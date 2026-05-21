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
            "da": []
        }
        
        def get_val(report, section, possible_tags):
            for tag in possible_tags:
                for item in report.get(section, []):
                    if item["concept"] == tag:
                        return float(item["value"])
            return 0.0

        for year_data in raw_reports:
            year = year_data["year"]
            report = year_data["report"]
            
            rev = get_val(report, "ic", ["us-gaap_Revenues", "us-gaap_SalesRevenueNet", "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax"])
            ni = get_val(report, "ic", ["us-gaap_NetIncomeLoss"])
            ocf = get_val(report, "cf", ["us-gaap_NetCashProvidedByUsedInOperatingActivities"])
            equity = get_val(report, "bs", ["us-gaap_StockholdersEquity", "us-gaap_StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"])
            eps = get_val(report, "ic", ["us-gaap_EarningsPerShareDiluted", "us-gaap_EarningsPerShareBasic"])
            capex = get_val(report, "cf", ["us-gaap_PaymentsForPropertyPlantAndEquipment", "us-gaap_PaymentsToAcquirePropertyPlantAndEquipment"])
            da = get_val(report, "cf", ["us-gaap_DepreciationDepletionAndAmortization"])
            
            history["revenue"].append({"year": year, "value": rev})
            history["net_income"].append({"year": year, "value": ni})
            history["operating_cash_flow"].append({"year": year, "value": ocf})
            history["book_value"].append({"year": year, "value": equity})
            history["eps"].append({"year": year, "value": eps})
            history["capex"].append({"year": year, "value": capex})
            history["da"].append({"year": year, "value": da})

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
