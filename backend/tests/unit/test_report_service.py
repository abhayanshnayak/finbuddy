import pytest
from app.services.report_service import compute_report_from_raw
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
            "management": {"quality": "high"}
        },
        "price_at_storage": 150.0,
        "last_updated_pst": "2023-10-01 10:00am"
    }

    report = compute_report_from_raw(raw_data, calculator)

    assert report["ticker"] == "AAPL"
    assert report["name"] == "Apple Inc."
    assert "derived_metrics" in report["financials"]
    assert "valuations" in report["financials"]
    
    # Check that market cap was computed correctly using shares * price
    # shares_out = 15000 * 1,000,000 = 15,000,000,000
    # price = 150.0
    # market_cap = 2,250,000,000,000
    assert report["financials"]["valuations"]["market_cap"] == 2250000000000.0

def test_computeReportFromRawMissingData_computesSafelyWithoutCrash(calculator):
    raw_data = {
        "ticker": "UNKNOWN"
    }
    
    report = compute_report_from_raw(raw_data, calculator)
    assert report["ticker"] == "UNKNOWN"
    assert report["financials"]["valuations"]["market_cap"] == 0
    assert report["financials"]["derived_metrics"]["windage_growth_rate"] == 0.0
