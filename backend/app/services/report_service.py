import math
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
import pytz
from typing import Any, Dict, List, Optional

from app.services.finnhub_client import FinnhubClient
from app.services.calculator import FinancialCalculator
from app.services.analyst_service import AnalystService
from app.services.db_service import DBService


def _to_finite_float(value) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        num = float(value)
        return num if math.isfinite(num) else None
    if isinstance(value, str):
        cleaned = value.strip().replace("%", "").replace(",", "")
        if not cleaned:
            return None
        if "/" in cleaned:
            cleaned = cleaned.split("/", 1)[0].strip()
        try:
            num = float(cleaned)
            return num if math.isfinite(num) else None
        except ValueError:
            return None
    return None


def normalize_rating_to_5(value) -> Optional[float]:
    """
    Normalizes a CEO or employee rating onto a strict 0.0-5.0 scale so the numerator
    can never exceed 5.0 (even for legacy cached entries stored as 0-10 or 0-100).
    """
    num = _to_finite_float(value)
    if num is None or num <= 0:
        return None
    if num <= 5.0:
        scaled = num
    elif num <= 10.0:
        scaled = (num / 10.0) * 5.0
    elif num <= 100.0:
        scaled = (num / 100.0) * 5.0
    else:
        scaled = 5.0
    return round(min(5.0, max(0.0, scaled)), 1)


def normalize_percentage(value) -> Optional[int]:
    """Normalizes a percentage figure (e.g. CEO approval) onto an integer 0-100 scale."""
    num = _to_finite_float(value)
    if num is None or num <= 0:
        return None
    if num <= 1.0:
        num *= 100.0
    return int(round(min(100.0, max(0.0, num))))


def normalize_employee_sentiment(sentiment: Optional[dict]) -> dict:
    """Sanitizes and normalizes a grounded employee/CEO sentiment payload."""
    if not isinstance(sentiment, dict) or "error" in sentiment:
        return {}

    raw_ceo_rating = sentiment.get("ceo_employee_rating")
    raw_ceo_num = _to_finite_float(raw_ceo_rating)

    ceo_approval_pct = normalize_percentage(sentiment.get("ceo_approval_pct"))
    if ceo_approval_pct is None and raw_ceo_num is not None and 10.0 < raw_ceo_num <= 100.0:
        ceo_approval_pct = int(round(raw_ceo_num))

    ceo_rating = normalize_rating_to_5(raw_ceo_rating)
    if ceo_rating is None and ceo_approval_pct is not None:
        ceo_rating = round((ceo_approval_pct / 100.0) * 5.0, 1)

    emp_score = normalize_rating_to_5(sentiment.get("employee_happiness_score"))

    raw_tenure = _to_finite_float(sentiment.get("ceo_tenure_years"))
    ceo_tenure = None
    if raw_tenure is not None and 0 <= raw_tenure <= 80:
        rounded_tenure = round(raw_tenure, 1)
        ceo_tenure = int(rounded_tenure) if rounded_tenure.is_integer() else rounded_tenure

    raw_sources = sentiment.get("grounding_sources")
    clean_sources = []
    if isinstance(raw_sources, list):
        for src in raw_sources:
            if isinstance(src, dict) and isinstance(src.get("url"), str) and src["url"].strip():
                clean_sources.append({
                    "title": str(src.get("title") or src["url"]).strip(),
                    "url": src["url"].strip(),
                })

    raw_queries = sentiment.get("search_queries")
    clean_queries = (
        [q.strip() for q in raw_queries if isinstance(q, str) and q.strip()]
        if isinstance(raw_queries, list)
        else []
    )

    ceo_name = sentiment.get("ceo_name")
    ceo_name = ceo_name.strip() if isinstance(ceo_name, str) and ceo_name.strip() else None

    review_count = sentiment.get("review_count")
    review_count = (
        review_count.strip()
        if isinstance(review_count, str) and review_count.strip()
        else None
    )

    source_platform = sentiment.get("source_platform")
    source_platform = (
        source_platform.strip()
        if isinstance(source_platform, str) and source_platform.strip()
        else None
    )

    notes = sentiment.get("notes")
    notes = notes.strip() if isinstance(notes, str) and notes.strip() else None

    normalized = {
        "ceo_name": ceo_name,
        "ceo_tenure_years": ceo_tenure,
        "ceo_approval_pct": ceo_approval_pct,
        "ceo_employee_rating": ceo_rating,
        "employee_happiness_score": emp_score,
        "review_count": review_count,
        "source_platform": source_platform,
        "notes": notes,
        "grounding_sources": clean_sources,
        "search_queries": clean_queries,
        "grounded": bool(sentiment.get("grounded") or clean_sources or clean_queries),
    }
    if sentiment.get("generated_at"):
        normalized["generated_at"] = sentiment["generated_at"]
    return normalized


