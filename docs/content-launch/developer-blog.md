# DCP: Run LLM and GPU Workloads through Saudi-Hosted Container APIs

*DCP — A Saudi-focused GPU compute marketplace*

---

## TL;DR

DCP is a Saudi-hosted, container-based GPU API. Submit workloads, monitor job progress, and fetch outputs with clear completion checkpoints. This post covers the REST path, SDK patterns, and VS Code workflow integration for reliable job routing.

---

## Why DCP Instead of AWS / Azure?

Saudi ML teams currently face a familiar set of problems with US cloud:

1. **Local financial clarity** — working in SAR avoids repeated FX operations in common renter workflows.
2. **Lower roundtrip for local teams** — Saudi-hosted routing can improve responsiveness for Saudi-origin teams.
3. **Data residency expectations** — PDPL-compatible patterns support local handling and operations planning.
4. **Saudi cost advantage** — regional energy conditions can improve long-run economics for sustained workloads.

DCP routes jobs to Saudi-located and Saudi-optimized execution paths using containerized workloads in a PDPL-aware design.

---

## API Overview

All requests go to `https://dcp.sa/api/dc1` in frontend flow, or the direct backend at `https://api.dcp.sa/api`.

**Auth:** Add your renter API key as a header or query param.

```
x-renter-key: YOUR_RENTER_KEY
# or
?key=YOUR_RENTER_KEY
```

### Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/dc1/renters/register` | Create an account, receive API key |
| GET | `/api/dc1/renters/me` | Account info, balance, job history |
| GET | `/api/dc1/renters/available-providers` | Browse online GPUs |
| POST | `/api/dc1/jobs/submit` | Submit a compute job |
| GET | `/api/dc1/jobs/:id/output` | Fetch job output |
| POST | `/api/dc1/renters/topup` | Add balance (SAR) |

Use `/dc1` prefix when calling directly against the backend (`/api/dc1/jobs/submit`).

---

## Quickstart — Submit a Workload

### 1. Register

```bash
curl -X POST https://dcp.sa/api/dc1/renters/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Name",
    "email": "you@example.com",
    "organization": "Your Startup"
  }'
# Returns: { "api_key": "dc1-renter-...", ... }
```

### 2. Browse Available GPUs

```bash
curl "https://dcp.sa/api/dc1/renters/available-providers?key=YOUR_KEY"
# Returns list of online providers with GPU model, VRAM, and current load
```

### 3. Submit a Job

```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "llm_inference",
    "duration_minutes": 5,
    "container_spec": { "image_type": "vllm-serve" },
    "params": {
      "model": "meta-llama/Llama-3-8B-Instruct",
      "prompt": "Explain transformers in Arabic in 3 sentences.",
      "max_tokens": 200
    }
  }'
# Returns: { "job": { "job_id": "...", "status": "queued" }, ... }
```

### 4. Fetch Output

```bash
curl "https://dcp.sa/api/dc1/jobs/JOB_ID/output?key=YOUR_KEY"
# Returns: output object with completion result fields and settlement-related billing details
```

---

## Python SDK

Install:

```bash
# Check /docs/sdk-guides for the current SDK package names before installation.
```

Usage:

```python
from <SDK_PACKAGE_NAME> import RenterClient

client = RenterClient(api_key="YOUR_RENTER_KEY")

# List available GPUs
providers = client.marketplace.list_available()
for p in providers:
    print(f"{p['gpu_model']} ({p['vram_gb']}GB) — {p['status']}")

# Submit an LLM inference job
job = client.jobs.submit(
    job_type="llm_inference",
    duration_minutes=4,
    container_spec={"image_type": "vllm-serve"},
    params={
      "model":"mistralai/Mistral-7B-Instruct-v0.2",
      "prompt":"Write a product description for a Saudi fintech app.",
      "max_tokens":300
    },
)

# Poll until completion
result = client.jobs.wait(job["job_id"])
print(result["output"])
print(f"Cost: {result['cost_halala'] / 100:.2f} SAR")
```

**Supported job types:**

| `job_type` | Description | Example Model |
|-----------|-------------|---------------|
| `llm_inference` | Single prompt, single response | Llama 3, Mistral 7B, Qwen 2 |
| `image_generation` | Text-to-image | Stable Diffusion XL |
| `training` | Fine-tuning adapter jobs | LoRA, QLoRA |

---

## JavaScript / Node.js SDK

Install:

```bash
# Check /docs/sdk-guides for the current SDK package names before installation.
```

