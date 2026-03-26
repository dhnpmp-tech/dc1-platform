# DCP Renter Quickstart Guide

## Welcome to DCP! 🚀

DCP is Saudi Arabia's GPU compute marketplace. Rent GPUs on-demand, deploy models instantly, and save 40-60% vs AWS/Azure.

This guide will get you from zero to running your first model in **5 minutes**.

---

## Step 1: Sign Up & Get Your API Key (2 minutes)

### 1. Create Your Account

Go to **[dcp.sa](https://dcp.sa)** and click "Sign Up".

**Sign up with:**
- Email + password, OR
- Supabase magic link (passwordless)

**You'll need:**
- Valid email
- Saudi phone number (for payment verification)
- IBAN (for invoicing)

### 2. Verify Your Email

Check your inbox for our verification email. Click the link.

### 3. Get Your API Key

1. Go to **Settings → API Keys**
2. Click "Generate New Key"
3. **Copy and save this key in a safe place** (you won't see it again)
4. Name it something useful: "My Research" or "Production"

**Keep your API key secret!** Treat it like a password.

---

## Step 2: Browse Available Templates & Models (1 minute)

### View Available Models

Go to **Marketplace → Models** on dcp.sa or via the API:

```bash
curl https://api.dcp.sa/api/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Popular Models Available

**Arabic-Optimized Models:**
- **ALLaM 7B** (Arabic chat, fine-tuning)
- **Falcon H1 Arabic 7B** (Arabic instruction-following)
- **Qwen 2.5 7B** (Multilingual, Arabic-capable)

**Multilingual Models:**
- **Llama 3 8B** (English, supports 8 languages)
- **Mistral 7B** (English, fast)

**Image Models:**
- **SDXL** (Text-to-image, high quality)
- **Stable Diffusion 3** (Open-source, fast)

**Embedding & Retrieval:**
- **BGE-M3** (Multilingual embeddings, great for Arabic)
- **BGE-Reranker** (Semantic ranking)

**Templates (Ready-to-Deploy Stacks):**
- **Arabic RAG** (BGE-M3 + Reranker + ALLaM 7B)
- **Code Generation** (Llama + coding datasets)
- **Image Generation** (SDXL + inference server)
- **Jupyter GPU** (PyTorch + GPU-enabled notebook)

### Filter by Your Needs

- **Language:** Arabic-optimized, English, multilingual
- **Task:** Chat, embeddings, code, images, fine-tuning
- **VRAM:** 16GB, 24GB, 48GB, 80GB
- **GPU:** RTX 4090, H100, L40S, A100, H200

---

## Step 3: Deploy Your First Model (2 minutes)

### Option A: Use a One-Click Template (Easiest)

1. Go to **Marketplace → Templates**
2. Pick a template (e.g., "Arabic RAG" or "Jupyter GPU")
3. Click **"Deploy Now"**
4. Select your GPU tier:
   - **RTX 4090** — $0.24/hr (good for inference)
   - **H100** — $1.50/hr (good for training + inference)
   - **A100** — $0.80/hr (balanced)
5. Click **"Confirm"**
6. Wait 2-3 minutes for deployment
7. Copy your **Endpoint URL**

**You're live!** Send requests to your endpoint.

### Option B: Deploy a Model Manually (More Control)

1. Go to **Create Job → Model Inference**
2. Select your model (e.g., "ALLaM 7B")
3. Choose GPU:
   ```
   Model: ALLaM 7B
   Min VRAM: 16GB → Recommended GPU: RTX 4090 or H100
   ```
4. Set duration:
   - Hourly (pay-as-you-go)
   - Reserved (8 hrs, 24 hrs, 7 days) — 10% discount
5. Click **"Deploy"**

### Monitor Your Deployment

Go to **Dashboard → Jobs** to see:
- Status (Launching, Running, Ready)
- Uptime
- Current cost
- Endpoint URL

---

## Step 4: Use Your Model (Examples)

### Example 1: Chat with ALLaM 7B (Arabic)

```bash
curl https://api.dcp.sa/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "allam-7b-instruct",
    "messages": [
      {
        "role": "user",
        "content": "مرحبا، من أنت؟"
      }
    ]
  }'
```

**Response:**
```json
{
  "choices": [{
    "message": {
      "content": "مرحباً! أنا نموذج لغة عربي يسمى ALLaM. يمكنني مساعدتك في الإجابة على الأسئلة باللغة العربية..."
    }
  }]
}
```

### Example 2: Embed Text with BGE-M3

```bash
curl https://api.dcp.sa/v1/embeddings \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bge-m3",
    "input": "This is an Arabic document about natural language processing."
  }'
```

### Example 3: Generate Images with SDXL

```bash
curl https://api.dcp.sa/v1/images/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sdxl",
    "prompt": "A beautiful sunset over the Arabian desert, oil painting style",
    "n": 1,
    "size": "1024x1024"
  }'
```

### Example 4: Fine-Tune a Model (Advanced)

```bash
curl https://api.dcp.sa/v1/fine-tuning/jobs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -X POST \
  -d '{
    "training_file": "file-upload-id-here",
    "model": "llama-3-8b-instruct",
    "suffix": "my-custom-model",
    "hyperparameters": {
      "learning_rate_multiplier": 1,
      "n_epochs": 3
    }
  }'
