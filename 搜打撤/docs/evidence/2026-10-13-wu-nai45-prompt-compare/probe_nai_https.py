"""Credential-free POST probe; HTTP 401 means the NAI endpoint was reached."""

import urllib.error
import urllib.request
import sys

request = urllib.request.Request(
    "https://image.novelai.net/ai/generate-image",
    data=b"{}",
    headers={"Content-Type": "application/json"},
)
proxy = sys.argv[1] if len(sys.argv) > 1 else None
opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({"https": proxy} if proxy else {})
)
try:
    with opener.open(request, timeout=12) as response:
        print("http", response.status)
except urllib.error.HTTPError as error:
    print("http", error.code)
