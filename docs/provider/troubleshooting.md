# Provider Troubleshooting Guide

Quick solutions to common issues when running a DCP provider. For each problem, try solutions in order.

---

## Problem: Provider Shows Offline

**Symptom:** Dashboard shows "OFFLINE" (red) after starting the agent. Provider registered but not accepting jobs.

### Solution 1: Check Network Connectivity

Verify DCP API is reachable:
```bash
curl -v https://api.dcp.sa/health
```

Expected: `HTTP/1.1 200 OK`

If not:
- Check firewall allows outbound HTTPS (port 443)
- Check ISP hasn't blocked api.dcp.sa
- Verify static IP is correct in registration

### Solution 2: Verify Provider API Key

Check your `.env` file has correct key:
```bash
# Make sure the key is present and >40 characters
grep "^DC1_PROVIDER_KEY=" .env | cut -c1-20...

# Test the key
curl -H "Authorization: Bearer $(grep DC1_PROVIDER_KEY .env | cut -d= -f2)" \
  https://api.dcp.sa/api/providers/me/status
```

If you get `401 Unauthorized`:
- Key is invalid or expired
- Go to dashboard → Settings → Regenerate API Key
- Update `.env` with new key
- Restart agent: `pm2 restart dc1-provider`

### Solution 3: Check Agent Logs

```bash
# View last 100 lines of provider logs
pm2 logs dc1-provider --lines 100

# Look for errors like:
# - "ECONNREFUSED" → Cannot reach API
# - "401 Unauthorized" → Invalid key
# - "ETIMEDOUT" → Network timeout
```

### Solution 4: Restart the Agent

```bash
# Stop
pm2 stop dc1-provider

# Wait 5 seconds
sleep 5

# Start
pm2 start dc1-provider

# Wait 10 seconds for heartbeat
sleep 10

# Check status
curl -H "Authorization: Bearer YOUR_KEY" \
  https://api.dcp.sa/api/providers/me/status | jq .status
```

If still offline after 2 minutes, escalate to support@dcp.sa with logs.

---

## Problem: "CUDA out of memory" Errors

**Symptom:** Jobs fail with `RuntimeError: CUDA out of memory` or `torch.cuda.OutOfMemoryError`.

### Solution 1: Reduce GPU Memory Utilization

Edit `.env`:
```env
# Current
VLLM_GPU_MEMORY_UTILIZATION=0.8

# Try this instead
VLLM_GPU_MEMORY_UTILIZATION=0.7
```

Restart:
```bash
pm2 restart dc1-provider
```

### Solution 2: Check Available GPU Memory

```bash
nvidia-smi

# Look at the "Memory-Usage" line
# Should show available memory

# Example:
# Memory-Usage: 15234 MiB / 24576 MiB
#               (15GB used out of 24GB)
```

If >90% used, reduce utilization further:
```env
VLLM_GPU_MEMORY_UTILIZATION=0.6
```

### Solution 3: Limit Concurrent Requests

```env
# Limit to 1 request at a time
VLLM_MAX_PARALLEL_LOADING_WORKERS=1

# Or use tensor parallelism if you have multiple GPUs
VLLM_TENSOR_PARALLEL_SIZE=2
```

### Solution 4: Disable PagedAttention

For older GPUs or if memory issues persist:
```env
VLLM_ENABLE_PAGED_ATTENTION=false
```

**Performance impact:** May reduce throughput by 10-20%, but eliminates OOM errors.

---

## Problem: Model Download Stuck or Very Slow

**Symptom:** Agent starts, tries to download models, but gets stuck or downloads very slowly.

### Solution 1: Check Disk Space

```bash
# Check /mnt/models directory
df -h /mnt/models

# Should show >100GB available
# Example output:
# Filesystem     Size  Used Avail Use%
# /dev/sda1     1.0T  200G  800G  20%

# If <10GB available, delete old model cache:
rm -rf /mnt/models/models--*
```

### Solution 2: Check Internet Speed

```bash
# Install speedtest tool
pip install speedtest-cli

# Run speed test
speedtest-cli

# Expected: >50 Mbps download
# If <20 Mbps, DCP provider not recommended
```

### Solution 3: Cancel and Retry Download

```bash
# Stop provider
pm2 stop dc1-provider

# Clear partial downloads (only .tmp files)
find /mnt/models -name "*.tmp" -delete
find /mnt/models -name "*partial*" -delete

# Restart
pm2 start dc1-provider

# Monitor progress
tail -f /mnt/models/download.log 2>/dev/null || pm2 logs dc1-provider
```

### Solution 4: Download Models Manually (Faster)

For the first time setup, pre-downloading models is faster:

