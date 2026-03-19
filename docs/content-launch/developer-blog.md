# DCP: Run LLaMA 3, Mistral, and GPU Workloads via API — Saudi-Hosted

*DCP — Saudi Arabia's First Decentralized GPU Compute Marketplace*

---

## TL;DR

DCP is a REST API for GPU compute in Saudi Arabia. Submit a job, get results. LLM inference, image generation, model training — billed in SAR, running on Saudi hardware, no cross-border VAT. This post covers the API, the Python + JS SDKs, and the VS Code vLLM integration.

---

## Why DCP Instead of AWS / Azure?

Saudi ML teams currently face a familiar set of problems with US cloud:

1. **Cross-border payment friction** — USD billing, cross-border VAT complexity, credit card FX fees
2. **Latency** — US-East or EU regions add 180–300ms roundtrip from Riyadh
3. **Data residency** — PDPL requires personal data to stay in KSA; US cloud requires explicit configuration and trust
4. **Cost** — An AWS p4d.24xlarge (8× A100) costs ~$32/hr. A comparable DCP cluster costs a fraction, in SAR

DCP runs on GPU hardware located in Saudi Arabia, billed in SAR, with PDPL-compliant data handling built in.

---

## API Overview

All requests go to `https://dcp.sa/api` (or your proxied frontend at the same origin).

**Auth:** Add your renter API key as a header or query param.

```
x-renter-key: YOUR_RENTER_KEY
# or
?key=YOUR_RENTER_KEY
```

### Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/renters/register` | Create an account, receive API key |
| GET | `/api/renters/me` | Account info, balance, job history |
| GET | `/api/renters/available-providers` | Browse online GPUs |
| POST | `/api/jobs/submit` | Submit a compute job |
| GET | `/api/jobs/:id/output` | Fetch job output |
| POST | `/api/renters/topup` | Add balance (SAR) |

---

## Quickstart — Submit Your First Job

### 1. Register

```bash
curl -X POST https://dcp.sa/api/renters/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Name",
    "email": "you@example.com",
    "organization": "Your Startup"
  }'
# Returns: { "renterKey": "rk_...", ... }
```

### 2. Browse Available GPUs

```bash
curl "https://dcp.sa/api/renters/available-providers?key=YOUR_KEY"
# Returns list of online providers with GPU model, VRAM, and current load
```

### 3. Submit a Job

```bash
curl -X POST https://dcp.sa/api/jobs/submit \
  -H "x-renter-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jobType": "llm_inference",
    "model": "meta-llama/Llama-3-8B-Instruct",
    "prompt": "Explain transformers in Arabic in 3 sentences.",
    "maxTokens": 200
  }'
# Returns: { "jobId": "job_...", "status": "queued", ... }
```

### 4. Fetch Output

```bash
curl "https://dcp.sa/api/jobs/JOB_ID/output?key=YOUR_KEY"
# Returns: { "output": "...", "tokensGenerated": 187, "costHalala": 42 }
```

---

## Python SDK

Install:

```bash
pip install dc1-python
```

Usage:

```python
from dc1 import RenterClient

client = RenterClient(api_key="YOUR_RENTER_KEY")

# List available GPUs
providers = client.marketplace.list_available()
for p in providers:
    print(f"{p['gpu_model']} ({p['vram_gb']}GB) — {p['status']}")

# Submit an LLM inference job
job = client.jobs.submit(
    job_type="llm_inference",
    model="mistralai/Mistral-7B-Instruct-v0.2",
    prompt="Write a product description for a Saudi fintech app.",
    max_tokens=300,
)

# Poll until done
result = client.jobs.wait(job["jobId"])
print(result["output"])
print(f"Cost: {result['costHalala'] / 100:.2f} SAR")
```

**Supported job types:**

| `jobType` | Description | Example Model |
|-----------|-------------|---------------|
| `llm_inference` | Single prompt, single response | Llama 3, Mistral 7B, Qwen 2 |
| `image_generation` | Text-to-image | Stable Diffusion XL |
| `model_training` | Fine-tuning adapter jobs | LoRA, QLoRA |

---

## JavaScript / Node.js SDK

Install:

```bash
npm install dc1-js
```

Usage:

```javascript
import { RenterClient } from 'dc1-js';

const client = new RenterClient({ apiKey: 'YOUR_RENTER_KEY' });

// Browse the marketplace
const providers = await client.marketplace.listAvailable();
console.log(`${providers.length} GPUs online`);

// Submit a job
const job = await client.jobs.submit({
  jobType: 'llm_inference',
  model: 'meta-llama/Llama-3-8B-Instruct',
  prompt: 'Summarize the Saudi Vision 2030 goals in 5 bullet points.',
  maxTokens: 400,
});

// Wait for result
const result = await client.jobs.waitForCompletion(job.jobId);
console.log(result.output);
console.log(`Cost: ${(result.costHalala / 100).toFixed(2)} SAR`);
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
  maxTokens: 500,
});
```

---

## Pricing (SAR)

All pricing is in **SAR**, billed per-job in **halala** (1 SAR = 100 halala).

| Workload | Approximate Cost |
|----------|-----------------|
| LLM inference (7B model, 500 tokens) | ~0.10–0.30 SAR |
| LLM inference (70B model, 500 tokens) | ~0.50–1.50 SAR |
| Image generation (SDXL, 1 image) | ~0.20–0.60 SAR |
| Fine-tuning job (1hr, RTX 4090) | ~20 SAR |

Compared to OpenAI API (GPT-4o): DCP LLM inference on Llama 3 70B runs at a fraction of the cost, with no USD conversion, no VAT complexity, and data that never leaves Saudi Arabia.

---

## PDPL Compliance

