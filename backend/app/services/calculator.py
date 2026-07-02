import statistics
from typing import Dict, Any, List

class FinancialCalculator:
    def __init__(self):
        self.marr = 0.15

    def calculate_cagr(self, start_val: float, end_val: float, years: int) -> float:
        if start_val <= 0 or end_val < 0 or years <= 0:
            return 0.0
        return (end_val / start_val) ** (1 / years) - 1

    def calculate_growth_rates(self, history: List[Dict[str, Any]]) -> Dict[str, float]:
        """Calculates 1, 3, 5, 10 yr growth rates given a list of historical values sorted by year."""
        if not history or len(history) < 2:
            return {"1_yr": 0.0, "3_yr": 0.0, "5_yr": 0.0, "10_yr": 0.0}
            
        current = history[-1]["value"]
        rates = {"1_yr": 0.0, "3_yr": 0.0, "5_yr": 0.0, "10_yr": 0.0}
        
        def safe_cagr(years_back, key):
            if len(history) > years_back:
                start = history[-(years_back + 1)]["value"]
                rates[key] = self.calculate_cagr(start, current, years_back)
                
        safe_cagr(1, "1_yr")
        safe_cagr(3, "3_yr")
        safe_cagr(5, "5_yr")
        safe_cagr(10, "10_yr")
        return rates

    def calculate_averages(self, history: List[Dict[str, Any]]) -> Dict[str, float]:
        """Calculates 3, 5, 10 yr simple averages given a list of historical values sorted by year (oldest to newest)."""
        if not history:
            return {"3_yr": 0.0, "5_yr": 0.0, "10_yr": 0.0}
            
        rates = {"3_yr": 0.0, "5_yr": 0.0, "10_yr": 0.0}
        
        # Determine the key for the value (could be 'v' from metrics.json or 'value' from extracted history)
        val_key = "v" if "v" in history[0] else "value"
        
        def safe_avg(years_back, key):
            # Take up to `years_back` most recent records
            subset = history[-years_back:] if len(history) >= years_back else history
            vals = [x.get(val_key, 0.0) for x in subset]
            if vals:
                rates[key] = sum(vals) / len(vals)
                
        safe_avg(3, "3_yr")
        safe_avg(5, "5_yr")
        safe_avg(10, "10_yr")
        return rates

    def calculate_windage_growth_rate(self, ocf_history: List[Dict[str, Any]]) -> tuple[float, str, Dict[str, Any]]:
        """Calculates the 10-year Compound Annual Growth Rate (CAGR) of Operating Cash Flow.
        
        For companies that transitioned from negative to positive OCF (e.g. Uber),
        the function scans forward to find the first year with positive OCF and
        computes CAGR from that shorter window instead of giving up entirely.
        """
        if len(ocf_history) < 2:
            empty_details = {
                "start_year": None,
                "start_value": 0.0,
                "end_year": None,
                "end_value": 0.0,
                "years": 0,
                "cagr": 0.0,
                "is_cagr": True,
                "history": [],
                "final_rate": 0.0,
                # Backward compatibility keys:
                "steps": [],
                "stats": {"mean": 0.0, "stdev": 0.0, "lower_bound": 0.0, "upper_bound": 0.0, "is_filtered": False}
            }
            return 0.0, "Not enough OCF history.", empty_details

        # Extract the last 10 years of OCF data
        subset = ocf_history[-10:] if len(ocf_history) >= 10 else ocf_history

        end_idx = len(subset) - 1
        end_val = subset[end_idx]["value"]
        end_year = subset[end_idx]["year"]

        # If ending OCF is negative, CAGR is undefined regardless — trigger fallback
        if end_val < 0:
            start_val = subset[0]["value"]
            start_year = subset[0]["year"]
            years = end_year - start_year
            cagr = -0.01
            rationale = (
                f"Operating Cash Flow CAGR is mathematically undefined because the ending value "
                f"was negative (${end_val:,.2f} in {end_year}). Falling back to Net Income CAGR."
            )
            details = self._build_windage_details(subset, start_year, start_val, end_year, end_val, years, cagr)
            return cagr, rationale, details

        # Find the first year with positive OCF for a valid CAGR starting point.
        # This handles companies like Uber that went from negative to positive OCF.
        start_idx = 0
        while start_idx < end_idx and subset[start_idx]["value"] <= 0:
            start_idx += 1

        # If no valid positive-to-positive window exists, trigger fallback
        if start_idx >= end_idx:
            start_val = subset[0]["value"]
            start_year = subset[0]["year"]
            years = end_year - start_year
            cagr = -0.01
            rationale = (
                f"Operating Cash Flow CAGR is mathematically undefined because no year in the "
                f"window had positive OCF to use as a starting point. Falling back to Net Income CAGR."
            )
            details = self._build_windage_details(subset, start_year, start_val, end_year, end_val, years, cagr)
            return cagr, rationale, details

        start_val = subset[start_idx]["value"]
        start_year = subset[start_idx]["year"]
        years = end_year - start_year

        if years <= 0:
            cagr = -0.01
            rationale = "Operating Cash Flow CAGR requires at least 1 year of history."
            details = self._build_windage_details(subset, start_year, start_val, end_year, end_val, years, cagr)
            return cagr, rationale, details

        cagr = (end_val / start_val) ** (1 / years) - 1

        skipped_years = start_idx
        if skipped_years > 0:
            rationale = (
                f"Compound Annual Growth Rate (CAGR) of Operating Cash Flow over {years} years "
                f"({start_year} to {end_year}): {cagr:.2%}. "
                f"Note: {skipped_years} earlier year(s) with non-positive OCF were excluded."
            )
        else:
            rationale = (
                f"Compound Annual Growth Rate (CAGR) of Operating Cash Flow over the last {years} years "
                f"({start_year} to {end_year}): {cagr:.2%}"
            )

        details = self._build_windage_details(subset, start_year, start_val, end_year, end_val, years, cagr)
        return cagr, rationale, details

    def _build_windage_details(self, subset, start_year, start_val, end_year, end_val, years, cagr):
        """Helper to build the windage details dict with consistent structure."""
        return {
            "start_year": start_year,
            "start_value": start_val,
            "end_year": end_year,
            "end_value": end_val,
            "years": years,
            "cagr": cagr,
            "is_cagr": True,
            "history": [{"year": x["year"], "value": x["value"]} for x in subset],
            "final_rate": cagr,
            # Backward compatibility keys:
            "steps": [],
            "stats": {
                "mean": cagr,
                "stdev": 0.0,
                "lower_bound": cagr,
                "upper_bound": cagr,
                "is_filtered": False
            }
        }

    def calculate_10_cap(self, net_income: float, da: float, capex: float, market_cap: float) -> tuple[float, float, str]:
        """Method A: 10-Cap Owner Earnings"""
        # capex is usually negative in cash flow statements, so we add it if negative, subtract if positive
        # Actually standard formula: Net Income + D&A - Maintenance CapEx
        capex_val = abs(capex) if capex else 0.0
        owner_earnings = net_income + da - capex_val
        
        if owner_earnings <= 0:
            return owner_earnings, 0.0, "Owner earnings are zero or negative."
            
        cap_rate = market_cap / owner_earnings
        rationale = f"Owner Earnings = Net Income ({net_income}) + D&A ({da}) - CapEx ({capex_val}) = {owner_earnings}. Cap Rate = Owner Earnings / Market Cap = {cap_rate:.2f}."
        return owner_earnings, cap_rate, rationale

    def calculate_payback_time(self, current_fcf: float, windage_gr: float, market_cap: float, fcf_year: str = "TTM") -> tuple[int, List[Dict[str, float]], str]:
        """Method B: Payback Time (FCF)"""
        if current_fcf <= 0:
            return 0, [], "Current FCF is zero or negative."
            
        projected_fcf = []
        accumulated_fcf = 0.0
        payback_years = 0
        
        for year in range(1, 11):
            fcf = current_fcf * ((1 + windage_gr) ** year)
            projected_fcf.append({"year": year, "fcf": fcf})
            accumulated_fcf += fcf
            
            if accumulated_fcf >= market_cap and payback_years == 0:
                payback_years = year

        def format_large(num):
            abs_num = abs(num)
            if abs_num >= 1e12:
                return f"{num/1e12:.1f}T"
            elif abs_num >= 1e9:
                return f"{num/1e9:.1f}B"
            elif abs_num >= 1e6:
                return f"{num/1e6:.1f}M"
            else:
                return f"{num:.2f}"
                
        rationale = f"1. Start with {fcf_year} Free Cash Flow (FCF) of ${format_large(current_fcf)}.\n"
        rationale += f"2. Project FCF for the next 10 years by applying the Windage Growth Rate of {windage_gr:.2%}.\n"
        rationale += f"3. Accumulate these projected FCF values year by year.\n"
        
        if payback_years == 0:
            rationale += f"4. The accumulated FCF over 10 years (${format_large(accumulated_fcf)}) does not reach the Market Cap of ${format_large(market_cap)}."
        else:
            rationale += f"4. The accumulated FCF reaches the Market Cap of ${format_large(market_cap)} by Year {payback_years}."
            
        return payback_years, projected_fcf, rationale

    def calculate_margin_of_safety(self, current_eps: float, windage_gr: float, windage_pe: float) -> tuple[float, Dict[str, str]]:
        """Method C: Margin of Safety (Sticker Price)"""
        step_1_future_eps = current_eps * ((1 + windage_gr) ** 10)
        step_2_future_price = step_1_future_eps * windage_pe
        step_3_sticker_price = step_2_future_price / ((1 + self.marr) ** 10)
        mos_price = step_3_sticker_price / 2
        
        details = {
            "step_1_future_eps": f"Current EPS ({current_eps:.2f}) * (1 + Windage Growth ({windage_gr:.2%}))^10 = Future EPS ({step_1_future_eps:.2f})",
            "step_2_future_price": f"Future EPS ({step_1_future_eps:.2f}) * Windage PE ({windage_pe:.2f}) = Future Price ({step_2_future_price:.2f})",
            "step_3_sticker_price": f"Future Price ({step_2_future_price:.2f}) / (1 + MARR ({self.marr}))^10 = Sticker Price ({step_3_sticker_price:.2f})",
            "step_4_mos_price": f"Sticker Price ({step_3_sticker_price:.2f}) / 2 = MOS Buy Price ({mos_price:.2f})"
        }
        
        return mos_price, details

