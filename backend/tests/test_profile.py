import urllib.request
import json

url = "https://finnhub.io/api/v1/stock/profile2?symbol=GOOG&token=d6ch2qhr01qsiik27i80d6ch2qhr01qsiik27i8g"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    res = response.read()
    data = json.loads(res)
    print(json.dumps(data, indent=2))
