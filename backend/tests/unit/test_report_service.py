import pytest
from unittest.mock import MagicMock
from app.services.report_service import (
    compute_report_from_raw,
    compute_big4_ttm,
    compute_ttm_cash_flow_and_growth,
    build_growth_analysis_context,
    build_business_model_context,
    generate_and_cache_report,
    normalize_rating_to_5,
    normalize_employee_sentiment,
)
from app.services.calculator import FinancialCalculator

@pytest.fixture
def calculator():
    return FinancialCalculator()

def test_computeReportFromRawValidData_computesDerivedMetricsSuccessfully(calculator):
    raw_data = {
        "ticker": "AAPL",
        "tags": ["tech"],
        "profile": {"name": "Apple Inc.", "shareOutstanding": 15000, "finnhubIndustry": "Technology"},
        "metrics": {
            "metric": {
                "epsBasicExclExtraItemsTTM": 6.0,
                "marketCapitalization": 2500000,
                "peExclExtraTTM": 25.0
            },
            "series": {
                "annual": {
                    "roe": [{"period": "2023", "v": 1.5}, {"period": "2022", "v": 1.4}],
                    "roic": [{"period": "2023", "v": 0.5}, {"period": "2022", "v": 0.4}],
                    "pe": [{"period": "2023", "v": 28.0}, {"period": "2022", "v": 25.0}]
                }
            }
        },
        "financials": {
            "latest_cash": 60000,
            "latest_total_debt": 100000,
            "history": {
                "revenue": [
                    {"year": 2022, "value": 380000},
                    {"year": 2023, "value": 390000}
                ],
                "net_income": [
                    {"year": 2022, "value": 90000},
                    {"year": 2023, "value": 95000}
                ],
                "operating_cash_flow": [
                    {"year": 2022, "value": 110000},
                    {"year": 2023, "value": 115000}
                ],
                "capex": [
                    {"year": 2022, "value": -10000},
                    {"year": 2023, "value": -12000}
                ],
                "da": [
                    {"year": 2022, "value": 10000},
                    {"year": 2023, "value": 11000}
                ]
            }
        },
        "ai_analysis": {
            "overview": "Strong company.",
            "sector": "Tech",
            "management": {"quality": "high"},
            "competitors": {
                "market_structure_verdict": {
                    "quadrant": "Clear Moat in a Growing Pie",
                    "market_growth_outlook": "Expanding Pie (Secular Growth)",
                    "moat_position": "Wide / Dominant"
                },
                "competitor_list": [
                    {
                        "name": "Samsung Electronics",
                        "threat_level": "High",
                        "competition_scope": "Premium smartphones and wearables",
                        "how_they_compete": "Hardware breadth and vertical component integration",
                        "moat_comparison": "Apple ecosystem lock-in vs Samsung hardware scale"
                    }
                ],
                "competitive_dynamics_summary": "High switching costs sustain premium margins."
            }
        },
        "price_at_storage": 150.0,
        "last_updated_pst": "2023-10-01 10:00am"
    }

    report = compute_report_from_raw(raw_data, calculator)

    assert report["ticker"] == "AAPL"
    assert report["name"] == "Apple Inc."
    assert "derived_metrics" in report["financials"]
    assert "valuations" in report["financials"]
    assert report["qualitative"]["competitors"]["market_structure_verdict"]["quadrant"] == "Clear Moat in a Growing Pie"
    assert len(report["qualitative"]["competitors"]["competitor_list"]) == 1
    assert report["qualitative"]["competitors"]["competitor_list"][0]["name"] == "Samsung Electronics"
    
    # Check that market cap was computed correctly using shares * price
    # shares_out = 15000 * 1,000,000 = 15,000,000,000
    # price = 150.0
    # market_cap = 2,250,000,000,000
    assert report["financials"]["valuations"]["market_cap"] == 2250000000000.0

    # Check Owner's Value (10-Cap) computation:
    # 2023: NI (95000) + D&A (11000) - |CapEx| (12000) = 94000
    # Owner's Value = 94000 * 10 = 940000
    valuations = report["financials"]["valuations"]
    assert valuations["owner_earnings"] == pytest.approx(94000.0)
    assert valuations["owners_value"] == pytest.approx(940000.0)
    assert valuations["owners_value_per_share"] == pytest.approx(940000.0 / 15000000000.0)
    assert valuations["cap_rate"] == pytest.approx(94000.0 / 2250000000000.0)
    ov_details = valuations["computation_owners_value_details"]
    assert ov_details["fiscal_year"] == "2023"
    assert ov_details["net_income"] == pytest.approx(95000.0)
    assert ov_details["depreciation_amortization"] == pytest.approx(11000.0)
    assert ov_details["capex"] == pytest.approx(12000.0)
    assert len(ov_details["history"]) == 2
    assert ov_details["history"][0]["year"] == 2022
    assert ov_details["history"][0]["owner_earnings"] == pytest.approx(90000.0)
    assert ov_details["history"][1]["year"] == 2023
    assert ov_details["history"][1]["owners_value"] == pytest.approx(940000.0)
    assert "step_1_owner_earnings" in ov_details["steps"]
    assert "step_2_owners_value" in ov_details["steps"]
    assert "step_3_per_share" in ov_details["steps"]
    assert "step_4_cap_rate" in ov_details["steps"]

