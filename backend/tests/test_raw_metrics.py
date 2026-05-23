import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../.env'))

import urllib.request
import json

url = f"https://finnhub.io/api/v1/stock/metric?symbol=AAPL&metric=all&token={os.environ.get("FINNHUB_API_KEY")}"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    res = response.read()
    data = json.loads(res)
    print("series keys:", data.get("series", {}).keys())
    print("series.annual keys:", data.get("series", {}).get("annual", {}).keys())
    print("roe:", data.get("series", {}).get("annual", {}).get("roe")[:3] if data.get("series", {}).get("annual", {}).get("roe") else None)
    print("roic:", data.get("series", {}).get("annual", {}).get("roic")[:3] if data.get("series", {}).get("annual", {}).get("roic") else None)