DCP is designed for Saudi data regulations:

- All compute runs on hardware physically located in Saudi Arabia
- Job inputs and outputs are not stored beyond job completion (ephemeral containers)
- No personal data leaves the Kingdom
- Provider machines cannot access renter data outside the job container

For enterprise deployments with specific data handling requirements, contact **support@dcp.sa**.

---

## Get Started

```bash
# 1. Register
curl -X POST https://dcp.sa/api/renters/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Your Name","email":"you@example.com"}'

# 2. Install SDK
pip install dc1-python
# or
npm install dc1-js

# 3. Submit your first job
```

Sign up at **[dcp.sa/renter/register](https://dcp.sa/renter/register)** → get your API key → start building.

**Questions:** support@dcp.sa | Full docs at [dcp.sa/docs](https://dcp.sa/docs)

---
---

# DCP: شغّل LLaMA 3 وMistral وأحمال العمل على GPU عبر API — مستضاف في السعودية

*DCP — أول سوق لامركزي للحوسبة الرسومية في المملكة العربية السعودية*

<div dir="rtl">

---

## الخلاصة السريعة

DCP هو واجهة برمجية REST للحوسبة عبر GPU في المملكة العربية السعودية. أرسل مهمة واحصل على النتائج. استدلال بنماذج اللغة الكبيرة، توليد الصور، تدريب النماذج — مُفوتَر بالريال السعودي، يعمل على أجهزة سعودية، بدون ضريبة قيمة مضافة عابرة للحدود. يغطي هذا المقال الـ API وحزم Python و JS و تكامل VS Code مع vLLM.

---

## لماذا DCP بدلاً من AWS / Azure؟

الفرق الجوهري:

1. **مدفوعات بالريال السعودي** — لا دولار، لا ضريبة قيمة مضافة معقدة، لا رسوم صرف عملات
2. **زمن استجابة أقل** — أجهزة داخل المملكة تقلل التأخير بشكل كبير من الرياض
3. **الامتثال لنظام PDPL** — البيانات الشخصية تبقى داخل المملكة تلقائياً
4. **التكلفة** — السحابة الأمريكية للـ A100 تكلف أكثر من 120 ريال/ساعة. مجموعات DCP المقارنة بكسر من هذا السعر

---

## نظرة عامة على الـ API

جميع الطلبات تذهب إلى `https://dcp.sa/api`.

**المصادقة:** أضف مفتاح API الخاص بك كترويسة أو معامل استعلام.

```
x-renter-key: YOUR_RENTER_KEY
```

### المسارات الأساسية

| الطريقة | المسار | الوصف |
|---------|--------|-------|
| POST | `/api/renters/register` | إنشاء حساب والحصول على مفتاح API |
| GET | `/api/renters/me` | معلومات الحساب والرصيد وسجل المهام |
| GET | `/api/renters/available-providers` | تصفح أجهزة GPU المتاحة |
| POST | `/api/jobs/submit` | إرسال مهمة حوسبة |
| GET | `/api/jobs/:id/output` | جلب نتائج المهمة |

---

## البداية السريعة — أرسل أول مهمة

### 1. التسجيل

```bash
curl -X POST https://dcp.sa/api/renters/register \
  -H "Content-Type: application/json" \
  -d '{"name":"اسمك","email":"you@example.com","organization":"شركتك"}'
# يعيد: { "renterKey": "rk_...", ... }
```

### 2. إرسال مهمة

```bash
curl -X POST https://dcp.sa/api/jobs/submit \
  -H "x-renter-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jobType": "llm_inference",
    "model": "meta-llama/Llama-3-8B-Instruct",
    "prompt": "اشرح المحولات (Transformers) في 3 جمل باللغة العربية.",
    "maxTokens": 200
  }'
```

---

## حزمة Python

```bash
pip install dc1-python
```

```python
from dc1 import RenterClient

client = RenterClient(api_key="YOUR_RENTER_KEY")

job = client.jobs.submit(
    job_type="llm_inference",
    model="mistralai/Mistral-7B-Instruct-v0.2",
    prompt="اكتب وصفاً تسويقياً لتطبيق فينتك سعودي.",
    max_tokens=300,
)

result = client.jobs.wait(job["jobId"])
print(result["output"])
print(f"التكلفة: {result['costHalala'] / 100:.2f} ريال")
```

---

## حزمة JavaScript / Node.js

```bash
npm install dc1-js
```

```javascript
import { RenterClient } from 'dc1-js';

const client = new RenterClient({ apiKey: 'YOUR_RENTER_KEY' });

const job = await client.jobs.submit({
  jobType: 'llm_inference',
  model: 'meta-llama/Llama-3-8B-Instruct',
  prompt: 'لخّص أهداف رؤية السعودية 2030 في 5 نقاط.',
  maxTokens: 400,
});

const result = await client.jobs.waitForCompletion(job.jobId);
console.log(result.output);
```

---

## الأسعار (ريال سعودي)

| نوع العمل | التكلفة التقريبية |
|-----------|------------------|
| استدلال LLM (نموذج 7B، 500 رمز) | ~0.10–0.30 ريال |
| استدلال LLM (نموذج 70B، 500 رمز) | ~0.50–1.50 ريال |
| توليد صورة (SDXL) | ~0.20–0.60 ريال |
| مهمة ضبط دقيق (ساعة، RTX 4090) | ~20 ريال |

---

## ابدأ الآن

سجّل في **[dcp.sa/renter/register](https://dcp.sa/renter/register)** ← احصل على مفتاح API ← ابدأ البناء.

**توثيق كامل:** [dcp.sa/docs](https://dcp.sa/docs) | **الدعم:** support@dcp.sa

</div>
