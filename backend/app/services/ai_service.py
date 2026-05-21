import json
from google import genai

class AIService:
    def __init__(self, project_id: str = None, location: str = "us-central1"):
        self.project_id = project_id
        self.location = location
        try:
            self.client = genai.Client(api_key="AIzaSyB43_2R4-9Ros7VI9zbvVngXMgP75zP4UY")
        except Exception as e:
            print(f"Warning: Failed to initialize AI Studio: {e}")
            self.client = None

    def analyze_qualitative(self, company_name: str, profile: dict, metrics: dict) -> dict:
        """
        Prompts Gemini to generate the qualitative JSON structures defined in the technical design.
        """
        if not self.client:
            return {"error": "AI Studio not initialized."}

        prompt = f"""
        You are an expert financial analyst and professional value investor.
        Analyze the company: {company_name}.
        Profile Data: {json.dumps(profile)}
        Metrics Data: {json.dumps(metrics)}

        Please conduct an exceptionally thorough, deep-dive qualitative analysis of the company, focusing specifically on their growth strategy, competitive moats, and operational/strategic challenges, integrating highly specific insights from their recent 10-K filings. Avoid generic high-level summaries; provide rich, professional-grade equity research paragraphs.
        
        Using your internal knowledge of the NAICS (North American Industry Classification System) taxonomy, classify the company into its most accurate Sector (2-digit level), Subsector (3-digit level), and Industry Group (4-digit level).

        Please provide a detailed qualitative analysis in JSON format exactly matching this structure:
        {{
            "overview": "A comprehensive, multi-paragraph overview of the company's business model, operations, and general context.",
            "sector": "Exact Title of the NAICS Sector",
            "subsector": "Exact Title of the NAICS Subsector",
            "industry_group": "Exact Title of the NAICS Industry Group",
            "sources": {{ "source_links": ["list of 2-3 relevant 10-K or news links"] }},
            "growth_plans": {{ 
                "strategy_summary": "An exceptionally thorough, multi-paragraph value-investing analysis of the company's long-term organic and inorganic growth vectors. Integrate highly specific details from the company's recent 10-K, including target markets, technology platforms, Capex priorities, and strategic product lines (e.g. AI chips, cloud services, subscription ecosystems, hardware iterations).", 
                "key_initiatives": [
                    "A highly specific key initiative from the 10-K detailing R&D directions, production capacity expansion, infrastructure upgrades, or new market/geographic entries.",
                    "Another highly detailed key initiative from the 10-K showing exactly how capital is allocated for future growth."
                ] 
            }},
            "competitors": {{ "competitor_list": [ {{"name": "...", "competition_scope": "..."}} ] }},
            "risks": {{ 
                "key_risks": [ 
                    {{"risk": "Highly specific operational/regulatory risk", "explanation": "A thorough, detailed explanation of how this risk affects cash flows, margins, or terminal value based on the 10-K Item 1A Risk Factors."}},
                    {{"risk": "Competitive or macroeconomic threat", "explanation": "A thorough, detailed explanation of this challenge based on the 10-K."}}
                ] 
            }},
            "moats": {{
                "moat_types": [ 
                    {{"type": "Moat Category (e.g. Switching Costs, Network Effects, Cost Advantage, Intangible Assets)", "strength": "Wide or Narrow", "rationale": "A deep, thorough value-investor's explanation of how this moat works, its durability, how it presents itself in the company's return metrics (ROIC/ROE), and specific barriers to entry for competitors."}}
                ],
                "competitor_comparison": "An extremely detailed, comparative analysis of competitive dynamics, detailing specific unit economics, pricing power, distribution channels, and market shares relative to key competitors."
            }},
            "management": {{
                "ceo_tenure_years": 0,
                "ceo_employee_rating": 0.0,
                "employee_happiness_score": 0.0,
                "board_of_directors_summary": "A thorough description of board oversight, independence, and alignment with shareholders."
            }},
            "market_and_bias": {{
                "gurus_buying": ["..."],
                "bias_checklist": [
                    {{"question": "Are we outside the circle of competence?", "answer": false, "rationale": "..."}},
                    {{"question": "Is the industry declining?", "answer": false, "rationale": "..."}},
                    {{"question": "Are the Big 4 numbers failing to grow or slowing down?", "answer": false, "rationale": "..."}},
                    {{"question": "Is debt increasing (or > 2 years FCF)?", "answer": false, "rationale": "..."}},
                    {{"question": "Is EPS engineered by buybacks?", "answer": false, "rationale": "..."}},
                    {{"question": "Is demand for the product uncertain in 10 years?", "answer": false, "rationale": "..."}},
                    {{"question": "Was the CEO recently replaced?", "answer": false, "rationale": "..."}},
                    {{"question": "Is there an unfriendly union?", "answer": false, "rationale": "..."}},
                    {{"question": "Have the 10-K footnotes been read?", "answer": true, "rationale": "..."}},
                    {{"question": "Is there an event that may permanently damage the business?", "answer": false, "rationale": "..."}}
                ]
            }}
        }}

        Return ONLY the raw JSON object. Do not include markdown code blocks.
        """
        
        try:
            response = self.client.models.generate_content(
                model="gemini-3.1-pro-preview",
                contents=prompt
            )
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            return json.loads(text)
        except Exception as e:
            print(f"AI Studio Generation Failed: {e}.")
            return {"error": f"AI Studio Generation Failed: {e}"}
