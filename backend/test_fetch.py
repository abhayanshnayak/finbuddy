import urllib.request
import json

url = "https://finnhub.io/api/v1/stock/financials-reported?symbol=GOOGL&freq=annual&token=d6ch2qhr01qsiik27i80d6ch2qhr01qsiik27i8g"
req = urllib.request.Request(url)
try:
    with urllib.request.urlopen(req) as response:
        res = response.read()
        data = json.loads(res).get('data', [])
        
        if not data:
            print("No data found")
        else:
            print(f"Number of historical reports: {len(data)}")
            years = [d.get('year') for d in data]
            print(f"Years available: {years}")
            
            latest = data[0]
            report = latest.get('report', {})
            
            print("\n--- Example Concepts ---")
            for sec in ['ic', 'bs', 'cf']:
                print(f"Section {sec}:")
                for item in report.get(sec, [])[:5]:
                    print(f"  {repr(item.get('concept'))} : {item.get('value')}")
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.reason)
    print(e.read())
