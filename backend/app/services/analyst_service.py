import json
import os
from typing import List, Optional, Tuple

from google import genai
from google.genai import types

from .prompts import (
    QUALITATIVE_ANALYSIS_PROMPT,
    GROWTH_COMPANY_PROMPT,
    BUSINESS_MODEL_PROMPT,
    EMPLOYEE_SENTIMENT_PROMPT,
)
from app.core.config import settings


class AnalystService:
    # (model_name, thinking_level) chains ordered primary -> fallbacks
    QUALITATIVE_MODELS: List[Tuple[str, str]] = [
        ("gemini-4-hydrogen", "high"),
        ("gemini-3.8-flash", "medium"),
        ("gemini-3.5-flash-lite", "medium"),
    ]
    BUSINESS_MODEL_MODELS: List[Tuple[str, str]] = [
        ("gemini-4-hydrogen", "high"),
        ("gemini-3.8-flash", "medium"),
        ("gemini-3.5-flash-lite", "medium"),
    ]
    GROWTH_MODELS: List[Tuple[str, str]] = [
        ("gemini-3.5-flash-lite", "medium"),
        ("gemini-3.8-flash", "medium"),
        ("gemini-4-hydrogen", "high"),
    ]
    SENTIMENT_MODELS: List[Tuple[str, str]] = [
        ("gemini-3.8-flash", "medium"),
        ("gemini-3.5-flash-lite", "medium"),
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
                self.client = genai.Client(
                    api_key=api_key,
                    http_options=types.HttpOptions(timeout=45_000),
                )
        except Exception as e:
            print(f"Warning: Failed to initialize AI Studio: {e}")
            self.client = None

    def _build_generation_config(
        self,
        thinking_level: Optional[str] = None,
        use_google_search: bool = False,
    ) -> types.GenerateContentConfig:
        """Build GenerateContentConfig with optional Google Search grounding and thinking level."""
        if use_google_search:
            # Omit response_mime_type="application/json" when tools are attached;
            # Gemini API rejects combining Google Search tool use with JSON MIME enforcement.
            config_kwargs = {
                "tools": [types.Tool(google_search=types.GoogleSearch())],
            }
        else:
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
                    timeout=45_000,
                    extra_body={
                        "generationConfig": {
                            "thinkingConfig": {"thinkingLevel": thinking_level}
                        }
                    },
                )

        return types.GenerateContentConfig(**config_kwargs)

    @staticmethod
    def _parse_json_text(raw_text: Optional[str]) -> dict:
        """Parse a JSON object from model output, tolerating markdown fences or surrounding prose."""
        text = (raw_text or "").strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end == -1 or end <= start:
                raise
            parsed = json.loads(text[start : end + 1])

        if not isinstance(parsed, dict):
            raise ValueError("Expected JSON object from Gemini response.")
        return parsed

    @staticmethod
    def _extract_grounding_metadata(response) -> Tuple[List[dict], List[str]]:
        """Extract deduplicated web source citations and search queries from a grounded response."""
        sources: List[dict] = []
        queries: List[str] = []

        candidates = getattr(response, "candidates", None)
        if not isinstance(candidates, (list, tuple)) or not candidates:
            return sources, queries

        gm = getattr(candidates[0], "grounding_metadata", None)
        if gm is None:
            return sources, queries

        raw_chunks = getattr(gm, "grounding_chunks", None)
        seen_urls = set()
        if isinstance(raw_chunks, (list, tuple)):
            for chunk in raw_chunks:
                web = getattr(chunk, "web", None)
                if web is None:
                    continue
                uri = getattr(web, "uri", None)
                title = getattr(web, "title", None)
                if not isinstance(uri, str) or not uri.strip():
                    continue
                uri = uri.strip()
                if uri in seen_urls:
                    continue
                seen_urls.add(uri)
                clean_title = title.strip() if isinstance(title, str) and title.strip() else uri
                sources.append({"title": clean_title, "url": uri})
                if len(sources) >= 5:
                    break

        raw_queries = getattr(gm, "web_search_queries", None)
        if isinstance(raw_queries, (list, tuple)):
            for q in raw_queries:
                if isinstance(q, str) and q.strip() and q.strip() not in queries:
                    queries.append(q.strip())

        return sources, queries

    def _generate_with_retry(
        self,
        prompt: str,
        models_to_try: Optional[List[Tuple[str, str]]] = None,
        use_google_search: bool = False,
    ) -> dict:
        """Helper to try generating content with multiple models and parsing JSON."""
        model_chain = models_to_try or self.QUALITATIVE_MODELS

        last_error = None
        for model_name, thinking_level in model_chain:
            try:
                config = self._build_generation_config(
                    thinking_level=thinking_level,
                    use_google_search=use_google_search,
                )
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=config,
                )
                parsed = self._parse_json_text(response.text)
                if use_google_search:
                    sources, queries = self._extract_grounding_metadata(response)
                    parsed["grounding_sources"] = sources
                    parsed["search_queries"] = queries
                    parsed["grounded"] = bool(sources or queries)
                return parsed
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

    def analyze_business_model(self, company_name: str, context_data: dict) -> dict:
        """
        Prompts Gemini to generate a deep-dive business model, unit economics, and earnings division breakdown.
        """
        if not self.client:
            return {"error": "AI Studio not initialized."}

        prompt = BUSINESS_MODEL_PROMPT.format(
            company_name=company_name,
            context_data=json.dumps(context_data)
        )

        return self._generate_with_retry(prompt, models_to_try=self.BUSINESS_MODEL_MODELS)

    def fetch_employee_sentiment(self, company_name: str, ticker: str = "") -> dict:
        """
        Uses Gemini with Google Search grounding to retrieve public Glassdoor/Comparably/Indeed
        employee sentiment and CEO approval ratings normalized to a 0.0-5.0 scale.
        """
        if not self.client:
            return {"error": "AI Studio not initialized."}

        prompt = EMPLOYEE_SENTIMENT_PROMPT.format(
            company_name=company_name,
            ticker=ticker or "N/A",
        )

        return self._generate_with_retry(
            prompt,
            models_to_try=self.SENTIMENT_MODELS,
            use_google_search=True,
        )
