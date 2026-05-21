import json
from app.services.calculator import FinancialCalculator

with open('metrics.json', 'r') as f:
    metrics = json.load(f)

calc = FinancialCalculator()
series_annual = metrics.get("series", {}).get("annual", {})
roe_history = list(reversed(series_annual.get("roe", [])))
roic_history = list(reversed(series_annual.get("roic", [])))

roe_averages = calc.calculate_averages(roe_history)
roic_averages = calc.calculate_averages(roic_history)

print("ROE History:", roe_history[-3:])
print("ROE Averages:", roe_averages)
print("ROIC Averages:", roic_averages)