def merge_management_data(
    ai_management: Optional[dict],
    grounded_sentiment: Optional[dict] = None,
) -> dict:
    """
    Merges qualitative management fields with Google-Search-grounded employee/CEO sentiment
    and guarantees all 5-point ratings stay strictly within [0.0, 5.0].
    """
    merged = dict(ai_management) if isinstance(ai_management, dict) else {}

    legacy_ceo_raw = merged.get("ceo_employee_rating")
    legacy_ceo_num = _to_finite_float(legacy_ceo_raw)
    legacy_approval_pct = (
        int(round(legacy_ceo_num))
        if legacy_ceo_num is not None and 10.0 < legacy_ceo_num <= 100.0
        else None
    )

    ceo_rating = normalize_rating_to_5(legacy_ceo_raw)
    emp_score = normalize_rating_to_5(merged.get("employee_happiness_score"))
    ceo_approval_pct = normalize_percentage(merged.get("ceo_approval_pct")) or legacy_approval_pct

    norm_grounded = normalize_employee_sentiment(grounded_sentiment)
    if norm_grounded:
        if norm_grounded.get("ceo_name"):
            merged["ceo_name"] = norm_grounded["ceo_name"]
        if norm_grounded.get("ceo_tenure_years") is not None:
            merged["ceo_tenure_years"] = norm_grounded["ceo_tenure_years"]
        if norm_grounded.get("ceo_approval_pct") is not None:
            ceo_approval_pct = norm_grounded["ceo_approval_pct"]
        if norm_grounded.get("ceo_employee_rating") is not None:
            ceo_rating = norm_grounded["ceo_employee_rating"]
        if norm_grounded.get("employee_happiness_score") is not None:
            emp_score = norm_grounded["employee_happiness_score"]
        if norm_grounded.get("review_count"):
            merged["review_count"] = norm_grounded["review_count"]
        if norm_grounded.get("source_platform"):
            merged["sentiment_source"] = norm_grounded["source_platform"]
        if norm_grounded.get("notes"):
            merged["sentiment_notes"] = norm_grounded["notes"]
        merged["sentiment_sources"] = norm_grounded.get("grounding_sources", [])
        merged["sentiment_grounded"] = bool(norm_grounded.get("grounded", False))
        if norm_grounded.get("generated_at"):
            merged["sentiment_generated_at"] = norm_grounded["generated_at"]
    else:
        merged.setdefault("sentiment_grounded", False)

    merged["ceo_employee_rating"] = ceo_rating
    merged["employee_happiness_score"] = emp_score
    if ceo_approval_pct is not None:
        merged["ceo_approval_pct"] = ceo_approval_pct

    return merged


def _to_positive_float(val: Any) -> Optional[float]:
    num = _to_finite_float(val)
    return num if (num is not None and num > 0) else None


def _parse_iso_date(raw_date: Any) -> Optional[date]:
    if not raw_date or not isinstance(raw_date, str):
        return None
    try:
        return date.fromisoformat(raw_date.strip()[:10])
    except ValueError:
        return None


