import google.auth
import google.auth.transport.requests
import requests

def test_adc():
    try:
        credentials, project = google.auth.default(
            scopes=['https://www.googleapis.com/auth/cloud-platform']
        )
        print("ADC loaded successfully.")
        print(f"Project from credentials/environment: {project}")
        
        # Refresh the credentials to get a token
        request = google.auth.transport.requests.Request()
        credentials.refresh(request)
        print("Token refreshed successfully.")
        print(f"Token (first 10 chars): {credentials.token[:10]}...")
        
        # Test calling Resource Manager to list projects or verify credentials
        url = "https://cloudresourcemanager.googleapis.com/v1/projects"
        headers = {"Authorization": f"Bearer {credentials.token}"}
        res = requests.get(url, headers=headers)
        print(f"Resource Manager status: {res.status_code}")
        if res.status_code == 200:
            print("Successfully authenticated and listed projects!")
            projects = res.json().get('projects', [])
            for p in projects:
                print(f" - {p['projectId']}")
        else:
            print(f"Failed to list projects: {res.text}")
            
    except Exception as e:
        print(f"Error testing ADC: {e}")

if __name__ == "__main__":
    test_adc()