```bash
# Pre-download key models
docker run --rm \
  -v /mnt/models:/models \
  -e HF_HOME=/models \
  -e TRANSFORMERS_CACHE=/models \
  ghcr.io/vllm-project/vllm:latest \
  python -c "
from transformers import AutoTokenizer, AutoModelForCausalLM
models = ['meta-llama/Llama-2-8b-hf', 'Qwen/Qwen2-7B-Instruct']
for m in models:
    print(f'Downloading {m}...')
    AutoTokenizer.from_pretrained(m)
    AutoModelForCausalLM.from_pretrained(m)
"
```

This pre-caches models, so the agent starts faster.

---

## Problem: Heartbeat Rejected (401 Error)

**Symptom:** Logs show repeated "Error: Heartbeat rejected (401 Unauthorized)"

### Solution 1: Verify API Key Format

```bash
# Extract key from .env
KEY=$(grep "^DC1_PROVIDER_KEY=" .env | cut -d= -f2)

# Key should be 'sk-provider-...' format, >40 characters
echo "Key: $KEY" | wc -c
# Should output: 50+ (including newline)
```

If key is malformed:
1. Go to https://dcp.sa/dashboard
2. Settings → API Keys
3. Regenerate → Copy new key
4. Update `.env`
5. Restart agent

### Solution 2: Check API URL

```bash
# Verify .env has correct URL
grep "^DC1_API_URL=" .env
# Should output: DC1_API_URL=https://api.dcp.sa
```

If wrong, fix it:
```env
# Must be HTTPS (not HTTP)
# Must include /api path for some endpoints
DC1_API_URL=https://api.dcp.sa
```

Restart:
```bash
pm2 restart dc1-provider
```

### Solution 3: Check Provider Exists in System

Your provider must be registered before the agent can authenticate:

```bash
# Verify registration
curl -s https://api.dcp.sa/api/providers/status \
  -H "Authorization: Bearer $KEY" | jq .

# Should return your provider info
# If 404, you need to complete registration first
```

Go back to activation-guide.md Step 1 if not registered.

---

## Problem: Jobs Accepted But Never Start

**Symptom:** Dashboard shows jobs assigned to your provider, but they never execute. Status stays "PENDING".

### Solution 1: Check if Agent Can Reach Renter

Jobs require bidirectional communication:

```bash
# Agent needs to pull jobs AND accept inbound connections
# Check if port 8000 is open (default vLLM port)

# From external machine:
nc -zv YOUR_PUBLIC_IP 8000
# Should show: Connected (if port open)

# If not, your firewall is blocking:
# - Open port 8000-8010 on your router/firewall
# - Check ISP doesn't block these ports
# - Use DDNS if you don't have static IP
```

### Solution 2: Verify Model is Downloaded

```bash
# Check if the requested model is available
curl -H "Authorization: Bearer YOUR_KEY" \
  https://api.dcp.sa/api/providers/me/status | jq .modelsReady

# Example output:
# "modelsReady": ["llama3-8b", "qwen25-7b"]

# If model not in list, it's still downloading
# Wait for download to complete (can take 30+ minutes)
```

Monitor progress:
```bash
du -sh /mnt/models/
# Watch size increase as model downloads
```

### Solution 3: Check Job Request Format

Some job formats might not be supported. View recent job attempts:

```bash
# Check agent logs for job errors
pm2 logs dc1-provider --lines 200 | grep -i "job\|error"

# Look for patterns like:
# - "Model not found"
# - "Invalid request format"
# - "Timeout waiting for job response"
```

Contact support@dcp.sa with job ID if error persists.

### Solution 4: Increase Job Accept Timeout

Edit `.env`:
```env
JOB_REQUEST_TIMEOUT=120  # Wait up to 2 minutes for job request
```

Restart:
```bash
pm2 restart dc1-provider
```

---

## Problem: Very High VRAM Usage (Near Max)

**Symptom:** `nvidia-smi` shows GPU memory is 95-100% full, even when no jobs running.

### Solution 1: Clear Model Cache

```bash
# Stop provider
pm2 stop dc1-provider

# Clear only unused models
rm -rf /mnt/models/models--meta-llama*  # Clear Llama cache
rm -rf /mnt/models/models--Qwen*        # Clear Qwen cache

# Keep only active models in .env
nano .env
# Edit DEFAULT_MODELS to only your most-used models

# Restart
pm2 start dc1-provider
```

### Solution 2: Disable Model Caching

```env
# Only load model when needed, unload after job
VLLM_ENABLE_MODEL_CACHING=false
```

This trades latency for memory (models load slower).

### Solution 3: Use Smaller Models

```env
# Instead of 13B models, use 8B or 7B
DEFAULT_MODELS=llama3-8b,qwen25-7b,nemotron-nano-4b
```

Smaller models = less VRAM used.

---

## Problem: Agent Crashes on Startup

**Symptom:** Agent starts briefly then exits. Logs show a crash error.

### Solution 1: Check Node.js and Dependencies

