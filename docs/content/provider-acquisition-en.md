# How to Earn SAR with Your GPU — DC1 Provider Guide

*Published by DC1 | Saudi Arabia's GPU Compute Marketplace*

---

## What Is DC1?

DC1 is Saudi Arabia's first decentralized GPU compute marketplace — a platform that connects NVIDIA GPU owners with AI engineers, researchers, and developers who need compute power for machine learning workloads, image generation, and LLM inference. Instead of leaving your GPU idle, you register it with DC1 and earn Saudi Riyals every hour it runs a job. DC1 handles the job matching, billing, and payout — you just keep your machine online.

---

## How Much Can You Earn?

At the founding provider rate, DC1 pays **0.50 SAR per GPU per hour**. You keep **75%** of every job that runs on your hardware — DC1 takes a 25% platform fee.

| Scenario | GPUs | Hours/Day | Monthly Earnings |
|----------|------|-----------|-----------------|
| Single GPU (part-time) | 1 | 8 hrs | ~120 SAR |
| Single GPU (full-time) | 1 | 24 hrs | ~360 SAR |
| Rig (4 GPUs, full-time) | 4 | 24 hrs | ~1,440 SAR |
| Server (8 GPUs, full-time) | 8 | 24 hrs | ~2,880 SAR |

*Rates shown are founding rates. DC1 will move to market-rate pricing as liquidity grows.*

Earnings are calculated in **halala** (1/100 SAR) and settled weekly directly to your Saudi bank account via IBAN transfer.

---

## Requirements

Before you register, make sure your setup meets the minimum spec:

| Requirement | Minimum |
|-------------|---------|
| GPU | NVIDIA (any model with ≥8GB VRAM) |
| OS | Ubuntu 20.04 LTS or later |
| Internet | 100 Mbps symmetric or faster |
| Python | 3.8+ |
| Disk | 50GB free (for Docker images + job data) |
| Runtime | Docker + NVIDIA Container Toolkit |

**Recommended GPUs:** RTX 3080, RTX 3090, RTX 4080, RTX 4090, A100, H100. Anything with 8GB+ VRAM and CUDA support will work.

---

## Setup in 3 Steps

### Step 1 — Register

Go to [dcp.sa/provider/register](https://dcp.sa/provider/register) and fill in your details: name, email, GPU model, and VRAM. You'll receive your **provider API key** by email. Keep this safe — it authenticates your daemon and your dashboard access.

### Step 2 — Install the Daemon

The DC1 daemon (`dc1_daemon.py`) is a lightweight Python process that runs on your machine, sends heartbeats to DC1, and executes GPU jobs inside Docker containers.

**Linux / macOS:**
```bash
curl -O https://dcp.sa/daemon/dc1_daemon.py
pip install requests psutil
python dc1_daemon.py --key YOUR_PROVIDER_KEY
```

**Windows:**
Download the installer from [dcp.sa/download/installer](https://dcp.sa/download/installer) — it handles Python, the daemon script, and auto-start on login.

The daemon auto-updates itself when DC1 ships new versions. You only install once.

### Step 3 — Connect and Go Live

Once the daemon starts, it sends a heartbeat to DC1 every 30 seconds. Within 2 minutes your machine will appear as **online** in your provider dashboard at [dcp.sa/provider](https://dcp.sa/provider).

You're live. Jobs will start arriving automatically when renters request your GPU spec.

---

## Getting Paid

- Earnings accumulate in your **provider wallet** in real time as jobs complete
- You can view your balance and job history at any time from your dashboard
- Payouts are processed **weekly** via IBAN bank transfer (Saudi local bank accounts)
- Minimum withdrawal: 50 SAR

No crypto, no PayPal, no friction — just SAR into your Saudi bank account.

---

## FAQ

**Is my GPU safe?**
Yes. Jobs run inside isolated Docker containers. The daemon never gives renters shell access to your machine — only GPU compute inside a sandboxed environment. You can review which Docker images DC1 uses in the [provider docs](https://dcp.sa/docs/provider-guide).

**What jobs will run on my machine?**
AI inference workloads: large language model (LLM) serving, image generation (Stable Diffusion), and model training jobs. All jobs are vetted by DC1 before execution.

**How is pricing set?**
During the founding period, DC1 sets a flat rate of 0.50 SAR/GPU/hr. In Phase 4, providers will be able to set their own floor prices and market rates.

**What if my machine goes offline?**
The daemon detects network interruptions and reconnects automatically. If your machine goes offline during a job, DC1 reassigns the job to another provider — renters are not charged for failed jobs.

**Can I run multiple GPUs?**
Yes. A single daemon instance manages all GPUs in your machine. If you have 4× RTX 4090s, all four will be listed and earn independently.

**What about electricity costs?**
A typical NVIDIA RTX 4090 draws ~450W under full load. At Saudi electricity rates (~0.18 SAR/kWh for residential), that's ~0.08 SAR/hr — well within the 0.375 SAR/hr you earn (75% of 0.50 SAR). Most providers see a comfortable margin.

---

## Start Earning Today

Register at **[dcp.sa/provider/register](https://dcp.sa/provider/register)** — setup takes under 10 minutes.

Questions? Reach us at **support@dcp.sa** or join the discussion on [Hsoub.com](https://hsoub.com).

---

*DC1 is operated in Saudi Arabia. Provider payouts comply with Saudi financial regulations. GPU jobs are subject to DC1's acceptable use policy.*
