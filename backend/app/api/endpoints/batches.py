from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List
import uuid
import json
import os
from datetime import datetime
import pytz

from app.dependencies import db_service as db, publisher, topic_path
from app.services.report_service import local_background_ingest

router = APIRouter()

class BatchPayload(BaseModel):
    tickers: List[str] = Field(..., max_items=500)
    force_fresh: bool = False
    tags: List[str] = []

@router.post("/batch")
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


@router.get("/batch/{batch_id}")
def get_batch_status(batch_id: str):
    batch = db.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch

