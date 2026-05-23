import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../.env'))

import vertexai
from vertexai.generative_models import GenerativeModel
try:
    vertexai.init(project=os.environ.get('GCP_PROJECT_ID'), location="us-central1")
    model = GenerativeModel("gemini-1.5-flash")
    resp = model.generate_content("hello")
    print("SUCCESS:", resp.text)
except Exception as e:
    print("ERROR:", e)
