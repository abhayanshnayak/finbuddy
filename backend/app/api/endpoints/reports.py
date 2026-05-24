from fastapi import APIRouter, HTTPException
from typing import List

from app.dependencies import db_service as db, finnhub_client as finnhub, calc_service as calc, ai_service as ai
from app.services.report_service import compute_report_from_raw, generate_and_cache_report, build_growth_analysis_context

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
        context_data = build_growth_analysis_context(
            ticker=ticker,
            name=company_data.get("name", ticker),
            financials=financials,
            metrics=company_data.get("metrics", {}),
            profile=company_data.get("profile", {}),
            current_price=company_data.get("price_at_storage", 0.0)
        )
        
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

