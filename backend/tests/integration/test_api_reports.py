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
