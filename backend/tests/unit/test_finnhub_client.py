import pytest
from unittest.mock import MagicMock
from app.services.finnhub_client import FinnhubClient

@pytest.fixture
def client():
    return FinnhubClient(api_key="test_key")

def test_getProfileValidSymbol_returnsProfileDict(client, mocker):
    symbol = "AAPL"
    mock_response = {"country": "US", "currency": "USD", "name": "Apple Inc."}
    
    mock_get = mocker.patch("requests.get")
    mock_get.return_value.json.return_value = mock_response
    mock_get.return_value.raise_for_status = MagicMock()
    
    profile = client.get_profile(symbol)
    assert profile["name"] == "Apple Inc."
    assert profile["country"] == "US"
    mock_get.assert_called_once()

def test_getQuoteValidSymbol_returnsQuoteDict(client, mocker):
    symbol = "AAPL"
    mock_response = {"c": 150.0, "d": 1.5, "dp": 1.0}
    
    mock_get = mocker.patch("requests.get")
    mock_get.return_value.json.return_value = mock_response
    mock_get.return_value.raise_for_status = MagicMock()
    
    quote = client.get_quote(symbol)
    assert quote["c"] == 150.0
    mock_get.assert_called_once()

def test_getMetricsValidSymbol_returnsMetricsDict(client, mocker):
    symbol = "AAPL"
    mock_response = {"metric": {"52WeekHigh": 150.0}}
    
    mock_get = mocker.patch("requests.get")
    mock_get.return_value.json.return_value = mock_response
    mock_get.return_value.raise_for_status = MagicMock()
    
    metrics = client.get_metrics(symbol)
    assert metrics["metric"]["52WeekHigh"] == 150.0
    mock_get.assert_called_once()

def test_extractKeyMetricsValidData_extractsSuccessfully(client, mocker):
    symbol = "AAPL"
    
    mock_data = {
        "data": [
            {
                "year": 2023,
                "report": {
                    "ic": [
                        {"concept": "us-gaap_Revenues", "value": "100000"}
                    ],
                    "cf": [
                        {"concept": "us-gaap_NetCashProvidedByUsedInOperatingActivities", "value": "50000"}
                    ],
                    "bs": [
                        {"concept": "us-gaap_StockholdersEquity", "value": "200000"}
                    ]
                }
            }
        ]
    }
    
    mock_get = mocker.patch("requests.get")
    mock_get.return_value.json.return_value = mock_data
    mock_get.return_value.raise_for_status = MagicMock()
    
    metrics = client.extract_key_metrics(symbol)
    assert len(metrics["history"]["revenue"]) == 1
    assert metrics["history"]["revenue"][0]["value"] == 100000.0
    assert metrics["history"]["operating_cash_flow"][0]["value"] == 50000.0
    assert metrics["history"]["book_value"][0]["value"] == 200000.0
    mock_get.assert_called_once()

def test_getProfileHttpError_raisesException(client, mocker):
    symbol = "INVALID"
    
    mock_get = mocker.patch("requests.get")
    mock_get.return_value.raise_for_status.side_effect = Exception("HTTP Error")
    
    with pytest.raises(Exception):
        client.get_profile(symbol)

def test_extractKeyMetricsContinuingOperationsData_extractsSuccessfully(client, mocker):
    symbol = "AAPL"
    mock_data = {
        "data": [
            {
                "year": 2016,
                "report": {
                    "ic": [
                        {"concept": "us-gaap_Revenues", "value": "215639000000"},
                        {"concept": "us-gaap_NetIncomeLoss", "value": "45687000000"}
                    ],
                    "cf": [
                        {"concept": "us-gaap_NetCashProvidedByUsedInOperatingActivitiesContinuingOperations", "value": "65824000000"},
                        {"concept": "us-gaap_PaymentsForPropertyPlantAndEquipmentContinuingOperations", "value": "12734000000"},
                        {"concept": "us-gaap_DepreciationDepletionAndAmortizationContinuingOperations", "value": "10505000000"}
                    ],
                    "bs": [
                        {"concept": "us-gaap_StockholdersEquity", "value": "128249000000"},
                        {"concept": "us-gaap_CashAndCashEquivalentsAtCarryingValue", "value": "20484000000"}
                    ]
                }
            }
        ]
    }
    
    mock_get = mocker.patch("requests.get")
    mock_get.return_value.json.return_value = mock_data
    mock_get.return_value.raise_for_status = MagicMock()
    
    metrics = client.extract_key_metrics(symbol)
    assert len(metrics["history"]["revenue"]) == 1
    assert metrics["history"]["operating_cash_flow"][0]["value"] == 65824000000.0
    assert metrics["history"]["capex"][0]["value"] == 12734000000.0
    assert metrics["history"]["da"][0]["value"] == 10505000000.0
    assert metrics["history"]["net_income"][0]["value"] == 45687000000.0
    mock_get.assert_called_once()

