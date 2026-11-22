from datetime import datetime
import pytz
from fastapi import APIRouter, HTTPException

from app.dependencies import db_service as db, finnhub_client as finnhub, calc_service as calc, ai_service as ai
from app.services.report_service import (
    compute_report_from_raw,
    generate_and_cache_report,
    build_growth_analysis_context,
    build_business_model_context,
)

router = APIRouter()

@router.get("/stocks/{ticker}/business-model")
async def get_business_model_analysis(ticker: str, force_fresh: bool = False):
    """
    Fetches the business model, unit economics, and earnings divisions breakdown from the database.
    If not found or force_fresh is true, synthesizes it via Gemini, caches it in Firestore, and returns it.
    """
    ticker = ticker.upper()
    try:
        company_data = db.get_company_data(ticker) or {}
        context = company_data.get("context") or {}
        business_model = context.get("business_model_analysis")

        if (
            business_model
            and isinstance(business_model, dict)
            and "error" not in business_model
            and not force_fresh
        ):
            return business_model

        if not company_data:
            raise HTTPException(
                status_code=400,
                detail="No company data available for this ticker to analyze.",
            )

        context_data = build_business_model_context(
            ticker=ticker,
            name=company_data.get("name", ticker),
            financials=company_data.get("financials", {}),
            metrics=company_data.get("metrics", {}),
            profile=company_data.get("profile", {}),
            current_price=company_data.get("price_at_storage", 0.0),
        )

        analysis_result = ai.analyze_business_model(company_data.get("name", ticker), context_data)

        if "error" in analysis_result:
            raise HTTPException(status_code=500, detail=analysis_result["error"])

        analysis_result["generated_at"] = datetime.now(pytz.utc).isoformat()
        db.update_company_field(ticker, "business_model_analysis", analysis_result)

        return analysis_result

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in get_business_model_analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stocks/{ticker}/growth-analysis")
async def get_growth_analysis(ticker: str, force_fresh: bool = False):
    """
    Fetches the growth company analysis from the database.
    If not found or force_fresh is true, it gathers financial context, generates the analysis using Gemini,
    caches the result in the database, and returns it.
    """
    ticker = ticker.upper()
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