def compute_big4_ttm(
    financials: dict,
    metrics: dict,
    effective_shares: float = 0.0,
) -> Dict[str, Dict[str, Any]]:
    """Computes Big 4 TTM (Revenue, Net Income, Operating Cash Flow) and MRQ (Book Value).

    Combines direct SEC XBRL quarterly/annual TTM (`financials["ttm"]`) with Finnhub
    `metrics` TTM/quarterly derivations so both freshly fetched and already-cached
    companies receive accurate TTM values, while preferring whichever source is fresher
    (or direct XBRL when periods match). Includes freshness guards to reject stale
    Finnhub book-value series on negative-equity companies.
    """
    xbrl_ttm = (financials or {}).get("ttm") or {}
    history = (financials or {}).get("history") or {}
    metric_dict = (metrics or {}).get("metric") or {}
    series_quarterly = ((metrics or {}).get("series") or {}).get("quarterly") or {}

    latest_flow_dt: Optional[date] = None
    latest_flow_period: Optional[str] = None
    for series_key in ("eps", "salesPerShare", "netMargin", "ev"):
        for item in series_quarterly.get(series_key) or []:
            dt = _parse_iso_date(item.get("period"))
            if dt and (latest_flow_dt is None or dt > latest_flow_dt):
                latest_flow_dt = dt
                latest_flow_period = dt.isoformat()

    mc_millions = _to_positive_float(metric_dict.get("marketCapitalization"))
    mc_dollars = mc_millions * 1_000_000.0 if mc_millions is not None else None
    shares = effective_shares if (effective_shares and effective_shares > 0) else 0.0

    metrics_candidates: Dict[str, Dict[str, Any]] = {}

    # 1. Revenue TTM from Finnhub metrics
    rev_val: Optional[float] = None
    ps_ttm = _to_positive_float(metric_dict.get("psTTM"))
    if mc_dollars is not None and ps_ttm is not None:
        rev_val = mc_dollars / ps_ttm
    else:
        rev_per_share = _to_finite_float(metric_dict.get("revenuePerShareTTM"))
        if rev_per_share is not None and shares > 0:
            rev_val = rev_per_share * shares

    if rev_val is not None:
        metrics_candidates["revenue"] = {
            "value": rev_val,
            "period": latest_flow_period,
            "period_type": "TTM",
            "source": "finnhub_metrics",
        }

    # 2. Net Income TTM from Finnhub metrics (supports negative earnings via netProfitMarginTTM / epsTTM)
    ni_val: Optional[float] = None
    pe_ttm = _to_positive_float(metric_dict.get("peTTM")) or _to_positive_float(metric_dict.get("peExclExtraTTM"))
    if mc_dollars is not None and pe_ttm is not None:
        ni_val = mc_dollars / pe_ttm
    else:
        npm_ttm = _to_finite_float(metric_dict.get("netProfitMarginTTM"))
        if rev_val is not None and rev_val > 0 and npm_ttm is not None:
            ni_val = rev_val * (npm_ttm / 100.0)
        else:
            eps_raw = metric_dict.get("epsTTM")
            if eps_raw is None:
                eps_raw = metric_dict.get("epsBasicExclExtraItemsTTM")
            eps_ttm = _to_finite_float(eps_raw)
            if eps_ttm is not None and shares > 0:
                ni_val = eps_ttm * shares

    if ni_val is not None:
        metrics_candidates["net_income"] = {
            "value": ni_val,
            "period": latest_flow_period,
            "period_type": "TTM",
            "source": "finnhub_metrics",
        }

    # 3. Operating Cash Flow TTM from Finnhub metrics (pcfShareTTM is Price/OCF; do not confuse with pfcfShareTTM)
    pcf_ttm = _to_positive_float(metric_dict.get("pcfShareTTM"))
    if mc_dollars is not None and pcf_ttm is not None:
        metrics_candidates["operating_cash_flow"] = {
            "value": mc_dollars / pcf_ttm,
            "period": latest_flow_period,
            "period_type": "TTM",
            "source": "finnhub_metrics",
        }

    # 4. Book Value MRQ (Stockholders' Equity snapshot) from Finnhub metrics with staleness guard
    bv_hist = history.get("book_value") or []
    latest_annual_bv_year = bv_hist[-1].get("year") if bv_hist else None
    latest_annual_bv_val = _to_finite_float(bv_hist[-1].get("value")) if bv_hist else None

    bv_series = series_quarterly.get("bookValue") or []
    latest_bv_dt: Optional[date] = None
    latest_bv_val_m: Optional[float] = None
    for item in bv_series:
        dt = _parse_iso_date(item.get("period"))
        v_num = _to_finite_float(item.get("v"))
        if dt is not None and v_num is not None and (latest_bv_dt is None or dt > latest_bv_dt):
            latest_bv_dt = dt
            latest_bv_val_m = v_num

    if latest_bv_dt is not None and latest_bv_val_m is not None:
        is_stale = False
        if isinstance(latest_annual_bv_year, int) and latest_bv_dt.year < latest_annual_bv_year:
            is_stale = True
        if latest_flow_dt is not None and (latest_flow_dt - latest_bv_dt).days > 200:
            is_stale = True

        if not is_stale:
            metrics_candidates["book_value"] = {
                "value": latest_bv_val_m * 1_000_000.0,
                "period": latest_bv_dt.isoformat(),
                "period_type": "MRQ",
                "source": "finnhub_metrics",
            }
    elif not bv_series:
        bvps_q = _to_finite_float(metric_dict.get("bookValuePerShareQuarterly"))
        if bvps_q is not None and shares > 0:
            if latest_annual_bv_val is None or latest_annual_bv_val >= 0 or bvps_q < 0:
                metrics_candidates["book_value"] = {
                    "value": bvps_q * shares,
                    "period": latest_flow_period,
                    "period_type": "MRQ",
                    "source": "finnhub_metrics",
                }

    result: Dict[str, Dict[str, Any]] = {}
    for metric_key in ("revenue", "net_income", "operating_cash_flow", "book_value"):
        default_period_type = "MRQ" if metric_key == "book_value" else "TTM"
        raw_x = xbrl_ttm.get(metric_key)
        x_entry = None
        if isinstance(raw_x, dict):
            x_val = _to_finite_float(raw_x.get("value"))
            if x_val is not None:
                x_entry = {
                    "value": x_val,
                    "period": raw_x.get("period"),
                    "period_type": raw_x.get("period_type") or default_period_type,
                    "source": raw_x.get("source") or "xbrl_quarterly",
                }

        m_entry = metrics_candidates.get(metric_key)

        if x_entry and m_entry:
            x_dt = _parse_iso_date(x_entry.get("period"))
            m_dt = _parse_iso_date(m_entry.get("period"))
            if x_dt and m_dt and (m_dt - x_dt).days > 15:
                result[metric_key] = m_entry
            else:
                result[metric_key] = x_entry
        elif x_entry:
            result[metric_key] = x_entry
        elif m_entry:
            result[metric_key] = m_entry
        else:
            result[metric_key] = {
                "value": None,
                "period": None,
                "period_type": default_period_type,
                "source": "unavailable",
            }

    return result

def build_growth_analysis_context(ticker: str, name: str, financials: dict, metrics: dict, profile: dict, current_price: float) -> dict:
    history = financials.get("history", {})
    ocf_list = history.get("operating_cash_flow", [])
    capex_list = history.get("capex", [])
    fcf_history = []
    for i in range(len(ocf_list)):
        year = ocf_list[i]["year"]
        ocf_val = ocf_list[i]["value"]
        capex_val = capex_list[i]["value"] if i < len(capex_list) else 0.0
        fcf_history.append({"year": year, "value": ocf_val - abs(capex_val)})
        
    shares_out = profile.get("shareOutstanding", 0) * 1000000
    market_cap = current_price * shares_out if shares_out else metrics.get("metric", {}).get("marketCapitalization", 0) * 1000000

    return {
        "name": name,
        "ticker": ticker,
        "revenue_history": history.get("revenue", []),
        "operating_cash_flow_history": ocf_list,
        "free_cash_flow_history": fcf_history,
        "net_income_history": history.get("net_income", []),
        "eps_history": history.get("eps", []),
        "latest_cash": financials.get("latest_cash", 0),
        "latest_total_debt": financials.get("latest_total_debt", 0),
        "market_cap": market_cap
    }


