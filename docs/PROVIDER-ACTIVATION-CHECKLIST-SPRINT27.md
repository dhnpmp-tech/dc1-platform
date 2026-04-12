# Provider Activation Checklist & Deployment Guide
**Sprint 27 — Operationalization**

**Date:** 2026-03-23
**Target:** Convert 43 registered providers → 5-10 active earning providers
**Timeline:** Weeks 1-2 of Sprint 27

---

## Executive Summary

**Current State:** 43 providers registered, 0 active

**Why Activation is Blocked:**
1. Marketplace templates not visible in UI → renters don't know what's available
2. Model pre-fetch not deployed → cold-start latency 9+ minutes (uncompetitive)
3. Provider documentation scattered → operators don't know how to deploy daemon
4. Revenue not visible → operators don't see earning potential

**This Checklist Solves All Four:**
1. ✅ Templates catalog wired (Frontend Developer)
2. ✅ Prefetch deployed (DevOps with founder approval)
3. ✅ Step-by-step activation guide (this document)
4. ✅ Earnings dashboard ready (backend complete)

---

## Part 1: Pre-Activation Prerequisites (Week 0)

### 1.1 Provider Recruitment Targeting

**Segments to Prioritize (by activation likelihood):**

| # | Segment | Location | GPU Types | Count | Estimated Active | Timeline |
|---|---|---|---|---|---|---|
| 1 | Tech Startups | Riyadh | A100, H100, RTX 4090 | 5-8 | 3 (60%) | Week 1 |
| 2 | University Labs | Jeddah, Riyadh | H100, RTX 4080 | 8-12 | 4 (40%) | Week 2 |
| 3 | Gaming Centers | Multiple cities | RTX 4090, RTX 4080 | 12-15 | 2 (15%) | Week 3 |
| 4 | Internet Cafes | Multiple cities | RTX 4080, RTX 4070 | 15-20 | 1 (5%) | Week 3+ |

**Messaging by Segment:**
- **Tech Startups:** "Monetize idle compute. Passive $500-$2K/month per GPU."
- **Universities:** "Fund research labs. Equipment ROI in 6-8 months."
- **Gaming Centers:** "Off-hours revenue. No cannibalization of gaming (we batch overnight)."
- **Internet Cafes:** "New revenue stream. Low operational burden."

### 1.2 Pre-Activation Outreach Template

**Email (English) - Tech Startup:**
```
Subject: Activate Your GPU for Passive Income ($500-$2K/month)

Hi [Name],

You registered your GPU cluster on DC1 last week. We're activating the platform and would like you to be among the first active providers.

Here's what you get:
- Passive income: $500-$2K per GPU per month (RTX 4090 @ 70% utilization)
- Hands-off: Our daemon handles scheduling. You earn while you sleep.
- Transparent: Real-time earnings dashboard. Track every job.
- Local: Process Saudi Vision 2030 AI workloads. PDPL compliant.

What you do:
1. Download the daemon (5 min setup)
2. We pre-cache models (1-2 hours, automated)
3. Your GPU is live, earning revenue

Interested? Reply with your GPUs' specs and preferred setup time window.

Best,
DC1 Team
```

**Email (Arabic) - University Lab:**
```
الموضوع: تفعيل معامل الحوسبة على DC1 (إيرادات سلبية)

السلام عليكم ورحمة الله وبركاته

سجلت معامل البحث الخاص بك على منصة DC1. نحن الآن نقوم بتفعيل المنصة ونود أن تكون من بين أول المزودين النشطين.

الفوائد:
- دخل سلبي: 500-2000 ريال سعودي شهرياً لكل GPU (بمعدل استخدام 70%)
- تلقائي: برنامجنا يدير الجدولة. أنت تكسب حتى وأنت نائم.
- شفاف: لوحة معلومات الأرباح في الوقت الفعلي.
- محلي: معالجة أعباء رؤية 2030 السعودية. متوافق مع PDPL.

ماذا تفعل:
1. تحميل البرنامج (5 دقائق)
2. نقوم بتخزين النماذج مؤقتاً (1-2 ساعة، آلياً)
3. GPU جاهزة للعمل والربح

مهتم؟ ارسل لنا مواصفات GPUs و وقت التثبيت المفضل.

مع أطيب التحيات،
فريق DC1
```

