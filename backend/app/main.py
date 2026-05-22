from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from pydantic import BaseModel, Field
from typing import List
import uuid
import json
import time
from datetime import datetime
import pytz

from app.services.finnhub_client import FinnhubClient
from app.services.calculator import FinancialCalculator
from app.services.ai_service import AIService
from app.services.db_service import DBService

class Settings(BaseSettings):
    FINNHUB_API_KEY: str = "d6ch2qhr01qsiik27i80d6ch2qhr01qsiik27i8g"
    GCP_PROJECT_ID: str = "gen-lang-client-0826635932"

settings = Settings()

app = FastAPI(title="Finbuddy Stock Research API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Services
finnhub = FinnhubClient(api_key=settings.FINNHUB_API_KEY)
calc = FinancialCalculator()
ai = AIService(project_id=settings.GCP_PROJECT_ID)
db = DBService(project_id=settings.GCP_PROJECT_ID)

# Initialize Pub/Sub Publisher client if possible
try:
    from google.cloud import pubsub_v1
    publisher = pubsub_v1.PublisherClient()
    topic_path = publisher.topic_path(settings.GCP_PROJECT_ID, "stock-ingestion-topic")
except Exception as e:
    print(f"Warning: Failed to initialize Pub/Sub publisher client: {e}")
    publisher = None
    topic_path = None

class BatchPayload(BaseModel):
    tickers: List[str] = Field(..., max_items=500)
    force_fresh: bool = False
    tags: List[str] = []

def compute_report_from_raw(raw_data: dict, calc: FinancialCalculator) -> dict:
    ticker = raw_data.get("ticker", "Unknown")
    combined_tags = raw_data.get("tags", [])
    profile = raw_data.get("profile", {})
    metrics = raw_data.get("metrics", {})
    financials = raw_data.get("financials", {})
    ai_analysis = raw_data.get("ai_analysis", {})
    current_price = raw_data.get("price_at_storage", 0.0)
    timestamp_pst = raw_data.get("last_updated_pst", "")
    
    history = financials.get("history", {})
    
    latest_eps = metrics.get("metric", {}).get("epsBasicExclExtraItemsTTM", 0.0)
    shares_out = profile.get("shareOutstanding", 0) * 1000000
    market_cap = current_price * shares_out if shares_out else metrics.get("metric", {}).get("marketCapitalization", 0) * 1000000

    growth_rates = {
        "revenue": list(calc.calculate_growth_rates(history.get("revenue", [])).values()),
        "net_income": list(calc.calculate_growth_rates(history.get("net_income", [])).values()),
        "book_value": list(calc.calculate_growth_rates(history.get("book_value", [])).values()),
        "operating_cash_flow": list(calc.calculate_growth_rates(history.get("operating_cash_flow", [])).values())
    }
    
    fcf_history = []
    ocf_list = history.get("operating_cash_flow", [])
    capex_list = history.get("capex", [])
    for i in range(len(ocf_list)):
        year = ocf_list[i]["year"]
        ocf_val = ocf_list[i]["value"]
        capex_val = capex_list[i]["value"] if i < len(capex_list) else 0.0
        fcf_val = ocf_val - abs(capex_val)
        fcf_history.append({"year": year, "value": fcf_val})

    windage_gr, windage_rationale, computation_windage_details = calc.calculate_windage_growth_rate(ocf_list)
    
    windage_fallback_message = None
    if windage_gr < 0:
        ni_10_yr_cagr = growth_rates["net_income"][3] if len(growth_rates["net_income"]) > 3 else 0.0
        windage_gr = ni_10_yr_cagr
        windage_rationale = f"Windage growth rate was negative, so the 10-year Net Income growth rate ({windage_gr:.2%}) was used instead."
        computation_windage_details = {
            "steps": [],
            "stats": {"mean": windage_gr, "stdev": 0.0, "lower_bound": windage_gr, "upper_bound": windage_gr, "is_filtered": False},
            "final_rate": windage_gr
        }
        windage_fallback_message = "The 10-year Net Income average was used for the windage growth."    
    latest_net_income = history["net_income"][-1]["value"] if history.get("net_income") else 0
    latest_da = history["da"][-1]["value"] if history.get("da") else 0
    latest_capex = capex_list[-1]["value"] if capex_list else 0
    latest_fcf = ocf_list[-1]["value"] - abs(latest_capex) if ocf_list else 0
    latest_fcf_year = ocf_list[-1]["year"] if ocf_list else "TTM"

    series_annual = metrics.get("series", {}).get("annual", {})
    roe_history = list(reversed(series_annual.get("roe", [])))
    roic_history = list(reversed(series_annual.get("roic", [])))
    
    pe_history = series_annual.get("pe", [])
    sorted_pe = sorted(pe_history, key=lambda x: x.get("period", ""), reverse=True)
    last_5_pe_records = sorted_pe[:5]
    last_5_pe_values = [x.get("v", 15.0) for x in last_5_pe_records if x.get("v") is not None]
    
    if last_5_pe_values:
        max_pe_5yr = max(last_5_pe_values)
    else:
        pe_excl_extra = metrics.get("metric", {}).get("peExclExtraTTM")
        max_pe_5yr = pe_excl_extra if pe_excl_extra is not None else 15.0
        
    windage_pe = min(max_pe_5yr, windage_gr * 100 * 2)
    
    computation_pe_details = {
        "last_5_years_pe": [
            {
                "date": x.get("period", ""),
                "pe": x.get("v", 0.0)
            }
            for x in last_5_pe_records
        ],
        "max_pe_5yr": max_pe_5yr,
        "two_x_growth": windage_gr * 100 * 2,
        "final_pe": windage_pe
    }
    
    roe_averages = calc.calculate_averages(roe_history)
    roic_averages = calc.calculate_averages(roic_history)

    # Rule of 40 and EV/Revenue
    rev_list = history.get("revenue", [])
    if len(rev_list) >= 2 and rev_list[-2]["value"] > 0:
        latest_revenue = rev_list[-1]["value"]
        latest_revenue_year = rev_list[-1]["year"]
        previous_revenue = rev_list[-2]["value"]
        revenue_growth_1yr = (latest_revenue / previous_revenue) - 1
    else:
        latest_revenue = rev_list[-1]["value"] if len(rev_list) >= 1 else 0
        latest_revenue_year = rev_list[-1]["year"] if len(rev_list) >= 1 else "TTM"
        revenue_growth_1yr = 0.0

    fcf_margin = latest_fcf / latest_revenue if latest_revenue > 0 else 0.0
    rule_of_40 = (revenue_growth_1yr + fcf_margin) * 100

    cash_and_equivalents = financials.get("latest_cash", 0)
    total_debt = financials.get("latest_total_debt", 0)
    enterprise_value = market_cap + total_debt - cash_and_equivalents
    ev_to_revenue = enterprise_value / latest_revenue if latest_revenue > 0 else 0.0

    owner_earnings, cap_rate, cap_rationale = calc.calculate_10_cap(latest_net_income, latest_da, latest_capex, market_cap)
    payback_years, projected_fcf, payback_rationale = calc.calculate_payback_time(latest_fcf, windage_gr, market_cap, str(latest_fcf_year))
    mos_price, mos_details = calc.calculate_margin_of_safety(latest_eps, windage_gr, windage_pe)

    return {
        "ticker": ticker,
        "tags": combined_tags,
        "name": profile.get("name", ticker),
        "industry": profile.get("finnhubIndustry", "Unknown"),
        "overview": ai_analysis.get("overview", "No overview available."),
        "sector": ai_analysis.get("sector", "Unknown"),
        "subsector": ai_analysis.get("subsector", "Unknown"),
        "industry_group": ai_analysis.get("industry_group", "Unknown"),
        "price_at_storage": current_price,
        "last_updated_pst": timestamp_pst,
        "financials": {
            "raw_data": {
                "revenue_history": history.get("revenue", []),
                "net_income_history": history.get("net_income", []),
                "book_value_history": history.get("book_value", []),
                "operating_cash_flow_history": ocf_list,
                "eps_history": history.get("eps", []),
                "roe_history": roe_history,
                "roic_history": roic_history,
                "total_debt": financials.get("latest_total_debt", 0),
                "cash_and_equivalents": financials.get("latest_cash", 0)
            },
            "derived_metrics": {
                "growth_rates_1_3_5_10_yr": growth_rates,
                "computation_growth_rates": "Calculated using CAGR formula (Ending Value / Beginning Value)^(1/Years) - 1.",
                "windage_growth_rate": windage_gr,
                "computation_windage": windage_rationale,
                "computation_windage_details": computation_windage_details,
                "debt_payoff_years": financials.get("latest_total_debt", 0) / latest_fcf if latest_fcf > 0 else 0,
                "computation_debt_payoff": f"Total Debt / Current Annual FCF",
                "rule_of_40": rule_of_40,
                "computation_rule_of_40_details": {
                    "revenue_growth_1yr": revenue_growth_1yr,
                    "fcf_margin": fcf_margin,
                    "latest_revenue": latest_revenue,
                    "latest_fcf": latest_fcf,
                    "latest_year": str(latest_revenue_year),
                    "explanation": "Score > 40 indicates a healthy balance of growth and profitability."
                },
                "ev_to_revenue": ev_to_revenue,
                "computation_ev_to_revenue_details": {
                    "enterprise_value": enterprise_value,
                    "latest_revenue": latest_revenue,
                    "latest_year": str(latest_revenue_year),
                    "explanation": "Measures how much it costs to buy the company's sales."
                }
            },
            "valuations": {
                "margin_of_safety_price": mos_price,
                "windage_growth_rate_used": windage_gr,
                "windage_pe_used": windage_pe,
                "marr_used": 0.15,
                "computation_mos_details": mos_details,
                "computation_pe_details": computation_pe_details,
                "computation_windage_details": computation_windage_details,
                "payback_time_years": payback_years,
                "projected_fcf_per_year": projected_fcf,
                "computation_payback_details": payback_rationale,
                "owner_earnings": owner_earnings,
                "cap_rate": cap_rate,
                "computation_10_cap": cap_rationale,
                "market_cap": market_cap,
                "windage_fallback_message": windage_fallback_message
            }
        },
        "qualitative": {
            "sources": ai_analysis.get("sources", {}),
            "growth_plans": ai_analysis.get("growth_plans", {}),
            "competitors": ai_analysis.get("competitors", {}),
            "risks": ai_analysis.get("risks", {}),
            "moats": ai_analysis.get("moats", {}),
            "management": {
                **ai_analysis.get("management", {}),
                "roic_3_yr_avg": roic_averages.get("3_yr", 0),
                "roic_5_yr_avg": roic_averages.get("5_yr", 0),
                "roic_10_yr_avg": roic_averages.get("10_yr", 0),
                "roe_3_yr_avg": roe_averages.get("3_yr", 0),
                "roe_5_yr_avg": roe_averages.get("5_yr", 0),
                "roe_10_yr_avg": roe_averages.get("10_yr", 0)
            }
        },
        "context": {
            "market_and_bias": ai_analysis.get("market_and_bias", {})
        }
    }

def generate_and_cache_report(ticker: str, finnhub: FinnhubClient, calc: FinancialCalculator, ai: AIService, db: DBService, force_fresh: bool = False, tags: List[str] = None):
    ticker = ticker.upper()
    original_ticker = ticker
    tags = tags or []
    
    # 1. Check Cache first to make it idempotent and ultra-fast
    if not force_fresh:
        cached_data = db.get_company_data(ticker)
        if cached_data and "ai_analysis" in cached_data and "financials" in cached_data and "error" not in cached_data["ai_analysis"]:
            print(f"Using cached report for {ticker}")
            existing_tags = cached_data.get("tags", [])
            combined_tags = list(set(existing_tags + tags))
            if set(existing_tags) != set(combined_tags):
                cached_data["tags"] = combined_tags
                db.save_company_data(ticker, cached_data)
            return compute_report_from_raw(cached_data, calc)
            
    # Fetch existing to preserve tags even if we're doing a force_fresh
    existing_data = db.get_company_data(ticker) if force_fresh else cached_data
    existing_tags = existing_data.get("tags", []) if existing_data else []
    combined_tags = list(set(existing_tags + tags))
        
    # 2. Fetch Data from Finnhub
    try:
        profile = finnhub.get_profile(ticker)
        
        # Finnhub resolves some tickers to a primary class (e.g., GOOG -> GOOGL)
        actual_ticker = profile.get("ticker", ticker)
        
        # Check cache again just in case the resolved ticker is cached
        if actual_ticker != ticker and not force_fresh:
            cached_data = db.get_company_data(actual_ticker)
            if cached_data and "ai_analysis" in cached_data and "financials" in cached_data and "error" not in cached_data["ai_analysis"]:
                existing_tags_actual = cached_data.get("tags", [])
                combined_tags_actual = list(set(existing_tags_actual + tags))
                if set(existing_tags_actual) != set(combined_tags_actual):
                    cached_data["tags"] = combined_tags_actual
                    db.save_company_data(actual_ticker, cached_data)
                db.save_company_data(original_ticker, cached_data)
                return compute_report_from_raw(cached_data, calc)
                
        # Also grab existing tags for actual ticker if doing a full fresh
        if force_fresh or not cached_data:
            existing_data_actual = db.get_company_data(actual_ticker)
            existing_tags_actual = existing_data_actual.get("tags", []) if existing_data_actual else []
            combined_tags = list(set(existing_tags_actual + tags))
        ticker = actual_ticker
        
        metrics = finnhub.get_metrics(ticker)
        financials = finnhub.extract_key_metrics(ticker)
    except Exception as e:
        raise Exception(f"Failed to fetch stock data for {ticker}: {e}")

    # 3. Prompt AI
    ai_analysis = ai.analyze_qualitative(profile.get("name", ticker), profile, metrics)
    
    if "error" in ai_analysis:
        if existing_data and "ai_analysis" in existing_data and "error" not in existing_data["ai_analysis"]:
            print(f"AI generation failed, falling back to cached AI analysis for {ticker}")
            ai_analysis = existing_data["ai_analysis"]
        else:
            raise Exception(f"AI generation failed: {ai_analysis['error']}")

    current_price = finnhub.get_quote(ticker).get("c", 0.0)

    # Generate timestamp in PST
    pst_tz = pytz.timezone('US/Pacific')
    fetched_at = datetime.now(pytz.utc).astimezone(pst_tz)
    timestamp_pst = fetched_at.strftime("%-d %b %I:%M%p").lower()

    # 4. Build Final Raw JSON Schema
    raw_data = {
        "ticker": ticker,
        "tags": combined_tags,
        "name": profile.get("name", ticker),
        "industry": profile.get("finnhubIndustry", "Unknown"),
        "price_at_storage": current_price,
        "last_updated_pst": timestamp_pst,
        "profile": profile,
        "metrics": metrics,
        "financials": financials,
        "ai_analysis": ai_analysis
    }

    # 5. Save Raw to Cache
    db.save_company_data(ticker, raw_data)
    if original_ticker != ticker:
        db.save_company_data(original_ticker, raw_data)

    return compute_report_from_raw(raw_data, calc)

@app.get("/api/stocks/{ticker}/growth-analysis")
async def get_growth_analysis(ticker: str):
    """
    Fetches the growth company analysis from the database.
    If not found, it gathers financial context, generates the analysis using Gemini,
    caches the result in the database, and returns it.
    """
    try:
        # Check DB first
        company_data = db.get_company_data(ticker)
        context = company_data.get("context", {})
        growth_analysis = context.get("growth_company_analysis")
        
        if growth_analysis:
            return growth_analysis
            
        # If not in DB, we need to generate it.
        # But we need financial context. Let's see if we have financials.
        financials = company_data.get("financials", {})
        if not financials:
            raise HTTPException(status_code=400, detail="No financial data available for this company to analyze.")
            
        # Build context
        context_data = {
            "name": company_data.get("name", ticker),
            "ticker": ticker,
            "revenue_history": financials.get("raw_data", {}).get("revenue", []),
            "fcf_history": financials.get("raw_data", {}).get("ocf", []), # Assuming FCF is derived from OCF
            "net_income_history": financials.get("raw_data", {}).get("netIncome", []),
            "latest_cash": financials.get("latest_cash", 0),
            "latest_total_debt": financials.get("latest_total_debt", 0),
            "market_cap": financials.get("valuations", {}).get("market_cap", 0),
            "derived_metrics": financials.get("derived_metrics", {})
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

@app.get("/api/companies")
def get_all_companies():
    companies = db.list_companies()
    return companies

@app.get("/api/report/{ticker}")
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

def local_background_ingest(batch_id: str, tickers_to_process: List[str], force_fresh: bool = False, tags: List[str] = None):
    """Background fallback when Pub/Sub is not available or credentials are local-only"""
    print(f"Starting local background ingestion for batch {batch_id}...")
    tags = tags or []
    for ticker in tickers_to_process:
        # Check if batch still exists
        batch = db.get_batch(batch_id)
        if not batch:
            break
            
        db.update_batch_ticker_status(batch_id, ticker, "processing")
        
        try:
            # Pause to preserve rate limits (approx 2s between calls)
            time.sleep(2.0)
            
            generate_and_cache_report(ticker, finnhub, calc, ai, db, force_fresh=force_fresh, tags=tags)
            
            db.update_batch_ticker_status(batch_id, ticker, "completed")
            
        except Exception as e:
            print(f"Local batch processing failed for {ticker}: {e}")
            db.update_batch_ticker_status(batch_id, ticker, "failed", error=str(e))

@app.post("/api/batch")
def start_batch(payload: BatchPayload, background_tasks: BackgroundTasks):
    print("RECEIVED BATCH PAYLOAD:", payload.dict())
    # De-duplicate and validate
    raw_tickers = list(set([t.strip().upper() for t in payload.tickers if t.strip()]))
    if len(raw_tickers) > 500:
        raise HTTPException(status_code=400, detail="Maximum batch size is 500 tickers")
    if not raw_tickers:
        raise HTTPException(status_code=400, detail="Please provide at least one valid ticker symbol")
        
    batch_id = str(uuid.uuid4())
    
    # Initialize batch state
    batch_data = {
        "batch_id": batch_id,
        "created_at": datetime.now(pytz.utc).isoformat(),
        "force_fresh_data": payload.force_fresh,
        "status": "pending",
        "total_symbols": len(raw_tickers),
        "completed_count": 0,
        "failed_count": 0,
        "symbols": {},
        "tags": payload.tags
    }
    
    tickers_to_process = []
    
    # Check cache first to avoid sending messages for already valid cached stocks
    for ticker in raw_tickers:
        if not payload.force_fresh:
            cached = db.get_company_data(ticker)
            if cached and "ai_analysis" in cached and "financials" in cached and "error" not in cached["ai_analysis"]:
                existing_tags_cached = cached.get("tags", [])
                combined_tags_cached = list(set(existing_tags_cached + payload.tags))
                if set(existing_tags_cached) != set(combined_tags_cached):
                    cached["tags"] = combined_tags_cached
                    db.save_company_data(ticker, cached)

                batch_data["symbols"][ticker] = {
                    "status": "completed",
                    "error": None,
                    "timestamp": datetime.now(pytz.utc).isoformat(),
                    "tags": payload.tags
                }
                batch_data["completed_count"] += 1
                continue
                
        batch_data["symbols"][ticker] = {
            "status": "pending",
            "error": None,
            "timestamp": datetime.now(pytz.utc).isoformat(),
            "tags": payload.tags
        }
        tickers_to_process.append(ticker)
            
    # If all tickers are already cached
    if len(tickers_to_process) == 0:
        batch_data["status"] = "completed"
        db.save_batch(batch_id, batch_data)
        return {
            "batch_id": batch_id,
            "status": "completed",
            "total_symbols": len(raw_tickers),
            "completed_count": batch_data["completed_count"],
            "failed_count": 0,
            "dispatched_count": 0
        }
        
    # Save active batch to database
    db.save_batch(batch_id, batch_data)
    
    # Publish remaining tasks to Pub/Sub
    published_successfully = 0
    import os
    is_cloud_run = os.environ.get("K_SERVICE") is not None
    
    if publisher and topic_path and is_cloud_run:
        try:
            for ticker in tickers_to_process:
                msg_bytes = json.dumps({"ticker": ticker, "batch_id": batch_id, "force_fresh": payload.force_fresh, "tags": payload.tags}).encode("utf-8")
                publisher.publish(topic_path, msg_bytes)
                published_successfully += 1
        except Exception as e:
            print(f"Failed to publish to Pub/Sub: {e}. Falling back to background threads.")
            published_successfully = 0
            
    # Fallback to local background tasks if Pub/Sub failed or not configured
    if published_successfully == 0:
        background_tasks.add_task(local_background_ingest, batch_id, tickers_to_process, payload.force_fresh, payload.tags)
        print(f"Dispatched {len(tickers_to_process)} tickers to local FastAPI BackgroundTasks.")
        
    return {
        "batch_id": batch_id,
        "status": "pending" if published_successfully > 0 else "processing_locally",
        "total_symbols": len(raw_tickers),
        "completed_count": batch_data["completed_count"],
        "failed_count": 0,
        "dispatched_count": len(tickers_to_process)
    }

@app.get("/api/batch/{batch_id}")
def get_batch_status(batch_id: str):
    batch = db.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch

# Include the Pub/Sub worker router
from app.worker import router as worker_router
app.include_router(worker_router)
