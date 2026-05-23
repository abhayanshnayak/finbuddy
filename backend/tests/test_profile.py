import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../.env'))

import urllib.request
import json

url = f"https://finnhub.io/api/v1/stock/profile2?symbol=GOOG&token={os.environ.get("FINNHUB_API_KEY")}"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    res = response.read()
    data = json.loads(res)
    print(json.dumps(data, indent=2))
