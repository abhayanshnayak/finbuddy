import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app

client = TestClient(app)

def test_getGrowthAnalysisCachedData_returnsFromCacheWithoutCallingAI(mocker):
    # Setup mocks
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {
        "context": {
            "growth_company_analysis": {"cash_burn": "Low"}
        }
    }
    mocker.patch("app.api.endpoints.reports.db", mock_db)
    mock_ai = MagicMock()
    mocker.patch("app.api.endpoints.reports.ai", mock_ai)
    
    response = client.get("/api/stocks/AAPL/growth-analysis")
    
    assert response.status_code == 200
    assert response.json() == {"cash_burn": "Low"}
    mock_db.get_company_data.assert_called_once_with("AAPL")
    mock_ai.analyze_growth_company.assert_not_called()

def test_getGrowthAnalysisMissingFinancials_returns400(mocker):
    # Setup mocks
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {}  # Missing financials
    mocker.patch("app.api.endpoints.reports.db", mock_db)
    
    response = client.get("/api/stocks/AAPL/growth-analysis")
    
    assert response.status_code == 400
    assert "No financial data available" in response.json()["detail"]

def test_getGrowthAnalysisNotCached_callsAIAndUpdatesDB(mocker):
    # Setup mocks
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {
        "financials": {
            "history": {
                "operating_cash_flow": [{"year": 2023, "value": 100}],
                "capex": [{"year": 2023, "value": -10}]
            }
        },
        "metrics": {"metric": {"marketCapitalization": 1000}}
    }
    mocker.patch("app.api.endpoints.reports.db", mock_db)
    
    mock_ai = MagicMock()
    mock_ai.analyze_growth_company.return_value = {"cash_burn": "High"}
    mocker.patch("app.api.endpoints.reports.ai", mock_ai)
    
    response = client.get("/api/stocks/AAPL/growth-analysis")
    
    assert response.status_code == 200
    data = response.json()
    assert data["cash_burn"] == "High"
    assert "generated_at" in data
    
    mock_ai.analyze_growth_company.assert_called_once()
    mock_db.update_company_field.assert_called_once()

def test_getReportCached_returnsReportWithoutForceFresh(mocker):
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {
        "ai_analysis": {"overview": "Good"},
        "financials": {},
        "ticker": "AAPL"
    }
    mocker.patch("app.api.endpoints.reports.db", mock_db)
    mock_compute = mocker.patch("app.api.endpoints.reports.compute_report_from_raw", return_value={"ticker": "AAPL", "status": "cached"})
    
    response = client.get("/api/report/AAPL")
    
    assert response.status_code == 200
    assert response.json() == {"ticker": "AAPL", "status": "cached"}
    mock_compute.assert_called_once()

def test_getReportInvalidTicker_returns400(mocker):
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = None
    mocker.patch("app.api.endpoints.reports.db", mock_db)
    mock_generate = mocker.patch("app.api.endpoints.reports.generate_and_cache_report", side_effect=Exception("Failed to fetch stock data"))
    
    response = client.get("/api/report/INVALID")
    
    assert response.status_code == 400
    assert "Failed to fetch stock data" in response.json()["detail"]
    mock_generate.assert_called_once()

def test_getReportForceFresh_ignoresCacheAndGeneratesNew(mocker):
    mock_db = MagicMock()
    mocker.patch("app.api.endpoints.reports.db", mock_db)
    mock_generate = mocker.patch("app.api.endpoints.reports.generate_and_cache_report", return_value={"ticker": "AAPL", "status": "fresh"})
    
    response = client.get("/api/report/AAPL?force_fresh=true")
    
    assert response.status_code == 200
    assert response.json() == {"ticker": "AAPL", "status": "fresh"}
    mock_db.get_company_data.assert_not_called()
    mock_generate.assert_called_once()

