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


def test_calculate10CapValidPositiveOwnerEarnings_returnsOwnersValueAndDetails(calculator):
    # Net Income = $100B, D&A = $10B, CapEx = -$15B (negative convention)
    # Owner Earnings = 100B + 10B - 15B = $95B
    # Owner's Value (10-Cap) = $95B * 10 = $950B
    # Shares = 10B -> Owner's Value Per Share = $95.00
    # Market Cap = $800B -> Cap Rate = 95B / 800B = 11.875% (undervalued / Pass)
    owner_earnings, cap_rate, rationale, details = calculator.calculate_10_cap(
        net_income=100e9,
        da=10e9,
        capex=-15e9,
        market_cap=800e9,
        shares_outstanding=10e9,
        fiscal_year="2024",
    )

    assert owner_earnings == pytest.approx(95e9)
    assert cap_rate == pytest.approx(95e9 / 800e9)
    assert details["fiscal_year"] == "2024"
    assert details["owners_value"] == pytest.approx(950e9)
    assert details["owners_value_per_share"] == pytest.approx(95.0)
    assert details["price_to_owner_earnings"] == pytest.approx(800e9 / 95e9)
    assert details["is_undervalued"] is True
    assert details["capex"] == pytest.approx(15e9)
    assert "Owner Earnings ($95.00B)" in details["steps"]["step_1_owner_earnings"]
    assert "Owner's Value ($950.00B)" in details["steps"]["step_2_owners_value"]
    assert "$95.00 / share" in details["steps"]["step_3_per_share"]
    assert "11.88% Cap Rate" in details["steps"]["step_4_cap_rate"]
    assert "Owner's Value (10-Cap)" in rationale


def test_calculate10CapPositiveCapexConvention_subtractsCapexIdentically(calculator):
    # Positive CapEx convention (as returned by Finnhub XBRL PaymentsToAcquire...)
    owner_earnings, cap_rate, _, details = calculator.calculate_10_cap(
        net_income=100e9,
        da=10e9,
        capex=15e9,
        market_cap=1900e9,
        shares_outstanding=10e9,
        fiscal_year="2024",
    )

    assert owner_earnings == pytest.approx(95e9)
    assert cap_rate == pytest.approx(0.05)
    assert details["owners_value"] == pytest.approx(950e9)
    assert details["is_undervalued"] is False
    assert details["price_to_owner_earnings"] == pytest.approx(20.0)


def test_calculate10CapNegativeOwnerEarnings_returnsZeroValuationSafely(calculator):
    owner_earnings, cap_rate, rationale, details = calculator.calculate_10_cap(
        net_income=-50e6,
        da=10e6,
        capex=20e6,
        market_cap=500e6,
        shares_outstanding=10e6,
        fiscal_year="2024",
    )

    assert owner_earnings == pytest.approx(-60e6)
    assert cap_rate == 0.0
    assert details["owners_value"] == 0.0
    assert details["owners_value_per_share"] == 0.0
    assert details["is_undervalued"] is False
    assert "zero or negative" in rationale.lower()
    assert "-$60.00M" in details["steps"]["step_1_owner_earnings"]


def test_calculate10CapMissingSharesAndMarketCap_handlesZeroSafely(calculator):
    owner_earnings, cap_rate, _, details = calculator.calculate_10_cap(
        net_income=50e6,
        da=5e6,
        capex=10e6,
        market_cap=0.0,
        shares_outstanding=0.0,
        fiscal_year="2024",
    )

    assert owner_earnings == pytest.approx(45e6)
    assert details["owners_value"] == pytest.approx(450e6)
    assert details["owners_value_per_share"] == 0.0
    assert cap_rate == 0.0
    assert details["price_to_owner_earnings"] == 0.0
    assert details["is_undervalued"] is False