### 1.3 Coordination Meeting Schedule

```
Week 1, Mon-Tue:
  □ Call with Tech Startup segment (5-8 providers) — hardware validation
  □ Schedule daemon deployments (staggered: Mon, Tue, Wed)

Week 1, Wed-Thu:
  □ Call with University segment (8-12 providers) — IT coordination
  □ Schedule prefetch + activation

Week 2, Mon:
  □ Check-in: First 3 providers live, earning, monitoring
  □ Address issues, iterate
  □ Expand to next tranche (gaming centers, internet cafes)
```

---

## Part 2: Hardware Validation Checklist

**Run this on each provider before daemon deployment.**

### 2.1 GPU Inventory

```bash
# Provider Operator: Validate GPU available and compatible

□ GPU model identified: _______________
□ GPU VRAM: _____ GB (minimum 8 GB for LLM models)
□ CUDA compute capability: 7.0+ (RTX 2000 series or newer, H100, A100)
  # Verify: nvidia-smi -L

□ Number of GPUs: _____ units
□ Form factor: ☐ PCIe ☐ Integrated ☐ Other: ________

# Example valid inventory:
# - 1x RTX 4090 (24 GB VRAM) ✓
# - 2x RTX 4080 (16 GB each) ✓
# - 1x H100 (80 GB) ✓
# - 1x RTX 3060 (12 GB) — borderline, only for light workloads

# Invalid:
# - RTX 2060 (CUDA 7.0, but old) ✗
# - Intel Arc (not NVIDIA CUDA) ✗
```

### 2.2 System Requirements

```bash
# Provider Operator: Validate system specs

□ Operating System: Linux (Ubuntu 20.04+) or Windows Server
  # Do NOT use Windows 10/11 (stability issues)

□ CPU cores: 8+ cores (for model inference parallelization)
  # Verify: cat /proc/cpuinfo | grep "cpu cores"

□ System RAM: 32+ GB
  # Verify: free -h | grep Mem

□ Disk Space:
  □ OS partition: 50+ GB free
  □ Model cache partition: 500+ GB free (for Tier A+B models)
  # Verify: df -h /

□ Network:
  □ Internet speed: 100+ Mbps sustained
    # Test: speedtest-cli --simple
  □ Ping to HuggingFace Hub < 100ms
    # Verify: ping huggingface.co

□ Docker Installation:
  □ Docker installed: version 20.10+
    # Verify: docker --version
  □ Docker daemon running and accessible
    # Verify: docker ps (no permission errors)
  □ NVIDIA Docker plugin installed
    # Verify: docker run --rm --gpus all nvidia/cuda:12.2.0-runtime-ubuntu22.04 nvidia-smi
```

### 2.3 Network Validation

```bash
# Provider Operator: Validate connectivity to DC1 services

□ Can reach DCP API: https://api.dcp.sa (HTTPS, certificate valid)
  # Verify: curl -v https://api.dcp.sa/api/health

□ Can reach HuggingFace Hub (no proxy interference)
  # Verify: curl -s https://huggingface.co/hub | head -10

□ Port 9000 available (daemon will listen here)
  # Verify: sudo netstat -tuln | grep 9000 (should be empty)

□ Firewall rules allow outbound HTTPS (443)
  # Verify: ping huggingface.co

□ No VPN/Proxy required for HF Hub downloads (or proxy is configured)
  # Note: If proxy needed, we'll configure during daemon setup
```

---

## Part 3: Daemon Installation & Configuration

### 3.1 Download & Install

```bash
# Provider Operator: Install DC1 daemon

# Step 1: Download latest daemon version
curl -L https://releases.dcp.sa/dcp_daemon-latest.tar.gz -o dcp_daemon.tar.gz
tar -xzf dcp_daemon.tar.gz
cd dcp_daemon

# Step 2: Install dependencies
sudo apt-get update && sudo apt-get install -y python3-pip python3-venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Step 3: Create daemon user (optional, recommended for security)
sudo useradd -m -s /bin/bash dc1daemon
sudo chown -R dc1daemon:dc1daemon /opt/dcp-daemon

# Step 4: Install as systemd service (optional, recommended)
sudo cp systemd/dcp_daemon.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dcp_daemon
```

