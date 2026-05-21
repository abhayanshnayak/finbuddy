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

def generate_and_cache_report(ticker: str, finnhub: FinnhubClient, calc: FinancialCalculator, ai: AIService, db: DBService, force_fresh: bool = False):
    ticker = ticker.upper()
    original_ticker = ticker
    
    # 1. Check Cache first to make it idempotent and ultra-fast
    if not force_fresh:
        cached_data = db.get_company_data(ticker)
        if (
            cached_data 
            and "qualitative" in cached_data 
            and "management" in cached_data["qualitative"] 
            and "roic_3_yr_avg" in cached_data["qualitative"]["management"]
            and "financials" in cached_data
            and "valuations" in cached_data["financials"]
            and "computation_pe_details" in cached_data["financials"]["valuations"]
            and "computation_windage_details" in cached_data["financials"]["valuations"]
        ):
            print(f"Using cached report for {ticker}")
            return cached_data
        
    # 2. Fetch Data from Finnhub
    try:
        profile = finnhub.get_profile(ticker)
        
        # Finnhub resolves some tickers to a primary class (e.g., GOOG -> GOOGL)
        actual_ticker = profile.get("ticker", ticker)
        
        # Check cache again just in case the resolved ticker is cached
        if actual_ticker != ticker and not force_fresh:
            cached_data = db.get_company_data(actual_ticker)
            if (
                cached_data 
                and "qualitative" in cached_data 
                and "management" in cached_data["qualitative"] 
                and "roic_3_yr_avg" in cached_data["qualitative"]["management"]
                and "financials" in cached_data
                and "valuations" in cached_data["financials"]
                and "computation_pe_details" in cached_data["financials"]["valuations"]
                and "computation_windage_details" in cached_data["financials"]["valuations"]
            ):
                db.save_company_data(original_ticker, cached_data)
                return cached_data
                
        ticker = actual_ticker
        
        metrics = finnhub.get_metrics(ticker)
        financials = finnhub.extract_key_metrics(ticker)
    except Exception as e:
        raise Exception(f"Failed to fetch stock data for {ticker}: {e}")

    # 3. Calculate Financials
    history = financials["history"]
    latest_eps = metrics.get("metric", {}).get("epsBasicExclExtraItemsTTM", 0.0)
    current_price = finnhub.get_quote(ticker).get("c", 0.0)
    shares_out = profile.get("shareOutstanding", 0) * 1000000
    market_cap = current_price * shares_out if shares_out else metrics.get("metric", {}).get("marketCapitalization", 0) * 1000000

    growth_rates = {
        "revenue": list(calc.calculate_growth_rates(history["revenue"]).values()),
        "net_income": list(calc.calculate_growth_rates(history["net_income"]).values()),
        "book_value": list(calc.calculate_growth_rates(history["book_value"]).values()),
        "operating_cash_flow": list(calc.calculate_growth_rates(history["operating_cash_flow"]).values())
    }
    
    fcf_history = []
    for i in range(len(history["operating_cash_flow"])):
        year = history["operating_cash_flow"][i]["year"]
        ocf_val = history["operating_cash_flow"][i]["value"]
        capex_val = history["capex"][i]["value"] if i < len(history["capex"]) else 0.0
        fcf_val = ocf_val - abs(capex_val)
        fcf_history.append({"year": year, "value": fcf_val})

    windage_gr, windage_rationale, computation_windage_details = calc.calculate_windage_growth_rate(history["operating_cash_flow"])
    
    latest_net_income = history["net_income"][-1]["value"] if history["net_income"] else 0
    latest_da = history["da"][-1]["value"] if history["da"] else 0
    latest_capex = history["capex"][-1]["value"] if history["capex"] else 0
    latest_fcf = history["operating_cash_flow"][-1]["value"] - abs(latest_capex) if history["operating_cash_flow"] else 0

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
        max_pe_5yr = metrics.get("metric", {}).get("peExclExtraTTM", 15.0)
        
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

    owner_earnings, cap_rate, cap_rationale = calc.calculate_10_cap(latest_net_income, latest_da, latest_capex, market_cap)
    payback_years, projected_fcf, payback_rationale = calc.calculate_payback_time(latest_fcf, windage_gr, market_cap)
    mos_price, mos_details = calc.calculate_margin_of_safety(latest_eps, windage_gr, windage_pe)

    # 4. Prompt AI
    ai_analysis = ai.analyze_qualitative(profile.get("name", ticker), profile, metrics)

    # Generate timestamp in PST
    pst_tz = pytz.timezone('US/Pacific')
    fetched_at = datetime.now(pytz.utc).astimezone(pst_tz)
    timestamp_pst = fetched_at.strftime("%-d %b %I:%M%p").lower()

    # 5. Build Final JSON Schema
    report_data = {
        "ticker": ticker,
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
                "revenue_history": history["revenue"],
                "net_income_history": history["net_income"],
                "book_value_history": history["book_value"],
                "operating_cash_flow_history": history["operating_cash_flow"],
                "eps_history": history["eps"],
                "roe_history": roe_history,
                "roic_history": roic_history,
                "total_debt": financials["latest_total_debt"],
                "cash_and_equivalents": financials["latest_cash"]
            },
            "derived_metrics": {
                "growth_rates_1_3_5_10_yr": growth_rates,
                "computation_growth_rates": "Calculated using CAGR formula (Ending Value / Beginning Value)^(1/Years) - 1.",
                "windage_growth_rate": windage_gr,
                "computation_windage": windage_rationale,
                "computation_windage_details": computation_windage_details,
                "debt_payoff_years": financials["latest_total_debt"] / latest_fcf if latest_fcf > 0 else 0,
                "computation_debt_payoff": f"Total Debt / Current Annual FCF"
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
                "computation_10_cap": cap_rationale
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

    # 6. Save to Cache
    db.save_company_data(ticker, report_data)
    if original_ticker != ticker:
        db.save_company_data(original_ticker, report_data)

    return report_data

@app.get("/api/report/{ticker}")
def get_report(ticker: str, force_fresh: bool = False):
    ticker = ticker.upper()
    original_ticker = ticker
    
    # 1. Check Cache
    if not force_fresh:
        cached_data = db.get_company_data(ticker)
        if (
            cached_data 
            and "qualitative" in cached_data 
            and "management" in cached_data["qualitative"] 
            and "roic_3_yr_avg" in cached_data["qualitative"]["management"]
            and "financials" in cached_data
            and "valuations" in cached_data["financials"]
            and "computation_pe_details" in cached_data["financials"]["valuations"]
            and "computation_windage_details" in cached_data["financials"]["valuations"]
        ):
            return cached_data

    # Generate and return
    try:
        return generate_and_cache_report(ticker, finnhub, calc, ai, db, force_fresh=force_fresh)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def local_background_ingest(batch_id: str, tickers_to_process: List[str], force_fresh: bool = False):
    """Background fallback when Pub/Sub is not available or credentials are local-only"""
    print(f"Starting local background ingestion for batch {batch_id}...")
    for ticker in tickers_to_process:
        # Check if batch still exists
        batch = db.get_batch(batch_id)
        if not batch:
            break
            
        db.update_batch_ticker_status(batch_id, ticker, "processing")
        
        try:
            # Pause to preserve rate limits (approx 2s between calls)
            time.sleep(2.0)
            
            generate_and_cache_report(ticker, finnhub, calc, ai, db, force_fresh=force_fresh)
            
            db.update_batch_ticker_status(batch_id, ticker, "completed")
            
        except Exception as e:
            print(f"Local batch processing failed for {ticker}: {e}")
            db.update_batch_ticker_status(batch_id, ticker, "failed", error=str(e))

@app.post("/api/batch")
def start_batch(payload: BatchPayload, background_tasks: BackgroundTasks):
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
        "symbols": {}
    }
    
    tickers_to_process = []
    
    # Check cache first to avoid sending messages for already valid cached stocks
    for ticker in raw_tickers:
        if not payload.force_fresh:
            cached = db.get_company_data(ticker)
            if (
                cached 
                and "qualitative" in cached 
                and "management" in cached["qualitative"] 
                and "roic_3_yr_avg" in cached["qualitative"]["management"]
                and "financials" in cached
                and "valuations" in cached["financials"]
            ):
                batch_data["symbols"][ticker] = {
                    "status": "completed",
                    "error": None,
                    "timestamp": datetime.now(pytz.utc).isoformat()
                }
                batch_data["completed_count"] += 1
                continue
                
        batch_data["symbols"][ticker] = {
            "status": "pending",
            "error": None,
            "timestamp": datetime.now(pytz.utc).isoformat()
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
    if publisher and topic_path:
        try:
            for ticker in tickers_to_process:
                msg_bytes = json.dumps({"ticker": ticker, "batch_id": batch_id, "force_fresh": payload.force_fresh}).encode("utf-8")
                publisher.publish(topic_path, msg_bytes)
                published_successfully += 1
        except Exception as e:
            print(f"Failed to publish to Pub/Sub: {e}. Falling back to background threads.")
            published_successfully = 0
            
    # Fallback to local background tasks if Pub/Sub failed or not configured
    if published_successfully == 0:
        background_tasks.add_task(local_background_ingest, batch_id, tickers_to_process, payload.force_fresh)
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
