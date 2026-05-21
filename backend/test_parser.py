import requests

API_KEY = "d6ch2qhr01qsiik27i80d6ch2qhr01qsiik27i8g"

def test_parser():
    url = f"https://finnhub.io/api/v1/stock/financials-reported?symbol=AAPL&freq=annual&token={API_KEY}"
    res = requests.get(url).json()
    data = res.get("data", [])
    
    for year_data in data[:3]:
        year = year_data["year"]
        report = year_data["report"]
        
        def get_val(section, possible_tags):
            for tag in possible_tags:
                for item in report.get(section, []):
                    if item["concept"] == tag:
                        return item["value"]
            return None
            
        rev = get_val("ic", ["us-gaap_Revenues", "us-gaap_SalesRevenueNet", "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax"])
        ni = get_val("ic", ["us-gaap_NetIncomeLoss"])
        ocf = get_val("cf", ["us-gaap_NetCashProvidedByUsedInOperatingActivities"])
        equity = get_val("bs", ["us-gaap_StockholdersEquity", "us-gaap_StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"])
        eps = get_val("ic", ["us-gaap_EarningsPerShareDiluted", "us-gaap_EarningsPerShareBasic"])
        capex = get_val("cf", ["us-gaap_PaymentsForPropertyPlantAndEquipment"])
        da = get_val("cf", ["us-gaap_DepreciationDepletionAndAmortization"])
        
        print(f"Year {year}: Rev={rev}, NI={ni}, OCF={ocf}, Equity={equity}, EPS={eps}, CapEx={capex}, D&A={da}")

if __name__ == "__main__":
    test_parser()
