import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../.env'))

from google import genai
try:
    client = genai.Client(vertexai=True, project=os.environ.get('GCP_PROJECT_ID'), location='us-central1')
    response = client.models.generate_content(
        model='gemini-1.5-pro',
        contents='Tell me a joke.',
    )
    print(response.text)
except Exception as e:
    print(f"FAILED: {e}")