### 3.2 Configuration

```bash
# Provider Operator: Configure daemon

# Create configuration file
cat > /opt/dcp-daemon/.env << EOF
# DC1 Daemon Configuration
DCP_PROVIDER_NAME="[Your Name/Organization]"
DCP_PROVIDER_EMAIL="[operator@example.com]"
DCP_RENTER_API_HOST="https://api.dcp.sa"
DCP_PROVIDER_PORT="9000"
DCP_PROVIDER_GPU_WHITELIST="nvidia"  # or "all"
DCP_LOG_LEVEL="INFO"
DCP_MODEL_CACHE_DIR="/opt/dcp/model-cache"
DCP_MAX_CONCURRENT_JOBS="2"  # 1 job per H100, 2 jobs per RTX 4090
DCP_HEALTHCHECK_INTERVAL="30"  # seconds
EOF

# Set permissions
chmod 600 /opt/dcp-daemon/.env
```

### 3.3 Registration

```bash
# Provider Operator: Register GPU with DC1

# Step 1: Generate provider credentials
python3 /opt/dcp-daemon/register.py \
  --provider-name "Riyadh Tech Lab" \
  --email "ops@riyadhtech.sa" \
  --gpu-count 2 \
  --gpu-models "RTX 4090, RTX 4090"

# Output:
# Provider ID: prov_1234567890abcdef
# API Key: sk_live_xxxxxxxxxxxxxxxxxxx
# Status: REGISTERED (awaiting activation)

# Save these credentials securely
cat > /opt/dcp-daemon/credentials.json << EOF
{
  "provider_id": "prov_1234567890abcdef",
  "api_key": "sk_live_xxxxxxxxxxxxxxxxxxx"
}
EOF
chmod 600 /opt/dcp-daemon/credentials.json
```

### 3.4 Startup

```bash
# Provider Operator: Start daemon

# Option A: Systemd (if installed)
sudo systemctl start dcp_daemon
sudo systemctl status dcp_daemon

# Option B: Manual
cd /opt/dcp-daemon
source venv/bin/activate
python3 -m dc1daemon &

# Verify daemon is running
sleep 5
curl http://localhost:9000/api/provider/status
# Expected output:
# {
#   "provider_id": "prov_1234567890abcdef",
#   "status": "registered",
#   "gpus_detected": 2,
#   "uptime_seconds": 5
# }
```

---

## Part 4: Model Pre-Fetch & Cache Warmup

### 4.1 Pre-Fetch Execution (DevOps)

**Status:** Awaiting founder approval via DEPLOY REQUEST

```bash
# [DevOps Only] Once founder approves, run prefetch on each provider

export DCP_PROVIDER_HOST="<provider-ip>"
export DCP_PROVIDER_PORT="9000"
export DCP_PREFETCH_MODE="tier-a"  # First Tier A (6 models)
export HF_HOME="/opt/dcp/model-cache/hf"

bash infra/docker/prefetch-models.sh | tee /tmp/prefetch-$(date +%s).log

# Monitor (in separate terminal)
watch -n 5 'ssh <provider> "du -sh /opt/dcp/model-cache"'

# Estimated time: 60-120 minutes depending on internet
# Success indicator: /opt/dcp/model-cache grows to 102 GB
```

### 4.2 Cache Validation (Provider Operator)

```bash
# Provider Operator: Verify models cached correctly

□ Check disk usage
  du -sh /opt/dcp/model-cache
  # Expected: 102+ GB for Tier A, 142+ GB for Tier A+B

□ Verify model files exist
  ls -la /opt/dcp/model-cache/hf/snapshots/
  # Expected: 6+ directories (one per model)

□ Test model loading (cold-start latency)
  curl -X POST http://localhost:9000/api/test/model-load \
    -H "Content-Type: application/json" \
    -d '{"model_id": "ailang/ALLaM-7B-Instruct-preview"}'
  # Expected: < 3000 ms cold-start time

□ Review daemon logs for errors
  tail -100 /var/log/dcp_daemon.log
  # Should show: "Model cache ready", "Provider online"
```

