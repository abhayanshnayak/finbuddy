import pytest
import json
from unittest.mock import MagicMock
from app.services.analyst_service import AnalystService


def _extract_thinking_level(config):
    if getattr(config, "thinking_config", None) is not None:
        level = getattr(config.thinking_config, "thinking_level", None)
        if level is not None:
            return level
    if getattr(config, "http_options", None) is not None and config.http_options.extra_body:
        return (
            config.http_options.extra_body
            .get("generationConfig", {})
            .get("thinkingConfig", {})
            .get("thinkingLevel")
        )
    return None


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
    call_kwargs = mocker_genai_client.models.generate_content.call_args.kwargs
    assert call_kwargs["model"] == "gemini-4-hydrogen"
    assert call_kwargs["config"].response_mime_type == "application/json"
    assert _extract_thinking_level(call_kwargs["config"]) == "high"

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
    call_kwargs = mocker_genai_client.models.generate_content.call_args.kwargs
    assert call_kwargs["model"] == "gemini-3.5-flash-lite"
    assert call_kwargs["config"].response_mime_type == "application/json"
    assert _extract_thinking_level(call_kwargs["config"]) == "medium"

def test_generateWithRetryAllModelsFail_returnsErrorDict(service, mocker_genai_client):
    # Make the generate_content raise an exception every time it's called
    mocker_genai_client.models.generate_content.side_effect = Exception("API Down")

    result = service.analyze_qualitative("Apple", {}, {})

    assert "error" in result
    assert "AI Studio Generation Failed" in result["error"]
    assert mocker_genai_client.models.generate_content.call_count == 3  # Tried all 3 models
    called_models = [
        (call.kwargs["model"], _extract_thinking_level(call.kwargs["config"]))
        for call in mocker_genai_client.models.generate_content.call_args_list
    ]
    assert called_models == [
        ("gemini-4-hydrogen", "high"),
        ("gemini-3.8-flash", "medium"),
        ("gemini-3.5-flash-lite", "medium"),
    ]

def test_analyzeGrowthCompanyFallbackOrder_triesAllModels(service, mocker_genai_client):
    mocker_genai_client.models.generate_content.side_effect = Exception("API Down")

    result = service.analyze_growth_company("Uber", {})

    assert "error" in result
    called_models = [
        (call.kwargs["model"], _extract_thinking_level(call.kwargs["config"]))
        for call in mocker_genai_client.models.generate_content.call_args_list
    ]
    assert called_models == [
        ("gemini-3.5-flash-lite", "medium"),
        ("gemini-3.8-flash", "medium"),
        ("gemini-4-hydrogen", "high"),
    ]

def test_generateWithRetry_recoversOnFallbackModel(service, mocker_genai_client):
    mock_response = MagicMock()
    mock_response.text = '{"overview": "Recovered"}'
    mocker_genai_client.models.generate_content.side_effect = [
        Exception("Primary overloaded"),
        mock_response,
    ]

    result = service.analyze_qualitative("Apple", {}, {})

    assert result == {"overview": "Recovered"}
    assert mocker_genai_client.models.generate_content.call_count == 2
    assert mocker_genai_client.models.generate_content.call_args_list[0].kwargs["model"] == "gemini-4-hydrogen"
    assert mocker_genai_client.models.generate_content.call_args_list[1].kwargs["model"] == "gemini-3.8-flash"

def test_analyzeQualitativePrompt_includesExhaustiveCompetitorFields(service, mocker_genai_client):
    mock_response = MagicMock()
    mock_response.text = '{"competitors": {"market_structure_verdict": {"quadrant": "Clear Moat in a Growing Pie"}, "competitor_list": []}}'
    mocker_genai_client.models.generate_content.return_value = mock_response

    service.analyze_qualitative("NVIDIA", {"name": "NVIDIA Corp"}, {"pe": 45.0})

    sent_prompt = mocker_genai_client.models.generate_content.call_args.kwargs["contents"]
    assert "NVIDIA" in sent_prompt
    assert "market_structure_verdict" in sent_prompt
    assert "Clear Moat in a Growing Pie" in sent_prompt
    assert "Fixed-Size Market with Little Moat" in sent_prompt
    assert "how_they_compete" in sent_prompt
    assert "moat_comparison" in sent_prompt
    assert "competitive_dynamics_summary" in sent_prompt


def test_analyzeBusinessModelValidResponse_returnsParsedDictAndFormatsPrompt(service, mocker_genai_client):
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "executive_summary": "Cloud and productivity software compounder.",
        "revenue_model_archetype": "Usage-Based Cloud + Enterprise SaaS",
        "earnings_divisions": [
            {"name": "Intelligent Cloud", "revenue_share_pct": 43.0}
        ],
    })
    mocker_genai_client.models.generate_content.return_value = mock_response

    result = service.analyze_business_model(
        "Microsoft",
        {"ticker": "MSFT", "margin_and_efficiency_metrics": {"grossMarginTTM": 69.5}},
    )

    assert result["revenue_model_archetype"] == "Usage-Based Cloud + Enterprise SaaS"
    assert result["earnings_divisions"][0]["name"] == "Intelligent Cloud"

    call_kwargs = mocker_genai_client.models.generate_content.call_args.kwargs
    assert call_kwargs["model"] == "gemini-4-hydrogen"
    assert call_kwargs["config"].response_mime_type == "application/json"
    assert _extract_thinking_level(call_kwargs["config"]) == "high"

    sent_prompt = call_kwargs["contents"]
    assert "Microsoft" in sent_prompt
    assert "earnings_divisions" in sent_prompt
    assert "company_unit_economics" in sent_prompt
    assert "how_it_makes_money" in sent_prompt
    assert "earnings_kpis" in sent_prompt


def test_analyzeBusinessModelFallbackOrder_triesAllModels(service, mocker_genai_client):
    mocker_genai_client.models.generate_content.side_effect = Exception("API Down")

    result = service.analyze_business_model("Microsoft", {"ticker": "MSFT"})

    assert "error" in result
    called_models = [
        (call.kwargs["model"], _extract_thinking_level(call.kwargs["config"]))
        for call in mocker_genai_client.models.generate_content.call_args_list
    ]
    assert called_models == [
        ("gemini-4-hydrogen", "high"),
        ("gemini-3.8-flash", "medium"),
        ("gemini-3.5-flash-lite", "medium"),
    ]
