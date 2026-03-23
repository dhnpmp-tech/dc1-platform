# Renter Quick Start — Your First Job in 5 Minutes

**Time required:** 5 minutes
**Difficulty:** Easy (no coding)
**Cost:** Free (get 50 SAR test credit)

---

## Overview

This guide walks you through submitting your first inference job on DCP. You'll:
1. Create account (2 min)
2. Get API key (1 min)
3. Submit job (2 min)
4. Get results (automatic)

---

## Step 1: Create Your Account (2 minutes)

### 1a. Go to Registration
Visit: https://dcp.sa/renter/register

### 1b. Enter Your Information
- **Email:** Your email address
- **Full Name:** Your name or organization
- **Password:** Secure password (12+ characters recommended)
- **Company (optional):** Your company or team name

### 1c. Agree & Register
- ✓ Agree to Terms of Service
- ✓ Agree to Privacy Policy
- Click **"Register"**

### What You'll Get
- **Login credentials:** Email + password for https://dcp.sa/login
- **Dashboard link:** https://dcp.sa/renter/dashboard
- **50 SAR free test credit:** (expires in 7 days)

---

## Step 2: Get Your API Key (1 minute)

### 2a. Log In
Visit: https://dcp.sa/login
- Enter your email
- Enter your password
- Click **"Log In"**

### 2b. Copy Your API Key
1. Go to Dashboard → Settings → API Keys
2. Your default key: `sk_renter_XXXXXXXXXX...`
3. Click **"Copy"** to copy to clipboard

### 2c. Keep It Secret
- Don't share your API key with anyone
- Don't commit it to GitHub
- Treat it like a password

**Tip:** You can create multiple API keys with different scopes (read-only, specific endpoints, etc.)

---

## Step 3: Submit Your First Job (2 minutes)

### 3a. Using the Web Dashboard (Easiest)

**Go to:** https://dcp.sa/renter/playground

1. **Select a model:** Choose "Mistral 7B" (popular, cheap)
2. **Enter your prompt:** Type something like:
   ```
   Explain Vision 2030 in Saudi Arabia in 3 sentences.
   ```
3. **Click Submit**
4. **Wait:** Job submits, typically returns in 10-30 seconds

### 3b. Using the API (If You Code)

```bash
# Set your API key
export DCP_KEY="sk_renter_XXXXXXXXXX"

# Submit a job
curl -X POST https://api.dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: $DCP_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistralai/Mistral-7B-Instruct-v0.3",
    "prompt": "Explain Vision 2030",
    "max_tokens": 128
  }'

# Response:
# {"job_id": "job_abc123...", "status": "pending"}
```

### 3c. Check Results

**Via Dashboard:**
1. Go to Dashboard → Recent Jobs
2. Click on your job
3. See status: Pending → Running → Done
4. View output

**Via API:**
```bash
# Check status
curl https://api.dcp.sa/api/dc1/jobs/job_abc123 \
  -H "x-renter-key: $DCP_KEY"

# Get results (once job is done)
curl https://api.dcp.sa/api/dc1/jobs/job_abc123/output \
  -H "x-renter-key: $DCP_KEY"
```

---

## Available Models

All models are ready to use with your free 50 SAR credit:

| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| **Nemotron Nano** | ⚡⚡⚡ Super fast | 5 SAR/hr | Quick answers, edge cases |
| **Mistral 7B** | ⚡⚡ Fast | 8 SAR/hr | General purpose, coding |
| **Qwen 2.5 (Arabic)** | ⚡⚡ Fast | 9 SAR/hr | Arabic-specific, multilingual |
| **Llama 3 8B** | ⚡ Medium | 9 SAR/hr | Reasoning, complex tasks |
| **Nemotron Super 70B** | 🧠 Best | 45 SAR/hr | Enterprise, high accuracy |
| **SDXL** | 🖼️ Image | 12 SAR/hr | Image generation |