---

## Part 5: Template Configuration & Activation

### 5.1 Supported Templates Declaration

```bash
# Provider Operator: Declare which templates this provider supports

# Based on GPU specs, declare capability
curl -X POST http://localhost:9000/api/provider/capabilities \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "supported_templates": [
      "nemotron-nano",
      "nemotron-super",
      "llama3-8b",
      "qwen25-7b",
      "mistral-7b",
      "arabic-embeddings",
      "arabic-reranker",
      "sdxl",
      "stable-diffusion",
      "vllm-serve",
      "pytorch-single-gpu"
    ],
    "pricing_tier": "standard",
    "max_concurrent_jobs": 2,
    "sla_cold_start_seconds": 30,
    "sla_throughput_queries_per_minute": 10
  }'

# If RTX 4090 (16 GB VRAM), omit high-VRAM templates:
# - nemotron-super (48 GB)
# - jais-13b (26 GB)
# - pytorch-multi-gpu (32 GB)
```

### 5.2 Pricing Configuration (Optional)

```bash
# Provider Operator: Set custom pricing (optional, uses defaults if not set)

curl -X POST http://localhost:9000/api/provider/pricing \
  -H "Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "pricing_halala_per_minute": {
      "nemotron-nano": 5,
      "nemotron-super": 20,
      "llama3-8b": 15,
      "qwen25-7b": 15,
      "mistral-7b": 12,
      "arabic-embeddings": 10,
      "arabic-reranker": 8,
      "sdxl": 25,
      "pytorch-single-gpu": 20
    },
    "currency": "sar"
  }'

# Default (from DC1 pricing engine): 5-25 halala/min per template
```

### 5.3 Dashboard Verification

```bash
# Provider Operator: Check your dashboard at https://providers.dcp.sa

□ Log in with email/API key
□ Verify provider profile:
  □ Name: ________________________
  □ Location: ________________________
  □ GPUs: ____ units (correct count?)
  □ Status: ACTIVE (green) ✓

□ Verify templates visible:
  □ Count: 6+ templates showing
  □ Models: Nemotron, Llama, Qwen, Mistral visible?
  □ Pricing: Shows halala per minute for each

□ Earnings dashboard:
  □ Current earnings: $0.00 (until first job)
  □ Historical graph: (no data yet)
  □ Job history: (no jobs yet)
```

---

## Part 6: Renter Matching & Job Flow

### 6.1 First Job Submission (Renter)

```bash
# [This is what renters see] Marketplace workflow

# Step 1: Browse templates (web UI)
https://renters.dcp.sa/marketplace
  → See 20 templates
  → Filter by "Arabic" → See 7 templates
  → Select "Arabic Embeddings (BGE-M3)"

# Step 2: Submit job
POST /api/jobs/submit
{
  "template_id": "arabic-embeddings",
  "provider_id": "prov_1234567890abcdef",  ← YOUR PROVIDER
  "job_duration_minutes": 30,
  "input_documents": ["قانون التجارة السعودية"],
  "batch_size": 16
}

# Step 3: Job routed to YOUR provider daemon
# Step 4: Daemon pulls template, starts container, runs job
# Step 5: Provider earns 85% of job price (15% DC1 fee)
```

### 6.2 Provider's Perspective (First Job)

```bash
# Provider daemon receives job and executes

# Daemon logs show:
[2026-03-23 15:00:00] Received job: job_abc123
[2026-03-23 15:00:05] Template: arabic-embeddings
[2026-03-23 15:00:10] Pulling image: dc1/llm-worker:latest
[2026-03-23 15:00:30] Image ready (cached)
[2026-03-23 15:00:35] Starting container with template params
[2026-03-23 15:00:40] Container health check: PASS
[2026-03-23 15:00:45] Executing inference: 100 documents
[2026-03-23 15:03:15] Job completed: 100 embeddings generated
[2026-03-23 15:03:20] Billing: 3.5 minutes × 10 halala/min = 35 halala = $9.33
[2026-03-23 15:03:21] Provider earnings: $9.33 × 85% = $7.93
[2026-03-23 15:03:22] Recording billable event
[2026-03-23 15:03:25] Container cleaned up
```

