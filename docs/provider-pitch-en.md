# Earn SAR from Your Idle GPU — DCP Provider Pitch

*DCP — Saudi Arabia's First Decentralized GPU Compute Marketplace*

---

## Your GPU Is Sitting Idle. It Shouldn't Be.

Every hour your NVIDIA GPU isn't running a job, it's earning nothing. DCP connects your hardware to AI engineers and ML researchers across Saudi Arabia who need GPU compute — and pays you in SAR for every hour your machine runs a job.

**No crypto. No technical complexity. Just Saudi Riyals in your bank account.**

---

## How It Works — 3 Steps

### Step 1 — Register (2 minutes)
Go to **[dcp.sa/provider/register](https://dcp.sa/provider/register)**. Enter your name, email, and GPU model. You'll receive your Provider API Key instantly.

### Step 2 — Install the Daemon (5 minutes)
Download and run the DCP daemon — a lightweight Python script that runs in the background. It sends a heartbeat every 30 seconds and executes jobs inside isolated Docker containers on your GPU.

```bash
# Linux / macOS
curl -fsSL https://dcp.sa/api/providers/download/daemon?key=YOUR_KEY -o dc1_daemon.py
python3 dc1_daemon.py

# Windows — run in PowerShell
irm https://dcp.sa/api/providers/download/setup?key=YOUR_KEY^&os=windows | iex
```

### Step 3 — Go Live and Start Earning
Your machine appears online in your provider dashboard within 2 minutes. Jobs arrive automatically when renters request your GPU specs. **You don't need to do anything else.**

---

## Earning Potential

> Providers keep **75%** of all job revenue. DCP takes a 25% platform fee.

| GPU Model | VRAM | DCP Rate | Your Cut | Est. Daily Earnings* |
|-----------|------|----------|----------|----------------------|
| RTX 3080  | 10 GB | 9 SAR/hr | 6.75 SAR/hr | ~81 SAR/day |
| RTX 3090  | 24 GB | 15 SAR/hr | 11.25 SAR/hr | ~150 SAR/day |
| RTX 4090  | 24 GB | 22 SAR/hr | 16.50 SAR/hr | ~200 SAR/day |
| A100      | 80 GB | 75 SAR/hr | 56.25 SAR/hr | ~675 SAR/day |
| H100      | 80 GB | 120 SAR/hr | 90 SAR/hr | ~1,080 SAR/day |

*\*Estimates based on ~12 hours of utilization per day (conservative). Full-time utilization doubles this.*

### Monthly Projections (RTX 3090, conservative estimate)

| Hours/Day | Monthly Earnings |
|-----------|-----------------|
| 8 hrs | ~2,700 SAR |
| 12 hrs | ~4,050 SAR |
| 24 hrs | ~8,100 SAR |

---

## DCP vs. Leaving Your GPU Idle vs. AWS

| | Your GPU Idle | AWS p3.2xlarge (V100) | DCP RTX 3090 |
|--|---------------|----------------------|--------------|
| Earnings | **0 SAR** | N/A (you pay AWS) | **11.25 SAR/hr** |
| Effort | None | Complex EC2 setup | 5-min install |
| Payout | None | None | Weekly IBAN |
| VRAM | 24 GB unused | 16 GB | 24 GB |
| Compliance | N/A | AWS ToS | Saudi-compliant |

AWS charges renters ~$3.06/hr (~11.5 SAR) for a V100 with only 16 GB VRAM. DCP's RTX 3090 offers more VRAM at a competitive rate — while **you earn SAR instead of paying AWS**.

---

## What Actually Runs on Your Machine

DCP uses Docker containers with NVIDIA Container Toolkit to isolate every job:

- **LLM Inference** — Large language model serving (Llama, Mistral, Qwen)
- **Image Generation** — Stable Diffusion and ComfyUI workloads
- **Model Training** — Fine-tuning adapter jobs (LoRA, QLoRA)

**What renters cannot do:**
- Access your filesystem outside the container
- Open a shell on your machine
- See your other running processes
- Access your network beyond what Docker allows

Every job runs in an ephemeral container that's destroyed after completion. Your machine, your data — stays yours.

---

## Getting Paid

- Earnings accumulate in real time in your **provider wallet**
- View balance and job history from your dashboard at **[dcp.sa/provider](https://dcp.sa/provider)**
- Payouts processed **weekly** via IBAN transfer to your Saudi bank account
- Minimum withdrawal: **50 SAR**
- Currency: **SAR** — no crypto, no PayPal, no friction

---

## FAQ — Top 10 Provider Questions

**1. Is my computer safe?**
Yes. Jobs run inside isolated Docker containers. Renters get GPU compute only — no shell access, no file access, no network access beyond what the job needs.

**2. What if I need my GPU back?**
You can pause job acceptance from your dashboard at any time. In-progress jobs complete first (typically under 30 minutes), then your machine goes offline.

**3. Do I need to be a developer?**
No. If you can run a Python script, you can run the DCP daemon. The installer handles everything on Windows.

**4. How are earnings calculated?**
Per job completion, in halala (1 SAR = 100 halala). Your dashboard shows real-time earnings, job count, and payout history.

**5. What are the minimum specs?**
Any NVIDIA GPU with ≥8 GB VRAM. Ubuntu 20.04+ or Windows 10/11. 100 Mbps internet. 50 GB free disk space. Docker + NVIDIA Container Toolkit.

**6. Can I run multiple GPUs?**
Yes. One daemon manages all GPUs on your machine. Each GPU earns independently.

**7. What happens if my internet cuts out?**
The daemon reconnects automatically. If a job fails mid-run, it's reassigned to another provider — renters aren't charged.

**8. How often are payouts?**
Weekly, directly to your Saudi bank account via IBAN. Minimum 50 SAR to trigger a payout.

**9. Are there taxes?**
Earnings from DCP are income from a service. Consult your tax advisor. DCP provides transaction records for your records.

**10. When can I set my own prices?**
Phase 4 (coming soon) introduces provider-controlled floor pricing. Early providers who join now get **founding provider rates** locked in before public launch.

---

## Ready to Start?

**Register now:** [dcp.sa/provider/register](https://dcp.sa/provider/register)

**Questions:** support@dcp.sa | [Hsoub.com](https://hsoub.com)

*DCP is Saudi Arabia's first decentralized GPU marketplace. Operated in compliance with Saudi financial regulations.*
