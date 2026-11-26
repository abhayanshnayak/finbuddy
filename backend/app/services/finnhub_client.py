from datetime import date
import requests
from typing import Dict, Any, List, Optional

class FinnhubClient:
    BIG4_CONCEPTS = {
        "revenue": ("ic", [
            "us-gaap_Revenues",
            "us-gaap_SalesRevenueNet",
            "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax",
        ]),
        "net_income": ("ic", ["us-gaap_NetIncomeLoss"]),
        "operating_cash_flow": ("cf", [
            "us-gaap_NetCashProvidedByUsedInOperatingActivities",
            "us-gaap_NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
        ]),
        "book_value": ("bs", [
            "us-gaap_StockholdersEquity",
            "us-gaap_StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
        ]),
    }
    CAPEX_CONCEPTS = (
        "cf",
        [
            "us-gaap_PaymentsForPropertyPlantAndEquipment",
            "us-gaap_PaymentsToAcquirePropertyPlantAndEquipment",
            "us-gaap_PaymentsForPropertyPlantAndEquipmentContinuingOperations",
            "us-gaap_PaymentsToAcquirePropertyPlantAndEquipmentContinuingOperations",
        ],
    )

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://finnhub.io/api/v1"

    def get_profile(self, symbol: str) -> Dict[str, Any]:
        res = requests.get(f"{self.base_url}/stock/profile2?symbol={symbol}&token={self.api_key}")
        res.raise_for_status()
        return res.json()

    def get_quote(self, symbol: str) -> Dict[str, Any]:
        res = requests.get(f"{self.base_url}/quote?symbol={symbol}&token={self.api_key}")
        res.raise_for_status()
        return res.json()

    def get_metrics(self, symbol: str) -> Dict[str, Any]:
        res = requests.get(f"{self.base_url}/stock/metric?symbol={symbol}&metric=all&token={self.api_key}")
        res.raise_for_status()
        return res.json()

    def get_financials_reported(self, symbol: str, freq: str = "annual") -> List[Dict[str, Any]]:
        res = requests.get(f"{self.base_url}/stock/financials-reported?symbol={symbol}&freq={freq}&token={self.api_key}")
        res.raise_for_status()
        data = res.json()
        return data.get("data", [])

    @staticmethod
    def _get_opt_val(report: Dict[str, Any], section: str, possible_tags: List[str]) -> Optional[float]:
        for tag in possible_tags:
            for item in report.get(section, []):
                if item.get("concept") == tag and item.get("value") is not None:
                    try:
                        return float(item["value"])
                    except (TypeError, ValueError):
                        continue
        return None

    @classmethod
    def _get_val(cls, report: Dict[str, Any], section: str, possible_tags: List[str]) -> float:
        val = cls._get_opt_val(report, section, possible_tags)
        return val if val is not None else 0.0

    @staticmethod
    def _parse_iso_date(raw_date: Any) -> Optional[date]:
        if not raw_date or not isinstance(raw_date, str):
            return None
        try:
            return date.fromisoformat(raw_date.strip()[:10])
        except ValueError:
            return None

    def compute_xbrl_ttm(
        self,
        annual_reports: List[Dict[str, Any]],
        quarterly_reports: List[Dict[str, Any]],
    ) -> Dict[str, Dict[str, Any]]:
        """Computes exact Big 4 TTM (flow) and MRQ (book value) figures from SEC XBRL 10-K/10-Q filings.

        Finnhub's quarterly filings report cumulative YTD values for Q1/Q2/Q3 (startDate = fiscal year start).
        When a newer 10-Q exists after the latest 10-K, TTM = Prior FY (10-K) + Current YTD - Prior-Year YTD.
        When the latest 10-K is at least as recent as the latest 10-Q, TTM equals that 10-K.
        Book Value is a balance-sheet snapshot, so it always takes the most recent filing's equity (MRQ).
        """
        def filing_sort_key(item: Dict[str, Any]):
            end_dt = self._parse_iso_date(item.get("endDate"))
            filed_dt = self._parse_iso_date(item.get("filedDate"))
            return (
                end_dt or date(int(item.get("year") or 1), 1, 1),
                filed_dt or date(1, 1, 1),
            )

        annual_by_year: Dict[int, Dict[str, Any]] = {}
        for item in annual_reports or []:
            yr = item.get("year")
            if not isinstance(yr, int):
                continue
            existing = annual_by_year.get(yr)
            if existing is None or filing_sort_key(item) >= filing_sort_key(existing):
                annual_by_year[yr] = item

        quarterly_by_key: Dict[tuple, Dict[str, Any]] = {}
        for item in quarterly_reports or []:
            yr = item.get("year")
            q = item.get("quarter")
            if not isinstance(yr, int) or q not in (1, 2, 3):
                continue
            key = (yr, q)
            existing = quarterly_by_key.get(key)
            if existing is None or filing_sort_key(item) >= filing_sort_key(existing):
                quarterly_by_key[key] = item

        sorted_annuals = sorted(annual_by_year.values(), key=filing_sort_key)
        sorted_quarterlies = sorted(quarterly_by_key.values(), key=filing_sort_key)

        latest_annual = sorted_annuals[-1] if sorted_annuals else None
        latest_q = sorted_quarterlies[-1] if sorted_quarterlies else None

        if not latest_annual and not latest_q:
            return {}

        latest_a_end = self._parse_iso_date(latest_annual.get("endDate")) if latest_annual else None
        latest_q_end = self._parse_iso_date(latest_q.get("endDate")) if latest_q else None

        use_annual_as_latest = False
        if latest_annual and not latest_q:
            use_annual_as_latest = True
        elif latest_annual and latest_q:
            if latest_a_end and latest_q_end:
                use_annual_as_latest = latest_a_end >= latest_q_end
            else:
                use_annual_as_latest = latest_annual["year"] >= latest_q["year"]

        ttm: Dict[str, Dict[str, Any]] = {}

        if use_annual_as_latest and latest_annual is not None:
            period_str = latest_a_end.isoformat() if latest_a_end else f"{latest_annual['year']}-12-31"
            rep = latest_annual.get("report") or {}
            for metric_key, (section, tags) in self.BIG4_CONCEPTS.items():
                val = self._get_opt_val(rep, section, tags)
                if val is not None:
                    ttm[metric_key] = {
                        "value": val,
                        "period": period_str,
                        "period_type": "MRQ" if metric_key == "book_value" else "TTM",
                        "source": "xbrl_annual",
                    }
            # Free Cash Flow (TTM) = OCF - |CapEx|
            capex_val = self._get_opt_val(rep, *self.CAPEX_CONCEPTS)
            if "operating_cash_flow" in ttm and capex_val is not None:
                ttm["free_cash_flow"] = {
                    "value": ttm["operating_cash_flow"]["value"] - abs(capex_val),
                    "period": period_str,
                    "period_type": "TTM",
                    "source": "xbrl_annual",
                }
            # TTM YoY Revenue Growth = FY(Y) / FY(Y-1) - 1
            prior_annual = annual_by_year.get(latest_annual["year"] - 1)
            if "revenue" in ttm and prior_annual is not None:
                prev_rev = self._get_opt_val(prior_annual.get("report") or {}, *self.BIG4_CONCEPTS["revenue"])
                if prev_rev is not None and prev_rev > 0:
                    ttm["revenue_growth_yoy"] = {
                        "value": (ttm["revenue"]["value"] / prev_rev) - 1.0,
                        "period": period_str,
                        "period_type": "TTM",
                        "source": "xbrl_annual",
                    }
            return ttm

        if latest_q is None:
            return {}

        q_year = latest_q["year"]
        q_num = latest_q["quarter"]
        period_str = latest_q_end.isoformat() if latest_q_end else None

        def is_ytd_filing(item: Dict[str, Any], quarter_num: int) -> bool:
            if quarter_num == 1:
                return True
            start_dt = self._parse_iso_date(item.get("startDate"))
            end_dt = self._parse_iso_date(item.get("endDate"))
            if not start_dt or not end_dt:
                return False
            days = (end_dt - start_dt).days
            if quarter_num == 2:
                return days >= 140
            if quarter_num == 3:
                return days >= 230
            return False

        prev_annual = annual_by_year.get(q_year - 1)
        prev_q = quarterly_by_key.get((q_year - 1, q_num))

        if (
            prev_annual is not None
            and prev_q is not None
            and is_ytd_filing(latest_q, q_num)
            and is_ytd_filing(prev_q, q_num)
        ):
            ann_rep = prev_annual.get("report") or {}
            curr_rep = latest_q.get("report") or {}
            prev_rep = prev_q.get("report") or {}
            for metric_key in ("revenue", "net_income", "operating_cash_flow"):
                section, tags = self.BIG4_CONCEPTS[metric_key]
                v_ann = self._get_opt_val(ann_rep, section, tags)
                v_curr = self._get_opt_val(curr_rep, section, tags)
                v_prev = self._get_opt_val(prev_rep, section, tags)
                if v_ann is not None and v_curr is not None and v_prev is not None:
                    ttm[metric_key] = {
                        "value": v_ann + v_curr - v_prev,
                        "period": period_str,
                        "period_type": "TTM",
                        "source": "xbrl_quarterly",
                    }

            # Free Cash Flow (TTM) = OCF_TTM - CapEx_TTM (normalize CapEx sign per filing)
            cap_ann = self._get_opt_val(ann_rep, *self.CAPEX_CONCEPTS)
            cap_curr = self._get_opt_val(curr_rep, *self.CAPEX_CONCEPTS)
            cap_prev = self._get_opt_val(prev_rep, *self.CAPEX_CONCEPTS)
            if (
                "operating_cash_flow" in ttm
                and cap_ann is not None
                and cap_curr is not None
                and cap_prev is not None
            ):
                capex_ttm = abs(cap_ann) + abs(cap_curr) - abs(cap_prev)
                ttm["free_cash_flow"] = {
                    "value": ttm["operating_cash_flow"]["value"] - capex_ttm,
                    "period": period_str,
                    "period_type": "TTM",
                    "source": "xbrl_quarterly",
                }

            # Matched TTM-vs-prior-TTM YoY Revenue Growth:
            # Prior TTM = Annual(Y-2) + YTD(Y-1, q) - YTD(Y-2, q)
            prev2_annual = annual_by_year.get(q_year - 2)
            prev2_q = quarterly_by_key.get((q_year - 2, q_num))
            if (
                "revenue" in ttm
                and prev2_annual is not None
                and prev2_q is not None
                and is_ytd_filing(prev2_q, q_num)
            ):
                rev_sec, rev_tags = self.BIG4_CONCEPTS["revenue"]
                r_ann2 = self._get_opt_val(prev2_annual.get("report") or {}, rev_sec, rev_tags)
                r_prev = self._get_opt_val(prev_rep, rev_sec, rev_tags)
                r_prev2 = self._get_opt_val(prev2_q.get("report") or {}, rev_sec, rev_tags)
                if r_ann2 is not None and r_prev is not None and r_prev2 is not None:
                    prior_ttm_rev = r_ann2 + r_prev - r_prev2
                    if prior_ttm_rev > 0:
                        ttm["revenue_growth_yoy"] = {
                            "value": (ttm["revenue"]["value"] / prior_ttm_rev) - 1.0,
                            "period": period_str,
                            "period_type": "TTM",
                            "source": "xbrl_quarterly",
                        }

        # Book Value (MRQ): point-in-time balance sheet snapshot from latest 10-Q
        bv_section, bv_tags = self.BIG4_CONCEPTS["book_value"]
        bv_val = self._get_opt_val(latest_q.get("report") or {}, bv_section, bv_tags)
        if bv_val is not None:
            ttm["book_value"] = {
                "value": bv_val,
                "period": period_str,
                "period_type": "MRQ",
                "source": "xbrl_quarterly",
            }

        return ttm

    def extract_key_metrics(self, symbol: str, include_ttm: bool = False) -> Dict[str, Any]:
        raw_reports = self.get_financials_reported(symbol)
        
        # Sort by year ascending
        raw_reports.sort(key=lambda x: x["year"])
        
        history = {
            "revenue": [],
            "net_income": [],
            "operating_cash_flow": [],
            "book_value": [],
            "eps": [],
            "capex": [],
            "da": [],
            "working_capital": [],
            "working_capital_change": []
        }

        get_opt_val = self._get_opt_val
        get_val = self._get_val

        ncwc_by_year = {}

        for year_data in raw_reports:
            year = year_data["year"]
            report = year_data["report"]
            
            rev = get_val(report, *self.BIG4_CONCEPTS["revenue"])
            ni = get_val(report, *self.BIG4_CONCEPTS["net_income"])
            ocf = get_val(report, *self.BIG4_CONCEPTS["operating_cash_flow"])
            equity = get_val(report, *self.BIG4_CONCEPTS["book_value"])
            eps = get_val(report, "ic", ["us-gaap_EarningsPerShareDiluted", "us-gaap_EarningsPerShareBasic"])
            capex = get_val(report, *self.CAPEX_CONCEPTS)
            da = get_val(report, "cf", ["us-gaap_DepreciationDepletionAndAmortization", "us-gaap_DepreciationDepletionAndAmortizationContinuingOperations", "us-gaap_DepreciationAndAmortization", "us-gaap_Depreciation", "us-gaap_DepreciationAmortizationAndAccretionNet"])

            # Non-Cash Working Capital (Balance Sheet):
            # NCWC = (Current Assets - Cash & Short-Term Investments) - (Current Liabilities - Short-Term Debt)
            curr_assets = get_opt_val(report, "bs", ["us-gaap_AssetsCurrent"])
            curr_liab = get_opt_val(report, "bs", ["us-gaap_LiabilitiesCurrent"])
            if curr_assets is not None and curr_liab is not None:
                cash_and_sti = get_opt_val(report, "bs", ["us-gaap_CashCashEquivalentsAndShortTermInvestments"])
                if cash_and_sti is None:
                    cash_only = get_val(report, "bs", ["us-gaap_CashAndCashEquivalentsAtCarryingValue", "us-gaap_Cash"])
                    sti_only = get_val(report, "bs", [
                        "us-gaap_MarketableSecuritiesCurrent",
                        "us-gaap_ShortTermInvestments",
                        "us-gaap_AvailableForSaleSecuritiesDebtSecuritiesCurrent"
                    ])
                    cash_and_sti = cash_only + sti_only

                debt_current = get_opt_val(report, "bs", ["us-gaap_DebtCurrent"])
                if debt_current is None:
                    st_borrowings = get_val(report, "bs", ["us-gaap_ShortTermBorrowings", "us-gaap_CommercialPaper"])
                    ltd_current = get_val(report, "bs", [
                        "us-gaap_LongTermDebtCurrent",
                        "us-gaap_LongTermDebtAndCapitalLeaseObligationsCurrent"
                    ])
                    debt_current = st_borrowings + ltd_current

                ncwc = (curr_assets - cash_and_sti) - (curr_liab - debt_current)
            else:
                ncwc = None

            # Year-over-year change in Non-Cash Working Capital:
            # Positive ΔWC = increase in working capital (cash outflow); Negative ΔWC = cash inflow.
            prev_ncwc = ncwc_by_year.get(year - 1) if isinstance(year, int) else None
            if ncwc is not None and prev_ncwc is not None:
                wc_change = ncwc - prev_ncwc
                wc_source = "balance_sheet"
            else:
                # Fallback to explicit Cash Flow Statement operating working capital XBRL tag
                cf_wc = get_opt_val(report, "cf", [
                    "us-gaap_IncreaseDecreaseInOperatingCapital",
                    "us-gaap_IncreaseDecreaseInOperatingAssetsAndLiabilities"
                ])
                if cf_wc is not None:
                    wc_change = cf_wc
                    wc_source = "cash_flow"
                else:
                    wc_change = 0.0
                    wc_source = "unavailable"

            if ncwc is not None and isinstance(year, int):
                ncwc_by_year[year] = ncwc
            
            history["revenue"].append({"year": year, "value": rev})
            history["net_income"].append({"year": year, "value": ni})
            history["operating_cash_flow"].append({"year": year, "value": ocf})
            history["book_value"].append({"year": year, "value": equity})
            history["eps"].append({"year": year, "value": eps})
            history["capex"].append({"year": year, "value": capex})
            history["da"].append({"year": year, "value": da})
            history["working_capital"].append({"year": year, "value": ncwc if ncwc is not None else 0.0, "available": ncwc is not None})
            history["working_capital_change"].append({"year": year, "value": wc_change, "source": wc_source})

        # Also get current total debt and cash from the latest report
        latest_report = raw_reports[-1]["report"] if raw_reports else {}
        total_debt_short = get_val(latest_report, "bs", ["us-gaap_DebtCurrent", "us-gaap_ShortTermBorrowings"])
        total_debt_long = get_val(latest_report, "bs", ["us-gaap_LongTermDebt", "us-gaap_LongTermDebtNoncurrent"])
        cash = get_val(latest_report, "bs", ["us-gaap_CashAndCashEquivalentsAtCarryingValue"])
        
        result: Dict[str, Any] = {
            "history": history,
            "latest_total_debt": total_debt_short + total_debt_long,
            "latest_cash": cash
        }

        if include_ttm:
            try:
                quarterly_reports = self.get_financials_reported(symbol, freq="quarterly")
                ttm_data = self.compute_xbrl_ttm(raw_reports, quarterly_reports)
                if ttm_data:
                    result["ttm"] = ttm_data
            except Exception as e:
                print(f"Optional quarterly XBRL TTM fetch failed for {symbol}: {e}")

        return result