**Pro Tip:** Start with Mistral 7B (best price-to-quality ratio)

---

## Cost Breakdown

### Your 50 SAR Test Credit Covers:

| Scenario | Cost | Coverage |
|----------|------|----------|
| Mistral 7B, 100 tokens | 0.022 SAR | ~2,272 jobs |
| Llama 3 8B, 100 tokens | 0.025 SAR | ~2,000 jobs |
| Qwen 2.5, 100 tokens | 0.025 SAR | ~2,000 jobs |
| SDXL image, 768x768 | 0.10 SAR | ~500 images |

**In Plain Language:** Your 50 SAR credit can run hundreds of inference jobs.

### Get More Credit

**Option 1: Use Your Credit + Pay**
1. Go to Dashboard → Billing
2. Add credit card (one-time)
3. Pay as you go (only charged for jobs you run)

**Option 2: Tier-Based Discounts**
- Spend 100 SAR → Get 10% discount
- Spend 1,000 SAR → Get 20% discount
- Enterprise → Get custom pricing

---

## Common Use Cases

### Case 1: Extract Information
```
Prompt: Extract the main facts from this text: [insert text]
Model: Mistral 7B
Cost: ~0.01 SAR
```

### Case 2: Write Code
```
Prompt: Write a Python function that [your requirement]
Model: Mistral 7B
Cost: ~0.02 SAR
```

### Case 3: Translate
```
Prompt: Translate to Arabic: [English text]
Model: Qwen 2.5 (better for Arabic)
Cost: ~0.02 SAR
```

### Case 4: Classify Text
```
Prompt: Classify this email as: urgent, normal, or spam: [email]
Model: Nemotron Nano (fastest)
Cost: ~0.001 SAR
```

### Case 5: Generate Images
```
Prompt: Generate an image of [description]
Model: SDXL
Cost: ~0.10 SAR per image
```

---

## Advanced: Batch Processing (Save 40%)

If you have lots of jobs, submit them as a batch overnight—**40% cheaper**:

```bash
# Create batch file (one job per line)
cat > jobs.jsonl << EOF
{"model": "mistral-7b", "prompt": "Explain climate change"}
{"model": "mistral-7b", "prompt": "What is machine learning?"}
{"model": "mistral-7b", "prompt": "How does photosynthesis work?"}
EOF

# Submit batch
curl -X POST https://api.dcp.sa/api/dc1/jobs/batch \
  -H "x-renter-key: $DCP_KEY" \
  -H "Content-Type: application/jsonl" \
  --data-binary @jobs.jsonl
```

Results available in morning (usually 2-4 hours). **40% cheaper than real-time.**

---

## Troubleshooting

### Job Failed / "Provider Offline"
This means the provider went offline mid-job.
- ✅ You get **full refund** automatically
- ✅ Resubmit and try again
- Typical success rate: 99.5%+

### Job Took Too Long
If a job takes >5 minutes:
- ✅ Auto-timeout occurs
- ✅ You get **full refund**
- Try a faster model (Nemotron Nano, Mistral) next time

### API Key Not Working
```bash
# Verify key is correct
curl https://api.dcp.sa/api/dc1/renters/verify-key \
  -H "x-renter-key: $DCP_KEY"

# Response: {"status": "valid"} or {"error": "invalid key"}
```

If invalid:
1. Go to Dashboard → Settings → API Keys
2. Delete old key, create new one
3. Copy new key and try again

**Contact:** support@dcp.sa if issues persist