def test_computeReportFromRawMissingShares_derivesEffectiveSharesForOwnersValuePerShare(calculator):
    raw_data = {
        "ticker": "TEST",
        "profile": {"name": "Test Corp"},
        "metrics": {"metric": {"marketCapitalization": 1000}},  # $1B
        "financials": {
            "history": {
                "net_income": [{"year": 2024, "value": 100000000}],
                "da": [{"year": 2024, "value": 20000000}],
                "capex": [{"year": 2024, "value": 10000000}],
                "working_capital_change": [{"year": 2024, "value": -5000000, "source": "balance_sheet"}],
            }
        },
        "price_at_storage": 50.0,  # implies 20M shares
    }
    report = compute_report_from_raw(raw_data, calculator)
    valuations = report["financials"]["valuations"]
    # Owner Earnings = 100M + 20M - (-5M) - 10M = 115M; Owner's Value = 1.15B; shares = 20M -> $57.50/share
    assert valuations["owner_earnings"] == pytest.approx(115000000.0)
    assert valuations["owners_value"] == pytest.approx(1150000000.0)
    assert valuations["owners_value_per_share"] == pytest.approx(57.5)
    assert valuations["cap_rate"] == pytest.approx(0.115)
    ov_details = valuations["computation_owners_value_details"]
    assert ov_details["is_undervalued"] is True
    assert ov_details["working_capital_change"] == pytest.approx(-5000000.0)
    assert ov_details["working_capital_source"] == "balance_sheet"
    assert ov_details["has_working_capital_data"] is True
    assert ov_details["history"][0]["working_capital_change"] == pytest.approx(-5000000.0)

def test_computeReportFromRawMissingData_computesSafelyWithoutCrash(calculator):
    raw_data = {
        "ticker": "UNKNOWN"
    }
    
    report = compute_report_from_raw(raw_data, calculator)
    assert report["ticker"] == "UNKNOWN"
    assert report["financials"]["valuations"]["market_cap"] == 0
    assert report["financials"]["valuations"]["owners_value"] == 0.0
    assert report["financials"]["valuations"]["owners_value_per_share"] == 0.0
    assert report["financials"]["derived_metrics"]["windage_growth_rate"] == 0.0

def test_buildGrowthAnalysisContextAllDataPresent_returnsCompleteContext():
    financials = {
        "latest_cash": 100,
        "latest_total_debt": 50,
        "history": {
            "revenue": [{"year": 2023, "value": 1000}],
            "net_income": [{"year": 2023, "value": 200}],
            "eps": [{"year": 2023, "value": 2.0}],
            "operating_cash_flow": [{"year": 2023, "value": 300}],
            "capex": [{"year": 2023, "value": -50}]
        }
    }
    metrics = {"metric": {"marketCapitalization": 5000}}
    profile = {"name": "Apple", "shareOutstanding": 100}
    
    context = build_growth_analysis_context(
        ticker="AAPL",
        name="Apple",
        financials=financials,
        metrics=metrics,
        profile=profile,
        current_price=150.0
    )
    
    assert context["ticker"] == "AAPL"
    assert context["name"] == "Apple"
    assert len(context["operating_cash_flow_history"]) == 1
    assert context["operating_cash_flow_history"][0]["value"] == 300
    assert len(context["free_cash_flow_history"]) == 1
    assert context["free_cash_flow_history"][0]["value"] == 250
    assert context["latest_cash"] == 100
    assert context["latest_total_debt"] == 50
    assert context["market_cap"] == 150.0 * 100 * 1000000

