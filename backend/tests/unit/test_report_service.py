import pytest
from app.services.report_service import compute_report_from_raw, build_growth_analysis_context
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

