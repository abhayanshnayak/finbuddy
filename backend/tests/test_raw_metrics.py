import urllib.request
import json

url = "https://finnhub.io/api/v1/stock/metric?symbol=AAPL&metric=all&token=d6ch2qhr01qsiik27i80d6ch2qhr01qsiik27i8g"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    res = response.read()
    data = json.loads(res)
    print("series keys:", data.get("series", {}).keys())
    print("series.annual keys:", data.get("series", {}).get("annual", {}).keys())
    print("roe:", data.get("series", {}).get("annual", {}).get("roe")[:3] if data.get("series", {}).get("annual", {}).get("roe") else None)
    print("roic:", data.get("series", {}).get("annual", {}).get("roic")[:3] if data.get("series", {}).get("annual", {}).get("roic") else None)