def test_buildGrowthAnalysisContextMissingAllButTicker_returnsSafely():
    context = build_growth_analysis_context(
        ticker="AAPL",
        name="Unknown",
        financials={},
        metrics={},
        profile={},
        current_price=0.0
    )
    
    assert context["ticker"] == "AAPL"
    assert context["name"] == "Unknown"
    assert context["revenue_history"] == []
    assert context["operating_cash_flow_history"] == []
    assert context["free_cash_flow_history"] == []
    assert context["net_income_history"] == []
    assert context["eps_history"] == []
    assert context["latest_cash"] == 0
    assert context["latest_total_debt"] == 0
    assert context["market_cap"] == 0.0

def test_buildGrowthAnalysisContextMissingSharesButHasMarketCap_usesMarketCapMetric():
    metrics = {"metric": {"marketCapitalization": 5000}}
    profile = {} # shareOutstanding missing
    
    context = build_growth_analysis_context(
        ticker="AAPL",
        name="Apple",
        financials={},
        metrics=metrics,
        profile=profile,
        current_price=150.0
    )
    
    assert context["ticker"] == "AAPL"
    assert context["market_cap"] == 5000 * 1000000


def test_computeReportFromRawHyperGrowthStock_appliesCombinedAnchorDecayToMosAndPayback(calculator):
    # Simulates an NVDA-like hyper-growth company:
    # 9-year OCF grew from $1.2B to $64B (~55.5% CAGR), Revenue from $5B to $130B (~43.6% CAGR),
    # Forward P/E = 32, Forward PEG = 1.0 -> 32% implied forward consensus,
    # 5-year P/E includes an anomalous 110x spike (median = 45x).
    raw_data = {
        "ticker": "NVDA",
        "profile": {"name": "NVIDIA Corp", "shareOutstanding": 24500, "finnhubIndustry": "Semiconductors"},
        "metrics": {
            "metric": {
                "epsBasicExclExtraItemsTTM": 3.0,
                "marketCapitalization": 3300000,
                "forwardPE": 32.0,
                "forwardPEG": 1.0,
                "peExclExtraTTM": 45.0,
            },
            "series": {
                "annual": {
                    "pe": [
                        {"period": "2025", "v": 45.0},
                        {"period": "2024", "v": 60.0},
                        {"period": "2023", "v": 110.0},
                        {"period": "2022", "v": 40.0},
                        {"period": "2021", "v": 38.0},
                    ],
                }
            },
        },
        "financials": {
            "latest_cash": 43e9,
            "latest_total_debt": 10e9,
            "history": {
                "revenue": [
                    {"year": 2016, "value": 5e9},
                    {"year": 2025, "value": 130e9},
                ],
                "operating_cash_flow": [
                    {"year": 2016, "value": 1.2e9},
                    {"year": 2025, "value": 64e9},
                ],
                "capex": [
                    {"year": 2016, "value": -0.1e9},
                    {"year": 2025, "value": -3.2e9},
                ],
                "net_income": [
                    {"year": 2016, "value": 0.6e9},
                    {"year": 2025, "value": 72e9},
                ],
                "da": [{"year": 2025, "value": 1.8e9}],
            },
        },
        "price_at_storage": 135.0,
    }

    report = compute_report_from_raw(raw_data, calculator)
    valuations = report["financials"]["valuations"]
    derived = report["financials"]["derived_metrics"]
    proj = valuations["computation_growth_projection"]
    pe_details = valuations["computation_pe_details"]

    # Raw OCF CAGR (~55.5%) anchored down to 32% forward consensus and faded to 12%
    assert derived["raw_windage_growth_rate"] > 0.50
    assert proj["was_anchored"] is True
    assert proj["anchor_key"] == "forward_consensus"
    assert proj["start_rate"] == pytest.approx(0.32)
    assert proj["terminal_rate"] == pytest.approx(0.12)
    assert proj["decay_applied"] is True
    assert valuations["windage_growth_rate_used"] == pytest.approx(proj["effective_cagr"])
    assert valuations["windage_growth_rate_used"] < 0.25

    # Exit PE uses median (45x) vs 2*12% (24x) vs 30x cap -> 24x (ignoring 110x spike!)
    assert pe_details["median_pe_5yr"] == pytest.approx(45.0)
    assert pe_details["max_pe_5yr"] == pytest.approx(110.0)
    assert pe_details["final_pe"] == pytest.approx(24.0)
    assert valuations["windage_pe_used"] == pytest.approx(24.0)

    # MOS price stays realistic (~$64) instead of exaggerated ($1,500+)
    assert 50.0 < valuations["margin_of_safety_price"] < 80.0

    # Payback Time uses the exact same decaying schedule
    fcf_rows = valuations["projected_fcf_per_year"]
    assert len(fcf_rows) == 10
    assert fcf_rows[0]["growth_rate"] == pytest.approx(0.32)
    assert fcf_rows[-1]["growth_rate"] == pytest.approx(0.12)
    assert fcf_rows[-1]["cumulative_fcf"] > fcf_rows[0]["cumulative_fcf"]
    assert "linearly faded" in valuations["computation_payback_details"].lower()