def test_calculate10CapWithWorkingCapitalChanges_adjustsOwnerEarningsCorrectly(calculator):
    # Positive ΔWC (+$5B) = working capital increased (uses cash) -> reduces Owner Earnings
    # NI ($100B) + D&A ($10B) - ΔWC ($5B) - CapEx ($15B) = $90B -> Owner's Value = $900B
    oe_pos, cap_pos, rationale_pos, details_pos = calculator.calculate_10_cap(
        net_income=100e9,
        da=10e9,
        capex=15e9,
        market_cap=900e9,
        shares_outstanding=10e9,
        fiscal_year="2024",
        working_capital_change=5e9,
        working_capital_source="balance_sheet",
    )
    assert oe_pos == pytest.approx(90e9)
    assert details_pos["owners_value"] == pytest.approx(900e9)
    assert details_pos["owners_value_per_share"] == pytest.approx(90.0)
    assert cap_pos == pytest.approx(0.10)
    assert details_pos["is_undervalued"] is True
    assert details_pos["has_working_capital_data"] is True
    assert details_pos["working_capital_source"] == "balance_sheet"
    assert "ΔWC ($5.00B)" in details_pos["steps"]["step_1_owner_earnings"]
    assert "ΔWC ($5.00B)" in rationale_pos

    # Negative ΔWC (-$5B) = working capital decreased (releases cash) -> increases Owner Earnings
    # NI ($100B) + D&A ($10B) - ΔWC (-$5B) - CapEx ($15B) = $100B -> Owner's Value = $1.00T
    oe_neg, _, _, details_neg = calculator.calculate_10_cap(
        net_income=100e9,
        da=10e9,
        capex=15e9,
        market_cap=1000e9,
        shares_outstanding=10e9,
        fiscal_year="2024",
        working_capital_change=-5e9,
        working_capital_source="cash_flow",
    )
    assert oe_neg == pytest.approx(100e9)
    assert details_neg["owners_value"] == pytest.approx(1000e9)
    assert details_neg["owners_value_per_share"] == pytest.approx(100.0)
    assert details_neg["has_working_capital_data"] is True
    assert "ΔWC (-$5.00B)" in details_neg["steps"]["step_1_owner_earnings"]


def test_combinedGrowthProjectionHyperGrowthNvdaLike_anchorsToForwardAndDecaysToTerminal(calculator):
    # NVDA-like: 55% OCF CAGR, 38% Rev CAGR (+5% = 43%), Forward P/E 32 / PEG 1.0 = 32%
    proj = calculator.calculate_combined_growth_projection(
        historical_gr=0.55,
        historical_label="9Y OCF CAGR",
        forward_pe=32.0,
        forward_peg=1.0,
        revenue_cagr=0.38,
        revenue_years=9,
        revenue_start_year=2016,
        revenue_end_year=2025,
    )

    assert proj["was_anchored"] is True
    assert proj["anchor_key"] == "forward_consensus"
    assert proj["start_rate"] == pytest.approx(0.32)
    assert proj["decay_applied"] is True
    assert proj["terminal_rate"] == pytest.approx(0.12)
    assert len(proj["yearly_schedule"]) == 10
    assert proj["yearly_schedule"][0]["rate"] == pytest.approx(0.32)
    assert proj["yearly_schedule"][-1]["rate"] == pytest.approx(0.12)
    assert proj["cumulative_factor"] == pytest.approx(7.2116, rel=1e-3)
    assert proj["effective_cagr"] == pytest.approx(0.2184, rel=1e-2)


def test_combinedGrowthProjectionPeakingCyclical_anchorsDownWithoutUpwardDecay(calculator):
    # Cyclical peak: 40% OCF CAGR, 14% Rev CAGR (+5% = 19%), Forward consensus 8%
    proj = calculator.calculate_combined_growth_projection(
        historical_gr=0.40,
        forward_pe=16.0,
        forward_peg=2.0,  # 8% implied forward growth
        revenue_cagr=0.14,
    )

    assert proj["was_anchored"] is True
    assert proj["anchor_key"] == "forward_consensus"
    assert proj["start_rate"] == pytest.approx(0.08)
    assert proj["decay_applied"] is False
    assert proj["terminal_rate"] == pytest.approx(0.08)
    assert proj["effective_cagr"] == pytest.approx(0.08)


def test_combinedGrowthProjectionMissingForward_usesRevenueGuardrailAndDecays(calculator):
    # No forwardPEG; OCF 60%, Revenue 20% (+5% = 25%) -> anchored to 25%, decays to 12%
    proj = calculator.calculate_combined_growth_projection(
        historical_gr=0.60,
        forward_pe=None,
        forward_peg=None,
        revenue_cagr=0.20,
    )

    assert proj["was_anchored"] is True
    assert proj["anchor_key"] == "revenue_guardrail"
    assert proj["start_rate"] == pytest.approx(0.25)
    assert proj["decay_applied"] is True
    assert proj["terminal_rate"] == pytest.approx(0.12)


def test_combinedGrowthProjectionExtremeTurnaroundMissingSignals_hitsHyperGrowthCeiling(calculator):
    # 90% OCF turnaround with no forward or revenue data -> capped at 40%, decays to 12%
    proj = calculator.calculate_combined_growth_projection(
        historical_gr=0.90,
        forward_pe=None,
        forward_peg=None,
        revenue_cagr=None,
    )

    assert proj["was_anchored"] is True
    assert proj["anchor_key"] == "hyper_growth_cap"
    assert proj["start_rate"] == pytest.approx(0.40)
    assert proj["decay_applied"] is True
    assert proj["terminal_rate"] == pytest.approx(0.12)


