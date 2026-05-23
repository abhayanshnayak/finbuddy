import sys
import os
import time
from datetime import datetime
import pytz

sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))
from app.services.db_service import DBService
from app.services.analyst_service import AnalystService
from app.core.config import settings

db = DBService(project_id=settings.GCP_PROJECT_ID)
ai = AnalystService(project_id=settings.GCP_PROJECT_ID)

docs = list(db.db.collection('companies').stream())

for doc in docs:
    ticker = doc.id
    company_data = doc.to_dict()
    context = company_data.get("context", {})
    
    if "growth_company_analysis" not in context:
        print(f"Generating for {ticker}...")
        
        financials = company_data.get("financials", {})
        if not financials:
            print(f"  Skipping {ticker}: No financial data")
            continue
            
        history = financials.get("history", {})
        metrics = company_data.get("metrics", {})
        
        fcf_history = []
        ocf_list = history.get("operating_cash_flow", [])
        capex_list = history.get("capex", [])
        for i in range(len(ocf_list)):
            year = ocf_list[i]["year"]
            ocf_val = ocf_list[i]["value"]
            capex_val = capex_list[i]["value"] if i < len(capex_list) else 0.0
            fcf_history.append({"year": year, "value": ocf_val - abs(capex_val)})

        current_price = company_data.get("price_at_storage", 0.0)
        profile = company_data.get("profile", {})
        shares_out = profile.get("shareOutstanding", 0) * 1000000
        market_cap = current_price * shares_out if shares_out else metrics.get("metric", {}).get("marketCapitalization", 0) * 1000000

        context_data = {
            "name": company_data.get("name", ticker),
            "ticker": ticker,
            "revenue_history": history.get("revenue", []),
            "operating_cash_flow_history": ocf_list,
            "free_cash_flow_history": fcf_history,
            "net_income_history": history.get("net_income", []),
            "eps_history": history.get("eps", []),
            "latest_cash": financials.get("latest_cash", 0),
            "latest_total_debt": financials.get("latest_total_debt", 0),
            "market_cap": market_cap
        }
        
        try:
            analysis_result = ai.analyze_growth_company(company_data.get("name", ticker), context_data)
            if "error" in analysis_result:
                print(f"  Error generating AI for {ticker}: {analysis_result['error']}")
                continue
                
            analysis_result["generated_at"] = datetime.now(pytz.utc).isoformat()
            db.update_company_field(ticker, "growth_company_analysis", analysis_result)
            print(f"  Successfully saved AI analysis for {ticker}")
            
            # Rate limiting for Vertex AI
            time.sleep(2)
        except Exception as e:
            print(f"  Exception for {ticker}: {str(e)}")

print("Done!")
