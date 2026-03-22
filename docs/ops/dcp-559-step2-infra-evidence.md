# DCP-559 — Launch Gate Step 2 Infra Evidence Bundle

Owner lane: ML Infrastructure Engineer + Claude-Cowork (board operator evidence capture)

Purpose: replace cancelled `DCP-84` reference in `DCP-308` Step 2 with an active evidence lane that can be closed with verifiable artifacts.

## Scope

Step 2 is complete only when all three evidence groups below are attached to Paperclip:

1. VPS runtime env var proof (from live PM2 process)
2. DNS proof for `api.dcp.sa` A record -> `76.13.179.86`
3. HTTPS/certbot proof for `https://api.dcp.sa`

## Evidence Group A — VPS Runtime Env Vars

Run on VPS host:

```bash
cd /root/dc1-platform/backend
pm2 env dc1-provider-onboarding | egrep 'DC1_ADMIN_TOKEN|DC1_HMAC_SECRET|BACKEND_URL|FRONTEND_URL|MOYASAR_SECRET_KEY'
```

Acceptance:
- Output is non-empty for each required variable.
- No placeholder/default values.
- Redact secrets in screenshots/log snippets before posting.

## Evidence Group B — DNS

Run from VPS and one external host:

```bash
getent hosts api.dcp.sa
dig +short api.dcp.sa A
```

Acceptance:
- `api.dcp.sa` resolves to `76.13.179.86`.
- Same result from both vantage points.

## Evidence Group C — HTTPS / Certbot

Run on VPS:

```bash
sudo certbot certificates
curl -sS -D - https://api.dcp.sa/health -o /tmp/api-health-body.txt
echo | openssl s_client -servername api.dcp.sa -connect api.dcp.sa:443 2>/tmp/api_ssl_err.txt | openssl x509 -noout -subject -issuer -dates
```

Acceptance:
- `curl` returns successful TLS handshake and HTTP response from `api.dcp.sa`.
- Certificate validity dates are present and not expired.
- Certbot output shows managed certificate for `api.dcp.sa`.

## Fresh Probe Snapshot (from this heartbeat)

Timestamp (UTC): `2026-03-22 19:17:14 UTC`

Command:

```bash
getent hosts api.dcp.sa
```

Result:

```text
76.13.179.86    api.dcp.sa
```

Command:

```bash
curl -sS -D - https://api.dcp.sa/health -o /tmp/api_dcp_sa_health_body.txt
```

Result:

```text
curl: (7) Failed to connect to api.dcp.sa port 443 after 10 ms: Could not connect to server
```

Command:

```bash
echo | openssl s_client -servername api.dcp.sa -connect api.dcp.sa:443
```

Result:

```text
BIO_connect:Connection refused
connect:errno=111
```

Interpretation:
- DNS A record is already resolving to target IP.
- HTTPS endpoint is not reachable yet from this probe, so Step 2 cannot be marked complete until certbot/TLS service path is live and evidence is attached.

## Paperclip Attachment Checklist (DCP-559)

- [ ] PM2 env proof attached (redacted)
- [ ] DNS proof attached from VPS + external vantage
- [ ] Certbot + TLS proof attached
- [ ] DCP-308 Step 2 checklist text updated to point at DCP-559 evidence lane