def test_buildBusinessModelContextAllDataPresent_extractsRecentHistoryAndMargins():
    financials = {
        "latest_cash": 50e9,
        "latest_total_debt": 20e9,
        "history": {
            "revenue": [{"year": 2019 + i, "value": (100 + i * 10) * 1e9} for i in range(7)],
            "net_income": [{"year": 2024, "value": 30e9}],
            "operating_cash_flow": [{"year": 2024, "value": 40e9}],
            "capex": [{"year": 2024, "value": -8e9}],
        },
    }
    metrics = {
        "metric": {
            "grossMarginTTM": 68.5,
            "operatingMarginTTM": 44.1,
            "marketCapitalization": 3000000,
            "unrelatedMetric": 999,
        }
    }
    profile = {"name": "Microsoft", "finnhubIndustry": "Technology", "shareOutstanding": 7400}

    ctx = build_business_model_context(
        ticker="MSFT",
        name="Microsoft",
        financials=financials,
        metrics=metrics,
        profile=profile,
        current_price=400.0,
    )

    assert ctx["ticker"] == "MSFT"
    assert ctx["industry"] == "Technology"
    assert len(ctx["revenue_history_recent"]) == 5
    assert ctx["revenue_history_recent"][0]["year"] == 2021
    assert ctx["margin_and_efficiency_metrics"]["grossMarginTTM"] == 68.5
    assert ctx["margin_and_efficiency_metrics"]["operatingMarginTTM"] == 44.1
    assert "unrelatedMetric" not in ctx["margin_and_efficiency_metrics"]
    assert ctx["market_cap"] == pytest.approx(400.0 * 7400 * 1_000_000)


def test_computeReportFromRaw_exposesBusinessModelFromContext(calculator):
    raw_data = {
        "ticker": "AMZN",
        "profile": {"name": "Amazon.com Inc."},
        "context": {
            "business_model_analysis": {
                "executive_summary": "Retail scale flywheel paired with high-margin AWS cloud.",
                "earnings_divisions": [
                    {"name": "North America", "revenue_share_pct": 61.0},
                    {"name": "International", "revenue_share_pct": 22.0},
                    {"name": "AWS", "revenue_share_pct": 17.0},
                ],
            }
        },
    }

    report = compute_report_from_raw(raw_data, calculator)

    bm = report["qualitative"]["business_model"]
    assert bm["executive_summary"].startswith("Retail scale flywheel")
    assert len(bm["earnings_divisions"]) == 3
    assert bm["earnings_divisions"][2]["name"] == "AWS"


def test_generateAndCacheReport_synthesizesBusinessModelAndCachesIt(calculator):
    mock_finnhub = MagicMock()
    mock_finnhub.get_profile.return_value = {"ticker": "AMZN", "name": "Amazon.com", "finnhubIndustry": "Retail"}
    mock_finnhub.get_metrics.return_value = {"metric": {"grossMarginTTM": 48.0}, "series": {"annual": {}}}
    mock_finnhub.extract_key_metrics.return_value = {
        "latest_cash": 80e9,
        "latest_total_debt": 60e9,
        "history": {"revenue": [{"year": 2024, "value": 638e9}]},
    }
    mock_finnhub.get_quote.return_value = {"c": 200.0}

    mock_ai = MagicMock()
    mock_ai.analyze_qualitative.return_value = {"overview": "Global commerce and cloud leader."}
    mock_ai.analyze_business_model.return_value = {
        "executive_summary": "E-commerce + Ads + AWS.",
        "earnings_divisions": [{"name": "AWS", "revenue_share_pct": 17.0}],
    }
    mock_ai.analyze_growth_company.return_value = {"cash_burn": {"verdict": "Pass", "justification": "Strong FCF."}}

    mock_db = MagicMock()
    mock_db.get_company_data.return_value = None

    report = generate_and_cache_report(
        "AMZN", mock_finnhub, calculator, mock_ai, mock_db, force_fresh=True
    )

    mock_ai.analyze_business_model.assert_called_once()
    assert report["qualitative"]["business_model"]["executive_summary"] == "E-commerce + Ads + AWS."
    assert "generated_at" in report["qualitative"]["business_model"]

    saved_payload = mock_db.save_company_data.call_args[0][1]
    assert "business_model_analysis" in saved_payload["context"]
    assert saved_payload["context"]["business_model_analysis"]["earnings_divisions"][0]["name"] == "AWS"


