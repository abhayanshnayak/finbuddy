from fastapi import APIRouter, HTTPException
from typing import List

from app.dependencies import db_service as db, finnhub_client as finnhub, calc_service as calc, ai_service as ai
from app.services.report_service import compute_report_from_raw, generate_and_cache_report

router = APIRouter()

@router.get("/stocks/{ticker}/growth-analysis")
async def get_growth_analysis(ticker: str, force_fresh: bool = False):
    """
    Fetches the growth company analysis from the database.
    If not found or force_fresh is true, it gathers financial context, generates the analysis using Gemini,
    caches the result in the database, and returns it.
    """
    try:
        # Check DB first
        company_data = db.get_company_data(ticker)
        context = company_data.get("context", {})
        growth_analysis = context.get("growth_company_analysis")
        
        if growth_analysis and not force_fresh:
            return growth_analysis
            
        # If not in DB, we need to generate it.
        # But we need financial context. Let's see if we have financials.
        financials = company_data.get("financials", {})
        if not financials:
            raise HTTPException(status_code=400, detail="No financial data available for this company to analyze.")
            
        # Build context from raw DB object
        history = financials.get("history", {})
        metrics = company_data.get("metrics", {})
        
        # Calculate historical FCF
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
        
        # Call AI
        analysis_result = ai.analyze_growth_company(company_data.get("name", ticker), context_data)
        
        if "error" in analysis_result:
             raise HTTPException(status_code=500, detail=analysis_result["error"])
             
        # Add timestamp
        from datetime import datetime
        import pytz
        analysis_result["generated_at"] = datetime.now(pytz.utc).isoformat()
        
        # Save back to DB using our new update function
        db.update_company_field(ticker, "growth_company_analysis", analysis_result)
        
        return analysis_result

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in get_growth_analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/report/{ticker}")
def get_report(ticker: str, force_fresh: bool = False):
    ticker = ticker.upper()
    original_ticker = ticker
    
    # 1. Check Cache
    if not force_fresh:
        cached_data = db.get_company_data(ticker)
        if cached_data and "ai_analysis" in cached_data and "financials" in cached_data and "error" not in cached_data["ai_analysis"]:
            return compute_report_from_raw(cached_data, calc)

    # Generate and return
    try:
        return generate_and_cache_report(ticker, finnhub, calc, ai, db, force_fresh=force_fresh)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