```

---

## Pricing Explained

### How Billing Works

- **Pay-as-you-go:** $0.24-$2.50/hr depending on GPU
- **Reserved instances:** 10% discount for 8+ hour bookings
- **Storage:** $0.05/GB/month for model weights
- **Egress:** $0.10/GB for data downloads (typically $0-1/job)

### Your Monthly Bill

```
GPU compute:     100 hrs × $0.50/hr = $50
Storage:         5 GB × $0.05 = $0.25
Egress:          2 GB × $0.10 = $0.20
---
TOTAL:           $50.45/month
```

### Cost Comparison: DCP vs Hyperscalers

```
WORKLOAD: Fine-tune Llama 3 8B (40 hours, H100)

AWS SageMaker:
- H100 instance: $3.06/hr × 40 hrs = $122
- Data transfer: $0.02/GB × 10GB = $0.20
TOTAL: $122.20

Azure ML Compute:
- GPU cluster: $2.80/hr × 40 hrs = $112
- Storage: $0.50
TOTAL: $112.50

DCP (Saudi energy rates):
- H100 compute: $1.50/hr × 40 hrs = $60
- Storage: $0.20
TOTAL: $60.20

SAVINGS: 45-51% cheaper than AWS/Azure
```

---

## Monitoring & Billing

### View Your Usage

1. Go to **Dashboard → Usage**
2. See real-time costs:
   - Current month spend
   - Hourly breakdown
   - GPU utilization

### Set Spending Alerts

1. Go to **Settings → Billing**
2. Set alert thresholds:
   - $100/month warning
   - $200/month alert
3. Get notified via email

### Download Invoices

Go to **Billing → Invoices** to download SAR invoices for accounting.

---

## Common Questions

### Q: How do I stop a job and not get charged?

A: Go to **Dashboard → Jobs → [Your Job] → Stop**.

Billing stops immediately. You're only charged for hours used (rounded to nearest minute).

### Q: Can I reserve a GPU in advance?

A: Yes! Use **Marketplace → Reserve Slot** or:

```bash
curl https://api.dcp.sa/v1/jobs/reserve \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -X POST \
  -d '{
    "model": "h100-compute",
    "duration_hours": 24,
    "start_time": "2026-03-27T10:00:00Z"
  }'
```

### Q: What happens if a provider goes offline?

A: DCP manages failover automatically. If your provider disconnects:
1. Your job pauses (no charges)
2. DCP reassigns to another provider
3. You're notified via email
4. You get 10% credit for the disruption

### Q: Can I use my own model/code?

A: Yes! Use **Create Job → Custom Container** and upload a Docker image with your code.

### Q: Is my data safe?

A: Yes, because:
- PDPL-compliant (data stays in Saudi Arabia)
- SSL/TLS encryption in transit
- Data deleted after job completion
- No data sharing with other users

### Q: Can I deploy long-running services (e.g., API serving)?

A: Yes! Use **Marketplace → Persistent Endpoint**:
- Monthly pricing (not hourly)
- Guaranteed uptime SLA (99.5%)
- Auto-scaling (pay only for what you use)
- Ideal for production APIs

---

## Troubleshooting

### Job Won't Start

**Symptom:** Job status stuck on "Launching" for >5 min

**Fix:**
1. Check your account balance (Settings → Billing)
2. Verify API key is correct (Settings → API Keys)
3. Restart the job: Dashboard → Jobs → [Job] → Restart

### Model Request Timeout

**Symptom:** API calls get 504 Gateway Timeout

**Fix:**
1. Your provider might be overloaded
2. Increase timeout in your code:
   ```python
   import requests
   response = requests.post(endpoint, json=data, timeout=60)
   ```
3. Try a larger GPU (H100 vs RTX 4090) for faster inference
4. Contact support: support@dcp.sa

### Out of Memory (OOM)

**Symptom:** "CUDA out of memory" error

**Fix:**
- Your model is too large for the GPU
- Use a smaller model, or
- Upgrade to larger GPU:
  - RTX 4090 (24GB) → H100 (80GB)
  - A100 (40GB) → H100 (80GB)

### Payment Rejected

**Symptom:** Credit card or IBAN rejected during checkout

**Fix:**
1. Verify your card is enabled for international payments
2. For IBAN, ensure it matches your registered name
3. Try a different payment method
4. Contact support: billing@dcp.sa

---

## Next Steps

### Learn More

- **API Docs:** [docs.dcp.sa/api](https://docs.dcp.sa/api)
- **Model Benchmarks:** [dcp.sa/benchmarks](https://dcp.sa/benchmarks)
- **Community:** [Discord](https://discord.gg/dcp-saudi)

### Get Help

- **Email:** support@dcp.sa (response in 4 hours)
- **WhatsApp:** +966-55-XXXX-XXXX (urgent issues)
- **Live Chat:** [dcp.sa/chat](https://dcp.sa/chat) (Sat-Wed 09:00-17:00 KSA)

### Share Your Project

Built something cool? Share it in #showcase on our [Discord](https://discord.gg/dcp-saudi).

---

## Appendix: Quick API Reference

### Authentication
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.dcp.sa/v1/...
```

### List Available Models
```bash
curl https://api.dcp.sa/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Create a Job
```bash
curl https://api.dcp.sa/v1/jobs \
  -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "allam-7b-instruct",
    "gpu": "h100",
    "duration_hours": 1
  }'
```

### Stop a Job
```bash
curl https://api.dcp.sa/v1/jobs/{job_id}/stop \
  -X POST \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Get Job Status
```bash
curl https://api.dcp.sa/v1/jobs/{job_id} \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

**You're all set! 🎉 Happy computing!**

For questions or feedback, reach out to products@dcp.sa