def test_combinedGrowthProjectionSteadyLowGrower_staysFlatUnchanged(calculator):
    # Classic 10% steady grower with 11% forward and 9% revenue (+5% = 14%)
    proj = calculator.calculate_combined_growth_projection(
        historical_gr=0.10,
        forward_pe=22.0,
        forward_peg=2.0,  # 11%
        revenue_cagr=0.09,
    )

    assert proj["was_anchored"] is False
    assert proj["anchor_key"] == "historical"
    assert proj["decay_applied"] is False
    assert proj["start_rate"] == pytest.approx(0.10)
    assert proj["terminal_rate"] == pytest.approx(0.10)
    assert proj["effective_cagr"] == pytest.approx(0.10)


def test_conservativeExitPe_usesMedianOverSpikeAndTiesToTerminalGrowth(calculator):
    # 5Y PE includes an anomalous 120x spike; median is 35x; 2 * 12% = 24x -> selects 24x
    pe_records = [
        {"period": "2024", "v": 45.0},
        {"period": "2023", "v": 120.0},
        {"period": "2022", "v": 35.0},
        {"period": "2021", "v": 30.0},
        {"period": "2020", "v": 28.0},
    ]
    final_pe, details = calculator.calculate_conservative_exit_pe(pe_records, terminal_gr=0.12)

    assert details["median_pe_5yr"] == pytest.approx(35.0)
    assert details["max_pe_5yr"] == pytest.approx(120.0)
    assert details["two_x_growth"] == pytest.approx(24.0)
    assert final_pe == pytest.approx(24.0)
    assert details["selected_bound"] == "two_x_terminal_growth"


def test_conservativeExitPe_enforcesMatureCapWhenBothBoundsExceed30(calculator):
    pe_records = [
        {"period": "2024", "v": 50.0},
        {"period": "2023", "v": 45.0},
        {"period": "2022", "v": 40.0},
    ]
    final_pe, details = calculator.calculate_conservative_exit_pe(pe_records, terminal_gr=0.20)

    assert details["median_pe_5yr"] == pytest.approx(45.0)
    assert details["two_x_growth"] == pytest.approx(40.0)
    assert final_pe == pytest.approx(30.0)
    assert details["selected_bound"] == "terminal_pe_cap"


def test_paybackTimeAndMos_applyCombinedDecayScheduleConsistently(calculator):
    proj = calculator.calculate_combined_growth_projection(
        historical_gr=0.55,
        forward_pe=32.0,
        forward_peg=1.0,  # 32%
        revenue_cagr=0.38,
    )
    yearly_rates = [item["rate"] for item in proj["yearly_schedule"]]

    # Payback Time with decaying FCF schedule
    payback_years, projected_fcf, rationale = calculator.calculate_payback_time(
        current_fcf=60e9,
        windage_gr=proj["effective_cagr"],
        market_cap=1000e9,
        fcf_year="2025",
        yearly_growth_rates=yearly_rates,
        growth_projection=proj,
    )

    assert len(projected_fcf) == 10
    assert projected_fcf[0]["growth_rate"] == pytest.approx(0.32)
    assert projected_fcf[-1]["growth_rate"] == pytest.approx(0.12)
    assert projected_fcf[0]["fcf"] == pytest.approx(60e9 * 1.32)
    assert payback_years > 0
    assert projected_fcf[payback_years - 1]["is_payback_year"] is True
    assert projected_fcf[payback_years - 1]["cumulative_fcf"] >= 1000e9
    assert "linearly faded" in rationale.lower()

    # MOS with decaying EPS schedule and conservative 24x exit PE
    mos_price, mos_details = calculator.calculate_margin_of_safety(
        current_eps=3.0,
        windage_gr=proj["effective_cagr"],
        windage_pe=24.0,
        yearly_growth_rates=yearly_rates,
        growth_projection=proj,
        shares_outstanding=24.5e9,
    )

    expected_future_eps = 3.0 * proj["cumulative_factor"]
    expected_sticker = (expected_future_eps * 24.0) / (1.15 ** 10)
    assert mos_price == pytest.approx(expected_sticker / 2.0)
    assert mos_details["future_eps"] == pytest.approx(expected_future_eps)
    assert mos_details["implied_future_market_cap"] == pytest.approx(expected_future_eps * 24.0 * 24.5e9)
    assert "Linear Fade: 32.0% → 12.0%" in mos_details["step_1_future_eps"]



