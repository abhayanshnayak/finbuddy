import statistics
from typing import Dict, Any, List

class FinancialCalculator:
    def __init__(self):
        self.marr = 0.15

    def calculate_cagr(self, start_val: float, end_val: float, years: int) -> float:
        if start_val <= 0 or years <= 0:
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
        """Average of 10-year OCF growth rates within 1 std dev."""
        if len(ocf_history) < 2:
            empty_details = {
                "steps": [],
                "stats": {"mean": 0.0, "stdev": 0.0, "lower_bound": 0.0, "upper_bound": 0.0, "is_filtered": False},
                "final_rate": 0.0
            }
            return 0.0, "Not enough OCF history.", empty_details
            
        yoy_rates_detailed = []
        for i in range(1, len(ocf_history)):
            prev_year = ocf_history[i-1]["year"]
            curr_year = ocf_history[i]["year"]
            prev = ocf_history[i-1]["value"]
            curr = ocf_history[i]["value"]
            if prev > 0:
                yoy_rates_detailed.append({
                    "from_year": prev_year,
                    "to_year": curr_year,
                    "prev_value": prev,
                    "curr_value": curr,
                    "rate": (curr - prev) / prev
                })
                
        yoy_rates = [x["rate"] for x in yoy_rates_detailed]
        
        if not yoy_rates:
            empty_details = {
                "steps": [],
                "stats": {"mean": 0.0, "stdev": 0.0, "lower_bound": 0.0, "upper_bound": 0.0, "is_filtered": False},
                "final_rate": 0.0
            }
            return 0.0, "No valid OCF growth rates.", empty_details
            
        if len(yoy_rates) < 3:
            mean = statistics.mean(yoy_rates)
            rationale = f"Calculated simple average due to limited data: {mean:.2%}"
            steps = [
                {
                    "from_year": x["from_year"],
                    "to_year": x["to_year"],
                    "prev_value": x["prev_value"],
                    "curr_value": x["curr_value"],
                    "rate": x["rate"],
                    "is_included": True
                }
                for x in yoy_rates_detailed
            ]
            details = {
                "steps": steps,
                "stats": {
                    "mean": mean,
                    "stdev": 0.0,
                    "lower_bound": mean,
                    "upper_bound": mean,
                    "is_filtered": False
                },
                "final_rate": mean
            }
            return mean, rationale, details
            
        mean = statistics.mean(yoy_rates)
        stdev = statistics.stdev(yoy_rates)
        lower_bound = mean - stdev
        upper_bound = mean + stdev
        
        valid_rates = [r for r in yoy_rates if lower_bound <= r <= upper_bound]
        windage_gr = statistics.mean(valid_rates) if valid_rates else mean
        
        steps = [
            {
                "from_year": x["from_year"],
                "to_year": x["to_year"],
                "prev_value": x["prev_value"],
                "curr_value": x["curr_value"],
                "rate": x["rate"],
                "is_included": lower_bound <= x["rate"] <= upper_bound
            }
            for x in yoy_rates_detailed
        ]
        
        details = {
            "steps": steps,
            "stats": {
                "mean": mean,
                "stdev": stdev,
                "lower_bound": lower_bound,
                "upper_bound": upper_bound,
                "is_filtered": True
            },
            "final_rate": windage_gr
        }
        
        rationale = f"Average of 10-year OCF growth rates within 1 standard deviation. Raw rates: {[round(r, 2) for r in yoy_rates]}. Valid average: {windage_gr:.2%}"
        return windage_gr, rationale, details

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