def test_getReportValidTickerNotCached_generatesNew(mocker):
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = None
    mocker.patch("app.api.endpoints.reports.db", mock_db)
    mock_generate = mocker.patch("app.api.endpoints.reports.generate_and_cache_report", return_value={"ticker": "AAPL", "status": "generated"})
    
    response = client.get("/api/report/AAPL")
    
    assert response.status_code == 200
    assert response.json() == {"ticker": "AAPL", "status": "generated"}
    mock_db.get_company_data.assert_called_once_with("AAPL")
    mock_generate.assert_called_once()


def test_getBusinessModelCachedData_returnsFromCacheWithoutCallingAI(mocker):
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {
        "context": {
            "business_model_analysis": {
                "executive_summary": "Hardware + Services ecosystem.",
                "earnings_divisions": [{"name": "iPhone", "revenue_share_pct": 51.0}],
            }
        }
    }
    mocker.patch("app.api.endpoints.reports.db", mock_db)
    mock_ai = MagicMock()
    mocker.patch("app.api.endpoints.reports.ai", mock_ai)

    response = client.get("/api/stocks/AAPL/business-model")

    assert response.status_code == 200
    assert response.json()["executive_summary"] == "Hardware + Services ecosystem."
    mock_db.get_company_data.assert_called_once_with("AAPL")
    mock_ai.analyze_business_model.assert_not_called()


def test_getBusinessModelMissingCompany_returns400(mocker):
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {}
    mocker.patch("app.api.endpoints.reports.db", mock_db)

    response = client.get("/api/stocks/UNKNOWN/business-model")

    assert response.status_code == 400
    assert "No company data available" in response.json()["detail"]


def test_getBusinessModelNotCached_callsAIAndUpdatesDB(mocker):
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {
        "name": "Alphabet Inc.",
        "profile": {"name": "Alphabet Inc.", "finnhubIndustry": "Media"},
        "financials": {"history": {"revenue": [{"year": 2024, "value": 350e9}]}},
        "metrics": {"metric": {"grossMarginTTM": 58.0}},
    }
    mocker.patch("app.api.endpoints.reports.db", mock_db)

    mock_ai = MagicMock()
    mock_ai.analyze_business_model.return_value = {
        "executive_summary": "Search ads + YouTube + Cloud.",
        "earnings_divisions": [{"name": "Google Services", "revenue_share_pct": 87.0}],
    }
    mocker.patch("app.api.endpoints.reports.ai", mock_ai)

    response = client.get("/api/stocks/GOOGL/business-model")

    assert response.status_code == 200
    data = response.json()
    assert data["executive_summary"] == "Search ads + YouTube + Cloud."
    assert "generated_at" in data
    mock_ai.analyze_business_model.assert_called_once()
    mock_db.update_company_field.assert_called_once()
    assert mock_db.update_company_field.call_args[0][0] == "GOOGL"
    assert mock_db.update_company_field.call_args[0][1] == "business_model_analysis"


def test_getBusinessModelForceFresh_bypassesCacheAndCallsAI(mocker):
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {
        "name": "Apple Inc.",
        "context": {
            "business_model_analysis": {"executive_summary": "Stale summary."}
        },
        "profile": {"name": "Apple Inc."},
        "financials": {"history": {"revenue": [{"year": 2024, "value": 391e9}]}},
    }
    mocker.patch("app.api.endpoints.reports.db", mock_db)

    mock_ai = MagicMock()
    mock_ai.analyze_business_model.return_value = {
        "executive_summary": "Fresh summary.",
        "earnings_divisions": [{"name": "Services", "revenue_share_pct": 25.0}],
    }
    mocker.patch("app.api.endpoints.reports.ai", mock_ai)

    response = client.get("/api/stocks/AAPL/business-model?force_fresh=true")

    assert response.status_code == 200
    assert response.json()["executive_summary"] == "Fresh summary."
    mock_ai.analyze_business_model.assert_called_once()
    mock_db.update_company_field.assert_called_once()


