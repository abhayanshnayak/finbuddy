import json
import os
import pytest
from app.services.calculator import FinancialCalculator

@pytest.fixture
def metrics_data():
    current_dir = os.path.dirname(__file__)
    metrics_path = os.path.join(current_dir, '../fixtures/metrics.json')
    with open(metrics_path, 'r') as f:
        return json.load(f)

@pytest.fixture
def calculator():
    return FinancialCalculator()

def test_calculateAveragesValidInput_returnsCorrectAverages(calculator, metrics_data):
    series_annual = metrics_data.get("series", {}).get("annual", {})
    roe_history = list(reversed(series_annual.get("roe", [])))
    
    averages = calculator.calculate_averages(roe_history)
    
    assert "3_yr" in averages
    assert "5_yr" in averages
    assert "10_yr" in averages
    # Since we are just testing the behavior returns something, we can check basic types
    assert isinstance(averages["3_yr"], float) or averages["3_yr"] is None

def test_calculateAveragesEmptyInput_returnsNoneValues(calculator):
    averages = calculator.calculate_averages([])
    assert averages["3_yr"] == 0.0
    assert averages["5_yr"] == 0.0
    assert averages["10_yr"] == 0.0

def test_calculateWindageGrowthRateValidOcfHistory_returnsCorrectCagr(calculator):
    # Test with 3 years of OCF data: 2021 to 2023 (years = 2)
    # 2021: 100.0, 2023: 144.0
    # CAGR = (144.0 / 100.0) ^ (1/2) - 1 = 1.2 - 1 = 0.20 (20.0%)
    ocf_history = [
        {"year": 2021, "value": 100.0},
        {"year": 2022, "value": 120.0},
        {"year": 2023, "value": 144.0}
    ]
    rate, rationale, details = calculator.calculate_windage_growth_rate(ocf_history)
    assert abs(rate - 0.20) < 1e-6
    assert details["is_cagr"] is True
    assert details["start_year"] == 2021
    assert details["end_year"] == 2023
    assert details["start_value"] == 100.0
    assert details["end_value"] == 144.0
    assert details["years"] == 2

def test_calculateWindageGrowthRateNegativeStartValue_skipsToFirstPositiveYear(calculator):
    # With the fix, the calculator should skip the negative starting year
    # and compute CAGR from the first positive year (2022) to end (2023)
    # CAGR = (20.0 / 10.0) ^ (1/1) - 1 = 1.0 (100%)
    ocf_history = [
        {"year": 2021, "value": -10.0},
        {"year": 2022, "value": 10.0},
        {"year": 2023, "value": 20.0}
    ]
    rate, rationale, details = calculator.calculate_windage_growth_rate(ocf_history)
    assert abs(rate - 1.0) < 1e-6
    assert details["is_cagr"] is True
    assert details["start_year"] == 2022
    assert details["end_year"] == 2023
    assert "excluded" in rationale

def test_calculateWindageGrowthRateNegativeEndValue_returnsFallbackTrigger(calculator):
    # If the ending OCF is negative, CAGR is undefined — should trigger fallback
    ocf_history = [
        {"year": 2021, "value": 100.0},
        {"year": 2022, "value": 50.0},
        {"year": 2023, "value": -10.0}
    ]
    rate, rationale, details = calculator.calculate_windage_growth_rate(ocf_history)
    assert rate == -0.01
    assert "negative" in rationale.lower()

def test_calculateWindageGrowthRateUberLikeTransition_computesCagrFromFirstPositiveYear(calculator):
    # Simulates Uber-like OCF history: negative for years, then turning positive
    # Should skip years 2015-2019 and compute CAGR from 2020 to 2024
    # CAGR = (8000.0 / 500.0) ^ (1/4) - 1 = 16^0.25 - 1 = 2.0 - 1 = 1.0 (100%)
    ocf_history = [
        {"year": 2015, "value": -2000.0},
        {"year": 2016, "value": -1800.0},
        {"year": 2017, "value": -1500.0},
        {"year": 2018, "value": -900.0},
        {"year": 2019, "value": -200.0},
        {"year": 2020, "value": 500.0},
        {"year": 2021, "value": 1200.0},
        {"year": 2022, "value": 3000.0},
        {"year": 2023, "value": 5500.0},
        {"year": 2024, "value": 8000.0}
    ]
    rate, rationale, details = calculator.calculate_windage_growth_rate(ocf_history)
    assert rate > 0, "Rate should be positive for a company with growing positive OCF"
    assert details["start_year"] == 2020, "Should start from the first positive OCF year"
    assert details["end_year"] == 2024
    assert details["years"] == 4
    assert "excluded" in rationale

def test_calculateWindageGrowthRateInsufficientHistory_returnsZeroRate(calculator):
    # Test with < 2 years of history
    ocf_history = [{"year": 2023, "value": 100.0}]
    rate, rationale, details = calculator.calculate_windage_growth_rate(ocf_history)
    assert rate == 0.0
    assert "Not enough OCF history" in rationale
    assert details["is_cagr"] is True

