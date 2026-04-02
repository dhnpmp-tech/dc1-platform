# OpenRouter 60-Second First Request (EN)

Get from signup to your first `POST /v1/chat/completions` call in about 60 seconds.

## 1) Create a renter key (signup)

```bash
curl -sS -X POST https://dcp.sa/api/dc1/renters/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DX Quickstart",
    "email": "dx-quickstart@example.com"
  }'
```

Save `api_key` from the response.

## 2) Set API base and key

```bash
export DCP_API_V1="https://api.dcp.sa/v1"
export DCP_RENTER_KEY="dc1-renter-your-key"
```

## 3) Confirm model catalog

```bash
curl -sS "$DCP_API_V1/models"
```

## 4) Send first chat completion (cURL)

```bash
curl -sS "$DCP_API_V1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "x-renter-key: $DCP_RENTER_KEY" \
  -d '{
    "model": "ALLaM-AI/ALLaM-7B-Instruct-preview",
    "messages": [
      { "role": "user", "content": "Reply with exactly: quickstart-ok" }
    ],
    "max_tokens": 12
  }'
```

## 5) Node.js path (copy-paste)

```js
import https from "https";

const payload = JSON.stringify({
  model: "ALLaM-AI/ALLaM-7B-Instruct-preview",
  messages: [{ role: "user", content: "Reply with exactly: quickstart-ok" }],
  max_tokens: 12,
});

const req = https.request("https://api.dcp.sa/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "x-renter-key": process.env.DCP_RENTER_KEY,
  },
}, (res) => {
  let body = "";
  res.on("data", (chunk) => (body += chunk));
  res.on("end", () => console.log(body));
});

req.write(payload);
req.end();
```

## 6) Python path (copy-paste)

```python
import json
import os
import urllib.request

payload = {
    "model": "ALLaM-AI/ALLaM-7B-Instruct-preview",
    "messages": [{"role": "user", "content": "Reply with exactly: quickstart-ok"}],
    "max_tokens": 12,
}

req = urllib.request.Request(
    "https://api.dcp.sa/v1/chat/completions",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "x-renter-key": os.environ["DCP_RENTER_KEY"],
    },
    method="POST",
)

with urllib.request.urlopen(req, timeout=40) as resp:
    print(resp.read().decode("utf-8"))
```

## Notes

- Auth for this surface uses renter keys (`x-renter-key`).
- If you see `{"error":"no_capacity"}`, your request path is valid and auth is accepted; retry when provider capacity is online.
