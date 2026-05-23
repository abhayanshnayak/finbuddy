import google.auth
import google.auth.transport.requests
import requests
import json

def create_firestore_db():
    try:
        credentials, project = google.auth.default(
            scopes=['https://www.googleapis.com/auth/cloud-platform']
        )
        print(f"Using project: {project}")
        
        # Refresh credential token
        request = google.auth.transport.requests.Request()
        credentials.refresh(request)
        
        # Endpoint to create default database
        # Base URL: POST https://firestore.googleapis.com/v1/projects/{project_id}/databases?databaseId=(default)
        url = f"https://firestore.googleapis.com/v1/projects/{project}/databases?databaseId=(default)"
        
        headers = {
            "Authorization": f"Bearer {credentials.token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "locationId": "us-central1",
            "type": "FIRESTORE_NATIVE"
        }
        
        print(f"Sending POST request to create Firestore Native database in location us-central1...")
        response = requests.post(url, headers=headers, json=payload)
        
        print(f"Status Code: {response.status_code}")
        try:
            res_json = response.json()
            print(json.dumps(res_json, indent=2))
        except Exception:
            print(response.text)
            
    except Exception as e:
        print(f"Error creating Firestore database: {e}")

if __name__ == "__main__":
    create_firestore_db()
