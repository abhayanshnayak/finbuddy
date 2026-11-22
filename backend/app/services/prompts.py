QUALITATIVE_ANALYSIS_PROMPT = """
        You are an expert financial analyst and professional value investor.
        Analyze the company: {company_name}.
        Profile Data: {profile}
        Metrics Data: {metrics}

        Please conduct an exceptionally thorough, deep-dive qualitative analysis of the company, focusing specifically on their growth strategy, competitive landscape & market structure, competitive moats, and operational/strategic challenges, integrating highly specific insights from their recent Form 10-K filings (Item 1 Business & Competition, Item 1A Risk Factors, Item 7 MD&A), competitor 10-K filings, earnings call disclosures, and authoritative industry/market research sources. Avoid generic high-level summaries; provide rich, institutional-grade equity research with concrete products, segments, pricing dynamics, market share figures, and unit-economics comparisons.

        For the competitor analysis specifically:
        - Identify 4 to 6 of the most important direct and emerging competitors (including major rivals explicitly named in the company's 10-K Competition / Risk Factors sections as well as notable private, international, or Big Tech disruptors).
        - Clearly explain WHERE and HOW each competitor competes (pricing/bundling, distribution, R&D cadence, vertical integration, switching-cost attacks, scale/capex).
        - Provide a concrete head-to-head comparison of how {company_name}'s moat compares against each competitor's moat (switching costs, network effects, cost advantage, brand/IP, ecosystem lock-in, and margin/ROIC gaps).
        - Deliver an unambiguous, candid verdict on market structure: clearly establish whether {company_name} operates in a fixed-size, zero-sum market with little moat OR holds a clear, defensible moat inside a growing pie (expanding TAM).
        
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
            "competitors": {{
                "market_structure_verdict": {{
                    "quadrant": "Choose exactly one: Clear Moat in a Growing Pie | Clear Moat in a Mature/Fixed Pie | Narrow/Weak Moat in a Growing Pie | Fixed-Size Market with Little Moat",
                    "market_growth_outlook": "Choose the closest fit: Expanding Pie (Secular Growth) | Moderate / GDP-Level Growth | Mature / Fixed-Size (Zero-Sum) | Structurally Declining",
                    "moat_position": "Choose the closest fit: Wide / Dominant | Narrow / Defensible | Weak / Commoditized",
                    "industry_concentration": "Concise structural label with context (e.g., 'Oligopoly — top 3 control ~70% share', 'Duopoly', 'Fragmented', 'Winner-Take-Most')",
                    "tam_and_pie_dynamics": "Detailed, 10-K and industry-sourced analysis of total addressable market (TAM) size, estimated secular growth rate (CAGR), structural tailwinds/headwinds, and whether competitors are growing alongside an expanding pie or fighting a zero-sum price war over a fixed customer base.",
                    "verdict_rationale": "Decisive, multi-sentence investor verdict answering directly whether this is a fixed-size market with little moat or a clear moat in a growing pie — backed by concrete evidence on pricing power, gross/operating margin resilience, market share trajectory, and ROIC vs. peers."
                }},
                "competitor_list": [
                    {{
                        "name": "Competitor Name (Ticker if public, or Private)",
                        "threat_level": "High | Medium | Low",
                        "competition_scope": "Specific product lines, customer segments, geographies, and revenue streams where this competitor overlaps with {company_name}, citing 10-K Item 1 / Competition details.",
                        "how_they_compete": "Concrete competitive playbook: pricing or discounting/bundling tactics, distribution channels, R&D and product velocity, vertical integration, ecosystem leverage, or capital intensity.",
                        "estimated_market_share_and_scale": "Relative scale (revenue/user footprint), estimated market share in overlapping segments, and directional share trend (gaining, holding, or losing share) vs. {company_name}.",
                        "moat_comparison": "Head-to-head comparison of {company_name}'s economic moat versus this competitor's moat across switching costs, network effects, cost advantages, IP/brand, and margin or ROIC gap.",
                        "key_advantage_over_target": "Where this competitor is genuinely stronger or poses the most credible threat to {company_name}'s growth, pricing power, or margins.",
                        "target_advantage_over_competitor": "Where {company_name} clearly outperforms this competitor and why that advantage is durable (or at risk)."
                    }}
                ],
                "competitive_dynamics_summary": "Exhaustive multi-paragraph equity-research synthesis covering industry structure, barriers to entry, customer switching costs, threat of substitutes and new entrants (including Big Tech, AI/technological disruption, or regulatory shifts cited in 10-K Item 1A Risk Factors), supplier/buyer bargaining power, and long-term margin durability across the competitive set.",
                "sources_referenced": [
                    "Specific 10-K filing sections (e.g., '{company_name} FY2025 Form 10-K, Item 1 Competition & Item 1A Risk Factors'), competitor 10-K filings, earnings disclosures, or industry reports informing this competitive analysis."
                ]
            }},
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
                "competitor_comparison": "An extremely detailed, comparative synthesis of unit economics, pricing power, gross/operating margin structure, distribution channels, and capital efficiency relative to the peer group."
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

GROWTH_COMPANY_PROMPT = """
        You are an exceptionally strict, highly critical financial analyst and professional value investor specializing in growth companies.
        Analyze the company: {company_name}.
        Financial Context Data: {context_data}

        Please conduct an exceptionally thorough, skeptical, and quantitative qualitative analysis of the company's growth metrics, runway, and path to profitability based on the provided financial context data. Do NOT be lenient. If the numbers do not clearly support a healthy trajectory, you must fail them.
        
        CRITICAL FORMATTING RULE: When citing any financial figures (revenue, cash flow, debt, cash, etc.) in your justifications, you MUST format and round them to millions (M) or billions (B) to make them simple to read. For example, write $11.2B instead of 11200000000, and $456M instead of 456000000.
        
        Provide the analysis in JSON format exactly matching this structure, explicitly including numbers and financial rationale in every justification:
        {{
            "cash_burn": {{
                "verdict": "Pass, Warning, or Fail",
                "justification": "Is the cash burn funding structural deficits (bad) or aggressive growth/R&D (good)? Provide a highly critical, detailed justification using exact numbers from the context."
            }},
            "gross_margin": {{
                "verdict": "Pass, Warning, or Fail",
                "justification": "Are the gross margins high enough to support future profitability? Explain the margin trajectory with specific numbers."
            }},
            "profitability_path": {{
                "verdict": "Pass, Warning, or Fail",
                "justification": "Is there a clear, mathematically sound 'path to profitability' in the next 3-5 years? Analyze revenue growth vs operating expense growth using specific figures. Be highly skeptical."
            }},
            "runway": {{
                "verdict": "Pass, Warning, or Fail",
                "justification": "Do they have enough cash on the balance sheet (runway) to survive until they turn cash-flow positive without needing highly dilutive funding? Calculate estimated runway in months/years based on latest cash and FCF/burn rate."
            }}
        }}

        Return ONLY the raw JSON object. Do not include markdown code blocks.
"""