### Running Out of Credit
Your 50 SAR credit expires in 7 days. To keep going:
1. Go to Dashboard → Billing
2. Add credit card (secure, we don't store details)
3. Spend 100 SAR → unlock 10% discount

---

## API Documentation

### Full Reference
- Detailed API docs: https://dcp.sa/docs/api
- Code examples: https://github.com/dhnpmp-tech/dcp-sdk-examples
- Python SDK: `pip install dc1-renter-sdk`
- JavaScript SDK: `npm install @dhnpmp-tech/dcp-renter-sdk`

### Quick Reference

**Submit Job:**
```bash
curl -X POST https://api.dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: YOUR_KEY" \
  -d '{"model": "mistralai/Mistral-7B-Instruct-v0.3", "prompt": "Hello"}'
```

**Check Status:**
```bash
curl https://api.dcp.sa/api/dc1/jobs/JOB_ID \
  -H "x-renter-key: YOUR_KEY"
```

**Get Results:**
```bash
curl https://api.dcp.sa/api/dc1/jobs/JOB_ID/output \
  -H "x-renter-key: YOUR_KEY"
```

**List Your Jobs:**
```bash
curl https://api.dcp.sa/api/dc1/renters/jobs \
  -H "x-renter-key: YOUR_KEY"
```

---

## Scaling Up

### When You're Ready to Run More Jobs

**Option 1: Real-Time Inference**
- Use the API for on-demand jobs
- Cost: Standard rates (8-45 SAR/hr depending on model)

**Option 2: Batch Processing**
- Submit 100s of jobs at once
- Run overnight (2-4 hour turnaround)
- **40% cheaper** than real-time

**Option 3: Reserved Capacity**
- Need guaranteed latency?
- Reserve a provider exclusively
- Base fee + usage charges
- Email enterprise@dcp.sa for quote

**Option 4: Enterprise**
- >1000 SAR/month volume?
- Get 20-40% discounts
- Dedicated account manager
- SLA guarantees
- Email enterprise@dcp.sa

---

## Security Best Practices

### Protect Your API Key
- ✅ Use environment variables: `export DCP_KEY=sk_renter_...`
- ✅ Don't commit to GitHub: Add `.env` to `.gitignore`
- ✅ Don't share in emails or chat
- ✅ Rotate keys periodically

### Protect Your Account
- ✅ Use strong password (12+ characters)
- ✅ Enable 2FA on your email (for recovery)
- ✅ Monitor billing (check for unusual charges)

### Privacy
- Your job data is private (other users can't see it)
- Your prompts are not used for training
- You can delete your job history anytime
- Read Privacy Policy: https://dcp.sa/legal/privacy

---

## FAQ

**Q: Is my test credit really free?**
A: Yes. 50 SAR free credit, no payment required. Expires in 7 days if not used.

**Q: Can I run jobs while sleeping?**
A: Yes. Submit jobs anytime, they run 24/7. Most jobs complete in <1 minute.

**Q: What if I run out of credit mid-job?**
A: Job is cancelled and refunded. You need to add credit to run more.

**Q: Can I run proprietary models?**
A: Only open-source models available (Mistral, Llama, Qwen, Nemotron, SDXL). No GPT-4, Claude, etc.

**Q: Is my data safe?**
A: Yes. Data stored in Saudi Arabia, encrypted in transit and at rest, PDPL compliant. See Privacy Policy.

**Q: How do I export my job history?**
A: Dashboard → Settings → Export Data. Get CSV of all jobs.

**Q: Can I use this for production?**
A: Yes. DCP is production-ready. 99% uptime SLA. See Terms of Service.

**Q: What if I want higher accuracy?**
A: Use Nemotron Super 70B (best model, higher cost) or fine-tune models (Phase 2).

**Q: How does billing work exactly?**
A: Per-token metering. You're charged for actual compute time (no hidden fees). See invoice for breakdown.

---

## Next Steps

1. **Register:** https://dcp.sa/renter/register
2. **Log In:** https://dcp.sa/login
3. **Get API Key:** Dashboard → Settings → API Keys
4. **Submit Job:** Dashboard → Playground
5. **Check Results:** Dashboard → Recent Jobs

**Questions?** Email support@dcp.sa
**Issues?** Check Troubleshooting section above
**Ready to scale?** Email enterprise@dcp.sa

---

**Time from now to first result:** ~10 minutes (including account creation)