def test_normalizeRatingTo5_handlesAllScalesSafely():
    assert normalize_rating_to_5(4.2) == 4.2
    assert normalize_rating_to_5(8.4) == 4.2
    assert normalize_rating_to_5(88) == 4.4
    assert normalize_rating_to_5("92%") == 4.6
    assert normalize_rating_to_5("4.1 / 5.0") == 4.1
    assert normalize_rating_to_5(150) == 5.0
    assert normalize_rating_to_5(0) is None
    assert normalize_rating_to_5(-3.0) is None
    assert normalize_rating_to_5(None) is None
    assert normalize_rating_to_5(True) is None


def test_computeReportFromRawLegacyOutOfScaleRatings_normalizesToFivePointScale(calculator):
    raw_data = {
        "ticker": "AAPL",
        "profile": {"name": "Apple Inc."},
        "ai_analysis": {
            "management": {
                "ceo_tenure_years": 14,
                "ceo_employee_rating": 88.0,
                "employee_happiness_score": 76.0,
                "board_of_directors_summary": "Independent board.",
            }
        },
    }

    report = compute_report_from_raw(raw_data, calculator)
    mgmt = report["qualitative"]["management"]

    assert mgmt["ceo_employee_rating"] == 4.4
    assert mgmt["ceo_approval_pct"] == 88
    assert mgmt["employee_happiness_score"] == 3.8
    assert mgmt["sentiment_grounded"] is False


def test_computeReportFromRawGroundedSentiment_prefersGroundedRatingsAndSources(calculator):
    raw_data = {
        "ticker": "MSFT",
        "profile": {"name": "Microsoft Corp"},
        "ai_analysis": {
            "management": {
                "ceo_tenure_years": 10,
                "ceo_employee_rating": 95.0,
                "employee_happiness_score": 82.0,
            }
        },
        "context": {
            "employee_sentiment": {
                "ceo_name": "Satya Nadella",
                "ceo_tenure_years": 12,
                "ceo_approval_pct": 92,
                "ceo_employee_rating": 92,  # Deliberately out of scale to verify normalization
                "employee_happiness_score": 4.3,
                "review_count": "60,000+ reviews",
                "source_platform": "Glassdoor",
                "notes": "Glassdoor shows 4.3/5 overall and 92% CEO approval.",
                "grounding_sources": [
                    {"title": "Glassdoor", "url": "https://www.glassdoor.com/microsoft"}
                ],
                "grounded": True,
                "generated_at": "2026-11-22T20:00:00+00:00",
            }
        },
    }

    report = compute_report_from_raw(raw_data, calculator)
    mgmt = report["qualitative"]["management"]

    assert mgmt["ceo_name"] == "Satya Nadella"
    assert mgmt["ceo_tenure_years"] == 12
    assert mgmt["ceo_approval_pct"] == 92
    assert mgmt["ceo_employee_rating"] == 4.6
    assert mgmt["employee_happiness_score"] == 4.3
    assert mgmt["review_count"] == "60,000+ reviews"
    assert mgmt["sentiment_source"] == "Glassdoor"
    assert mgmt["sentiment_grounded"] is True
    assert mgmt["sentiment_generated_at"] == "2026-11-22T20:00:00+00:00"
    assert len(mgmt["sentiment_sources"]) == 1