def test_getEmployeeSentimentCachedData_returnsNormalizedFromCacheWithoutCallingAI(mocker):
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {
        "name": "Apple Inc.",
        "context": {
            "employee_sentiment": {
                "ceo_name": "Tim Cook",
                "ceo_approval_pct": 90,
                "ceo_employee_rating": 90,
                "employee_happiness_score": 4.2,
                "source_platform": "Glassdoor",
                "grounded": True,
            }
        },
    }
    mocker.patch("app.api.endpoints.reports.db", mock_db)
    mock_ai = MagicMock()
    mocker.patch("app.api.endpoints.reports.ai", mock_ai)

    response = client.get("/api/stocks/AAPL/employee-sentiment")

    assert response.status_code == 200
    data = response.json()
    assert data["ceo_name"] == "Tim Cook"
    assert data["ceo_approval_pct"] == 90
    assert data["ceo_employee_rating"] == 4.5
    assert data["employee_happiness_score"] == 4.2
    assert data["grounded"] is True
    mock_ai.fetch_employee_sentiment.assert_not_called()


def test_getEmployeeSentimentMissingCompany_returns400(mocker):
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {}
    mocker.patch("app.api.endpoints.reports.db", mock_db)

    response = client.get("/api/stocks/UNKNOWN/employee-sentiment")

    assert response.status_code == 400
    assert "No company data available" in response.json()["detail"]


def test_getEmployeeSentimentNotCached_callsAIAndUpdatesDB(mocker):
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {
        "name": "Microsoft Corp",
        "context": {},
    }
    mocker.patch("app.api.endpoints.reports.db", mock_db)

    mock_ai = MagicMock()
    mock_ai.fetch_employee_sentiment.return_value = {
        "ceo_name": "Satya Nadella",
        "ceo_tenure_years": 12,
        "ceo_approval_pct": 92,
        "ceo_employee_rating": 4.6,
        "employee_happiness_score": 4.3,
        "source_platform": "Glassdoor",
        "grounding_sources": [{"title": "Glassdoor", "url": "https://www.glassdoor.com/msft"}],
        "grounded": True,
    }
    mocker.patch("app.api.endpoints.reports.ai", mock_ai)

    response = client.get("/api/stocks/MSFT/employee-sentiment")

    assert response.status_code == 200
    data = response.json()
    assert data["ceo_name"] == "Satya Nadella"
    assert data["ceo_employee_rating"] == 4.6
    assert data["employee_happiness_score"] == 4.3
    assert data["grounded"] is True
    assert "generated_at" in data
    mock_ai.fetch_employee_sentiment.assert_called_once_with("Microsoft Corp", "MSFT")
    mock_db.update_company_field.assert_called_once()
    assert mock_db.update_company_field.call_args[0][0] == "MSFT"
    assert mock_db.update_company_field.call_args[0][1] == "employee_sentiment"


def test_getEmployeeSentimentForceFresh_bypassesCacheAndCallsAI(mocker):
    mock_db = MagicMock()
    mock_db.get_company_data.return_value = {
        "name": "Apple Inc.",
        "context": {
            "employee_sentiment": {
                "ceo_name": "Tim Cook",
                "ceo_employee_rating": 4.0,
                "employee_happiness_score": 3.9,
                "grounded": True,
            }
        },
    }
    mocker.patch("app.api.endpoints.reports.db", mock_db)

    mock_ai = MagicMock()
    mock_ai.fetch_employee_sentiment.return_value = {
        "ceo_name": "Tim Cook",
        "ceo_approval_pct": 91,
        "ceo_employee_rating": 4.6,
        "employee_happiness_score": 4.2,
        "source_platform": "Glassdoor",
        "grounded": True,
    }
    mocker.patch("app.api.endpoints.reports.ai", mock_ai)

    response = client.get("/api/stocks/AAPL/employee-sentiment?force_fresh=true")

    assert response.status_code == 200
    data = response.json()
    assert data["ceo_employee_rating"] == 4.6
    assert data["employee_happiness_score"] == 4.2
    mock_ai.fetch_employee_sentiment.assert_called_once_with("Apple Inc.", "AAPL")
    mock_db.update_company_field.assert_called_once()