def build_business_model_context(ticker: str, name: str, financials: dict, metrics: dict, profile: dict, current_price: float) -> dict:
    history = (financials or {}).get("history", {})
    metric_dict = (metrics or {}).get("metric", {}) or {}
    profile_dict = profile or {}

    revenue_history = history.get("revenue", [])[-5:]
    net_income_history = history.get("net_income", [])[-5:]
    ocf_history = history.get("operating_cash_flow", [])[-5:]
    capex_history = history.get("capex", [])[-5:]

    shares_out = profile_dict.get("shareOutstanding", 0) * 1000000
    market_cap = (
        current_price * shares_out
        if shares_out
        else metric_dict.get("marketCapitalization", 0) * 1000000
    )

    margin_and_efficiency_metrics = {
        key: metric_dict[key]
        for key in (
            "grossMarginTTM",
            "grossMarginAnnual",
            "operatingMarginTTM",
            "operatingMarginAnnual",
            "netProfitMarginTTM",
            "netProfitMarginAnnual",
            "roicTTM",
            "roeTTM",
            "revenueGrowthTTMYoy",
            "revenueGrowth5Y",
            "inventoryTurnoverTTM",
            "receivablesTurnoverTTM",
            "assetTurnoverTTM",
        )
        if key in metric_dict and metric_dict[key] is not None
    }

    return {
        "ticker": ticker,
        "name": name,
        "industry": profile_dict.get("finnhubIndustry", "Unknown"),
        "country": profile_dict.get("country", ""),
        "exchange": profile_dict.get("exchange", ""),
        "market_cap": market_cap,
        "revenue_history_recent": revenue_history,
        "net_income_history_recent": net_income_history,
        "operating_cash_flow_history_recent": ocf_history,
        "capex_history_recent": capex_history,
        "latest_cash": (financials or {}).get("latest_cash", 0),
        "latest_total_debt": (financials or {}).get("latest_total_debt", 0),
        "margin_and_efficiency_metrics": margin_and_efficiency_metrics,
    }


def compute_report_from_raw(raw_data: dict, calc: FinancialCalculator) -> dict:
    ticker = raw_data.get("ticker", "Unknown")
    combined_tags = raw_data.get("tags", [])
    profile = raw_data.get("profile", {})
    metrics = raw_data.get("metrics", {})
    financials = raw_data.get("financials", {})
    ai_analysis = raw_data.get("ai_analysis", {})
    current_price = raw_data.get("price_at_storage", 0.0)
    timestamp_pst = raw_data.get("last_updated_pst", "")
    
    history = financials.get("history", {})
    
    latest_eps = metrics.get("metric", {}).get("epsBasicExclExtraItemsTTM", 0.0)
    shares_out = profile.get("shareOutstanding", 0) * 1000000
    market_cap = current_price * shares_out if shares_out else metrics.get("metric", {}).get("marketCapitalization", 0) * 1000000
    effective_shares = shares_out if shares_out > 0 else (market_cap / current_price if current_price > 0 and market_cap > 0 else 0.0)

    growth_rates = {
        "revenue": list(calc.calculate_growth_rates(history.get("revenue", [])).values()),
        "net_income": list(calc.calculate_growth_rates(history.get("net_income", [])).values()),
        "book_value": list(calc.calculate_growth_rates(history.get("book_value", [])).values()),
        "operating_cash_flow": list(calc.calculate_growth_rates(history.get("operating_cash_flow", [])).values())
    }
    big4_ttm = compute_big4_ttm(
        financials=financials,
        metrics=metrics,
        effective_shares=effective_shares,
    )
    
    fcf_history = []
    ocf_list = history.get("operating_cash_flow", [])
    capex_list = history.get("capex", [])
    for i in range(len(ocf_list)):
        year = ocf_list[i]["year"]
        ocf_val = ocf_list[i]["value"]
        capex_val = capex_list[i]["value"] if i < len(capex_list) else 0.0
        fcf_val = ocf_val - abs(capex_val)
        fcf_history.append({"year": year, "value": fcf_val})

    raw_windage_gr, windage_rationale, computation_windage_details = calc.calculate_windage_growth_rate(ocf_list)
    historical_label = (
        f"{computation_windage_details.get('years')}Y OCF CAGR"
        if computation_windage_details.get("years")
        else "Historical OCF CAGR"
    )

    windage_fallback_message = None
    if raw_windage_gr < 0:
        # OCF CAGR was negative or undefined — fall back to Net Income CAGR.
        # Try progressively shorter windows (10yr → 5yr → 3yr → 1yr) since
        # companies like Uber may have had negative NI in earlier years too.
        ni_rates = growth_rates["net_income"]  # [1_yr, 3_yr, 5_yr, 10_yr]
        ni_cagr = 0.0
        window_labels = ["1-year", "3-year", "5-year", "10-year"]
        chosen_label = None
        for idx in [3, 2, 1, 0]:  # Prefer longest window first
            if idx < len(ni_rates) and ni_rates[idx] > 0:
                ni_cagr = ni_rates[idx]
                chosen_label = window_labels[idx]
                break
        raw_windage_gr = ni_cagr
        if chosen_label:
            historical_label = f"{chosen_label.capitalize()} Net Income CAGR (Fallback)"
            windage_rationale = f"Windage growth rate was negative, so the {chosen_label} Net Income growth rate ({raw_windage_gr:.2%}) was used instead."
            windage_fallback_message = f"The {chosen_label} Net Income growth rate was used for the windage growth."
        else:
            historical_label = "No Positive Historical Growth"
            windage_rationale = f"Windage growth rate was negative and no positive Net Income growth rate was available. Defaulting to 0%."
            windage_fallback_message = "No positive growth rate was available from either OCF or Net Income history."
        computation_windage_details = {
            "steps": [],
            "stats": {"mean": raw_windage_gr, "stdev": 0.0, "lower_bound": raw_windage_gr, "upper_bound": raw_windage_gr, "is_filtered": False},
            "final_rate": raw_windage_gr
        }

    # Combined Method: Anchor Year-1 growth (OCF vs Forward Consensus vs Revenue+5% vs 40% cap)
    # and linearly decay toward 12% terminal rate over 10 years when starting growth > 12%.
    metric_dict = metrics.get("metric", {})
    rev_list = history.get("revenue", [])
    rev_cagr, rev_years, rev_start_yr, rev_end_yr = calc.calculate_longest_cagr(rev_list, max_years=10)

    growth_projection = calc.calculate_combined_growth_projection(
        historical_gr=raw_windage_gr,
        historical_label=historical_label,
        forward_pe=metric_dict.get("forwardPE"),
        forward_peg=metric_dict.get("forwardPEG"),
        revenue_cagr=rev_cagr,
        revenue_years=rev_years,
        revenue_start_year=rev_start_yr,
        revenue_end_year=rev_end_yr,
    )
    windage_gr = growth_projection["effective_cagr"]
    yearly_growth_rates = [item["rate"] for item in growth_projection["yearly_schedule"]]
    computation_windage_details["raw_historical_rate"] = growth_projection["raw_historical_rate"]
    computation_windage_details["final_rate"] = windage_gr
    computation_windage_details["projection"] = growth_projection
    if growth_projection["was_anchored"] or growth_projection["decay_applied"]:
        windage_rationale = f"{windage_rationale} Combined adjustment: {growth_projection['adjustment_summary']}"

    ni_list = history.get("net_income", [])
    da_list = history.get("da", [])
    wc_change_list = history.get("working_capital_change", [])
    da_by_year = {item["year"]: item["value"] for item in da_list if "year" in item}
    capex_by_year = {item["year"]: item["value"] for item in capex_list if "year" in item}
    wc_change_by_year = {item["year"]: item for item in wc_change_list if "year" in item}

    owner_earnings_history = []
    for ni_item in ni_list:
        yr = ni_item.get("year")
        ni_v = ni_item.get("value", 0.0)
        da_v = da_by_year.get(yr, 0.0)
        wc_entry = wc_change_by_year.get(yr)
        wc_v = wc_entry.get("value", 0.0) if wc_entry else 0.0
        wc_src = wc_entry.get("source", "balance_sheet") if wc_entry else "unavailable"
        capex_v = abs(capex_by_year.get(yr, 0.0))
        oe_v = ni_v + da_v - wc_v - capex_v
        owner_earnings_history.append({
            "year": yr,
            "net_income": ni_v,
            "da": da_v,
            "working_capital_change": wc_v,
            "working_capital_source": wc_src,
            "capex": capex_v,
            "owner_earnings": oe_v,
            "owners_value": oe_v * 10 if oe_v > 0 else 0.0
        })

    latest_ni_item = ni_list[-1] if ni_list else None
    latest_net_income = latest_ni_item["value"] if latest_ni_item else 0
    latest_oe_year = latest_ni_item["year"] if latest_ni_item else "TTM"
    latest_da = da_by_year.get(latest_oe_year, da_list[-1]["value"] if da_list else 0) if latest_ni_item else (da_list[-1]["value"] if da_list else 0)
    latest_capex_for_oe = capex_by_year.get(latest_oe_year, capex_list[-1]["value"] if capex_list else 0) if latest_ni_item else (capex_list[-1]["value"] if capex_list else 0)
    latest_wc_entry = wc_change_by_year.get(latest_oe_year) if latest_ni_item else (wc_change_list[-1] if wc_change_list else None)
    latest_wc_change = latest_wc_entry.get("value", 0.0) if latest_wc_entry else 0.0
    latest_wc_source = latest_wc_entry.get("source", "balance_sheet") if latest_wc_entry else "unavailable"
    latest_capex = capex_list[-1]["value"] if capex_list else 0
    latest_fcf = ocf_list[-1]["value"] - abs(latest_capex) if ocf_list else 0
    latest_fcf_year = ocf_list[-1]["year"] if ocf_list else "TTM"

    series_annual = metrics.get("series", {}).get("annual", {})
    roe_history = list(reversed(series_annual.get("roe", [])))
    roic_history = list(reversed(series_annual.get("roic", [])))

    pe_history = series_annual.get("pe", [])
    windage_pe, computation_pe_details = calc.calculate_conservative_exit_pe(
        pe_history_records=pe_history,
        terminal_gr=growth_projection["terminal_rate"],
        fallback_pe_ttm=metric_dict.get("peExclExtraTTM"),
    )

    roe_averages = calc.calculate_averages(roe_history)
    roic_averages = calc.calculate_averages(roic_history)

    # Rule of 40 and EV/Revenue
    if len(rev_list) >= 2 and rev_list[-2]["value"] > 0:
        latest_revenue = rev_list[-1]["value"]
        latest_revenue_year = rev_list[-1]["year"]
        previous_revenue = rev_list[-2]["value"]
        revenue_growth_1yr = (latest_revenue / previous_revenue) - 1
    else:
        latest_revenue = rev_list[-1]["value"] if len(rev_list) >= 1 else 0
        latest_revenue_year = rev_list[-1]["year"] if len(rev_list) >= 1 else "TTM"
        revenue_growth_1yr = 0.0

    fcf_margin = latest_fcf / latest_revenue if latest_revenue > 0 else 0.0
    rule_of_40 = (revenue_growth_1yr + fcf_margin) * 100

    cash_and_equivalents = financials.get("latest_cash", 0)
    total_debt = financials.get("latest_total_debt", 0)
    enterprise_value = market_cap + total_debt - cash_and_equivalents
    ev_to_revenue = enterprise_value / latest_revenue if latest_revenue > 0 else 0.0

    owner_earnings, cap_rate, cap_rationale, owners_value_details = calc.calculate_10_cap(
        latest_net_income,
        latest_da,
        latest_capex_for_oe,
        market_cap,
        shares_outstanding=effective_shares,
        fiscal_year=str(latest_oe_year),
        working_capital_change=latest_wc_change,
        working_capital_source=latest_wc_source,
    )
    owners_value_details["history"] = owner_earnings_history[-10:]
    payback_years, projected_fcf, payback_rationale = calc.calculate_payback_time(
        latest_fcf,
        windage_gr,
        market_cap,
        str(latest_fcf_year),
        yearly_growth_rates=yearly_growth_rates,
        growth_projection=growth_projection,
    )
    mos_price, mos_details = calc.calculate_margin_of_safety(
        latest_eps,
        windage_gr,
        windage_pe,
        yearly_growth_rates=yearly_growth_rates,
        growth_projection=growth_projection,
        pe_details=computation_pe_details,
        shares_outstanding=effective_shares,
    )

    return {
        "ticker": ticker,
        "tags": combined_tags,
        "name": profile.get("name", ticker),
        "industry": profile.get("finnhubIndustry", "Unknown"),
        "overview": ai_analysis.get("overview", "No overview available."),
        "sector": ai_analysis.get("sector", "Unknown"),
        "subsector": ai_analysis.get("subsector", "Unknown"),
        "industry_group": ai_analysis.get("industry_group", "Unknown"),
        "price_at_storage": current_price,
        "last_updated_pst": timestamp_pst,
        "financials": {
            "raw_data": {
                "revenue_history": history.get("revenue", []),
                "net_income_history": history.get("net_income", []),
                "book_value_history": history.get("book_value", []),
                "operating_cash_flow_history": ocf_list,
                "eps_history": history.get("eps", []),
                "roe_history": roe_history,
                "roic_history": roic_history,
                "total_debt": financials.get("latest_total_debt", 0),
                "cash_and_equivalents": financials.get("latest_cash", 0),
                "big4_ttm": big4_ttm
            },
            "derived_metrics": {
                "growth_rates_1_3_5_10_yr": growth_rates,
                "computation_growth_rates": "Calculated using CAGR formula (Ending Value / Beginning Value)^(1/Years) - 1.",
                "raw_windage_growth_rate": growth_projection["raw_historical_rate"],
                "windage_growth_rate": windage_gr,
                "computation_windage": windage_rationale,
                "computation_windage_details": computation_windage_details,
                "debt_payoff_years": financials.get("latest_total_debt", 0) / latest_fcf if latest_fcf > 0 else 0,
                "computation_debt_payoff": f"Total Debt / Current Annual FCF",
                "rule_of_40": rule_of_40,
                "computation_rule_of_40_details": {
                    "revenue_growth_1yr": revenue_growth_1yr,
                    "fcf_margin": fcf_margin,
                    "latest_revenue": latest_revenue,
                    "latest_fcf": latest_fcf,
                    "latest_year": str(latest_revenue_year),
                    "explanation": "Score > 40 indicates a healthy balance of growth and profitability."
                },
                "ev_to_revenue": ev_to_revenue,
                "computation_ev_to_revenue_details": {
                    "enterprise_value": enterprise_value,
                    "latest_revenue": latest_revenue,
                    "latest_year": str(latest_revenue_year),
                    "explanation": "Measures how much it costs to buy the company's sales."
                }
            },
            "valuations": {
                "margin_of_safety_price": mos_price,
                "windage_raw_growth_rate": growth_projection["raw_historical_rate"],
                "windage_start_growth_rate": growth_projection["start_rate"],
                "windage_terminal_growth_rate": growth_projection["terminal_rate"],
                "windage_growth_rate_used": windage_gr,
                "windage_pe_used": windage_pe,
                "marr_used": 0.15,
                "computation_mos_details": mos_details,
                "computation_pe_details": computation_pe_details,
                "computation_windage_details": computation_windage_details,
                "computation_growth_projection": growth_projection,
                "payback_time_years": payback_years,
                "projected_fcf_per_year": projected_fcf,
                "computation_payback_details": payback_rationale,
                "owner_earnings": owner_earnings,
                "owners_value": owners_value_details["owners_value"],
                "owners_value_per_share": owners_value_details["owners_value_per_share"],
                "cap_rate": cap_rate,
                "computation_10_cap": cap_rationale,
                "computation_owners_value_details": owners_value_details,
                "market_cap": market_cap,
                "windage_fallback_message": windage_fallback_message
            }
        },
        "qualitative": {
            "sources": ai_analysis.get("sources", {}),
            "business_model": (
                (raw_data.get("context") or {}).get("business_model_analysis")
                or ai_analysis.get("business_model")
                or {}
            ),
            "growth_plans": ai_analysis.get("growth_plans", {}),
            "competitors": ai_analysis.get("competitors", {}),
            "risks": ai_analysis.get("risks", {}),
            "moats": ai_analysis.get("moats", {}),
            "management": {
                **merge_management_data(
                    ai_analysis.get("management", {}),
                    (raw_data.get("context") or {}).get("employee_sentiment"),
                ),
                "roic_3_yr_avg": roic_averages.get("3_yr", 0),
                "roic_5_yr_avg": roic_averages.get("5_yr", 0),
                "roic_10_yr_avg": roic_averages.get("10_yr", 0),
                "roe_3_yr_avg": roe_averages.get("3_yr", 0),
                "roe_5_yr_avg": roe_averages.get("5_yr", 0),
                "roe_10_yr_avg": roe_averages.get("10_yr", 0)
            }
        },
        "context": {
            "market_and_bias": ai_analysis.get("market_and_bias", {})
        }
    }


