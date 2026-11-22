import json
import os
from typing import List, Optional, Tuple

from google import genai
from google.genai import types

from .prompts import QUALITATIVE_ANALYSIS_PROMPT, GROWTH_COMPANY_PROMPT
from app.core.config import settings


class AnalystService:
    # (model_name, thinking_level) chains ordered primary -> fallbacks
    QUALITATIVE_MODELS: List[Tuple[str, str]] = [
        ("gemini-4-hydrogen", "high"),
        ("gemini-3.8-flash", "medium"),
        ("gemini-3.5-flash-lite", "medium"),
    ]
    GROWTH_MODELS: List[Tuple[str, str]] = [
        ("gemini-3.5-flash-lite", "medium"),
        ("gemini-3.8-flash", "medium"),
        ("gemini-4-hydrogen", "high"),
    ]

    def __init__(self, project_id: str = None, location: str = "us-central1"):
        self.project_id = project_id
        self.location = location
        try:
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

    def _build_generation_config(self, thinking_level: Optional[str] = None) -> types.GenerateContentConfig:
        """Build GenerateContentConfig with JSON response MIME type and thinking level."""
        config_kwargs = {"response_mime_type": "application/json"}

        if thinking_level:
            thinking_fields = getattr(types.ThinkingConfig, "model_fields", {})
            if "thinking_level" in thinking_fields:
                config_kwargs["thinking_config"] = types.ThinkingConfig(
                    thinking_level=thinking_level
                )
            else:
                # google-genai<=1.47.0 (Python 3.9) predates the thinking_level SDK field;
                # pass generationConfig.thinkingConfig.thinkingLevel via extra_body.
                config_kwargs["http_options"] = types.HttpOptions(
                    extra_body={
                        "generationConfig": {
                            "thinkingConfig": {"thinkingLevel": thinking_level}
                        }
                    }
                )

        return types.GenerateContentConfig(**config_kwargs)

    def _generate_with_retry(
        self,
        prompt: str,
        models_to_try: Optional[List[Tuple[str, str]]] = None,
    ) -> dict:
        """Helper to try generating content with multiple models and parsing JSON."""
        model_chain = models_to_try or self.QUALITATIVE_MODELS

        last_error = None
        for model_name, thinking_level in model_chain:
            try:
                config = self._build_generation_config(thinking_level=thinking_level)
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=config,
                )
                text = response.text.strip()
                if text.startswith("```json"):
                    text = text[7:]
                elif text.startswith("```"):
                    text = text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                return json.loads(text.strip())
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

        return self._generate_with_retry(prompt, models_to_try=self.QUALITATIVE_MODELS)

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

        return self._generate_with_retry(prompt, models_to_try=self.GROWTH_MODELS)
