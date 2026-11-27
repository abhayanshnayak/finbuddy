from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest
import pytz

from app.data.curated_lists import (
    MAX_COMPANIES_PER_CATEGORY,
    MAX_CURATED_CATEGORIES,
    get_catalog_categories,
    get_catalog_category,
)
from app.services.calculator import FinancialCalculator
from app.services.curated_service import (
    CURATED_CACHE_SCHEMA_VERSION,
    CuratedListService,
    extract_curated_company_metrics,
)


def test_catalogConstraints_strictlyEnforced():
    categories = get_catalog_categories()
    assert 1 <= len(categories) <= MAX_CURATED_CATEGORIES
    assert len(categories) == 10

    seen_ids = set()
    tech_count = 0
    diversified_count = 0

    for cat in categories:
        assert cat["id"] not in seen_ids
        seen_ids.add(cat["id"])

        if cat["sector_focus"] in ("tech", "tech_enabled"):
            tech_count += 1
        else:
            diversified_count += 1

        buckets = cat["buckets"]
        assert len(buckets) >= 3
        bucket_ids = {b["id"] for b in buckets}
        stage_orders = [b["stage_order"] for b in buckets]
        assert stage_orders == sorted(stage_orders)

        companies = cat["companies"]
        assert 1 <= len(companies) <= MAX_COMPANIES_PER_CATEGORY

        seen_tickers_in_cat = set()
        for company in companies:
            ticker = company["ticker"]
            assert ticker == ticker.upper()
            assert ticker not in seen_tickers_in_cat, f"Duplicate ticker {ticker} in {cat['id']}"
            seen_tickers_in_cat.add(ticker)
            assert company["bucket_id"] in bucket_ids
            assert company["stage"] in ("established", "future_potential")
            assert len(company["overview"].strip()) >= 20
            assert len(company["stage_rationale"].strip()) >= 15

    # Leans tech-forward while maintaining real-economy diversity
    assert tech_count >= 6
    assert diversified_count >= 3


