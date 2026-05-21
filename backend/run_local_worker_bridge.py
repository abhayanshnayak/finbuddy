import time
import base64
import requests
from google.cloud import pubsub_v1

def run_bridge():
    project_id = "gen-lang-client-0826635932"
    subscription_id = "stock-ingestion-test-sub"
    worker_url = "http://localhost:8080/process_and_store_ticker_data"
    
    subscriber = pubsub_v1.SubscriberClient()
    subscription_path = subscriber.subscription_path(project_id, subscription_id)
    
    print(f"Starting Pub/Sub to Local Worker Bridge...")
    print(f"Listening on GCP Subscription: {subscription_path}")
    print(f"Forwarding to local worker: {worker_url}")
    
    while True:
        try:
            # Pull messages from the subscription
            response = subscriber.pull(
                request={
                    "subscription": subscription_path,
                    "max_messages": 5,
                    "return_immediately": False
                },
                timeout=10.0
            )
            
            ack_ids = []
            for received_message in response.received_messages:
                msg = received_message.message
                data_bytes = msg.data
                data_str = data_bytes.decode("utf-8")
                print(f"\n[Bridge] Pulled message: {data_str}")
                
                # Format into Pub/Sub push envelope
                envelope = {
                    "message": {
                        "data": base64.b64encode(data_bytes).decode("utf-8"),
                        "message_id": msg.message_id
                    }
                }
                
                # Forward to local worker
                try:
                    res = requests.post(worker_url, json=envelope, timeout=120.0)
                    print(f"[Bridge] Worker response: {res.status_code} - {res.text}")
                    if res.status_code == 200:
                        ack_ids.append(received_message.ack_id)
                    else:
                        print(f"[Bridge] Worker failed. Message not acknowledged.")
                except Exception as ex:
                    print(f"[Bridge] HTTP request to worker failed: {ex}")
            
            # Acknowledge successfully processed messages
            if ack_ids:
                subscriber.acknowledge(
                    request={
                        "subscription": subscription_path,
                        "ack_ids": ack_ids
                    }
                )
                print(f"[Bridge] Acknowledged {len(ack_ids)} messages.")
                
        except Exception as e:
            # Handle empty pull timeout
            if "DeadlineExceeded" in str(e) or "timeout" in str(e).lower():
                continue
            print(f"[Bridge] Error polling Pub/Sub: {e}")
            time.sleep(2)

if __name__ == "__main__":
    run_bridge()
