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


def test_extractKeyMetricsWorkingCapital_computesBalanceSheetYoYChangeAndCashFlowFallback(client, mocker):
    symbol = "AAPL"
    mock_data = {
        "data": [
            {
                "year": 2022,
                "report": {
                    "ic": [{"concept": "us-gaap_NetIncomeLoss", "value": "99803000000"}],
                    "cf": [
                        {"concept": "us-gaap_IncreaseDecreaseInOperatingCapital", "value": "-1200000000"}
                    ],
                    "bs": [
                        # Non-cash current assets = 135B - (23B + 25B) = 87B
                        # Non-debt current liabilities = 154B - (10B + 11B) = 133B
                        # NCWC_2022 = 87B - 133B = -46B
                        {"concept": "us-gaap_AssetsCurrent", "value": "135000000000"},
                        {"concept": "us-gaap_CashAndCashEquivalentsAtCarryingValue", "value": "23000000000"},
                        {"concept": "us-gaap_MarketableSecuritiesCurrent", "value": "25000000000"},
                        {"concept": "us-gaap_LiabilitiesCurrent", "value": "154000000000"},
                        {"concept": "us-gaap_CommercialPaper", "value": "10000000000"},
                        {"concept": "us-gaap_LongTermDebtCurrent", "value": "11000000000"},
                    ]
                }
            },
            {
                "year": 2023,
                "report": {
                    "ic": [{"concept": "us-gaap_NetIncomeLoss", "value": "96995000000"}],
                    "cf": [],
                    "bs": [
                        # Non-cash current assets = 144B - 62B = 82B
                        # Non-debt current liabilities = 145B - 16B = 129B
                        # NCWC_2023 = 82B - 129B = -47B
                        # ΔWC_2023 = -47B - (-46B) = -1B (WC decreased -> cash inflow)
                        {"concept": "us-gaap_AssetsCurrent", "value": "144000000000"},
                        {"concept": "us-gaap_CashCashEquivalentsAndShortTermInvestments", "value": "62000000000"},
                        {"concept": "us-gaap_LiabilitiesCurrent", "value": "145000000000"},
                        {"concept": "us-gaap_DebtCurrent", "value": "16000000000"},
                    ]
                }
            },
            {
                "year": 2024,
                "report": {
                    "ic": [{"concept": "us-gaap_NetIncomeLoss", "value": "93736000000"}],
                    "cf": [],
                    "bs": [
                        # Non-cash current assets = 153B - 65B = 88B
                        # Non-debt current liabilities = 140B - 12B = 128B
                        # NCWC_2024 = 88B - 128B = -40B
                        # ΔWC_2024 = -40B - (-47B) = +7B (WC increased -> cash outflow)
                        {"concept": "us-gaap_AssetsCurrent", "value": "153000000000"},
                        {"concept": "us-gaap_CashCashEquivalentsAndShortTermInvestments", "value": "65000000000"},
                        {"concept": "us-gaap_LiabilitiesCurrent", "value": "140000000000"},
                        {"concept": "us-gaap_DebtCurrent", "value": "12000000000"},
                    ]
                }
            }
        ]
    }

    mock_get = mocker.patch("requests.get")
    mock_get.return_value.json.return_value = mock_data
    mock_get.return_value.raise_for_status = MagicMock()

    metrics = client.extract_key_metrics(symbol)
    wc = metrics["history"]["working_capital"]
    wc_chg = metrics["history"]["working_capital_change"]

    assert wc[0]["value"] == pytest.approx(-46e9)
    assert wc[1]["value"] == pytest.approx(-47e9)
    assert wc[2]["value"] == pytest.approx(-40e9)

    # 2022 has no prior BS year -> uses CF fallback tag
    assert wc_chg[0]["value"] == pytest.approx(-1.2e9)
    assert wc_chg[0]["source"] == "cash_flow"

    # 2023 & 2024 use Balance Sheet ΔNCWC
    assert wc_chg[1]["value"] == pytest.approx(-1e9)
    assert wc_chg[1]["source"] == "balance_sheet"
    assert wc_chg[2]["value"] == pytest.approx(7e9)
    assert wc_chg[2]["source"] == "balance_sheet"


def test_extractKeyMetricsWorkingCapitalUnavailable_marksUnavailableSafely(client, mocker):
    mock_data = {
        "data": [
            {
                "year": 2024,
                "report": {"ic": [], "cf": [], "bs": []}
            }
        ]
    }
    mock_get = mocker.patch("requests.get")
    mock_get.return_value.json.return_value = mock_data
    mock_get.return_value.raise_for_status = MagicMock()

    metrics = client.extract_key_metrics("JPM")
    assert metrics["history"]["working_capital"][0]["available"] is False
    assert metrics["history"]["working_capital_change"][0]["value"] == 0.0
    assert metrics["history"]["working_capital_change"][0]["source"] == "unavailable"