def test_extractCuratedCompanyMetrics_extractsBig4MarginsReturnsDebtAndCash():
    calc = FinancialCalculator()
    raw_company = {
        "ticker": "NVDA",
        "name": "NVIDIA Corporation",
        "price_at_storage": 130.0,
        "profile": {
            "name": "NVIDIA Corporation",
            "finnhubIndustry": "Semiconductors",
            "currency": "USD",
            "shareOutstanding": 24500.0,  # 24.5B shares
            "marketCapitalization": 3185000.0,
        },
        "metrics": {
            "metric": {
                "marketCapitalization": 3185000.0,
                "roiTTM": 72.5,
                "roi5Y": 48.2,
                "roeTTM": 95.4,
                "roe5Y": 55.1,
                "netProfitMarginTTM": 55.8,
                "revenueGrowthTTMYoy": 68.0,
            },
            "series": {
                "annual": {
                    "roic": [
                        {"period": "2026-01-25", "v": 0.72},
                        {"period": "2025-01-26", "v": 0.65},
                    ],
                    "roe": [
                        {"period": "2026-01-25", "v": 0.90},
                        {"period": "2025-01-26", "v": 0.75},
                    ],
                    "fcfMargin": [{"period": "2026-01-25", "v": 0.45}],
                },
                "quarterly": {},
            },
        },
        "financials": {
            "latest_total_debt": 8500000000.0,
            "latest_cash": 12000000000.0,
            "ttm": {
                "revenue": {"value": 150000000000.0, "period": "2026-01-25", "period_type": "TTM"},
                "net_income": {"value": 84000000000.0, "period": "2026-01-25", "period_type": "TTM"},
                "operating_cash_flow": {"value": 72000000000.0, "period": "2026-01-25", "period_type": "TTM"},
                "book_value": {"value": 95000000000.0, "period": "2026-01-25", "period_type": "MRQ"},
                "free_cash_flow": {"value": 66000000000.0, "period": "2026-01-25", "period_type": "TTM"},
            },
            "history": {
                "revenue": [
                    {"year": 2021, "value": 16675000000.0},
                    {"year": 2022, "value": 26914000000.0},
                    {"year": 2023, "value": 26974000000.0},
                    {"year": 2024, "value": 60922000000.0},
                    {"year": 2025, "value": 130497000000.0},
                    {"year": 2026, "value": 150000000000.0},
                ],
                "net_income": [
                    {"year": 2021, "value": 4332000000.0},
                    {"year": 2022, "value": 9752000000.0},
                    {"year": 2023, "value": 4368000000.0},
                    {"year": 2024, "value": 29760000000.0},
                    {"year": 2025, "value": 72880000000.0},
                    {"year": 2026, "value": 84000000000.0},
                ],
                "operating_cash_flow": [
                    {"year": 2021, "value": 5822000000.0},
                    {"year": 2022, "value": 9108000000.0},
                    {"year": 2023, "value": 5641000000.0},
                    {"year": 2024, "value": 28090000000.0},
                    {"year": 2025, "value": 64089000000.0},
                    {"year": 2026, "value": 72000000000.0},
                ],
                "book_value": [
                    {"year": 2021, "value": 16893000000.0},
                    {"year": 2022, "value": 26612000000.0},
                    {"year": 2023, "value": 22101000000.0},
                    {"year": 2024, "value": 42978000000.0},
                    {"year": 2025, "value": 79327000000.0},
                    {"year": 2026, "value": 95000000000.0},
                ],
                "capex": [{"year": 2026, "value": -6000000000.0}],
            },
        },
    }

    result = extract_curated_company_metrics("NVDA", raw_company, calc, has_full_report=True)

    assert result["ticker"] == "NVDA"
    assert result["reporting_currency"] == "USD"
    assert result["has_full_report"] is True
    assert result["roic_pct"] == pytest.approx(72.5)
    assert result["roic_5y_avg_pct"] == pytest.approx(48.2)
    assert result["roe_pct"] == pytest.approx(95.4)
    assert result["total_debt"] == pytest.approx(8500000000.0)
    assert result["cash_and_equivalents"] == pytest.approx(12000000000.0)
    assert result["net_income_margin_pct"] == pytest.approx(55.8)
    assert result["fcf_margin_pct"] == pytest.approx(44.0)
    assert result["big4"]["revenue"]["latest"] == pytest.approx(150000000000.0)
    assert result["big4"]["revenue"]["period_type"] == "TTM"
    # TTM == FY2026 (150B), so delta compares against FY2025 (130.497B) -> +14.9%
    assert result["big4"]["revenue"]["prior_fy_year"] == 2025
    assert result["big4"]["revenue"]["delta_amount"] == pytest.approx(150000000000.0 - 130497000000.0)
    assert result["big4"]["revenue"]["delta_pct"] == pytest.approx((150000000000.0 - 130497000000.0) / 130497000000.0, rel=1e-3)
    assert result["big4"]["revenue"]["delta_basis"] == "vs FY25"
    assert result["big4"]["revenue"]["trend"] == "strong_growth"
    assert result["big4"]["revenue"]["cagr_5y"] > 0.50
    assert len(result["big4"]["revenue"]["history"]) == 6


def test_extractCuratedCompanyMetrics_handlesBankAndAdrFallbacks():
    calc = FinancialCalculator()
    raw_bank = {
        "ticker": "JPM",
        "profile": {
            "name": "JPMorgan Chase & Co.",
            "currency": "USD",
            "shareOutstanding": 2650.0,
            "marketCapitalization": 800000.0,
        },
        "metrics": {
            "metric": {
                "marketCapitalization": 800000.0,
                "psTTM": 3.0,
                "peTTM": 12.5,
                "roiTTM": 4.35,
                "roeTTM": 17.91,
                "netProfitMarginTTM": 33.26,
                "cashPerSharePerShareQuarterly": 160.0,
                "totalDebt/totalEquityQuarterly": 2.1,
                "bookValuePerShareQuarterly": 140.0,
                "revenueGrowth3Y": 8.5,
            },
            "series": {
                "annual": {
                    "fcfMargin": [{"period": "2025-12-31", "v": 0.22}],
                    "bookValue": [
                        {"period": "2024-12-31", "v": 340000},
                        {"period": "2025-12-31", "v": 371000},
                    ],
                },
                "quarterly": {},
            },
        },
        "financials": {
            "latest_total_debt": 0.0,
            "latest_cash": 0.0,
            "history": {},
        },
    }

    result = extract_curated_company_metrics("JPM", raw_bank, calc)
    # Falls back to cashPerShare * shares when XBRL cash is 0
    assert result["cash_and_equivalents"] == pytest.approx(160.0 * 2_650_000_000.0)
    # Falls back to debt/equity * book_value when XBRL debt is 0
    assert result["total_debt"] > 0
    assert result["roic_pct"] == pytest.approx(4.35)
    assert result["roe_pct"] == pytest.approx(17.91)
    assert result["net_income_margin_pct"] == pytest.approx(33.26)
    assert result["fcf_margin_pct"] == pytest.approx(22.0)
    assert result["big4"]["revenue"]["cagr_3y"] == pytest.approx(0.085)
    assert result["big4"]["revenue"]["trend"] == "growing"