```bash
# Verify Node version
node --version  # Should be v18+

# Reinstall dependencies
cd provider-agent
npm ci  # Clean install (faster than npm install)

# Start in foreground to see errors
npm start
```

Look for errors like:
- `Cannot find module 'vllm'` → Run `npm ci`
- `ENOENT: no such file` → Check file paths in .env

### Solution 2: Clear Cache and Restart

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules

# Reinstall
npm ci

# Restart
pm2 restart dc1-provider
```

### Solution 3: Check Disk Space

```bash
df -h /
# Must have >5GB free for node_modules + model cache

# If full, delete old models:
rm -rf /mnt/models/models--old-model-name*
```

---

## Problem: GPU Driver Issues

**Symptom:** `nvidia-smi` fails or shows "Driver not installed" or "Could not open shared object file".

### Solution 1: Check Driver Version

```bash
nvidia-smi
# Should show:
# NVIDIA-SMI 545.29.06    Driver Version: 545.29.06

# If command not found:
sudo apt update
sudo apt install nvidia-driver-545
sudo reboot
```

### Solution 2: Reinstall NVIDIA Drivers

```bash
# Completely remove old drivers
sudo apt remove --purge nvidia*
sudo apt clean

# Reinstall
sudo apt update
sudo apt install nvidia-driver-545 nvidia-utils

# Verify
nvidia-smi
```

### Solution 3: Fix CUDA Library Path

If `nvidia-smi` works but Docker GPU access fails:

```bash
# Check NVIDIA Container Runtime is installed
which nvidia-container-runtime
# Should output: /usr/bin/nvidia-container-runtime

# If not installed:
sudo apt install nvidia-container-toolkit
sudo systemctl restart docker

# Test Docker GPU access
docker run --rm --gpus all nvidia/cuda:12.1.0-runtime-ubuntu22.04 nvidia-smi
```

---

## Problem: "Port Already in Use" Error

**Symptom:** Error message like "Port 8000 is already in use" or "Address already in use".

### Solution 1: Find What's Using the Port

```bash
# Find process on port 8000
sudo lsof -i :8000
# Or:
ss -tlnp | grep 8000

# Example output:
# LISTEN  1234/python  ← Process ID 1234 is using port 8000
```

### Solution 2: Kill the Process

```bash
# Stop the offending process
kill -9 1234

# Or if it's DC1 provider:
pm2 kill  # Kill all PM2 processes
pm2 start ecosystem.config.js
```

### Solution 3: Use Different Port

If another service needs port 8000, use a different port:

```env
VLLM_PORT=8001  # Use port 8001 instead
```

Then update your job submission requests to use the new port.

---

## Problem: Job Completes But Result Doesn't Return

**Symptom:** Job runs (you see it in logs), but renter reports timeout or no response.

### Solution 1: Check Network Connectivity

```bash
# Verify renter can reach your server
ping YOUR_PUBLIC_IP
nmap -p 8000 YOUR_PUBLIC_IP  # Check if port is open
```

If port is closed, open it on your firewall.

### Solution 2: Check Response Format

```bash
# Your agent might be sending malformed JSON
pm2 logs dc1-provider --lines 100 | grep -i "response\|json"

# Common issues:
# - Missing Content-Type header
# - Invalid JSON syntax
# - Truncated response
```

### Solution 3: Increase Response Timeout

```env
JOB_RESPONSE_TIMEOUT=300  # Wait up to 5 minutes for completion
```

Restart:
```bash
pm2 restart dc1-provider
```

---

## Getting Help

If none of these solutions work:

1. **Collect Diagnostics:**
   ```bash
   # Run diagnostic script
   curl -fsSL https://dcp.sa/diagnostics.sh | bash
   ```

2. **Include in Support Request:**
   - Provider ID: `grep PROVIDER_ID .env`
   - Last 200 logs: `pm2 logs dc1-provider --lines 200 > logs.txt`
   - System info: `uname -a && nvidia-smi`
   - Error message (exact)
   - When it started happening

3. **Contact Support:**
   - Email: providers@dcp.sa
   - Discord: https://discord.gg/dcp #provider-support
   - Dashboard: Help → File Support Ticket

---

## Preventive Maintenance

### Daily
- Check provider status: `curl https://api.dcp.sa/api/providers/me/status`
- Monitor GPU temperature: `nvidia-smi dmon`

### Weekly
- Check disk usage: `df -h /mnt/models`
- Review earnings: Dashboard → Earnings
- Check for updates: `cd provider-agent && git pull`

### Monthly
- Update NVIDIA drivers: `sudo apt update && sudo apt upgrade`
- Clear old model cache: `du -sh /mnt/models && rm -rf /mnt/models/models--old*`
- Review logs for warnings: `pm2 logs dc1-provider --lines 1000`

---

**Last Updated:** 2026-03-24
**Status:** Production Ready
**Support Email:** providers@dcp.sa
