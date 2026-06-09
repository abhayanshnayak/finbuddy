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

def test_process_message_unauthorized():
    payload = {
        "message": {
            "data": "eyJ0aWNrZXIiOiAiTVNGVCIsICJiYXRjaF9pZCI6ICJiYXRjaF8xMjMifQ==",
            "message_id": "12345"
        }
    }
    response = client.post("/process_and_store_ticker_data", json=payload)
    assert response.status_code == 401
    assert response.text == "Unauthorized"

def test_process_message_authorized(mocker):
    # Mock token verification to succeed
    mocker.patch("app.worker.verify_pubsub_token", return_value=True)
    
    mock_db = MagicMock()
    mock_db.get_batch.return_value = {
        "symbols": {
            "MSFT": {"status": "pending"}
        }
    }
    mocker.patch("app.worker.db", mock_db)
    
    # Mock executor run to prevent executing actual background reports
    mocker.patch("asyncio.get_event_loop")
    
    payload = {
        "message": {
            "data": "eyJ0aWNrZXIiOiAiTVNGVCIsICJiYXRjaF9pZCI6ICJiYXRjaF8xMjMifQ==",
            "message_id": "12345"
        }
    }
    
    headers = {"Authorization": "Bearer dummy_token"}
    response = client.post("/process_and_store_ticker_data", json=payload, headers=headers)
    assert response.status_code == 200