def test_curatedService_usesFirestoreAndMemoryCacheBeforeFinnhub():
    mock_db = MagicMock()
    mock_finnhub = MagicMock()
    calc = FinancialCalculator()

    cached_doc = {
        "schema_version": CURATED_CACHE_SCHEMA_VERSION,
        "id": "robotics-automation",
        "name": "Robotics & Physical AI",
        "cached_at": datetime.now(pytz.utc).isoformat(),
        "buckets": [{"id": "vision-motion", "name": "Vision", "companies": []}],
    }
    mock_db.get_curated_category.return_value = cached_doc

    service = CuratedListService(db=mock_db, finnhub=mock_finnhub, calc=calc, request_delay_seconds=0)

    # First call hits Firestore cache
    first = service.get_category("robotics-automation")
    assert first["cache_source"] == "firestore_cache"
    mock_db.get_curated_category.assert_called_once_with("robotics-automation")
    mock_finnhub.get_metrics.assert_not_called()

    # Second call hits in-memory cache without re-reading Firestore
    second = service.get_category("robotics-automation")
    assert second["cache_source"] == "memory_cache"
    assert mock_db.get_curated_category.call_count == 1


def test_curatedService_buildsAndPersistsOnCacheMissReusingCompanyCache():
    mock_db = MagicMock()
    mock_finnhub = MagicMock()
    calc = FinancialCalculator()

    # Stale/missing category cache
    mock_db.get_curated_category.return_value = {
        "schema_version": CURATED_CACHE_SCHEMA_VERSION,
        "cached_at": (datetime.now(pytz.utc) - timedelta(days=30)).isoformat(),
        "buckets": [],
    }
    mock_db.get_curated_ticker_snapshot.return_value = {}
    mock_db.get_company_data.return_value = {
        "name": "Cached Corp",
        "ai_analysis": {"overview": "Solid"},
        "profile": {"name": "Cached Corp", "currency": "USD", "shareOutstanding": 100.0},
        "metrics": {"metric": {"roiTTM": 18.0, "roeTTM": 24.0, "netProfitMarginTTM": 21.0}},
        "financials": {
            "latest_total_debt": 500e6,
            "latest_cash": 900e6,
            "history": {
                "revenue": [{"year": 2024, "value": 4e9}, {"year": 2025, "value": 5e9}],
                "net_income": [{"year": 2024, "value": 800e6}, {"year": 2025, "value": 1e9}],
                "operating_cash_flow": [{"year": 2024, "value": 1e9}, {"year": 2025, "value": 1.3e9}],
                "book_value": [{"year": 2024, "value": 3e9}, {"year": 2025, "value": 3.8e9}],
                "capex": [{"year": 2024, "value": -200e6}, {"year": 2025, "value": -250e6}],
            },
        },
    }

    service = CuratedListService(db=mock_db, finnhub=mock_finnhub, calc=calc, request_delay_seconds=0)
    built = service.get_category("cybersecurity")

    assert built is not None
    assert built["id"] == "cybersecurity"
    assert built["cache_source"] == "freshly_built"
    assert built["company_count"] <= MAX_COMPANIES_PER_CATEGORY
    assert len(built["buckets"]) == 4
    assert built["summary"]["median_roic_pct"] == pytest.approx(18.0)
    # Because company report cache was valid, Finnhub was never called!
    mock_finnhub.get_metrics.assert_not_called()
    mock_db.save_curated_category.assert_called_once()


def test_curatedService_returnsNoneForUnknownCategory():
    service = CuratedListService(db=MagicMock(), finnhub=MagicMock(), calc=FinancialCalculator())
    assert get_catalog_category("non-existent") == {}
    assert service.get_category("non-existent") is None
