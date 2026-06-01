import pytest
import json
from unittest.mock import MagicMock
from app.services.analyst_service import AnalystService

@pytest.fixture
def mocker_genai_client(mocker):
    # Mock the genai.Client so it doesn't make real network calls
    mock_client = MagicMock()
    mocker.patch('app.services.analyst_service.genai.Client', return_value=mock_client)
    return mock_client

@pytest.fixture
def service(mocker_genai_client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "dummy_key_for_testing")
    return AnalystService()

def test_analyzeQualitativeValidResponse_returnsParsedDict(service, mocker_genai_client):
    # Setup mock response
    mock_response = MagicMock()
    mock_response.text = '```json\n{"strengths": ["Strong brand"], "weaknesses": ["High debt"]}\n```'
    mocker_genai_client.models.generate_content.return_value = mock_response

    company_name = "Apple"
    profile = {"name": "Apple Inc."}
    metrics = {"pe": 25.0}

    result = service.analyze_qualitative(company_name, profile, metrics)

    assert result == {"strengths": ["Strong brand"], "weaknesses": ["High debt"]}
    mocker_genai_client.models.generate_content.assert_called_once()

def test_analyzeGrowthCompanyValidResponse_returnsParsedDict(service, mocker_genai_client):
    # Setup mock response without markdown wrappers
    mock_response = MagicMock()
    mock_response.text = '{"cash_burn": "High", "path_to_profitability": "Clear"}'
    mocker_genai_client.models.generate_content.return_value = mock_response

    company_name = "Uber"
    context_data = {"margins": "-10%"}

    result = service.analyze_growth_company(company_name, context_data)

    assert result == {"cash_burn": "High", "path_to_profitability": "Clear"}
    mocker_genai_client.models.generate_content.assert_called_once()

def test_generateWithRetryAllModelsFail_returnsErrorDict(service, mocker_genai_client):
    # Make the generate_content raise an exception every time it's called
    mocker_genai_client.models.generate_content.side_effect = Exception("API Down")

    result = service.analyze_qualitative("Apple", {}, {})

    assert "error" in result
    assert "AI Studio Generation Failed" in result["error"]
    assert mocker_genai_client.models.generate_content.call_count == 3  # Tried all 3 models
