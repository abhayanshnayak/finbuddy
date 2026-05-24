import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app

client = TestClient(app)

def test_getAllCompanies_returnsList(mocker):
    # Mock DBService
    mock_db = MagicMock()
    mock_db.list_companies.return_value = [{"ticker": "AAPL", "name": "Apple Inc."}]
    mocker.patch("app.api.endpoints.companies.db", mock_db)
    
    response = client.get("/api/companies")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["ticker"] == "AAPL"
    
    mock_db.list_companies.assert_called_once()

def test_getAllCompaniesNoData_returnsEmptyList(mocker):
    # Mock DBService to return empty list
    mock_db = MagicMock()
    mock_db.list_companies.return_value = []
    mocker.patch("app.api.endpoints.companies.db", mock_db)
    
    response = client.get("/api/companies")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0
    
    mock_db.list_companies.assert_called_once()
