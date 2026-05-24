import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app

client = TestClient(app)

def test_submitBatchValidPayload_returnsBatchId(mocker):
    # Mock the DBService used in the router
    mock_db = MagicMock()
    mocker.patch("app.api.endpoints.batches.db", mock_db)
    
    # We should also mock local_background_ingest so we don't actually kick off the background task processing
    mocker.patch("app.api.endpoints.batches.local_background_ingest")
    
    payload = {"tickers": ["MSFT", "GOOGL", "INVALID"]}
    response = client.post("/api/batch", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    assert "batch_id" in data
    assert data["total_symbols"] == 3
    
    # Assert save_batch was called
    mock_db.save_batch.assert_called_once()

def test_getBatchStatusValidId_returnsStatus(mocker):
    # Mock the DBService
    mock_db = MagicMock()
    mock_db.get_batch.return_value = {
        "status": "processing",
        "total_symbols": 3,
        "completed_count": 0,
        "failed_count": 0,
        "symbols": {
            "MSFT": {"status": "pending"},
            "GOOGL": {"status": "pending"},
            "INVALID": {"status": "pending"}
        }
    }
    mocker.patch("app.api.endpoints.batches.db", mock_db)
    
    response = client.get("/api/batch/batch_123")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processing"
    assert data["total_symbols"] == 3
    mock_db.get_batch.assert_called_once_with("batch_123")

def test_submitBatchMissingTickers_returns422(mocker):
    payload = {}
    response = client.post("/api/batch", json=payload)
    
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    assert data["detail"][0]["loc"] == ["body", "tickers"]

def test_getBatchStatusInvalidId_returns404(mocker):
    mock_db = MagicMock()
    mock_db.get_batch.return_value = None
    mocker.patch("app.api.endpoints.batches.db", mock_db)
    
    response = client.get("/api/batch/invalid_batch_id")
    
    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Batch not found"
    mock_db.get_batch.assert_called_once_with("invalid_batch_id")
