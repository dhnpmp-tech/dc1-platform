# DC1 Platform — API Documentation

DC1 is Saudi Arabia's first decentralized GPU compute marketplace. This directory contains the machine-readable API spec and developer guides.

## Developer Docs

| Document | Language | Description |
|----------|----------|-------------|
| [Quickstart](./quickstart.md) | English | Submit your first GPU job in 5 minutes |
| [دليل البدء السريع](./quickstart-ar.md) | العربية | أرسل أول مهمة GPU في 5 دقائق |
| [API Reference](./api-reference.md) | English | All endpoints with request/response schemas |
| [مرجع API](./api-reference-ar.md) | العربية | جميع نقاط النهاية بالعربية |
| [Provider Guide](./provider-guide.md) | English | Earn SAR by connecting your NVIDIA GPU |
| [SDK Guides](./sdk-guides.md) | English | Python and JavaScript code examples |

## OpenAPI Spec

The full OpenAPI 3.0 spec is at [`docs/openapi.yaml`](./openapi.yaml).

**Live endpoints:**

| URL | What |
|-----|------|
| `GET /api/docs` | Raw OpenAPI 3.0 YAML (application/yaml) |
| `GET /api/docs/ui` | Swagger UI — interactive browser |

In production: `http://76.13.179.86:8083/api/docs/ui`

## Quick Start

### Provider

```bash
# 1. Register
curl -X POST http://76.13.179.86:8083/api/providers/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ahmed","email":"ahmed@example.sa","gpu_model":"RTX 3090","os":"Linux"}'

# 2. Install daemon (Linux)
curl "http://76.13.179.86:8083/api/providers/setup?key=dc1-provider-YOUR_KEY" | bash

# 3. Check dashboard
curl "http://76.13.179.86:8083/api/providers/me?key=dc1-provider-YOUR_KEY"
```

### Renter

```bash
# 1. Register
curl -X POST http://76.13.179.86:8083/api/renters/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Fatima","email":"fatima@example.sa"}'

# 2. Top up balance (sandbox — dev only)
curl -X POST http://76.13.179.86:8083/api/payments/topup-sandbox \
  -H "Content-Type: application/json" \
  -H "x-renter-key: dc1-renter-YOUR_KEY" \
  -d '{"amount_sar": 50}'

# 3. Browse available GPUs
curl http://76.13.179.86:8083/api/renters/available-providers

# 4. Submit a job
curl -X POST http://76.13.179.86:8083/api/jobs/submit \
  -H "Content-Type: application/json" \
  -H "x-renter-key: dc1-renter-YOUR_KEY" \
  -d '{
    "job_type": "image_generation",
    "duration_minutes": 5,
    "task_spec": {
      "prompt": "A futuristic skyline of Riyadh at sunset",
      "steps": 30,
      "width": 512,
      "height": 512
    }
  }'

# 5. Poll for result
curl "http://76.13.179.86:8083/api/jobs/JOB_ID/output" \
  -H "x-renter-key: dc1-renter-YOUR_KEY"
```

## Auth Schemes

| Role | Header | Query param |
|------|--------|-------------|
| Provider | `x-provider-key: dc1-provider-...` | `?key=dc1-provider-...` |
| Renter | `x-renter-key: dc1-renter-...` | `?key=dc1-renter-...` |
| Admin | `x-admin-token: <token>` | — |

## Billing Model

- Currency: SAR (1 SAR = 100 halala)
- Pre-pay: estimated cost held at job submit time
- Settlement: actual cost calculated at job completion
- Split: 75% provider / 25% DC1 fee
- Rates (halala/minute): LLM inference 15 · image gen 20 · training 25 · vllm_serve 20 · default 10

## Payment Gateway

Production payments use **Moyasar** (Saudi-first gateway — mada, Apple Pay, credit card).
- `POST /api/payments/topup` — initiate payment, returns `checkout_url`
- Redirect renter to `checkout_url` to complete payment
- Webhook at `POST /api/payments/webhook` confirms and credits balance
- `GET /api/payments/verify/{paymentId}` — poll status after redirect

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DC1_ADMIN_TOKEN` | Yes | Admin endpoint auth token |
| `DC1_HMAC_SECRET` | Yes | HMAC secret for job task signing |
| `MOYASAR_SECRET_KEY` | Prod | Moyasar API key |
| `MOYASAR_WEBHOOK_SECRET` | Prod | Webhook signature secret |
| `RESEND_API_KEY` | Optional | Email delivery |
| `FRONTEND_URL` | Optional | Payment callback base URL |
| `BACKEND_URL` | Optional | Backend URL for installer scripts |
