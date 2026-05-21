import base64
import json
import asyncio
from datetime import datetime
import pytz
from fastapi import FastAPI, Request, Response, status
from aiolimiter import AsyncLimiter
from tenacity import retry, wait_exponential_jitter, stop_after_attempt

from app.services.finnhub_client import FinnhubClient
from app.services.calculator import FinancialCalculator
from app.services.ai_service import AIService
from app.services.db_service import DBService
from app.main import settings, generate_and_cache_report

app = FastAPI(title="Finbuddy Stock Ingestion Worker")

# Initialize Services
finnhub = FinnhubClient(api_key=settings.FINNHUB_API_KEY)
calc = FinancialCalculator()
ai = AIService(project_id=settings.GCP_PROJECT_ID)
db = DBService(project_id=settings.GCP_PROJECT_ID)

# Thread-safe rate limiter: 20 tokens per 60 seconds (margin of safety under Finnhub's 30/min limit)
limiter = AsyncLimiter(max_rate=20, time_period=60)

@retry(
    wait=wait_exponential_jitter(initial=5, max=60, exp_base=2),
    stop=stop_after_attempt(5),
    reraise=True
)
def process_ticker_with_retry(ticker: str, force_fresh: bool):
    print(f"[Worker] Running ingestion for {ticker} (force_fresh={force_fresh})...")
    return generate_and_cache_report(ticker, finnhub, calc, ai, db, force_fresh=force_fresh)

@app.post("/process_and_store_ticker_data")
async def process_message(request: Request):
    try:
        envelope = await request.json()
    except Exception as e:
        print(f"[Worker] Failed to parse request JSON: {e}")
        return Response(content="Bad Request: Invalid JSON", status_code=status.HTTP_400_BAD_REQUEST)
        
    if not envelope:
        return Response(content="Bad Request: Empty envelope", status_code=status.HTTP_400_BAD_REQUEST)
        
    pubsub_message = envelope.get("message")
    if not pubsub_message or "data" not in pubsub_message:
        # Acknowledge to prevent Pub/Sub from infinite retries of bad payloads
        return Response(content="Acknowledge empty message", status_code=status.HTTP_200_OK)
        
    try:
        data_str = base64.b64decode(pubsub_message["data"]).decode("utf-8")
        payload = json.loads(data_str)
        ticker = payload.get("ticker", "").upper().strip()
        batch_id = payload.get("batch_id", "")
        force_fresh = payload.get("force_fresh", False)
    except Exception as e:
        print(f"[Worker] Failed to decode Pub/Sub base64: {e}")
        return Response(content="Acknowledge invalid base64 message", status_code=status.HTTP_200_OK)
        
    if not ticker or not batch_id:
        return Response(content="Acknowledge message with missing fields", status_code=status.HTTP_200_OK)
        
    print(f"[Worker] Received task for {ticker} (Batch: {batch_id})")
    
    # 1. Check if already completed (idempotency) and update status to processing
    batch = db.get_batch(batch_id)
    if batch:
        current_status = batch["symbols"].get(ticker, {}).get("status", "pending")
        if current_status == "completed":
            print(f"[Worker] Ticker {ticker} is already completed for batch {batch_id}. Skipping.")
            return Response(content="Acknowledge (already completed)", status_code=status.HTTP_200_OK)
            
        batch["symbols"][ticker]["status"] = "processing"
        batch["status"] = "processing"
        db.save_batch(batch_id, batch)
        
    # 2. Process with rate limiting & tenacity retries
    try:
        async with limiter:
            # Execute report generation in secondary threadpool to avoid blocking event loop
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, process_ticker_with_retry, ticker, force_fresh)
            
        # 3. Success: Update batch completed counts
        batch = db.get_batch(batch_id)
        if batch:
            batch["symbols"][ticker]["status"] = "completed"
            batch["symbols"][ticker]["timestamp"] = datetime.now(pytz.utc).isoformat()
            batch["completed_count"] += 1
            if batch["completed_count"] + batch["failed_count"] == batch["total_symbols"]:
                batch["status"] = "completed"
            db.save_batch(batch_id, batch)
        print(f"[Worker] Successfully processed {ticker}")
            
    except Exception as e:
        print(f"[Worker] Failed to process {ticker} after retries: {e}")
        # 4. Failure: Mark ticker status as failed and log error
        batch = db.get_batch(batch_id)
        if batch:
            batch["symbols"][ticker]["status"] = "failed"
            batch["symbols"][ticker]["error"] = str(e)
            batch["symbols"][ticker]["timestamp"] = datetime.now(pytz.utc).isoformat()
            batch["failed_count"] += 1
            if batch["completed_count"] + batch["failed_count"] == batch["total_symbols"]:
                batch["status"] = "completed"
            db.save_batch(batch_id, batch)
            
    return Response(content="Acknowledge", status_code=status.HTTP_200_OK)