def generate_and_cache_report(ticker: str, finnhub: FinnhubClient, calc: FinancialCalculator, ai: AnalystService, db: DBService, force_fresh: bool = False, tags: List[str] = None):
    ticker = ticker.upper()
    original_ticker = ticker
    tags = tags or []
    
    # 1. Check Cache first to make it idempotent and ultra-fast
    if not force_fresh:
        cached_data = db.get_company_data(ticker)
        if cached_data and "ai_analysis" in cached_data and "financials" in cached_data and "error" not in cached_data["ai_analysis"]:
            print(f"Using cached report for {ticker}")
            existing_tags = cached_data.get("tags", [])
            combined_tags = list(set(existing_tags + tags))
            if set(existing_tags) != set(combined_tags):
                cached_data["tags"] = combined_tags
                db.save_company_data(ticker, cached_data)
            return compute_report_from_raw(cached_data, calc)
            
    # Fetch existing to preserve tags even if we're doing a force_fresh
    existing_data = db.get_company_data(ticker) if force_fresh else cached_data
    existing_tags = existing_data.get("tags", []) if existing_data else []
    combined_tags = list(set(existing_tags + tags))
        
    # 2. Fetch Data from Finnhub
    try:
        profile = finnhub.get_profile(ticker)
        
        # Finnhub resolves some tickers to a primary class (e.g., GOOG -> GOOGL)
        actual_ticker = profile.get("ticker", ticker)
        
        # If the original ticker was US-listed (no dot) but Finnhub resolved it
        # to a foreign exchange (e.g., TSX ending in .TO), stick to the original
        # to avoid 403 Forbidden errors on free-tier API keys.
        if "." not in original_ticker and "." in actual_ticker:
            print(f"Prevented resolving {original_ticker} to foreign symbol {actual_ticker} to avoid API Key 403 errors.")
            actual_ticker = original_ticker
        
        # Check cache again just in case the resolved ticker is cached
        if actual_ticker != ticker and not force_fresh:
            cached_data = db.get_company_data(actual_ticker)
            if cached_data and "ai_analysis" in cached_data and "financials" in cached_data and "error" not in cached_data["ai_analysis"]:
                existing_tags_actual = cached_data.get("tags", [])
                combined_tags_actual = list(set(existing_tags_actual + tags))
                if set(existing_tags_actual) != set(combined_tags_actual):
                    cached_data["tags"] = combined_tags_actual
                    db.save_company_data(actual_ticker, cached_data)
                db.save_company_data(original_ticker, cached_data)
                return compute_report_from_raw(cached_data, calc)
                
        # Also grab existing tags for actual ticker if doing a full fresh
        if force_fresh or not cached_data:
            existing_data_actual = db.get_company_data(actual_ticker)
            existing_tags_actual = existing_data_actual.get("tags", []) if existing_data_actual else []
            combined_tags = list(set(existing_tags_actual + tags))
        ticker = actual_ticker
        
        metrics = finnhub.get_metrics(ticker)
        financials = finnhub.extract_key_metrics(ticker, include_ttm=True)
    except Exception as e:
        raise Exception(f"Failed to fetch stock data for {ticker}: {e}")

    current_price = finnhub.get_quote(ticker).get("c", 0.0)
    company_name = profile.get("name", ticker)

    growth_context = build_growth_analysis_context(
        ticker=ticker,
        name=company_name,
        financials=financials,
        metrics=metrics,
        profile=profile,
        current_price=current_price,
    )
    business_model_context = build_business_model_context(
        ticker=ticker,
        name=company_name,
        financials=financials,
        metrics=metrics,
        profile=profile,
        current_price=current_price,
    )

    # 3. Prompt AI (qualitative, business model, growth, and grounded employee sentiment in parallel)
    with ThreadPoolExecutor(max_workers=4) as executor:
        qual_future = executor.submit(ai.analyze_qualitative, company_name, profile, metrics)
        bm_future = executor.submit(ai.analyze_business_model, company_name, business_model_context)
        growth_future = executor.submit(ai.analyze_growth_company, company_name, growth_context)
        sentiment_future = executor.submit(ai.fetch_employee_sentiment, company_name, ticker)

        try:
            ai_analysis = qual_future.result()
        except Exception as e:
            ai_analysis = {"error": str(e)}

        try:
            business_model_analysis = bm_future.result()
        except Exception as e:
            print(f"Failed to generate business model analysis for {ticker}: {e}")
            business_model_analysis = {"error": str(e)}

        try:
            growth_analysis = growth_future.result()
        except Exception as e:
            print(f"Failed to generate growth analysis for {ticker}: {e}")
            growth_analysis = {"error": str(e)}

        try:
            employee_sentiment = sentiment_future.result()
        except Exception as e:
            print(f"Failed to fetch grounded employee sentiment for {ticker}: {e}")
            employee_sentiment = {"error": str(e)}

    if "error" in ai_analysis:
        if existing_data and "ai_analysis" in existing_data and "error" not in existing_data["ai_analysis"]:
            print(f"AI generation failed, falling back to cached AI analysis for {ticker}")
            ai_analysis = existing_data["ai_analysis"]
        else:
            print(f"AI generation failed, falling back to placeholder due to AI Studio limits: {ai_analysis['error']}")
            ai_analysis = {
                "overview": "AI qualitative analysis is currently unavailable (monthly spending cap exceeded in Google AI Studio). All quantitative audit data, Margin of Safety prices, and growth rate computations have been generated successfully below.",
                "sector": profile.get("finnhubIndustry", "Unknown"),
                "subsector": "Unknown",
                "industry_group": "Unknown",
                "sources": {"economic_moat": "Unavailable", "management_integrity": "Unavailable", "growth_runway": "Unavailable"},
                "growth_plans": {"summary": "Unavailable due to API limits", "details": []},
                "competitors": {
                    "market_structure_verdict": {},
                    "competitor_list": [],
                    "competitive_dynamics_summary": "Unavailable due to API limits",
                    "sources_referenced": []
                },
                "risks": {"summary": "Unavailable due to API limits", "key_risks": []},
                "moats": {"moat_types": [], "competitor_comparison": "Unavailable due to API limits"},
                "management": {"summary": "Unavailable due to API limits", "integrity_score": 0},
                "market_and_bias": {"summary": "Unavailable due to API limits"}
            }

    if isinstance(business_model_analysis, dict) and "error" not in business_model_analysis:
        business_model_analysis["generated_at"] = datetime.now(pytz.utc).isoformat()
    else:
        existing_bm = (existing_data or {}).get("context", {}).get("business_model_analysis")
        business_model_analysis = (
            existing_bm
            if isinstance(existing_bm, dict) and "error" not in existing_bm
            else {}
        )

    if isinstance(growth_analysis, dict) and "error" not in growth_analysis:
        growth_analysis["generated_at"] = datetime.now(pytz.utc).isoformat()
    else:
        existing_growth = (existing_data or {}).get("context", {}).get("growth_company_analysis")
        growth_analysis = (
            existing_growth
            if isinstance(existing_growth, dict) and "error" not in existing_growth
            else {}
        )

    if isinstance(employee_sentiment, dict) and "error" not in employee_sentiment:
        employee_sentiment = normalize_employee_sentiment(employee_sentiment)
        employee_sentiment["generated_at"] = datetime.now(pytz.utc).isoformat()
    else:
        existing_sentiment = (existing_data or {}).get("context", {}).get("employee_sentiment")
        employee_sentiment = (
            normalize_employee_sentiment(existing_sentiment)
            if isinstance(existing_sentiment, dict) and "error" not in existing_sentiment
            else {}
        )

    # Generate timestamp in PST
    pst_tz = pytz.timezone('US/Pacific')
    fetched_at = datetime.now(pytz.utc).astimezone(pst_tz)
    timestamp_pst = fetched_at.strftime("%-d %b %I:%M%p").lower()

    # 4. Build Final Raw JSON Schema
    raw_data = {
        "ticker": ticker,
        "tags": combined_tags,
        "name": company_name,
        "industry": profile.get("finnhubIndustry", "Unknown"),
        "price_at_storage": current_price,
        "last_updated_pst": timestamp_pst,
        "profile": profile,
        "metrics": metrics,
        "financials": financials,
        "ai_analysis": ai_analysis,
        "context": {
            "growth_company_analysis": growth_analysis,
            "business_model_analysis": business_model_analysis,
            "employee_sentiment": employee_sentiment,
        }
    }

    # 5. Save Raw to Cache
    db.save_company_data(ticker, raw_data)
    if original_ticker != ticker:
        db.save_company_data(original_ticker, raw_data)

    return compute_report_from_raw(raw_data, calc)


def local_background_ingest(batch_id: str, tickers_to_process: List[str], force_fresh: bool = False, tags: List[str] = None):
    """Background fallback when Pub/Sub is not available or credentials are local-only"""
    print(f"Starting local background ingestion for batch {batch_id}...")
    tags = tags or []
    for ticker in tickers_to_process:
        # Check if batch still exists
        batch = db.get_batch(batch_id)
        if not batch:
            break
            
        db.update_batch_ticker_status(batch_id, ticker, "processing")
        
        try:
            # Pause to preserve rate limits (approx 2s between calls)
            time.sleep(2.0)
            
            generate_and_cache_report(ticker, finnhub, calc, ai, db, force_fresh=force_fresh, tags=tags)
            
            db.update_batch_ticker_status(batch_id, ticker, "completed")
            
        except Exception as e:
            print(f"Local batch processing failed for {ticker}: {e}")
            db.update_batch_ticker_status(batch_id, ticker, "failed", error=str(e))

