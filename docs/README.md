# DC1 Platform — API Documentation

DCP is a Saudi-hosted GPU compute marketplace for AI workloads. This directory contains the machine-readable API spec and developer guides.

## Developer Docs

| Document | Language | Description |
|----------|----------|-------------|
| [Quickstart](./quickstart.md) | English | Submit a GPU workload |
| [دليل البدء السريع](./quickstart-ar.md) | العربية | دليل البدء السريع للحملات عبر curl |
| [OpenRouter 60-Second First Request](./api/openrouter-60s-quickstart.md) | English | Signup to first `/v1/chat/completions` call in ~60 seconds |
| [مسار أول طلب خلال 60 ثانية](./ar/openrouter-60s-quickstart.mdx) | العربية | من التسجيل إلى أول طلب `/v1/chat/completions` خلال 60 ثانية |
| [API Reference](./api-reference.md) | English | All endpoints with request/response schemas |
| [مرجع API](./api-reference-ar.md) | العربية | جميع نقاط النهاية بالعربية |
| [Provider Guide](./provider-guide.md) | English | Earn SAR by connecting your NVIDIA GPU |
| [SDK Guides](./sdk-guides.md) | English | Python and JavaScript code examples |
| [Migrate from RunPod to DCP](./guides/migrate-runpod-to-dcp.md) | English | Map RunPod auth, job, and monitoring flows to DCP equivalents |
| [Migrate from Vast.ai to DCP](./guides/migrate-vast-to-dcp.md) | English | Map Vast.ai marketplace and instance workflows to DCP job APIs |
| [Model Cards](./model-cards.mdx) | English | Bilingual model card publishing format with benchmark interpretation and reproducible methodology |
| [بطاقات النماذج](./ar/model-cards.mdx) | العربية | صيغة نشر بطاقات النماذج ثنائية اللغة مع تفسير القياسات |
| [vLLM Model Catalog](./models.md) | English | Supported LLMs, VRAM requirements, and Arabic model guidance |
| [Arabic Portfolio Serving Ops](./arabic-portfolio-serving-ops.md) | English | Tiered Arabic model prewarm policy, deployment, and rollback runbook |
| [GPU Compatibility Matrix](./gpu-matrix.md) | English | GPU-to-model fit, batch sizing, and throughput planning |
| [Pricing Guide](./pricing-guide.md) | English | SAR pricing bands, earnings calculator, and cloud comparison |
| [Retail Readiness Roadmap (Q2 2026)](./roadmap/dcp-retail-readiness-2026-Q2.md) | English | 2/4/8-week retail-readiness milestones for Nemotron, Swarm Intelligence, Open Viking, and Page Agents |
| [Container Security Baseline](./container-security.md) | English | Docker hardening controls, limits, and inspect verification checks |
| [Launch Window Deploy Runbook](./ops/launch-window-deploy-runbook.md) | English | Operator command sequence for deploy, verify, rollback, and blocker triage |
| [Enterprise SLA & Trust Commitments](./enterprise-trust-package/section-5-sla-trust.mdx) | English | Bronze/Silver/Gold uptime and support guarantees with trust commitments |
| [التزامات SLA والثقة للمؤسسات](./ar/enterprise-trust-package/section-5-sla-trust.mdx) | العربية | مستويات SLA وضمانات الدعم والثقة للمراجعة الخارجية |

## Test Environment Note

If tests fail with a `better-sqlite3` native module version mismatch after switching Node.js versions or using a fresh environment, run:

```bash
cd backend
npm rebuild better-sqlite3
```

Then run E2E tests with:

```bash
npm run test:e2e
```

## Post-Deploy Verification (VPS)

After deploying backend/frontend changes on the VPS, run:

```bash
./infra/scripts/verify-deploy.sh
```

The script validates required PM2 service status, launch-critical PM2 env vars, local/public API health, `https://dcp.sa` reachability, SQLite connectivity, and recent fatal log signatures.  
Exit code `0` means pass; exit code `1` means fail.

## OpenAPI Spec

The full OpenAPI 3.0 spec is at [`docs/openapi.yaml`](./openapi.yaml).

**Live endpoints:**

| URL | What |
|-----|------|
| `GET /api/docs` | Raw OpenAPI 3.0 YAML (application/yaml) |
| `GET /api/docs/ui` | Swagger UI — interactive browser |

In production: `https://dcp.sa/api/dc1/docs/ui`

## Quick Start

### Provider

```bash
# 1. Register
curl -X POST https://dcp.sa/api/dc1/providers/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ahmed","email":"ahmed@example.sa","gpu_model":"RTX 3090","os":"Linux"}'

# 2. Install daemon (Linux)
curl "https://dcp.sa/api/dc1/providers/download/setup?key=dc1-provider-YOUR_KEY&os=linux" | bash

# 3. Check dashboard
curl "https://dcp.sa/api/dc1/providers/me?key=dc1-provider-YOUR_KEY"
```

### Renter

```bash
# 1. Register
curl -X POST https://dcp.sa/api/dc1/renters/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Fatima","email":"fatima@example.sa"}'

# 2. Top up balance (sandbox — dev only)
curl -X POST https://dcp.sa/api/dc1/payments/topup-sandbox \
  -H "Content-Type: application/json" \
  -H "x-renter-key: dc1-renter-YOUR_KEY" \
  -d '{"amount_sar": 50}'

# 3. Browse available GPUs
curl https://dcp.sa/api/dc1/renters/available-providers

# 4. Submit a job
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
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
curl "https://dcp.sa/api/dc1/jobs/JOB_ID/output" \
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

Payment gateway integration is configured through **Moyasar** when gateway credentials are enabled (mada, Apple Pay, card).
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
