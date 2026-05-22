import json
from google import genai

client = genai.Client(vertexai=True, project="gen-lang-client-0826635932", location="us-central1")
try:
    response = client.models.generate_content(
        model="gemini-1.5-pro",
        contents="Hello"
    )
    print("gemini-1.5-pro worked!")
except Exception as e:
    print(f"gemini-1.5-pro failed: {e}")

try:
    response = client.models.generate_content(
        model="gemini-2.5-pro",
        contents="Hello"
    )
    print("gemini-2.5-pro worked!")
except Exception as e:
    pass

