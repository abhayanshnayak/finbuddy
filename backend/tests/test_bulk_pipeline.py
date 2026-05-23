import requests
import time
import sys

def test_bulk_pipeline():
    api_base = "http://localhost:8000"
    
    # 1. Prepare batch payload with mixed valid and invalid tickers
    # 'GOOGL' and 'MSFT' should succeed (or use cached ones).
    # 'INVALIDTICKER123' will fail.
    payload = {
        "tickers": ["MSFT", "GOOGL", "INVALIDTICKER123"]
    }
    
    print("--- [Step 1] Submitting bulk ingestion batch ---")
    print(f"Payload: {payload}")
    try:
        response = requests.post(f"{api_base}/api/batch", json=payload)
        if response.status_code != 200:
            print(f"Failed to submit batch: {response.status_code} - {response.text}")
            sys.exit(1)
        
        batch_info = response.json()
        batch_id = batch_info["batch_id"]
        print(f"Batch successfully created! Batch ID: {batch_id}")
        print(f"Initial API response: {batch_info}")
    except Exception as e:
        print(f"Error during batch creation: {e}")
        sys.exit(1)
        
    print("\n--- [Step 2] Polling batch status from Firestore (via backend API) ---")
    start_time = time.time()
    completed = False
    
    # Poll every 2 seconds for a maximum of 30 seconds
    for attempt in range(15):
        time.sleep(2)
        try:
            status_res = requests.get(f"{api_base}/api/batch/{batch_id}")
            if status_res.status_code != 200:
                print(f"Failed to get batch status: {status_res.status_code} - {status_res.text}")
                continue
                
            batch_status = status_res.json()
            status = batch_status.get("status", "unknown")
            completed_count = batch_status.get("completed_count", 0)
            failed_count = batch_status.get("failed_count", 0)
            total = batch_status.get("total_symbols", 0)
            
            print(f"Attempt {attempt + 1}: Status = {status} | Completed = {completed_count}/{total} | Failed = {failed_count}/{total}")
            
            # Print status of individual symbols
            symbols = batch_status.get("symbols", {})
            for sym, details in symbols.items():
                print(f"  - {sym}: status = {details.get('status')}, error = {details.get('error')}")
                
            if status == "completed" or (completed_count + failed_count == total):
                print(f"Batch processing finalized in {time.time() - start_time:.2f} seconds.")
                completed = True
                break
        except Exception as e:
            print(f"Error during polling: {e}")
            
    if not completed:
        print("Batch processing timed out or did not complete.")
        sys.exit(1)
        
    print("\n--- [Step 3] Verifying sub-second Firestore cache retrieval ---")
    # For a successfully cached stock (e.g. MSFT or GOOGL), querying `/api/report/{ticker}` should be sub-second
    for ticker in ["MSFT", "GOOGL"]:
        t0 = time.time()
        try:
            report_res = requests.get(f"{api_base}/api/report/{ticker}")
            duration = time.time() - t0
            if report_res.status_code == 200:
                print(f"Cache retrieval for {ticker}: SUCCESS! Duration = {duration:.4f} seconds.")
                if duration < 1.0:
                    print("  -> PASSED: retrieval is sub-second.")
                else:
                    print("  -> WARNING: retrieval took more than 1 second.")
            else:
                print(f"Failed to retrieve report for {ticker}: {report_res.status_code}")
        except Exception as e:
            print(f"Error querying {ticker}: {e}")

if __name__ == "__main__":
    test_bulk_pipeline()
