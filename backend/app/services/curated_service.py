"""Service for enriching, grouping, and multi-tier caching of Curated Stock Lists.

Caching layers:
1. In-memory TTL cache (instant reads across repeat requests within a backend instance).
2. Firestore `curated_lists/{category_id}` persistent document cache.
3. Shared ticker enrichment:
   - First reuses full company records already stored in Firestore `companies/{ticker}` (0 API calls).
   - Next reuses lightweight cached ticker snapshots in Firestore `curated_ticker_snapshots/{ticker}`.
   - Only fetches Finnhub (`profile` + `metrics` + `financials-reported`) for uncached tickers,
     with polite rate-limit pacing and retry handling.
"""

from __future__ import annotations

from datetime import datetime, timedelta
import math
import statistics
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import pytz

from app.data.curated_lists import (
    MAX_COMPANIES_PER_CATEGORY,
    MAX_CURATED_CATEGORIES,
    get_catalog_categories,
    get_catalog_category,
)
from app.services.calculator import FinancialCalculator
from app.services.db_service import DBService
from app.services.finnhub_client import FinnhubClient
from app.services.report_service import (
    compute_big4_ttm,
    compute_ttm_cash_flow_and_growth,
)

CURATED_CACHE_SCHEMA_VERSION = 1
MEMORY_CACHE_TTL_SECONDS = 6 * 3600  # 6 hours in-process
LIST_CACHE_TTL_SECONDS = 5 * 60      # 5 minutes in-process catalog summary cache
FIRESTORE_CACHE_TTL_DAYS = 7         # 7 days persistent cache before background/auto refresh
TICKER_SNAPSHOT_TTL_DAYS = 7


def _to_finite_float(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    return num if math.isfinite(num) else None


def _to_positive_float(value: Any) -> Optional[float]:
    num = _to_finite_float(value)
    return num if (num is not None and num > 0) else None


def _round_opt(value: Optional[float], digits: int = 2) -> Optional[float]:
    if value is None or not math.isfinite(value):
        return None
    return round(float(value), digits)


def _parse_iso_utc(raw: Any) -> Optional[datetime]:
    if not raw or not isinstance(raw, str):
        return None
    try:
        cleaned = raw.strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            dt = pytz.utc.localize(dt)
        return dt.astimezone(pytz.utc)
    except ValueError:
        return None


def _format_pst_timestamp(dt_utc: Optional[datetime] = None) -> str:
    now = dt_utc or datetime.now(pytz.utc)
    pst_tz = pytz.timezone("US/Pacific")
    local_dt = now.astimezone(pst_tz)
    return local_dt.strftime("%-d %b %I:%M%p").lower()


def _dedupe_annual_history(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicate XBRL annual history by year, preferring non-zero values."""
    by_year: Dict[int, float] = {}
    for item in records or []:
        yr = item.get("year")
        val = _to_finite_float(item.get("value"))
        if not isinstance(yr, int) or val is None:
            continue
        existing = by_year.get(yr)
        if existing is None or (existing == 0.0 and val != 0.0) or (val != 0.0):
            by_year[yr] = val
    # Drop leading all-zero placeholder years (common on spin-offs like CEG)
    sorted_years = sorted(by_year.keys())
    trimmed: List[Dict[str, Any]] = []
    seen_non_zero = False
    for yr in sorted_years:
        val = by_year[yr]
        if not seen_non_zero and val == 0.0:
            continue
        seen_non_zero = True
        trimmed.append({"year": yr, "value": val})
    return trimmed


def _extract_series_annual_points(
    series_list: List[Dict[str, Any]],
    multiplier: float = 1.0,
    max_points: int = 6,
) -> List[Dict[str, Any]]:
    """Builds ascending annual [{"year": YYYY, "value": float}] from Finnhub series.annual."""
    by_year: Dict[int, float] = {}
    for item in series_list or []:
        period = item.get("period")
        val = _to_finite_float(item.get("v"))
        if not isinstance(period, str) or len(period) < 4 or val is None:
            continue
        try:
            yr = int(period[:4])
        except ValueError:
            continue
        if yr not in by_year:
            by_year[yr] = val * multiplier
    ordered = [{"year": yr, "value": by_year[yr]} for yr in sorted(by_year.keys())]
    return ordered[-max_points:]


def _safe_cagr_from_history(
    history: List[Dict[str, Any]],
    years_back: int,
    calc: FinancialCalculator,
) -> Optional[float]:
    if not history or len(history) <= years_back:
        return None
    end_val = _to_finite_float(history[-1].get("value"))
    start_val = _to_finite_float(history[-(years_back + 1)].get("value"))
    if start_val is None or end_val is None or start_val <= 0 or end_val <= 0:
        return None
    end_yr = history[-1].get("year")
    start_yr = history[-(years_back + 1)].get("year")
    span = (end_yr - start_yr) if (isinstance(end_yr, int) and isinstance(start_yr, int) and end_yr > start_yr) else years_back
    return calc.calculate_cagr(start_val, end_val, span)


def _classify_metric_trend(
    latest_val: Optional[float],
    history: List[Dict[str, Any]],
    cagr_1y: Optional[float],
    cagr_3y: Optional[float],
    cagr_5y: Optional[float],
) -> str:
    """Classifies a Big-4 metric trajectory into an intuitive directional label."""
    if latest_val is None and not history:
        return "unavailable"
    if latest_val is not None and latest_val < 0:
        return "negative"

    # Check turnaround (was negative recently, now positive)
    if latest_val is not None and latest_val > 0 and len(history) >= 2:
        earlier_vals = [pt["value"] for pt in history[-4:-1] if pt.get("value") is not None]
        if earlier_vals and any(v < 0 for v in earlier_vals) and (cagr_3y is None and cagr_5y is None):
            return "turnaround"

    anchor = cagr_3y if cagr_3y is not None else (cagr_5y if cagr_5y is not None else cagr_1y)
    if anchor is None:
        if len(history) >= 2:
            first_v = history[0]["value"]
            last_v = history[-1]["value"]
            if first_v < 0 < last_v:
                return "turnaround"
            if first_v > 0 and last_v > first_v * 1.15:
                return "growing"
            if first_v > 0 and last_v < first_v * 0.9:
                return "contracting"
        return "unavailable" if latest_val is None else "stable"

    if anchor >= 0.10:
        return "strong_growth"
    if anchor >= 0.02:
        return "growing"
    if anchor >= -0.02:
        return "stable"
    return "contracting"


def _latest_series_val(series_list: List[Dict[str, Any]]) -> Optional[float]:
    if not series_list:
        return None
    sorted_items = sorted(
        (item for item in series_list if isinstance(item, dict) and item.get("period")),
        key=lambda x: str(x.get("period", "")),
        reverse=True,
    )
    for item in sorted_items:
        val = _to_finite_float(item.get("v"))
        if val is not None:
            return val
    return None


def _avg_series_pct(series_list: List[Dict[str, Any]], years: int = 5) -> Optional[float]:
    if not series_list:
        return None
    sorted_items = sorted(
        (item for item in series_list if isinstance(item, dict) and item.get("period")),
        key=lambda x: str(x.get("period", "")),
        reverse=True,
    )
    vals = []
    for item in sorted_items[:years]:
        val = _to_finite_float(item.get("v"))
        if val is not None:
            vals.append(val * 100.0)
    if not vals:
        return None
    return sum(vals) / len(vals)


def extract_curated_company_metrics(
    ticker: str,
    raw_data: Dict[str, Any],
    calc: FinancialCalculator,
    has_full_report: bool = False,
    data_source: str = "company_report_cache",
) -> Dict[str, Any]:
    """Deterministically extracts Big 4 numbers/trends, ROIC, ROE, debt, cash, NI margin, and FCF margin."""
    profile = (raw_data or {}).get("profile") or {}
    metrics = (raw_data or {}).get("metrics") or {}
    financials = (raw_data or {}).get("financials") or {}
    metric_dict = metrics.get("metric") or {}
    series_annual = (metrics.get("series") or {}).get("annual") or {}
    series_quarterly = (metrics.get("series") or {}).get("quarterly") or {}
    raw_history = financials.get("history") or {}

    reporting_currency = (
        str(profile.get("currency") or profile.get("estimateCurrency") or "USD")
        .strip()
        .upper()
        or "USD"
    )

    shares_m = _to_positive_float(profile.get("shareOutstanding"))
    shares_out = shares_m * 1_000_000.0 if shares_m is not None else 0.0

    current_price = _to_positive_float(raw_data.get("price_at_storage"))
    mc_m = _to_positive_float(metric_dict.get("marketCapitalization")) or _to_positive_float(
        profile.get("marketCapitalization")
    )
    market_cap = mc_m * 1_000_000.0 if mc_m is not None else (
        current_price * shares_out if (current_price and shares_out > 0) else None
    )

    effective_shares = shares_out
    if effective_shares <= 0 and market_cap and current_price:
        effective_shares = market_cap / current_price
    if current_price is None and market_cap and effective_shares > 0:
        current_price = market_cap / effective_shares

    big4_ttm = compute_big4_ttm(
        financials=financials,
        metrics=metrics,
        effective_shares=effective_shares,
    )
    ttm_cf_growth = compute_ttm_cash_flow_and_growth(
        financials=financials,
        metrics=metrics,
        effective_shares=effective_shares,
    )

    # Deduplicated annual histories from SEC XBRL
    xbrl_histories = {
        "revenue": _dedupe_annual_history(raw_history.get("revenue", [])),
        "net_income": _dedupe_annual_history(raw_history.get("net_income", [])),
        "operating_cash_flow": _dedupe_annual_history(raw_history.get("operating_cash_flow", [])),
        "book_value": _dedupe_annual_history(raw_history.get("book_value", [])),
    }

    # Synthesize fallback histories from Finnhub annual series when XBRL is sparse (e.g. ADRs / spin-offs)
    fallback_histories: Dict[str, List[Dict[str, Any]]] = {
        "revenue": (
            _extract_series_annual_points(series_annual.get("salesPerShare", []), multiplier=effective_shares)
            if effective_shares > 0
            else []
        ),
        "net_income": (
            _extract_series_annual_points(series_annual.get("eps", []), multiplier=effective_shares)
            if effective_shares > 0
            else []
        ),
        "operating_cash_flow": [],
        "book_value": _extract_series_annual_points(
            series_annual.get("bookValue", []), multiplier=1_000_000.0
        ),
    }

    # Per-metric Finnhub fallback growth ratios (stored in % in Finnhub metric dict -> convert to ratio)
    def _pct_to_ratio(key: str) -> Optional[float]:
        v = _to_finite_float(metric_dict.get(key))
        return (v / 100.0) if v is not None else None

    metric_growth_fallbacks = {
        "revenue": (
            _pct_to_ratio("revenueGrowthTTMYoy"),
            _pct_to_ratio("revenueGrowth3Y"),
            _pct_to_ratio("revenueGrowth5Y"),
        ),
        "net_income": (
            _pct_to_ratio("epsGrowthTTMYoy"),
            _pct_to_ratio("epsGrowth3Y"),
            _pct_to_ratio("epsGrowth5Y"),
        ),
        "operating_cash_flow": (
            None,
            None,
            _pct_to_ratio("focfCagr5Y"),
        ),
        "book_value": (
            None,
            None,
            _pct_to_ratio("bookValueShareGrowth5Y"),
        ),
    }

    # Per-metric latest fallback using per-share TTM metrics
    def _per_share_fallback(key: str) -> Optional[float]:
        if effective_shares <= 0:
            return None
        val = _to_finite_float(metric_dict.get(key))
        return (val * effective_shares) if val is not None else None

    latest_per_share_fallbacks = {
        "revenue": _per_share_fallback("revenuePerShareTTM") or _per_share_fallback("revenuePerShareAnnual"),
        "net_income": _per_share_fallback("epsTTM") or _per_share_fallback("epsBasicExclExtraItemsTTM"),
        "operating_cash_flow": _per_share_fallback("cashFlowPerShareTTM") or _per_share_fallback("cashFlowPerShareAnnual"),
        "book_value": _per_share_fallback("bookValuePerShareQuarterly") or _per_share_fallback("bookValuePerShareAnnual"),
    }

    big4: Dict[str, Dict[str, Any]] = {}
    for metric_key in ("revenue", "net_income", "operating_cash_flow", "book_value"):
        hist = xbrl_histories[metric_key]
        if len(hist) < 2 and len(fallback_histories[metric_key]) >= 2:
            hist = fallback_histories[metric_key]

        ttm_entry = big4_ttm.get(metric_key) or {}
        ttm_val = _to_finite_float(ttm_entry.get("value"))
        if ttm_val is not None:
            latest_val = ttm_val
            period_type = ttm_entry.get("period_type") or ("MRQ" if metric_key == "book_value" else "TTM")
        elif hist:
            latest_val = hist[-1]["value"]
            period_type = f"FY{hist[-1]['year']}"
        else:
            latest_val = latest_per_share_fallbacks[metric_key]
            period_type = "MRQ" if metric_key == "book_value" else "TTM"

        c1 = _safe_cagr_from_history(hist, 1, calc)
        c3 = _safe_cagr_from_history(hist, 3, calc)
        c5 = _safe_cagr_from_history(hist, 5, calc)

        fb1, fb3, fb5 = metric_growth_fallbacks[metric_key]
        if c1 is None:
            c1 = fb1
        if c3 is None:
            c3 = fb3
        if c5 is None:
            c5 = fb5

        trend = _classify_metric_trend(latest_val, hist, c1, c3, c5)
        compact_hist = [
            {"year": pt["year"], "value": round(float(pt["value"]), 2)}
            for pt in hist[-6:]
        ]

        big4[metric_key] = {
            "latest": _round_opt(latest_val, 2),
            "period_type": period_type,
            "cagr_1y": _round_opt(c1, 4),
            "cagr_3y": _round_opt(c3, 4),
            "cagr_5y": _round_opt(c5, 4),
            "trend": trend,
            "history": compact_hist,
        }

    # ROIC (%)
    roic_pct = (
        _to_finite_float(metric_dict.get("roiTTM"))
        if _to_finite_float(metric_dict.get("roiTTM")) is not None
        else _to_finite_float(metric_dict.get("roicTTM"))
    )
    if roic_pct is None:
        roic_pct = _to_finite_float(metric_dict.get("roiAnnual"))
    if roic_pct is None:
        latest_roic_dec = _latest_series_val(series_quarterly.get("roicTTM", []))
        if latest_roic_dec is None:
            latest_roic_dec = _latest_series_val(series_annual.get("roic", []))
        if latest_roic_dec is not None:
            roic_pct = latest_roic_dec * 100.0

    roic_5y_avg_pct = _to_finite_float(metric_dict.get("roi5Y"))
    if roic_5y_avg_pct is None:
        roic_5y_avg_pct = _avg_series_pct(series_annual.get("roic", []), years=5)

    # ROE (%)
    roe_pct = _to_finite_float(metric_dict.get("roeTTM"))
    if roe_pct is None:
        roe_pct = _to_finite_float(metric_dict.get("roeRfy"))
    if roe_pct is None:
        latest_roe_dec = _latest_series_val(series_quarterly.get("roeTTM", []))
        if latest_roe_dec is None:
            latest_roe_dec = _latest_series_val(series_annual.get("roe", []))
        if latest_roe_dec is not None:
            roe_pct = latest_roe_dec * 100.0
    if roe_pct is None:
        ni_l = big4["net_income"]["latest"]
        bv_l = big4["book_value"]["latest"]
        if ni_l is not None and bv_l is not None and bv_l > 0:
            roe_pct = (ni_l / bv_l) * 100.0

    roe_5y_avg_pct = _to_finite_float(metric_dict.get("roe5Y"))
    if roe_5y_avg_pct is None:
        roe_5y_avg_pct = _avg_series_pct(series_annual.get("roe", []), years=5)

    # Total Debt ($)
    xbrl_debt = _to_finite_float(financials.get("latest_total_debt"))
    debt_to_eq = _to_finite_float(metric_dict.get("totalDebt/totalEquityQuarterly"))
    if debt_to_eq is None:
        debt_to_eq = _to_finite_float(metric_dict.get("totalDebt/totalEquityAnnual"))
    if debt_to_eq is None:
        debt_to_eq = _to_finite_float(metric_dict.get("longTermDebt/equityQuarterly"))

    bv_latest = big4["book_value"]["latest"]
    if xbrl_debt is not None and xbrl_debt > 0:
        total_debt: Optional[float] = xbrl_debt
    elif debt_to_eq is not None and bv_latest is not None and bv_latest > 0:
        total_debt = max(0.0, debt_to_eq * bv_latest)
    elif xbrl_debt is not None:
        total_debt = xbrl_debt
    else:
        total_debt = None

    # Cash & Equivalents ($)
    xbrl_cash = _to_finite_float(financials.get("latest_cash"))
    cash_ps = _to_finite_float(metric_dict.get("cashPerSharePerShareQuarterly"))
    if cash_ps is None:
        cash_ps = _to_finite_float(metric_dict.get("cashPerSharePerShareAnnual"))
    if cash_ps is None:
        cash_ps = _to_finite_float(metric_dict.get("cashPerShareQuarterly"))

    if xbrl_cash is not None and xbrl_cash > 0:
        cash_and_equivalents: Optional[float] = xbrl_cash
    elif cash_ps is not None and cash_ps >= 0 and effective_shares > 0:
        cash_and_equivalents = cash_ps * effective_shares
    elif xbrl_cash is not None:
        cash_and_equivalents = xbrl_cash
    else:
        cash_and_equivalents = None

    # Net Income Margin (%)
    ni_margin_pct = _to_finite_float(metric_dict.get("netProfitMarginTTM"))
    if ni_margin_pct is None:
        ni_margin_pct = _to_finite_float(metric_dict.get("netProfitMarginAnnual"))
    if ni_margin_pct is None:
        latest_nm_dec = _latest_series_val(series_annual.get("netMargin", []))
        if latest_nm_dec is not None:
            ni_margin_pct = latest_nm_dec * 100.0
    if ni_margin_pct is None:
        ni_l = big4["net_income"]["latest"]
        rev_l = big4["revenue"]["latest"]
        if ni_l is not None and rev_l is not None and rev_l > 0:
            ni_margin_pct = (ni_l / rev_l) * 100.0

    # FCF Margin (%)
    fcf_margin_pct: Optional[float] = None
    ttm_fcf_val = _to_finite_float((ttm_cf_growth.get("free_cash_flow") or {}).get("value"))
    ttm_rev_val = _to_finite_float((big4_ttm.get("revenue") or {}).get("value"))
    if ttm_fcf_val is not None and ttm_rev_val is not None and ttm_rev_val > 0:
        fcf_margin_pct = (ttm_fcf_val / ttm_rev_val) * 100.0

    if fcf_margin_pct is None:
        latest_fcfm_dec = _latest_series_val(series_annual.get("fcfMargin", []))
        if latest_fcfm_dec is None:
            latest_fcfm_dec = _latest_series_val(series_quarterly.get("fcfMargin", []))
        if latest_fcfm_dec is not None:
            fcf_margin_pct = latest_fcfm_dec * 100.0

    if fcf_margin_pct is None:
        ocf_hist = xbrl_histories["operating_cash_flow"]
        capex_hist = _dedupe_annual_history(raw_history.get("capex", []))
        rev_hist = xbrl_histories["revenue"]
        if ocf_hist and rev_hist and rev_hist[-1]["value"] > 0:
            cap_val = abs(capex_hist[-1]["value"]) if capex_hist else 0.0
            ann_fcf = ocf_hist[-1]["value"] - cap_val
            fcf_margin_pct = (ann_fcf / rev_hist[-1]["value"]) * 100.0

    # Guard against extreme numerical noise on pre-revenue firms (e.g. -50000% margin)
    if ni_margin_pct is not None and abs(ni_margin_pct) > 500:
        ni_margin_pct = max(-500.0, min(500.0, ni_margin_pct))
    if fcf_margin_pct is not None and abs(fcf_margin_pct) > 500:
        fcf_margin_pct = max(-500.0, min(500.0, fcf_margin_pct))

    return {
        "ticker": ticker.upper(),
        "company_name": profile.get("name") or raw_data.get("name") or ticker.upper(),
        "industry": profile.get("finnhubIndustry") or raw_data.get("industry") or "",
        "reporting_currency": reporting_currency,
        "current_price": _round_opt(current_price, 2),
        "market_cap": _round_opt(market_cap, 2),
        "big4": big4,
        "roic_pct": _round_opt(roic_pct, 2),
        "roic_5y_avg_pct": _round_opt(roic_5y_avg_pct, 2),
        "roe_pct": _round_opt(roe_pct, 2),
        "roe_5y_avg_pct": _round_opt(roe_5y_avg_pct, 2),
        "total_debt": _round_opt(total_debt, 2),
        "cash_and_equivalents": _round_opt(cash_and_equivalents, 2),
        "net_income_margin_pct": _round_opt(ni_margin_pct, 2),
        "fcf_margin_pct": _round_opt(fcf_margin_pct, 2),
        "has_full_report": bool(has_full_report),
        "data_source": data_source,
        "metrics_updated_at": datetime.now(pytz.utc).isoformat(),
    }


def _median_opt(values: List[Optional[float]]) -> Optional[float]:
    clean = [v for v in values if v is not None and math.isfinite(v)]
    if not clean:
        return None
    return round(float(statistics.median(clean)), 2)


class CuratedListService:
    """Orchestrates curated thematic categories with multi-tier caching and Finnhub fallback."""

    def __init__(
        self,
        db: DBService,
        finnhub: FinnhubClient,
        calc: FinancialCalculator,
        request_delay_seconds: float = 0.35,
    ):
        self.db = db
        self.finnhub = finnhub
        self.calc = calc
        self.request_delay_seconds = request_delay_seconds
        self._mem_lock = threading.Lock()
        self._category_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
        self._list_cache: Optional[Tuple[float, List[Dict[str, Any]]]] = None
        self._finnhub_lock = threading.Lock()
        self._last_finnhub_call_ts = 0.0

    def clear_memory_cache(self) -> None:
        with self._mem_lock:
            self._category_cache.clear()
            self._list_cache = None

    def _pace_finnhub_request(self) -> None:
        if self.request_delay_seconds <= 0:
            return
        with self._finnhub_lock:
            elapsed = time.monotonic() - self._last_finnhub_call_ts
            if elapsed < self.request_delay_seconds:
                time.sleep(self.request_delay_seconds - elapsed)
            self._last_finnhub_call_ts = time.monotonic()

    def _call_finnhub_with_retry(self, fn, *args, **kwargs):
        last_err = None
        for attempt in range(3):
            self._pace_finnhub_request()
            try:
                return fn(*args, **kwargs)
            except Exception as exc:
                last_err = exc
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                if status_code == 429 and attempt < 2:
                    time.sleep(2.5 * (attempt + 1))
                    continue
                raise
        raise last_err

    def _is_snapshot_fresh(self, doc: Dict[str, Any], ttl_days: int) -> bool:
        if not doc or doc.get("schema_version") != CURATED_CACHE_SCHEMA_VERSION:
            return False
        ts = _parse_iso_utc(doc.get("cached_at") or doc.get("metrics_updated_at") or doc.get("last_updated"))
        if ts is None:
            return False
        return (datetime.now(pytz.utc) - ts) < timedelta(days=ttl_days)

    def _is_valid_company_report(self, company_data: Dict[str, Any]) -> bool:
        if not isinstance(company_data, dict):
            return False
        metrics = company_data.get("metrics") or {}
        financials = company_data.get("financials") or {}
        has_metrics = bool((metrics.get("metric") or {}))
        has_fin = bool((financials.get("history") or {}).get("revenue"))
        return has_metrics or has_fin

    def _resolve_ticker_metrics(
        self,
        ticker: str,
        fallback_name: str,
        force_fresh: bool = False,
    ) -> Dict[str, Any]:
        norm_ticker = ticker.upper()

        # 1. Check full company report cache in Firestore first (zero API calls, marks report instant!)
        company_data = self.db.get_company_data(norm_ticker) if self.db else {}
        has_full_report = bool(
            company_data
            and "ai_analysis" in company_data
            and "financials" in company_data
            and isinstance(company_data.get("ai_analysis"), dict)
            and "error" not in company_data["ai_analysis"]
        )

        if not force_fresh and self._is_valid_company_report(company_data):
            extracted = extract_curated_company_metrics(
                ticker=norm_ticker,
                raw_data=company_data,
                calc=self.calc,
                has_full_report=has_full_report,
                data_source="company_report_cache",
            )
            if not extracted["company_name"] or extracted["company_name"] == norm_ticker:
                extracted["company_name"] = fallback_name
            return extracted

        # 2. Check lightweight curated ticker snapshot cache in Firestore
        if not force_fresh and self.db:
            snap = self.db.get_curated_ticker_snapshot(norm_ticker)
            if self._is_snapshot_fresh(snap, ttl_days=TICKER_SNAPSHOT_TTL_DAYS):
                snap["has_full_report"] = has_full_report
                if not snap.get("company_name") or snap["company_name"] == norm_ticker:
                    snap["company_name"] = fallback_name
                return snap

        # 3. Fetch lightweight quantitative data from Finnhub (profile + metrics + annual XBRL)
        try:
            profile = self._call_finnhub_with_retry(self.finnhub.get_profile, norm_ticker) or {}
            metrics = self._call_finnhub_with_retry(self.finnhub.get_metrics, norm_ticker) or {}
            try:
                financials = self._call_finnhub_with_retry(
                    self.finnhub.extract_key_metrics,
                    norm_ticker,
                    include_ttm=False,
                ) or {}
            except Exception as fin_exc:
                print(f"Optional XBRL annual fetch failed for curated ticker {norm_ticker}: {fin_exc}")
                financials = {}

            raw_light = {
                "ticker": norm_ticker,
                "name": profile.get("name") or fallback_name,
                "industry": profile.get("finnhubIndustry") or "",
                "profile": profile,
                "metrics": metrics,
                "financials": financials,
                "price_at_storage": None,
            }
            extracted = extract_curated_company_metrics(
                ticker=norm_ticker,
                raw_data=raw_light,
                calc=self.calc,
                has_full_report=has_full_report,
                data_source="finnhub_snapshot",
            )
            if not extracted["company_name"] or extracted["company_name"] == norm_ticker:
                extracted["company_name"] = fallback_name
            extracted["schema_version"] = CURATED_CACHE_SCHEMA_VERSION
            if self.db:
                self.db.save_curated_ticker_snapshot(norm_ticker, extracted)
            return extracted
        except Exception as exc:
            print(f"Curated Finnhub enrichment failed for {norm_ticker}: {exc}")
            # Fall back to cached company doc even if force_fresh failed, or clean empty placeholder
            if self._is_valid_company_report(company_data):
                return extract_curated_company_metrics(
                    ticker=norm_ticker,
                    raw_data=company_data,
                    calc=self.calc,
                    has_full_report=has_full_report,
                    data_source="company_report_cache",
                )
            empty_metric = {
                "latest": None,
                "period_type": "TTM",
                "cagr_1y": None,
                "cagr_3y": None,
                "cagr_5y": None,
                "trend": "unavailable",
                "history": [],
            }
            return {
                "ticker": norm_ticker,
                "company_name": fallback_name,
                "industry": "",
                "reporting_currency": "USD",
                "current_price": None,
                "market_cap": None,
                "big4": {
                    "revenue": dict(empty_metric),
                    "net_income": dict(empty_metric),
                    "operating_cash_flow": dict(empty_metric),
                    "book_value": {**empty_metric, "period_type": "MRQ"},
                },
                "roic_pct": None,
                "roic_5y_avg_pct": None,
                "roe_pct": None,
                "roe_5y_avg_pct": None,
                "total_debt": None,
                "cash_and_equivalents": None,
                "net_income_margin_pct": None,
                "fcf_margin_pct": None,
                "has_full_report": has_full_report,
                "data_source": "catalog_fallback",
                "metrics_updated_at": datetime.now(pytz.utc).isoformat(),
            }

    def list_categories(self) -> List[Dict[str, Any]]:
        """Lists all <= 10 curated categories with metadata, counts, and cache freshness."""
        now_mono = time.monotonic()
        with self._mem_lock:
            if self._list_cache and (now_mono - self._list_cache[0]) < LIST_CACHE_TTL_SECONDS:
                return list(self._list_cache[1])

        cached_map = self.db.list_curated_categories() if self.db else {}
        summaries: List[Dict[str, Any]] = []

        for cat in get_catalog_categories()[:MAX_CURATED_CATEGORIES]:
            companies = cat["companies"][:MAX_COMPANIES_PER_CATEGORY]
            established_count = sum(1 for c in companies if c.get("stage") == "established")
            future_count = sum(1 for c in companies if c.get("stage") == "future_potential")
            cached_doc = cached_map.get(cat["id"]) or {}
            is_cached = bool(
                cached_doc
                and cached_doc.get("schema_version") == CURATED_CACHE_SCHEMA_VERSION
                and cached_doc.get("buckets")
            )

            summaries.append({
                "id": cat["id"],
                "name": cat["name"],
                "short_name": cat["short_name"],
                "sector_focus": cat["sector_focus"],
                "icon": cat["icon"],
                "tagline": cat["tagline"],
                "description": cat["description"],
                "bucket_count": len(cat["buckets"]),
                "company_count": len(companies),
                "established_count": established_count,
                "future_potential_count": future_count,
                "preview_tickers": [c["ticker"] for c in companies[:6]],
                "supply_chain_stages": [
                    {
                        "id": b["id"],
                        "name": b["name"],
                        "supply_chain_role": b["supply_chain_role"],
                        "stage_order": b["stage_order"],
                    }
                    for b in sorted(cat["buckets"], key=lambda x: x["stage_order"])
                ],
                "is_cached": is_cached,
                "cached_at": cached_doc.get("cached_at") if is_cached else None,
                "cached_at_pst": cached_doc.get("cached_at_pst") if is_cached else None,
            })

        with self._mem_lock:
            self._list_cache = (now_mono, summaries)

        return summaries

    def get_category(
        self,
        category_id: str,
        force_fresh: bool = False,
    ) -> Optional[Dict[str, Any]]:
        """Returns a single enriched curated category grouped by supply chain, serving from cache when available."""
        cat_def = get_catalog_category(category_id)
        if not cat_def:
            return None

        norm_id = cat_def["id"]
        now_mono = time.monotonic()

        # Tier 1: In-memory TTL cache
        if not force_fresh:
            with self._mem_lock:
                mem_entry = self._category_cache.get(norm_id)
                if mem_entry and (now_mono - mem_entry[0]) < MEMORY_CACHE_TTL_SECONDS:
                    payload = dict(mem_entry[1])
                    payload["cache_source"] = "memory_cache"
                    return payload

        # Tier 2: Firestore persistent curated_lists cache
        if not force_fresh and self.db:
            fs_doc = self.db.get_curated_category(norm_id)
            if self._is_snapshot_fresh(fs_doc, ttl_days=FIRESTORE_CACHE_TTL_DAYS) and fs_doc.get("buckets"):
                fs_doc["cache_source"] = "firestore_cache"
                with self._mem_lock:
                    self._category_cache[norm_id] = (now_mono, fs_doc)
                return fs_doc

        # Tier 3: Build enriched category snapshot and persist to both caches
        built = self._build_and_cache_category(cat_def, force_fresh=force_fresh)
        return built

    def _build_and_cache_category(
        self,
        cat_def: Dict[str, Any],
        force_fresh: bool = False,
    ) -> Dict[str, Any]:
        companies_def = cat_def["companies"][:MAX_COMPANIES_PER_CATEGORY]
        buckets_by_id: Dict[str, Dict[str, Any]] = {}
        ordered_buckets = sorted(cat_def["buckets"], key=lambda b: b["stage_order"])

        for b in ordered_buckets:
            buckets_by_id[b["id"]] = {
                "id": b["id"],
                "name": b["name"],
                "stage_order": b["stage_order"],
                "supply_chain_role": b["supply_chain_role"],
                "description": b["description"],
                "companies": [],
            }

        all_enriched: List[Dict[str, Any]] = []
        for c_def in companies_def:
            ticker = c_def["ticker"].upper()
            metrics_snap = self._resolve_ticker_metrics(
                ticker=ticker,
                fallback_name=c_def["name"],
                force_fresh=force_fresh,
            )
            bucket_id = c_def["bucket_id"]
            bucket_meta = buckets_by_id.get(bucket_id)
            if bucket_meta is None:
                continue

            entry = {
                "ticker": ticker,
                "name": metrics_snap.get("company_name") or c_def["name"],
                "industry": metrics_snap.get("industry") or "",
                "bucket_id": bucket_id,
                "bucket_name": bucket_meta["name"],
                "supply_chain_role": bucket_meta["supply_chain_role"],
                "stage": c_def["stage"],
                "stage_label": "Established" if c_def["stage"] == "established" else "Future Potential",
                "stage_rationale": c_def["stage_rationale"],
                "overview": c_def["overview"],
                "reporting_currency": metrics_snap.get("reporting_currency", "USD"),
                "current_price": metrics_snap.get("current_price"),
                "market_cap": metrics_snap.get("market_cap"),
                "big4": metrics_snap.get("big4"),
                "roic_pct": metrics_snap.get("roic_pct"),
                "roic_5y_avg_pct": metrics_snap.get("roic_5y_avg_pct"),
                "roe_pct": metrics_snap.get("roe_pct"),
                "roe_5y_avg_pct": metrics_snap.get("roe_5y_avg_pct"),
                "total_debt": metrics_snap.get("total_debt"),
                "cash_and_equivalents": metrics_snap.get("cash_and_equivalents"),
                "net_income_margin_pct": metrics_snap.get("net_income_margin_pct"),
                "fcf_margin_pct": metrics_snap.get("fcf_margin_pct"),
                "has_full_report": bool(metrics_snap.get("has_full_report", False)),
                "data_source": metrics_snap.get("data_source", "catalog_fallback"),
                "metrics_updated_at": metrics_snap.get("metrics_updated_at"),
            }
            bucket_meta["companies"].append(entry)
            all_enriched.append(entry)

        # Attach bucket-level benchmark summaries
        buckets_payload: List[Dict[str, Any]] = []
        for b in ordered_buckets:
            bucket_obj = buckets_by_id[b["id"]]
            cos = bucket_obj["companies"]
            bucket_obj["company_count"] = len(cos)
            bucket_obj["established_count"] = sum(1 for c in cos if c["stage"] == "established")
            bucket_obj["future_potential_count"] = sum(1 for c in cos if c["stage"] == "future_potential")
            bucket_obj["median_roic_pct"] = _median_opt([c["roic_pct"] for c in cos])
            bucket_obj["median_roe_pct"] = _median_opt([c["roe_pct"] for c in cos])
            bucket_obj["median_ni_margin_pct"] = _median_opt([c["net_income_margin_pct"] for c in cos])
            bucket_obj["median_fcf_margin_pct"] = _median_opt([c["fcf_margin_pct"] for c in cos])
            buckets_payload.append(bucket_obj)

        now_utc = datetime.now(pytz.utc)
        payload: Dict[str, Any] = {
            "schema_version": CURATED_CACHE_SCHEMA_VERSION,
            "id": cat_def["id"],
            "name": cat_def["name"],
            "short_name": cat_def["short_name"],
            "sector_focus": cat_def["sector_focus"],
            "icon": cat_def["icon"],
            "tagline": cat_def["tagline"],
            "description": cat_def["description"],
            "company_count": len(all_enriched),
            "bucket_count": len(buckets_payload),
            "established_count": sum(1 for c in all_enriched if c["stage"] == "established"),
            "future_potential_count": sum(1 for c in all_enriched if c["stage"] == "future_potential"),
            "full_reports_cached_count": sum(1 for c in all_enriched if c["has_full_report"]),
            "summary": {
                "median_roic_pct": _median_opt([c["roic_pct"] for c in all_enriched]),
                "median_roe_pct": _median_opt([c["roe_pct"] for c in all_enriched]),
                "median_ni_margin_pct": _median_opt([c["net_income_margin_pct"] for c in all_enriched]),
                "median_fcf_margin_pct": _median_opt([c["fcf_margin_pct"] for c in all_enriched]),
            },
            "buckets": buckets_payload,
            "cached_at": now_utc.isoformat(),
            "cached_at_pst": _format_pst_timestamp(now_utc),
            "cache_source": "freshly_built",
        }

        if self.db:
            self.db.save_curated_category(cat_def["id"], payload)

        with self._mem_lock:
            self._category_cache[cat_def["id"]] = (time.monotonic(), payload)
            self._list_cache = None

        return payload