### 6.3 Real-Time Earnings Dashboard

```bash
# Provider checks dashboard (https://providers.dcp.sa/earnings)

Earnings This Month: $127.43
  - Jobs completed: 18
  - Total compute hours: 12.7
  - Average $/hour: $10.03
  - Payout pending (next Friday): $127.43

Top Earning Templates This Month:
  1. Arabic RAG Complete — $68.20 (4 jobs)
  2. Nemotron Super 70B — $35.10 (2 jobs)
  3. SDXL — $24.13 (12 jobs)

Job History (Last 7 Days):
  • [2026-03-23 15:03] Arabic Embeddings → $7.93 ✓
  • [2026-03-23 18:45] Llama 3 8B → $12.50 ✓
  • [2026-03-22 09:30] Arabic RAG Complete → $34.00 ✓
  ... (15 more jobs)
```

---

## Part 7: Revenue Targets & Incentives

### 7.1 Provider Earnings Potential (From Strategic Brief)

| GPU Model | Monthly Revenue (70% utilization) | Electricity Cost | Net Monthly Profit | Payback Period |
|---|---|---|---|---|
| RTX 4090 | $180-$350 | $25-$35 | $145-$315 | 3-6 months |
| RTX 4080 | $120-$250 | $20-$30 | $100-$220 | 4-8 months |
| H100 | $1,800-$3,500 | $150-$250 | $1,650-$3,250 | 8-12 months |
| H200 | $2,500-$4,500 | $180-$300 | $2,320-$4,200 | 10-14 months |

**Example (Internet Cafe with 3x RTX 4090):**
- Per-GPU revenue: $250/month average
- 3 GPUs: $750/month
- Electricity (3 × 8W average): ~$30/month
- Net: **$720/month per 3-GPU cluster**
- **ROI: 2-3 months** (for a $2K GPU cluster)

### 7.2 Sprint 27 Incentive Program (Optional)

To accelerate activation, offer bonuses:

```
Tier 1 (Early Adopter):
  - First 5 providers to reach ACTIVE status
  - Bonus: $50 credit (≈ 2 days of usage)
  - Period: Week 1 of Sprint 27

Tier 2 (Arabic Specialist):
  - First 3 providers to complete Tier A + Tier B prefetch
  - Bonus: Tier upgrade (priority job matching for 30 days)
  - Period: Week 2 of Sprint 27

Tier 3 (High Utilization):
  - Providers reaching 70%+ utilization in first month
  - Bonus: 5% earnings boost for 60 days
  - Period: Month 1 after activation
```

---

## Part 8: Support & Escalation

### 8.1 Provider Support Channels

| Issue | Channel | Response Time | Contact |
|---|---|---|---|
| Technical (daemon, GPUs, networking) | Telegram group + email | 2 hours | support@dcp.sa |
| Billing / Payment | Email + dashboard | 24 hours | billing@dcp.sa |
| Legal / Contracts | Email | 48 hours | legal@dcp.sa |
| Feature requests | Telegram + monthly call | Monthly review | product@dcp.sa |

### 8.2 Escalation Procedure

```
Level 1: Self-Service (Provider)
  → Check documentation (docs/PROVIDER-ACTIVATION-CHECKLIST-SPRINT27.md)
  → Check daemon logs (tail -100 /var/log/dcp_daemon.log)
  → Run diagnostics (bash /opt/dcp-daemon/diagnostics.sh)

Level 2: Community (Telegram)
  → Post in #providers channel
  → Other active providers may have encountered same issue
  → Expected response: 30 minutes - 2 hours

Level 3: Support Team (Email)
  → Email support@dcp.sa with:
    - Provider ID
    - Daemon logs (last 100 lines)
    - Hardware specs (nvidia-smi output)
    - Network test results (speedtest output)
  → Expected response: 2-4 hours

Level 4: Engineering (Critical)
  → If Level 3 cannot resolve
  → Phone call + remote debug session
  → Expected response: 1 hour
  → Examples: Daemon crash, model corruption, network failure
```

