import json
from google import genai
from .prompts import QUALITATIVE_ANALYSIS_PROMPT, GROWTH_COMPANY_PROMPT

from app.core.config import settings

class AnalystService:
    def __init__(self, project_id: str = None, location: str = "us-central1"):
        self.project_id = project_id
        self.location = location
        try:
            import os
            # Read from settings (Pydantic automatically loads from backend/.env) or fallback to os.environ
            api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
            if not api_key:
                print("Error: GEMINI_API_KEY is missing! Please configure it in backend/.env")
                self.client = None
            else:
                self.client = genai.Client(api_key=api_key)
        except Exception as e:
            print(f"Warning: Failed to initialize AI Studio: {e}")
            self.client = None

    def _generate_with_retry(self, prompt: str) -> dict:
        """Helper to try generating content with multiple models and parsing JSON."""
        models_to_try = [
            "gemini-3.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-2.5-flash"
        ]
        
        last_error = None
        for model_name in models_to_try:
            try:
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                text = response.text.strip()
                if text.startswith("```json"):
                    text = text[7:]
                if text.endswith("```"):
                    text = text[:-3]
                return json.loads(text)
            except Exception as e:
                print(f"AI Studio Generation Failed with {model_name}: {e}")
                last_error = e
                continue
                
        return {"error": f"AI Studio Generation Failed across all models. Last error: {last_error}"}

    def analyze_qualitative(self, company_name: str, profile: dict, metrics: dict) -> dict:
        """
        Prompts Gemini to generate the qualitative JSON structures defined in the technical design.
        """
        if not self.client:
            return {"error": "AI Studio not initialized."}

        prompt = QUALITATIVE_ANALYSIS_PROMPT.format(
            company_name=company_name,
            profile=json.dumps(profile),
            metrics=json.dumps(metrics)
        )
        
        return self._generate_with_retry(prompt)

    def analyze_growth_company(self, company_name: str, context_data: dict) -> dict:
        """
        Prompts Gemini to analyze a growth company based on specific questions regarding cash burn, margins, and path to profitability.
        """
        if not self.client:
            return {"error": "AI Studio not initialized."}

        prompt = GROWTH_COMPANY_PROMPT.format(
            company_name=company_name,
            context_data=json.dumps(context_data)
        )
        
        return self._generate_with_retry(prompt)