Usage:

```javascript
import { RenterClient } from '<SDK_PACKAGE_FROM_DOCS>';

const client = new RenterClient({ apiKey: 'YOUR_RENTER_KEY' });

// Browse the marketplace
const providers = await client.marketplace.listAvailable();
console.log(`${providers.length} GPUs online`);

// Submit a job
const job = await client.jobs.submit({
  job_type: 'llm_inference',
  duration_minutes: 5,
  container_spec: { image_type: 'vllm-serve' },
  params: {
    model: 'meta-llama/Llama-3-8B-Instruct',
    prompt: 'Summarize the Saudi Vision 2030 goals in 5 bullet points.',
    max_tokens: 400,
  },
});

// Wait for result
const result = await client.jobs.waitForCompletion(job.job_id);
console.log(result.output);
console.log(`Cost: ${(result.cost_halala / 100).toFixed(2)} SAR`);
```

---

## VS Code Integration — vLLM Serve (Ctrl+Shift+V)

The DCP VS Code extension turns your editor into an LLM interface backed by DCP compute.

**Install:**
1. Download `dcp-vscode.vsix` from [dcp.sa/provider/download](https://dcp.sa/provider/download)
2. In VS Code: Extensions → `...` → Install from VSIX

**Start a serve session:**
- Open the Command Palette (`Ctrl+Shift+P`)
- Run `DCP: Start Serve Session`
- Or press `Ctrl+Shift+V`

The extension connects to DCP, allocates a GPU, starts a vLLM inference server, and opens a chat panel in the sidebar. You can query the model directly from your editor while you code.

**Query from code:**

```typescript
// dc1.queryServe({ prompt: string, maxTokens?: number })
const result = await vscode.commands.executeCommand('dc1.queryServe', {
  prompt: 'Review this function for security issues:\n\n' + selectedCode,
  max_tokens: 500,
});
```

---

## Pricing (SAR)

Pricing is in **SAR**, billed per-job in **halala** (1 SAR = 100 halala), with final settlement based on completed execution.

| Workload | Cost Signal |
|----------|-------------|
| LLM inference, image generation, training | Set per workload class in marketplace pricing |

Use the dashboard planner to compare workload scenarios with your expected utilization and uptime.

---

## PDPL Compliance

DCP is designed for Saudi data handling requirements:

- Compute execution is aligned to Saudi routing paths
- Job inputs and outputs are not stored beyond job completion (ephemeral containers)
- Data handling follows platform policies aligned with Saudi operational and residency needs.
- Provider machines cannot access renter data outside the job container

For enterprise deployments with specific data handling requirements, contact **support@dcp.sa**.

---

## Get Started

```bash
# 1. Register
curl -X POST https://dcp.sa/api/dc1/renters/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Your Name","email":"you@example.com"}'

# 2. Confirm current SDK package names from /docs/sdk-guides before install
```

## 3. Submit a workload

```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": 42,
    "job_type": "llm_inference",
    "duration_minutes": 3,
    "container_spec": { "image_type": "vllm-serve" },
    "params": {
      "model": "meta-llama/Llama-3-8B-Instruct",
  "prompt": "Summarize this in 5 bullets: when to use Saudi-hosted container workflows"
    }
  }'
```

Sign up at **[dcp.sa/renter/register](https://dcp.sa/renter/register)** → get your API key → start building.

**Questions:** support@dcp.sa | Full docs at [dcp.sa/docs](https://dcp.sa/docs)

---
---

# DCP: شغّل LLaMA 3 وMistral وأحمال العمل على GPU عبر API — مستضاف في السعودية

*DCP — منصة لامركزية للحوسبة الرسومية في المملكة العربية السعودية*

<div dir="rtl">

---

## الخلاصة السريعة

DCP هو واجهة برمجية REST للحوسبة عبر GPU في المملكة العربية السعودية. أرسل مهمة واحصل على النتائج. استدلال نماذج اللغة الكبيرة، توليد الصور، التدريب — مقوم بالريال السعودي، ويعمل على بنية تحتية سعودية مع خيارات تشغيل ملائمة للسوق المحلي. يغطي هذا المقال واجهة الـ API، وحزم Python و JavaScript، وتكامل VS Code مع vLLM.

---

## لماذا DCP بدلاً من AWS / Azure؟

الفرق الجوهري:

1. **حجم مالي محلي** — التعامل بالريال السعودي يقلل تعقيدات التسويات الخارجية ويبسّط إدارة الإنفاق.
2. **زمن أقرب للإنتاج** — استضافة البنية داخل المملكة قد تقرّب الزمن التشغيلي مقارنة بالمنطقيات البعيدة.
3. **ملاءمة تنظيمية للبيئة المحلية** — يمكن تمهيد التدفق بما يدعم متطلبات PDPL وسياسات البيانات المحلية.
4. **ميزة التكلفة المحلية** — البنية والطاقة في السعودية قد تجعل تكلفة التشغيل التراكمية أكثر جدوى لبعض أحمال العمل.

---

## نظرة عامة على الـ API

جميع الطلبات تذهب إلى `https://dcp.sa/api/dc1` (أو مباشرة إلى `https://api.dcp.sa`).

**المصادقة:** أضف مفتاح API الخاص بك كترويسة أو معامل استعلام.

```
x-renter-key: YOUR_RENTER_KEY
?key=YOUR_RENTER_KEY
```

### المسارات الأساسية

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| POST | `/api/dc1/renters/register` | إنشاء حساب والحصول على مفتاح API |
| GET | `/api/dc1/renters/me` | معلومات الحساب والرصيد وسجل المهام |
| GET | `/api/dc1/renters/available-providers` | تصفح أجهزة GPU المتاحة |
| POST | `/api/dc1/jobs/submit` | إرسال مهمة حوسبة |
| GET | `/api/dc1/jobs/:id/output` | جلب نتائج المهمة |

---

## البداية السريعة — أرسل عبء عمل

### 1. التسجيل

```bash
curl -X POST https://dcp.sa/api/dc1/renters/register \
  -H "Content-Type: application/json" \
  -d '{"name":"اسمك","email":"you@example.com","organization":"شركتك"}'
# يعيد: { "api_key": "rk_...", ... }
```

### 2. إرسال مهمة

```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "llm_inference",
    "duration_minutes": 4,
    "container_spec": { "image_type": "vllm-serve" },
    "params": {
      "model": "meta-llama/Llama-3-8B-Instruct",
      "prompt": "اشرح المحولات (Transformers) في 3 جمل باللغة العربية.",
      "max_tokens": 200
    }
  }'
```

---

## حزمة Python

```bash
# راجع /docs/sdk-guides لتأكيد أسماء حزم SDK الحالية قبل التثبيت
```

```python
from <SDK_PACKAGE_FROM_DOCS> import RenterClient

client = RenterClient(api_key="YOUR_RENTER_KEY")

job = client.jobs.submit(
    job_type="llm_inference",
    duration_minutes=4,
    container_spec={"image_type": "vllm-serve"},
    params={
      "model":"mistralai/Mistral-7B-Instruct-v0.2",
      "prompt":"اكتب وصفاً تسويقياً لتطبيق فينتك سعودي.",
      "max_tokens":300
    },
)

result = client.jobs.wait(job["job_id"])
print(result["output"])
print(f"التكلفة: {result['cost_halala'] / 100:.2f} ريال")
```

---

## حزمة JavaScript / Node.js

```bash
# راجع /docs/sdk-guides لتأكيد أسماء حزم SDK الحالية قبل التثبيت
```

```javascript
import { RenterClient } from '<SDK_PACKAGE_FROM_DOCS>';

const client = new RenterClient({ apiKey: 'YOUR_RENTER_KEY' });

const job = await client.jobs.submit({
  job_type: 'llm_inference',
  duration_minutes: 5,
  container_spec: { image_type: 'vllm-serve' },
  params: {
    model: 'meta-llama/Llama-3-8B-Instruct',
    prompt: 'لخّص أهداف رؤية السعودية 2030 في 5 نقاط.',
    max_tokens: 400,
  },
});

const result = await client.jobs.waitForCompletion(job.job_id);
console.log(result.output);
```

---

## الأسعار (ريال سعودي)

| نوع العمل | إشارة التكلفة |
|-----------|------------------|
| استدلال LLM | تُحدّد عبر فئة التسعير المختارة في السوق |
| توليد صورة | تُحدّد وفقاً لنوع النموذج ومدة التنفيذ |
| تدريب | تُحدّد وفقاً لطول المهمة وحجم الموارد المستخدمة |

---

## ابدأ الآن

سجّل في **[dcp.sa/renter/register](https://dcp.sa/renter/register)** ← احصل على مفتاح API ← ابدأ البناء.

**توثيق كامل:** [dcp.sa/docs](https://dcp.sa/docs) | **الدعم:** support@dcp.sa

</div>
