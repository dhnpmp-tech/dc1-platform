# DCP-578 Reactivation Bundle Curl Proof (20260404T093916Z)

1. Register dormant provider

```bash
curl -sS -X POST "http://127.0.0.1:8083/api/providers/register" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dormant Proof Provider","email":"dcp578-proof-20260404T093916Z@dc1.test","gpu_model":"RTX 4090","os":"linux"}'
```

2. Issue short-lived reactivation token (provider-authenticated)

```bash
curl -sS -X POST "http://127.0.0.1:8083/api/providers/me/reactivation-token" \
  -H "x-provider-key: <api_key>" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

3. Redeem token for deterministic install bundle

```bash
curl -sS "http://127.0.0.1:8083/api/providers/reactivation/bundle?token=<reactivation_token>"
```

## Result Snapshot

- Registered provider_id: 1
- Bundle success: true
- Linux command: curl -fsSL "https://api.dcp.sa/api/providers/download/setup?key=dc1-provider-f7fffccafcae95248916ad664db2d64d&os=linux" | bash
- Mac command: curl -fsSL "https://api.dcp.sa/api/providers/download/setup?key=dc1-provider-f7fffccafcae95248916ad664db2d64d&os=mac" | bash
- Windows command: powershell -ExecutionPolicy Bypass -Command "iwr 'https://api.dcp.sa/api/providers/download/setup?key=dc1-provider-f7fffccafcae95248916ad664db2d64d&os=windows' -UseBasicParsing | iex"
