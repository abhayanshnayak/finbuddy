from google import genai
try:
    client = genai.Client(vertexai=True, project='gen-lang-client-0826635932', location='us-central1')
    response = client.models.generate_content(
        model='gemini-1.5-pro',
        contents='Tell me a joke.',
    )
    print(response.text)
except Exception as e:
    print(f"FAILED: {e}")
