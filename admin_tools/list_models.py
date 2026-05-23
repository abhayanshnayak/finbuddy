import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../backend/.env'))

import vertexai
from vertexai.generative_models import GenerativeModel
vertexai.init(project=os.environ.get('GCP_PROJECT_ID'), location="us-west1")
for model_name in ["gemini-1.5-pro-002", "gemini-1.5-flash-002"]:
    try:
        model = GenerativeModel(model_name)
        model.generate_content("hello")
        print(f"SUCCESS: {model_name}")
    except Exception as e:
        print(f"FAILED: {model_name} - {e}")