def test_generateAndCacheReport_fetchesAndCachesGroundedEmployeeSentiment(calculator):
    mock_finnhub = MagicMock()
    mock_finnhub.get_profile.return_value = {"ticker": "NVDA", "name": "NVIDIA Corp", "finnhubIndustry": "Semiconductors"}
    mock_finnhub.get_metrics.return_value = {"metric": {}, "series": {"annual": {}}}
    mock_finnhub.extract_key_metrics.return_value = {"history": {"revenue": [{"year": 2025, "value": 130e9}]}}
    mock_finnhub.get_quote.return_value = {"c": 140.0}

    mock_ai = MagicMock()
    mock_ai.analyze_qualitative.return_value = {
        "overview": "AI compute leader.",
        "management": {"ceo_employee_rating": 96.0, "employee_happiness_score": 90.0},
    }
    mock_ai.analyze_business_model.return_value = {"executive_summary": "GPU + CUDA platform."}
    mock_ai.analyze_growth_company.return_value = {"cash_burn": {"verdict": "Pass", "justification": "High FCF."}}
    mock_ai.fetch_employee_sentiment.return_value = {
        "ceo_name": "Jensen Huang",
        "ceo_tenure_years": 33,
        "ceo_approval_pct": 97,
        "ceo_employee_rating": 4.9,
        "employee_happiness_score": 4.6,
        "source_platform": "Glassdoor",
        "grounding_sources": [{"title": "Glassdoor", "url": "https://www.glassdoor.com/nvidia"}],
        "grounded": True,
    }

    mock_db = MagicMock()
    mock_db.get_company_data.return_value = None

    report = generate_and_cache_report(
        "NVDA", mock_finnhub, calculator, mock_ai, mock_db, force_fresh=True
    )

    mock_ai.fetch_employee_sentiment.assert_called_once_with("NVIDIA Corp", "NVDA")
    mgmt = report["qualitative"]["management"]
    assert mgmt["ceo_name"] == "Jensen Huang"
    assert mgmt["ceo_employee_rating"] == 4.9
    assert mgmt["employee_happiness_score"] == 4.6
    assert mgmt["ceo_approval_pct"] == 97
    assert mgmt["sentiment_grounded"] is True

    saved_payload = mock_db.save_company_data.call_args[0][1]
    assert "employee_sentiment" in saved_payload["context"]
    assert saved_payload["context"]["employee_sentiment"]["ceo_name"] == "Jensen Huang"
    assert "generated_at" in saved_payload["context"]["employee_sentiment"]


def test_computeBig4TtmFromCachedMetrics_derivesAllFourWithoutXbrlTtm(calculator):
    raw_data = {
        "ticker": "MSFT",
        "profile": {"name": "Microsoft Corp", "shareOutstanding": 7430},
        "metrics": {
            "metric": {
                "marketCapitalization": 3598139.8,
                "psTTM": 10.3859,
                "peTTM": 25.2269,
                "pcfShareTTM": 18.3693,
                "pfcfShareTTM": 60.012,
                "netProfitMarginTTM": 41.17,
            },
            "series": {
                "quarterly": {
                    "eps": [{"period": "2026-09-30", "v": 4.92}],
                    "bookValue": [{"period": "2026-09-30", "v": 470509}],
                }
            },
        },
        "financials": {
            "history": {
                "revenue": [{"year": 2025, "value": 281724000000.0}],
                "net_income": [{"year": 2025, "value": 101832000000.0}],
                "operating_cash_flow": [{"year": 2025, "value": 136162000000.0}],
                "book_value": [{"year": 2025, "value": 343479000000.0}],
            }
        },
        "price_at_storage": 484.0,
    }

    report = compute_report_from_raw(raw_data, calculator)
    big4_ttm = report["financials"]["raw_data"]["big4_ttm"]

    assert big4_ttm["revenue"]["value"] == pytest.approx(346444679806.0, rel=1e-4)
    assert big4_ttm["revenue"]["period"] == "2026-09-30"
    assert big4_ttm["revenue"]["period_type"] == "TTM"
    assert big4_ttm["revenue"]["source"] == "finnhub_metrics"

    assert big4_ttm["net_income"]["value"] == pytest.approx(142631072387.0, rel=1e-4)
    assert big4_ttm["operating_cash_flow"]["value"] == pytest.approx(195877894095.0, rel=1e-4)

    assert big4_ttm["book_value"]["value"] == pytest.approx(470509000000.0)
    assert big4_ttm["book_value"]["period"] == "2026-09-30"
    assert big4_ttm["book_value"]["period_type"] == "MRQ"


def test_computeBig4TtmNegativeNetIncomeAndStaleBookValue_usesMarginAndRejectsStaleBv():
    financials = {
        "history": {
            "book_value": [{"year": 2025, "value": -8096600000.0}],
        }
    }
    metrics = {
        "metric": {
            "marketCapitalization": 15121.045,
            "psTTM": 2.3335,
            "peTTM": None,
            "pcfShareTTM": None,
            "netProfitMarginTTM": -45.88,
            "bookValuePerShareQuarterly": 0.8934,
        },
        "series": {
            "quarterly": {
                "eps": [{"period": "2026-09-30", "v": -0.75}],
                # Stale 2018 bookValue frozen when equity turned negative (e.g. SBUX/MCD)
                "bookValue": [{"period": "2018-09-30", "v": 1169.5}],
            }
        },
    }

    ttm = compute_big4_ttm(financials=financials, metrics=metrics, effective_shares=1_000_000_000.0)

    assert ttm["revenue"]["value"] == pytest.approx(6479984999.0, rel=1e-3)
    assert ttm["net_income"]["value"] == pytest.approx(-2973017118.0, rel=1e-3)
    assert ttm["operating_cash_flow"]["value"] is None
    assert ttm["operating_cash_flow"]["source"] == "unavailable"
    assert ttm["book_value"]["value"] is None
    assert ttm["book_value"]["source"] == "unavailable"
    assert ttm["book_value"]["period_type"] == "MRQ"


def test_computeBig4TtmReconciliation_prefersNewerMetricsAndDirectXbrlWhenSamePeriod():
    # Case 1: metrics is 1 quarter newer (NVDA Q3 FY27 vs XBRL Q2 FY27) -> prefer metrics
    nvda_ttm = compute_big4_ttm(
        financials={
            "ttm": {
                "revenue": {"value": 302.9e9, "period": "2026-07-26", "period_type": "TTM", "source": "xbrl_quarterly"},
            }
        },
        metrics={
            "metric": {"marketCapitalization": 3025273.0, "psTTM": 8.3616},
            "series": {"quarterly": {"eps": [{"period": "2026-10-25", "v": 2.8}]}},
        },
    )
    assert nvda_ttm["revenue"]["source"] == "finnhub_metrics"
    assert nvda_ttm["revenue"]["period"] == "2026-10-25"
    assert nvda_ttm["revenue"]["value"] == pytest.approx(361.8055e9, rel=1e-3)

    # Case 2: same period -> prefer direct XBRL for flow items, metrics fallback for missing BS equity
    same_period_ttm = compute_big4_ttm(
        financials={
            "ttm": {
                "revenue": {"value": 797.455e9, "period": "2026-09-30", "period_type": "TTM", "source": "xbrl_quarterly"},
                "operating_cash_flow": {"value": -2.629e9, "period": "2026-09-30", "period_type": "TTM", "source": "xbrl_quarterly"},
            }
        },
        metrics={
            "metric": {"marketCapitalization": 2668898.8, "psTTM": 3.3468, "pcfShareTTM": None},
            "series": {
                "quarterly": {
                    "eps": [{"period": "2026-09-30", "v": 3.1}],
                    "bookValue": [{"period": "2026-09-30", "v": 613601}],
                }
            },
        },
    )
    assert same_period_ttm["revenue"]["source"] == "xbrl_quarterly"
    assert same_period_ttm["revenue"]["value"] == pytest.approx(797.455e9)
    assert same_period_ttm["operating_cash_flow"]["source"] == "xbrl_quarterly"
    assert same_period_ttm["operating_cash_flow"]["value"] == pytest.approx(-2.629e9)
    assert same_period_ttm["book_value"]["source"] == "finnhub_metrics"
    assert same_period_ttm["book_value"]["value"] == pytest.approx(613.601e9)


