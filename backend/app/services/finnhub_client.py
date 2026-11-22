import requests
from typing import Dict, Any, List

class FinnhubClient:
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

    def get_financials_reported(self, symbol: str) -> List[Dict[str, Any]]:
        res = requests.get(f"{self.base_url}/stock/financials-reported?symbol={symbol}&freq=annual&token={self.api_key}")
        res.raise_for_status()
        data = res.json()
        return data.get("data", [])

    def extract_key_metrics(self, symbol: str) -> Dict[str, Any]:
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
        
        def get_opt_val(report, section, possible_tags):
            for tag in possible_tags:
                for item in report.get(section, []):
                    if item.get("concept") == tag and item.get("value") is not None:
                        try:
                            return float(item["value"])
                        except (TypeError, ValueError):
                            continue
            return None

        def get_val(report, section, possible_tags):
            val = get_opt_val(report, section, possible_tags)
            return val if val is not None else 0.0

        ncwc_by_year = {}

        for year_data in raw_reports:
            year = year_data["year"]
            report = year_data["report"]
            
            rev = get_val(report, "ic", ["us-gaap_Revenues", "us-gaap_SalesRevenueNet", "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax"])
            ni = get_val(report, "ic", ["us-gaap_NetIncomeLoss"])
            ocf = get_val(report, "cf", ["us-gaap_NetCashProvidedByUsedInOperatingActivities", "us-gaap_NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"])
            equity = get_val(report, "bs", ["us-gaap_StockholdersEquity", "us-gaap_StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"])
            eps = get_val(report, "ic", ["us-gaap_EarningsPerShareDiluted", "us-gaap_EarningsPerShareBasic"])
            capex = get_val(report, "cf", ["us-gaap_PaymentsForPropertyPlantAndEquipment", "us-gaap_PaymentsToAcquirePropertyPlantAndEquipment", "us-gaap_PaymentsForPropertyPlantAndEquipmentContinuingOperations", "us-gaap_PaymentsToAcquirePropertyPlantAndEquipmentContinuingOperations"])
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
        
        return {
            "history": history,
            "latest_total_debt": total_debt_short + total_debt_long,
            "latest_cash": cash
        }
