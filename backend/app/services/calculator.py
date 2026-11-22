import statistics
from typing import Dict, Any, List, Optional

class FinancialCalculator:
    def __init__(self):
        self.marr = 0.15
        self.terminal_growth_rate = 0.12
        self.max_start_growth_rate = 0.40
        self.revenue_growth_buffer = 0.05
        self.max_terminal_pe = 30.0

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

    def _format_large(self, num: float, decimals: int = 2) -> str:
        abs_num = abs(num)
        if abs_num >= 1e12:
            return f"{abs_num/1e12:.{decimals}f}T"
        elif abs_num >= 1e9:
            return f"{abs_num/1e9:.{decimals}f}B"
        elif abs_num >= 1e6:
            return f"{abs_num/1e6:.{decimals}f}M"
        elif abs_num >= 1e3:
            return f"{abs_num/1e3:.{decimals}f}K"
        else:
            return f"{abs_num:.2f}"

    def _format_currency(self, num: float) -> str:
        prefix = "-$" if num < 0 else "$"
        return f"{prefix}{self._format_large(num)}"

    def calculate_10_cap(
        self,
        net_income: float,
        da: float,
        capex: float,
        market_cap: float,
        shares_outstanding: float = 0.0,
        fiscal_year: str = "TTM",
        working_capital_change: float = 0.0,
        working_capital_source: str = "unavailable",
    ) -> tuple[float, float, str, Dict[str, Any]]:
        """Method A: 10-Cap Owner Earnings (Buffett Owner's Value with Working Capital)"""
        # CapEx may be reported as negative or positive in cash flow statements; normalize via abs()
        # working_capital_change (ΔWC): positive = WC increased (cash outflow), negative = WC decreased (cash inflow)
        ni_val = float(net_income) if net_income is not None else 0.0
        da_val = float(da) if da is not None else 0.0
        wc_change_val = float(working_capital_change) if working_capital_change is not None else 0.0
        capex_val = abs(float(capex)) if capex else 0.0
        market_cap_val = float(market_cap) if market_cap else 0.0
        shares_val = float(shares_outstanding) if shares_outstanding else 0.0
        year_label = str(fiscal_year) if fiscal_year else "TTM"
        wc_source = working_capital_source or "unavailable"

        owner_earnings = ni_val + da_val - wc_change_val - capex_val
        cap_multiplier = 10
        target_cap_rate = 0.10

        if owner_earnings <= 0:
            owners_value = 0.0
            owners_value_per_share = 0.0
            cap_rate = 0.0
            price_to_owner_earnings = 0.0
            is_undervalued = False
            step_2 = "Owner Earnings are zero or negative — a positive 10-Cap Owner's Value cannot be computed."
            step_3 = "N/A (Owner Earnings <= $0)"
            step_4 = "N/A (Owner Earnings <= $0)"
            rationale = (
                f"Owner Earnings ({year_label}) = Net Income ({self._format_currency(ni_val)}) + "
                f"D&A ({self._format_currency(da_val)}) - ΔWC ({self._format_currency(wc_change_val)}) - "
                f"CapEx ({self._format_currency(capex_val)}) = {self._format_currency(owner_earnings)}. "
                f"Owner earnings are zero or negative."
            )
        else:
            owners_value = owner_earnings * cap_multiplier
            owners_value_per_share = (owners_value / shares_val) if shares_val > 0 else 0.0
            cap_rate = (owner_earnings / market_cap_val) if market_cap_val > 0 else 0.0
            price_to_owner_earnings = (market_cap_val / owner_earnings) if market_cap_val > 0 else 0.0
            is_undervalued = (owners_value >= market_cap_val) if market_cap_val > 0 else False

            step_2 = (
                f"Owner Earnings ({self._format_currency(owner_earnings)}) × {cap_multiplier} "
                f"(10% Cap Rate) = Owner's Value ({self._format_currency(owners_value)})"
            )
            step_3 = (
                f"Owner's Value ({self._format_currency(owners_value)}) / "
                f"Shares Outstanding ({self._format_large(shares_val)}) = ${owners_value_per_share:,.2f} / share"
                if shares_val > 0
                else "Shares outstanding unavailable for per-share calculation."
            )
            step_4 = (
                f"Owner Earnings ({self._format_currency(owner_earnings)}) / "
                f"Market Cap ({self._format_currency(market_cap_val)}) = "
                f"{cap_rate:.2%} Cap Rate ({price_to_owner_earnings:.1f}x Owner Earnings)"
                if market_cap_val > 0
                else "Market Cap unavailable for Cap Rate comparison."
            )
            rationale = (
                f"Owner Earnings ({year_label}) = Net Income ({self._format_currency(ni_val)}) + "
                f"D&A ({self._format_currency(da_val)}) - ΔWC ({self._format_currency(wc_change_val)}) - "
                f"CapEx ({self._format_currency(capex_val)}) = {self._format_currency(owner_earnings)}. "
                f"Owner's Value (10-Cap) = {self._format_currency(owner_earnings)} × {cap_multiplier} = "
                f"{self._format_currency(owners_value)}. "
                f"Cap Rate = Owner Earnings / Market Cap = {cap_rate:.2%}."
            )

        step_1 = (
            f"Net Income ({self._format_currency(ni_val)}) + "
            f"D&A ({self._format_currency(da_val)}) - "
            f"ΔWC ({self._format_currency(wc_change_val)}) - "
            f"CapEx ({self._format_currency(capex_val)}) = "
            f"Owner Earnings ({self._format_currency(owner_earnings)})"
        )

        details = {
            "fiscal_year": year_label,
            "net_income": ni_val,
            "depreciation_amortization": da_val,
            "working_capital_change": wc_change_val,
            "working_capital_source": wc_source,
            "has_working_capital_data": wc_source != "unavailable",
            "capex": capex_val,
            "owner_earnings": owner_earnings,
            "cap_multiplier": cap_multiplier,
            "target_cap_rate": target_cap_rate,
            "owners_value": owners_value,
            "shares_outstanding": shares_val,
            "owners_value_per_share": owners_value_per_share,
            "market_cap": market_cap_val,
            "cap_rate": cap_rate,
            "price_to_owner_earnings": price_to_owner_earnings,
            "is_undervalued": is_undervalued,
            "steps": {
                "step_1_owner_earnings": step_1,
                "step_2_owners_value": step_2,
                "step_3_per_share": step_3,
                "step_4_cap_rate": step_4,
            },
        }
        return owner_earnings, cap_rate, rationale, details

    def calculate_longest_cagr(
        self,
        history: List[Dict[str, Any]],
        max_years: int = 10,
    ) -> tuple[Optional[float], int, Optional[int], Optional[int]]:
        """Computes CAGR over the longest valid positive-to-positive window within the last `max_years` records."""
        if not history or len(history) < 2:
            return None, 0, None, None

        subset = history[-max_years:] if len(history) >= max_years else history
        end_idx = len(subset) - 1
        end_val = subset[end_idx].get("value", 0.0)
        end_year = subset[end_idx].get("year")

        if end_val is None or end_val <= 0:
            return None, 0, None, None

        start_idx = 0
        while start_idx < end_idx and (subset[start_idx].get("value") is None or subset[start_idx].get("value", 0.0) <= 0):
            start_idx += 1

        if start_idx >= end_idx:
            return None, 0, None, None

        start_val = subset[start_idx]["value"]
        start_year = subset[start_idx].get("year")
        if start_year is None or end_year is None:
            years = end_idx - start_idx
        else:
            years = end_year - start_year

        if years <= 0:
            return None, 0, None, None

        cagr = (end_val / start_val) ** (1 / years) - 1
        return cagr, years, start_year, end_year

    def extract_implied_forward_growth(
        self,
        forward_pe: Optional[float],
        forward_peg: Optional[float],
    ) -> Optional[float]:
        """Derives implied consensus forward EPS growth from Finnhub forwardPE / (forwardPEG * 100)."""
        if (
            forward_pe is None
            or forward_peg is None
            or isinstance(forward_pe, bool)
            or isinstance(forward_peg, bool)
            or forward_pe <= 0
            or forward_peg <= 0
        ):
            return None

        implied = float(forward_pe) / (float(forward_peg) * 100.0)
        # Guard against corrupted or extreme ratio outliers (e.g. near-zero PEG)
        if implied <= 0 or implied > 1.5:
            return None
        return implied

    def calculate_combined_growth_projection(
        self,
        historical_gr: float,
        historical_label: str = "Historical OCF CAGR",
        forward_pe: Optional[float] = None,
        forward_peg: Optional[float] = None,
        revenue_cagr: Optional[float] = None,
        revenue_years: int = 0,
        revenue_start_year: Optional[int] = None,
        revenue_end_year: Optional[int] = None,
        years: int = 10,
        terminal_gr: Optional[float] = None,
        max_start_gr: Optional[float] = None,
        revenue_buffer: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Combined 2-step growth projection:
        1. Anchor Year-1 growth to the most conservative valid signal among:
           - Historical OCF CAGR (or Net Income fallback)
           - Implied Forward Consensus Growth (forwardPE / forwardPEG)
           - Revenue Guardrail (Revenue CAGR + 5% operating-leverage buffer)
           - Hyper-Growth Ceiling (40% max starting rate)
        2. Linearly decay Year-1 growth down to `terminal_gr` (12%) by Year 10
           whenever Year-1 growth exceeds `terminal_gr` (downward-only).
        """
        term_target = self.terminal_growth_rate if terminal_gr is None else terminal_gr
        start_cap = self.max_start_growth_rate if max_start_gr is None else max_start_gr
        rev_buf = self.revenue_growth_buffer if revenue_buffer is None else revenue_buffer

        raw_hist = max(0.0, float(historical_gr)) if historical_gr is not None else 0.0
        forward_gr = self.extract_implied_forward_growth(forward_pe, forward_peg)
        rev_guardrail = (
            max(0.0, float(revenue_cagr) + rev_buf)
            if revenue_cagr is not None
            else None
        )

        # Build transparent anchor candidate list
        candidates: List[Dict[str, Any]] = [
            {
                "key": "historical",
                "label": historical_label,
                "rate": raw_hist,
                "available": raw_hist > 0,
                "detail": f"{raw_hist:.2%}" if raw_hist > 0 else "No positive historical CAGR",
                "is_selected": False,
            },
            {
                "key": "forward_consensus",
                "label": "Forward Consensus Growth",
                "rate": forward_gr,
                "available": forward_gr is not None,
                "detail": (
                    f"Forward P/E ({forward_pe:.2f}) ÷ Forward PEG ({forward_peg:.2f}) = {forward_gr:.2%}"
                    if forward_gr is not None
                    else "Unavailable (Forward P/E or PEG missing)"
                ),
                "is_selected": False,
            },
            {
                "key": "revenue_guardrail",
                "label": "Revenue Guardrail (+5% Buffer)",
                "rate": rev_guardrail,
                "available": rev_guardrail is not None,
                "detail": (
                    f"{revenue_years}Y Rev CAGR ({revenue_cagr:.2%}, {revenue_start_year}–{revenue_end_year}) + {rev_buf:.0%} = {rev_guardrail:.2%}"
                    if rev_guardrail is not None and revenue_start_year and revenue_end_year
                    else (
                        f"Rev CAGR ({revenue_cagr:.2%}) + {rev_buf:.0%} = {rev_guardrail:.2%}"
                        if rev_guardrail is not None
                        else "Unavailable (insufficient revenue history)"
                    )
                ),
                "is_selected": False,
            },
            {
                "key": "hyper_growth_cap",
                "label": "Hyper-Growth Ceiling",
                "rate": start_cap,
                "available": True,
                "detail": f"Hard Year-1 cap at {start_cap:.0%} to prevent extreme outlier blow-up",
                "is_selected": False,
            },
        ]

        if raw_hist <= 0:
            start_rate = 0.0
            anchor_key = "historical"
            anchor_label = historical_label
            candidates[0]["is_selected"] = True
            was_anchored = False
        else:
            valid_candidates = [c for c in candidates if c["available"] and c["rate"] is not None]
            winner = min(valid_candidates, key=lambda c: c["rate"])
            winner["is_selected"] = True
            start_rate = float(winner["rate"])
            anchor_key = winner["key"]
            anchor_label = winner["label"]
            was_anchored = anchor_key != "historical" and start_rate < raw_hist - 1e-9

        # Step 2: Downward-only linear decay over `years`
        if start_rate > term_target:
            decay_applied = True
            terminal_rate = term_target
            annual_step = (start_rate - terminal_rate) / max(1, years - 1)
        else:
            decay_applied = False
            terminal_rate = start_rate
            annual_step = 0.0

        yearly_schedule: List[Dict[str, Any]] = []
        cumulative_factor = 1.0
        for yr in range(1, years + 1):
            rate = start_rate - (yr - 1) * annual_step if decay_applied else start_rate
            cumulative_factor *= (1.0 + rate)
            yearly_schedule.append({
                "year": yr,
                "rate": rate,
                "cumulative_factor": cumulative_factor,
            })

        effective_cagr = (cumulative_factor ** (1.0 / years)) - 1.0 if years > 0 else 0.0

        # Human-readable summary for banners & rationales
        adjustment_reasons: List[str] = []
        if was_anchored:
            adjustment_reasons.append(
                f"Year-1 growth anchored from {raw_hist:.1%} ({historical_label}) down to {start_rate:.1%} via {anchor_label}"
            )
        if decay_applied:
            adjustment_reasons.append(
                f"linearly decayed from {start_rate:.1%} (Yr 1) to {terminal_rate:.1%} (Yr {years}), yielding {effective_cagr:.1%} effective 10Y CAGR ({cumulative_factor:.2f}×)"
            )

        if adjustment_reasons:
            adjustment_summary = "; ".join(adjustment_reasons) + "."
            adjustment_summary = adjustment_summary[0].upper() + adjustment_summary[1:]
        else:
            adjustment_summary = (
                f"Flat {start_rate:.1%} annual growth applied across all {years} years "
                f"(within ≤{term_target:.0%} sustainable threshold; {cumulative_factor:.2f}× cumulative)."
            )

        return {
            "method": "combined_anchor_linear_decay",
            "raw_historical_rate": raw_hist,
            "historical_label": historical_label,
            "forward_pe": forward_pe,
            "forward_peg": forward_peg,
            "forward_growth_rate": forward_gr,
            "revenue_cagr": revenue_cagr,
            "revenue_years": revenue_years,
            "revenue_guardrail_rate": rev_guardrail,
            "revenue_buffer": rev_buf,
            "max_start_growth_rate": start_cap,
            "start_rate": start_rate,
            "terminal_target_rate": term_target,
            "terminal_rate": terminal_rate,
            "effective_cagr": effective_cagr,
            "cumulative_factor": cumulative_factor,
            "anchor_key": anchor_key,
            "anchor_label": anchor_label,
            "was_anchored": was_anchored,
            "decay_applied": decay_applied,
            "annual_decay_step": annual_step,
            "anchor_candidates": candidates,
            "yearly_schedule": yearly_schedule,
            "adjustment_summary": adjustment_summary,
        }

    def calculate_conservative_exit_pe(
        self,
        pe_history_records: List[Dict[str, Any]],
        terminal_gr: float,
        fallback_pe_ttm: Optional[float] = None,
        max_terminal_pe: Optional[float] = None,
    ) -> tuple[float, Dict[str, Any]]:
        """Computes Year-10 Windage Exit P/E as min(5Y Median P/E, 2 × Terminal Growth, Terminal P/E Cap)."""
        pe_cap = self.max_terminal_pe if max_terminal_pe is None else max_terminal_pe

        sorted_pe = sorted(pe_history_records or [], key=lambda x: x.get("period", ""), reverse=True)
        last_5_pe_records = sorted_pe[:5]
        positive_pe_values = [
            float(x["v"])
            for x in last_5_pe_records
            if x.get("v") is not None and not isinstance(x.get("v"), bool) and float(x["v"]) > 0
        ]

        if positive_pe_values:
            median_pe_5yr = float(statistics.median(positive_pe_values))
            max_pe_5yr = float(max(positive_pe_values))
            pe_source = "5Y Median P/E"
        elif fallback_pe_ttm is not None and float(fallback_pe_ttm) > 0:
            median_pe_5yr = float(fallback_pe_ttm)
            max_pe_5yr = float(fallback_pe_ttm)
            pe_source = "TTM P/E (Fallback)"
        else:
            median_pe_5yr = 15.0
            max_pe_5yr = 15.0
            pe_source = "Default P/E (15x)"

        two_x_growth = max(0.0, float(terminal_gr)) * 100.0 * 2.0
        final_pe = min(median_pe_5yr, two_x_growth, pe_cap)

        if final_pe == two_x_growth and two_x_growth <= median_pe_5yr and two_x_growth <= pe_cap:
            selected_bound = "two_x_terminal_growth"
            selected_bound_label = f"2× Yr-10 Terminal Growth ({terminal_gr:.1%})"
        elif final_pe == median_pe_5yr and median_pe_5yr <= pe_cap:
            selected_bound = "median_pe_5yr"
            selected_bound_label = pe_source
        else:
            selected_bound = "terminal_pe_cap"
            selected_bound_label = f"Mature Exit P/E Cap ({pe_cap:.0f}x)"

        details = {
            "last_5_years_pe": [
                {
                    "date": x.get("period", ""),
                    "pe": x.get("v", 0.0),
                }
                for x in last_5_pe_records
            ],
            "median_pe_5yr": median_pe_5yr,
            "max_pe_5yr": max_pe_5yr,
            "pe_source": pe_source,
            "terminal_growth_rate": max(0.0, float(terminal_gr)),
            "two_x_growth": two_x_growth,
            "terminal_pe_cap": pe_cap,
            "selected_bound": selected_bound,
            "selected_bound_label": selected_bound_label,
            "final_pe": final_pe,
        }
        return final_pe, details

    def calculate_payback_time(
        self,
        current_fcf: float,
        windage_gr: float,
        market_cap: float,
        fcf_year: str = "TTM",
        yearly_growth_rates: Optional[List[float]] = None,
        growth_projection: Optional[Dict[str, Any]] = None,
    ) -> tuple[int, List[Dict[str, float]], str]:
        """Method B: Payback Time (FCF) supporting flat or combined decaying growth schedules."""
        if current_fcf <= 0:
            return 0, [], "Current FCF is zero or negative."

        rates = (
            list(yearly_growth_rates)
            if yearly_growth_rates and len(yearly_growth_rates) == 10
            else [windage_gr] * 10
        )

        projected_fcf = []
        accumulated_fcf = 0.0
        payback_years = 0
        running_fcf = float(current_fcf)

        for year in range(1, 11):
            yr_rate = float(rates[year - 1])
            running_fcf = running_fcf * (1.0 + yr_rate)
            accumulated_fcf += running_fcf
            is_payback_year = False
            if market_cap > 0 and accumulated_fcf >= market_cap and payback_years == 0:
                payback_years = year
                is_payback_year = True

            projected_fcf.append({
                "year": year,
                "growth_rate": yr_rate,
                "fcf": running_fcf,
                "cumulative_fcf": accumulated_fcf,
                "is_payback_year": is_payback_year,
            })

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
        if growth_projection:
            start_r = growth_projection["start_rate"]
            term_r = growth_projection["terminal_rate"]
            eff_r = growth_projection["effective_cagr"]
            if growth_projection.get("decay_applied"):
                rationale += (
                    f"2. Compound FCF over 10 years using combined growth: anchored at {start_r:.1%} "
                    f"({growth_projection['anchor_label']}) and linearly faded to {term_r:.1%} by Year 10 "
                    f"(effective 10Y CAGR: {eff_r:.1%}).\n"
                )
            elif growth_projection.get("was_anchored"):
                rationale += (
                    f"2. Compound FCF at a flat {start_r:.1%} (anchored from {growth_projection['raw_historical_rate']:.1%} "
                    f"via {growth_projection['anchor_label']}).\n"
                )
            else:
                rationale += f"2. Project FCF for the next 10 years at a flat {start_r:.2%} annual growth rate.\n"
        else:
            rationale += f"2. Project FCF for the next 10 years by applying the Windage Growth Rate of {windage_gr:.2%}.\n"

        rationale += "3. Accumulate these projected FCF values year by year.\n"

        if payback_years == 0:
            rationale += f"4. The accumulated FCF over 10 years (${format_large(accumulated_fcf)}) does not reach the Market Cap of ${format_large(market_cap)}."
        else:
            rationale += f"4. The accumulated FCF reaches the Market Cap of ${format_large(market_cap)} by Year {payback_years} (10Y total: ${format_large(accumulated_fcf)})."

        return payback_years, projected_fcf, rationale

    def calculate_margin_of_safety(
        self,
        current_eps: float,
        windage_gr: float,
        windage_pe: float,
        yearly_growth_rates: Optional[List[float]] = None,
        growth_projection: Optional[Dict[str, Any]] = None,
        pe_details: Optional[Dict[str, Any]] = None,
        shares_outstanding: float = 0.0,
    ) -> tuple[float, Dict[str, Any]]:
        """Method C: Margin of Safety (Sticker Price) supporting flat or combined decaying growth schedules."""
        if yearly_growth_rates and len(yearly_growth_rates) == 10:
            compound_factor = 1.0
            for r in yearly_growth_rates:
                compound_factor *= (1.0 + float(r))
            effective_gr = (compound_factor ** (1.0 / 10.0)) - 1.0
        else:
            compound_factor = (1.0 + float(windage_gr)) ** 10
            effective_gr = float(windage_gr)

        step_1_future_eps = current_eps * compound_factor
        step_2_future_price = step_1_future_eps * windage_pe
        step_3_sticker_price = step_2_future_price / ((1.0 + self.marr) ** 10)
        mos_price = step_3_sticker_price / 2.0
        implied_future_market_cap = (
            step_2_future_price * float(shares_outstanding)
            if shares_outstanding and shares_outstanding > 0 and step_2_future_price > 0
            else 0.0
        )

        if growth_projection and growth_projection.get("decay_applied"):
            start_r = growth_projection["start_rate"]
            term_r = growth_projection["terminal_rate"]
            step_1_text = (
                f"Current EPS (${current_eps:.2f}) × {compound_factor:.2f}× "
                f"[Linear Fade: {start_r:.1%} → {term_r:.1%}; {effective_gr:.1%} eff. CAGR] "
                f"= Future EPS (${step_1_future_eps:.2f})"
            )
        else:
            step_1_text = (
                f"Current EPS (${current_eps:.2f}) × (1 + {effective_gr:.2%})^10 "
                f"({compound_factor:.2f}×) = Future EPS (${step_1_future_eps:.2f})"
            )

        pe_source_tag = (
            f" [{pe_details['selected_bound_label']}]"
            if pe_details and pe_details.get("selected_bound_label")
            else ""
        )

        details: Dict[str, Any] = {
            "step_1_future_eps": step_1_text,
            "step_2_future_price": f"Future EPS (${step_1_future_eps:.2f}) × Exit P/E ({windage_pe:.2f}x){pe_source_tag} = Future Price (${step_2_future_price:.2f})",
            "step_3_sticker_price": f"Future Price (${step_2_future_price:.2f}) / (1 + MARR ({self.marr:.0%}))^10 = Sticker Price (${step_3_sticker_price:.2f})",
            "step_4_mos_price": f"Sticker Price (${step_3_sticker_price:.2f}) / 2 = MOS Buy Price (${mos_price:.2f})",
            "current_eps": current_eps,
            "compound_factor": compound_factor,
            "effective_growth_rate": effective_gr,
            "future_eps": step_1_future_eps,
            "windage_pe": windage_pe,
            "future_price": step_2_future_price,
            "sticker_price": step_3_sticker_price,
            "mos_price": mos_price,
            "implied_future_market_cap": implied_future_market_cap,
        }

        return mos_price, details