def test_computeReportFromRawTtmMetrics_drivesRuleOf40DebtPayoffAndPaybackFromTtm(calculator):
    raw_data = {
        "ticker": "NVDA",
        "profile": {"name": "NVIDIA Corp", "shareOutstanding": 24100},
        "metrics": {
            "metric": {
                "marketCapitalization": 3025273.0,
                "psTTM": 8.3616,
                "pfcfShareTTM": 20.3417,
                "revenueGrowthTTMYoy": 93.33,
                "epsBasicExclExtraItemsTTM": 9.3,
                "peExclExtraTTM": 13.37,
            },
            "series": {
                "quarterly": {
                    "eps": [{"period": "2026-10-25", "v": 2.8}],
                    "fcfPerShareTTM": [{"period": "2026-10-25", "v": 6.1711}],
                },
                "annual": {"pe": [{"period": "2026", "v": 30.0}]},
            },
        },
        "financials": {
            "latest_cash": 40e9,
            "latest_total_debt": 10e9,
            "history": {
                "revenue": [
                    {"year": 2025, "value": 130.5e9},
                    {"year": 2026, "value": 215.9e9},
                ],
                "operating_cash_flow": [
                    {"year": 2025, "value": 64.1e9},
                    {"year": 2026, "value": 102.7e9},
                ],
                "capex": [
                    {"year": 2025, "value": -3.2e9},
                    {"year": 2026, "value": -5.0e9},
                ],
                "net_income": [
                    {"year": 2025, "value": 72.9e9},
                    {"year": 2026, "value": 120.1e9},
                ],
            },
        },
        "price_at_storage": 125.53,
    }

    report = compute_report_from_raw(raw_data, calculator)
    derived = report["financials"]["derived_metrics"]
    vals = report["financials"]["valuations"]

    expected_ttm_fcf = 3025273.0 * 1e6 / 20.3417
    expected_ttm_rev = 3025273.0 * 1e6 / 8.3616

    # 1. Payback Time starts from TTM FCF (~$148.7B, not FY26 ~$97.7B)
    assert vals["payback_fcf_basis"] == "TTM"
    assert vals["payback_fcf_label"] == "TTM (Oct 2026)"
    assert vals["payback_starting_fcf"] == pytest.approx(expected_ttm_fcf, rel=1e-4)
    assert "TTM (Oct 2026)" in vals["computation_payback_details"]
    yr1_rate = vals["projected_fcf_per_year"][0]["growth_rate"]
    assert vals["projected_fcf_per_year"][0]["fcf"] == pytest.approx(expected_ttm_fcf * (1 + yr1_rate), rel=1e-4)

    # 2. Debt Payoff Years uses Total Debt / TTM FCF
    assert derived["debt_payoff_years"] == pytest.approx(10e9 / expected_ttm_fcf, rel=1e-4)
    assert "TTM (Oct 2026)" in derived["computation_debt_payoff"]
    assert derived["computation_debt_payoff_details"]["basis"] == "TTM"
    assert derived["computation_debt_payoff_details"]["fcf_used"] == pytest.approx(expected_ttm_fcf, rel=1e-4)

    # 3. Rule of 40 uses TTM YoY Rev Growth + TTM FCF Margin
    r40 = derived["computation_rule_of_40_details"]
    assert r40["basis"] == "TTM"
    assert r40["latest_year"] == "TTM (Oct 2026)"
    assert r40["revenue_growth_1yr"] == pytest.approx(0.9333)
    assert r40["latest_revenue"] == pytest.approx(expected_ttm_rev, rel=1e-4)
    assert r40["latest_fcf"] == pytest.approx(expected_ttm_fcf, rel=1e-4)
    expected_r40 = (0.9333 + expected_ttm_fcf / expected_ttm_rev) * 100.0
    assert derived["rule_of_40"] == pytest.approx(expected_r40, rel=1e-3)


def test_computeTtmCashFlowAndGrowthNegativeFcf_rejectsStalePositivePfcfRatio(calculator):
    # Simulates AMZN Q1 2026 where timestamped fcfPerShareTTM turned negative (-0.2299)
    # while pfcfShareTTM stayed frozen at a stale positive value (184.47).
    raw_data = {
        "ticker": "AMZN",
        "profile": {"name": "Amazon.com Inc.", "shareOutstanding": 10757.11},
        "metrics": {
            "metric": {
                "marketCapitalization": 2896029.0,
                "psTTM": 3.8989,
                "pfcfShareTTM": 184.4722,
                "revenueGrowthTTMYoy": 14.22,
            },
            "series": {
                "quarterly": {
                    "eps": [{"period": "2026-03-31", "v": 2.0}],
                    "fcfPerShareTTM": [{"period": "2026-03-31", "v": -0.2299}],
                }
            },
        },
        "financials": {
            "latest_total_debt": 60e9,
            "history": {
                "revenue": [{"year": 2024, "value": 638e9}, {"year": 2025, "value": 717e9}],
                "operating_cash_flow": [{"year": 2025, "value": 139.5e9}],
                "capex": [{"year": 2025, "value": -83.0e9}],
            },
        },
        "price_at_storage": 269.2,
    }

    cf_growth = compute_ttm_cash_flow_and_growth(
        financials=raw_data["financials"],
        metrics=raw_data["metrics"],
        effective_shares=10757.11 * 1e6,
    )
    assert cf_growth["free_cash_flow"]["value"] < 0
    assert cf_growth["free_cash_flow"]["value"] == pytest.approx(-0.2299 * 10757.11e6)

    # Must NOT fall back to older positive FY25 FCF when TTM FCF is known negative!
    report = compute_report_from_raw(raw_data, calculator)
    vals = report["financials"]["valuations"]
    derived = report["financials"]["derived_metrics"]
    assert vals["payback_fcf_basis"] == "TTM"
    assert vals["payback_starting_fcf"] < 0
    assert vals["payback_time_years"] == 0
    assert derived["computation_debt_payoff_details"]["basis"] == "TTM"
    assert derived["computation_debt_payoff_details"]["fcf_used"] < 0
    assert derived["computation_rule_of_40_details"]["basis"] == "TTM"
    assert derived["computation_rule_of_40_details"]["fcf_margin"] < 0