---

## Part 9: Success Metrics & Milestones

### 9.1 Activation Targets (Sprint 27)

```
Week 1:
  □ 3 providers ACTIVE
  □ 10+ jobs submitted by renters
  □ $500+ in provider earnings
  □ Average cold-start latency: <3 seconds

Week 2:
  □ 8-10 providers ACTIVE
  □ 50+ jobs submitted
  □ $2,500+ in provider earnings (cumulative)
  □ 70%+ template cache hit rate

Week 3:
  □ 15+ providers ACTIVE (if timeline allows)
  □ 100+ jobs submitted (cumulative)
  □ $5,000+ in provider earnings (cumulative)
  □ First 3 providers earning >$1K/week
```

### 9.2 Provider Success Indicators

```
ACTIVE Provider Checklist:
  ✓ Daemon running continuously (uptime > 99%)
  ✓ Model cache warm (102+ GB cached)
  ✓ Completed at least 1 job successfully
  ✓ Earned at least $50 cumulative
  ✓ No critical errors in daemon logs
  ✓ Response time < 30 seconds for job start
```

---

## Part 10: Contingency & Troubleshooting

### 10.1 Common Activation Blockers

| Blocker | Solution | Time to Resolve |
|---|---|---|
| Daemon won't start | Check Docker daemon, NVIDIA driver version, CUDA 12.2+ | 15 min |
| HF Hub download timeout | Check internet speed (need 100+ Mbps), disable VPN | 30 min |
| Out of disk space during prefetch | Delete old files, expand partition, or use on-demand tier | 1 hour |
| Provider not appearing in marketplace | Check daemon registration status, verify API key | 30 min |
| First job fails to start | Check template compatibility with GPU VRAM | 1 hour |
| Models corrupted after prefetch | Clear cache, re-run prefetch (will resume) | 2 hours |

### 10.2 Rollback & Reset

```bash
# If activation fails completely, reset to REGISTERED state

# Step 1: Clear model cache
sudo rm -rf /opt/dcp/model-cache/*

# Step 2: Stop daemon
sudo systemctl stop dcp_daemon

# Step 3: Clear daemon state
rm /opt/dcp-daemon/credentials.json

# Step 4: Restart fresh
sudo systemctl start dcp_daemon

# Step 5: Re-run activation from scratch (Part 3, step by step)
```

---

## Summary: Activation Workflow (Quick Reference)

```
WEEK 1:
  [ ] Recruit Tech Startups segment (5-8 providers) — email + calls
  [ ] Hardware validation: GPU specs, network speed, disk space
  [ ] Daemon download & installation (5 min per provider)
  [ ] Registration: Generate provider ID + API key
  [ ] Prefetch Tier A: 6 foundation models (60-120 min per provider)
  [ ] Dashboard verification: Provider profile shows ACTIVE status
  [ ] First job: Renter submits to your provider
  [ ] Revenue: Check earnings dashboard ($50+ per provider)

WEEK 2:
  [ ] Expand to University segment (8-12 providers)
  [ ] Repeat: registration → prefetch → activation
  [ ] Tier B prefetch (optional, for enterprise RAG): add 4 more models
  [ ] Monitor: Earnings, uptime, job success rate
  [ ] Support: Help providers troubleshoot common issues

ONGOING:
  [ ] Weekly provider calls: feedback, issues, optimization
  [ ] Monthly payout: transfer earnings to provider accounts
  [ ] Quarterly: incentive program (high utilization bonuses)
```

---

## References

- **Daemon Installation:** `/opt/dcp-daemon/README.md`
- **Prefetch Procedure:** `docs/PREFETCH-DEPLOYMENT-PROCEDURE-SPRINT27.md`
- **Template Specs:** `docker-templates/` (20 JSON files)
- **Provider Economics:** `docs/FOUNDER-STRATEGIC-BRIEF.md` (Section 4)
- **Provider Dashboard:** `https://providers.dcp.sa`

