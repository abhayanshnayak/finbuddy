import vertexai
from vertexai.generative_models import GenerativeModel
try:
    vertexai.init(project="gen-lang-client-0826635932", location="us-central1")
    model = GenerativeModel("gemini-1.5-flash")
    resp = model.generate_content("hello")
    print("SUCCESS:", resp.text)
except Exception as e:
    print("ERROR:", e)
