# Provider Activation Guide

**Last Updated:** 2026-03-24
**Target Audience:** GPU providers (internet cafes, university labs, server farms)
**Estimated Time:** 30-45 minutes

## Overview

Welcome to the DCP provider program! This guide walks you through registering your GPU hardware and activating your first compute job on the DCP marketplace.

**What You'll Need:**
- Ubuntu 22.04 LTS (or compatible Linux distribution)
- NVIDIA GPU: RTX 3090 minimum, RTX 4090 recommended
- CUDA 12.1+ installed and verified
- Docker with nvidia-container-toolkit
- 100 Mbps+ stable internet connection
- Static IP address or reliable DDNS
- 100GB+ free disk space (for model cache)
- 2GB+ free RAM (minimum, 32GB+ recommended)

---

## Step 1: Register Your Provider Account

If you haven't already created a provider account:

1. Navigate to **https://dcp.sa/providers**
2. Click **"Register New Provider"**
3. Fill in the registration form:
   - **Provider Name:** Your organization/company name
   - **Contact Email:** Operational contact for alerts and support
   - **Location:** Country/Region (used for latency optimization)
   - **Primary GPU Model:** RTX 4090, RTX 4080, RTX 3090, or other
   - **Static IP Address:** Your server's public IP (or DDNS hostname if using dynamic IP)
   - **Available Bandwidth:** Upload/download speed in Mbps

4. Submit the form
5. You'll receive a **Provider API Key** via email within 5-10 minutes
6. Keep this key secure — you'll need it in Step 3

**Example Registration:**
```
Provider Name: "University AI Lab"
Location: "Saudi Arabia - Riyadh"
GPU Model: RTX 4090 (2x)
Static IP: 203.0.113.42
Bandwidth: 200 Mbps
```

---

## Step 2: Prepare Your System

### 2.1 Verify NVIDIA GPU

First, verify your GPU is installed and recognized:

```bash
nvidia-smi
```

Expected output:
```
+-------------------------------------+
| NVIDIA-SMI 545.29.06 | Driver Version: 545.29.06 |
| GPU Name | Compute SM | Memory |
|==========================+=============|
| NVIDIA RTX 4090 | 8.9 | 24GB |
+-------------------------------------+
```

If you don't see your GPU, install the NVIDIA driver:
```bash
sudo apt update
sudo apt install nvidia-driver-545
sudo reboot
```

### 2.2 Install CUDA 12.1+

```bash
# Download CUDA 12.1 for Ubuntu 22.04
wget https://developer.download.nvidia.com/compute/cuda/12.1.0/local_installers/cuda_12.1.0_530.30.02_linux.run

# Install
sudo sh cuda_12.1.0_530.30.02_linux.run --silent --driver

# Set environment variables
echo 'export PATH=/usr/local/cuda/bin:$PATH' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc

# Verify
nvcc --version
```

### 2.3 Install Docker & NVIDIA Container Runtime

```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# Verify GPU access in Docker
docker run --rm --gpus all nvidia/cuda:12.1.0-runtime-ubuntu22.04 nvidia-smi
```

### 2.4 Install Node.js 18+

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Should be v18.x or higher
npm --version   # Should be v9.x or higher
```

---

## Step 3: Install DC1 Provider Agent

The provider agent runs on your system and accepts compute jobs from the DCP marketplace.

### Option A: Quick Install (Recommended)

```bash
curl -fsSL https://api.dcp.sa/install-provider.sh | bash
```

This script:
- Clones the DC1 provider agent repository
- Installs dependencies
- Configures environment variables
- Sets up PM2 auto-start

### Option B: Manual Installation

```bash
# Clone the provider agent
git clone https://github.com/dc1/provider-agent.git
cd provider-agent

# Install dependencies
npm install

# Create configuration
cp .env.example .env

# Start the agent
npm start
```

---

## Step 4: Configure Your Provider

Edit the `.env` file with your provider credentials:

```bash
nano .env
```

**Required Environment Variables:**

```env
# API Configuration
DC1_API_URL=https://api.dcp.sa
DC1_PROVIDER_KEY=your_api_key_here_from_step_1

# GPU Configuration
CUDA_VISIBLE_DEVICES=0  # GPU device ID (0 for first GPU, or "0,1" for multiple)
GPU_MODEL=RTX4090       # RTX4090, RTX4080, RTX3090, etc.
TOTAL_GPU_MEMORY_MB=24576  # In MB (24GB for RTX 4090)

# vLLM Server Configuration
VLLM_PORT=8000
VLLM_MAX_PARALLEL_LOADING_WORKERS=1
VLLM_GPU_MEMORY_UTILIZATION=0.8

# Model Serving
MODEL_CACHE_DIR=/mnt/models  # Where to store downloaded models
DEFAULT_MODELS=llama3-8b,qwen25-7b,nemotron-nano-4b  # Pre-load these models

# Monitoring & Logging
LOG_LEVEL=info
HEARTBEAT_INTERVAL=30  # Send heartbeat to DCP every 30 seconds

# Optional: PM2 Auto-Start
PM2_ENABLED=true
PM2_WATCH=true
```

**Example for RTX 4090:**

```env
DC1_API_URL=https://api.dcp.sa
DC1_PROVIDER_KEY=sk-provider-abc123def456...
CUDA_VISIBLE_DEVICES=0
GPU_MODEL=RTX4090
TOTAL_GPU_MEMORY_MB=24576
VLLM_PORT=8000
VLLM_GPU_MEMORY_UTILIZATION=0.8
MODEL_CACHE_DIR=/mnt/models
DEFAULT_MODELS=llama3-8b,qwen25-7b
LOG_LEVEL=info
HEARTBEAT_INTERVAL=30
PM2_ENABLED=true
```

---

## Step 5: Start the Provider Agent

### Option A: Using npm (Development)

```bash
cd provider-agent
npm start
```

You should see:
```
[10:24:05] DC1 Provider Agent v1.0.0 starting...
[10:24:06] Loaded 3 default models: llama3-8b, qwen25-7b, nemotron-nano-4b
[10:24:07] Connected to DC1 API (https://api.dcp.sa)
[10:24:08] Provider status: ONLINE
[10:24:08] Heartbeat interval: 30s
[10:24:08] Waiting for job assignments...
```

### Option B: Using PM2 (Production/Auto-Restart)

```bash
cd provider-agent

# Install PM2 globally
sudo npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js --name "dc1-provider"

# Enable auto-start on system reboot
pm2 startup
pm2 save

# View logs
pm2 logs dc1-provider
```

---

## Step 6: Verify Provider Registration

Check your provider status on the DCP platform:

### Option A: Using CLI

```bash
curl -H "Authorization: Bearer YOUR_PROVIDER_KEY" \
  https://api.dcp.sa/api/providers/me/status
```

Expected response:
```json
{
  "providerId": "provider-7a8b9c0d",
  "status": "online",
  "lastHeartbeat": "2026-03-24T12:34:56Z",
  "gpuModel": "RTX4090",
  "gpuMemoryTotal": 24576,
  "gpuMemoryAvailable": 23000,
  "modelsReady": ["llama3-8b", "qwen25-7b", "nemotron-nano-4b"],
  "jobsProcessed": 0,
  "uptime": "00:05:23"
}
```

### Option B: Check Provider Dashboard

1. Log in to **https://dcp.sa/dashboard**
2. Go to **"My GPU"**
3. You should see your provider status as **ONLINE** (green)

---

## Step 7: Run Your First Job

Once your provider is online, test it with a simple inference job:

### Test 1: Health Check

```bash
curl -X POST https://api.dcp.sa/api/infer \
  -H "Authorization: Bearer YOUR_RENTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3-8b",
    "prompt": "Hello, world!",
    "maxTokens": 100
  }'
```

Expected response:
```json
{
  "jobId": "job-abc123...",
  "status": "completed",
  "output": "Hello, world! I'\''m an AI assistant...",
  "tokensGenerated": 42,
  "computeTime": 2.3,
  "costUSD": 0.0015
}
```

### Test 2: Monitor Job Execution

```bash
# Watch provider logs
pm2 logs dc1-provider

# Or check job status
curl -H "Authorization: Bearer YOUR_PROVIDER_KEY" \
  https://api.dcp.sa/api/providers/me/jobs?limit=10
```

---

## Troubleshooting

### Provider Shows Offline After Starting

**Issue:** Status shows "offline" on dashboard after ~5 minutes

**Causes & Solutions:**
1. **Firewall blocking outbound HTTPS** — Provider needs to reach `api.dcp.sa:443`
   ```bash
   curl -v https://api.dcp.sa  # Should get 200 response
   ```

2. **Invalid provider key** — Check your `.env` file has correct `DC1_PROVIDER_KEY`
   ```bash
   grep DC1_PROVIDER_KEY .env | wc -c  # Should be >40 chars
   ```

3. **Agent crashed** — Check logs
   ```bash
   pm2 logs dc1-provider --lines 50
   ```

### Model Download Stuck

**Issue:** Agent downloads models but appears frozen

**Solutions:**
1. Check available disk space:
   ```bash
   df -h /mnt/models  # Should have >100GB free
   ```

2. Check network bandwidth:
   ```bash
   speedtest-cli  # Should show >50 Mbps download
   ```

3. Cancel and retry:
   ```bash
   # Stop provider
   pm2 stop dc1-provider

   # Clear partial downloads
   rm -rf /mnt/models/*.tmp

   # Restart
   pm2 start dc1-provider
   ```

### Out of VRAM Error During Job

**Issue:** Error message: `RuntimeError: CUDA out of memory`

**Solutions:**
1. Reduce `VLLM_GPU_MEMORY_UTILIZATION` in `.env`:
   ```env
   VLLM_GPU_MEMORY_UTILIZATION=0.7  # Instead of 0.8
   ```

2. Reduce batch size:
   ```env
   VLLM_TENSOR_PARALLEL_SIZE=2  # Use multiple GPUs if available
   ```

3. Monitor GPU memory during jobs:
   ```bash
   watch -n 1 nvidia-smi
   ```

### Heartbeat Rejected (401 Error)

**Issue:** Logs show `Error: Heartbeat rejected (401 Unauthorized)`

**Causes & Solutions:**
1. **Expired or invalid provider key**
   - Check `.env` has correct key from Step 1
   - Regenerate key on dashboard if expired

2. **Wrong API URL**
   - Must be `https://api.dcp.sa` (not `http://`)
   - Must include `/api` path for all endpoints

3. **Provider not registered in system**
   - Verify registration completed in Step 1
   - Check email for confirmation

---

## Performance Tuning

### RTX 4090 Recommended Settings

For optimal throughput and latency:

```env
VLLM_GPU_MEMORY_UTILIZATION=0.85
VLLM_MAX_PARALLEL_LOADING_WORKERS=2
VLLM_MAX_LOOKAHEAD_TOKENS=10
CUDA_LAUNCH_BLOCKING=0
```

### Expected Performance Metrics

With these settings on RTX 4090:
- **Cold-start latency:** 8-12 seconds
- **Warm-start TTFT:** <200ms
- **Throughput:** 300-400 tokens/second (Llama 3 8B)
- **Cost at 70% utilization:** $102-114/month profit (Saudi rates)

### Monitor Performance

```bash
# Check GPU utilization
nvidia-smi dmon

# Check provider metrics
curl -H "Authorization: Bearer YOUR_PROVIDER_KEY" \
  https://api.dcp.sa/api/providers/me/metrics?period=1h
```

---

## Getting Help

### Support Resources

- **Dashboard:** https://dcp.sa/dashboard → Help & Support
- **Discord Community:** https://discord.gg/dcp (provider channel)
- **Email Support:** providers@dcp.sa
- **Technical Issues:** https://github.com/dc1/provider-agent/issues

### Provide Context When Asking for Help

Include:
1. Provider ID from dashboard
2. Recent logs: `pm2 logs dc1-provider --lines 50`
3. System info: `uname -a && nvidia-smi`
4. Error message and when it occurred

---

## Next Steps

Once your provider is stable and processing jobs:

1. **Monitor earnings** on the dashboard
2. **Pre-fetch models** for faster job startup (see Model Cache section below)
3. **Scale up** — add more GPUs or providers
4. **Optimize** — adjust settings based on job patterns

---

## Model Cache & Pre-fetching

To reduce cold-start latency, pre-load models:

```bash
# Download and cache specific models
docker run --rm \
  -v /mnt/models:/models \
  -e HF_HOME=/models \
  ghcr.io/vllm-project/vllm:latest \
  python -c "from transformers import AutoModel; AutoModel.from_pretrained('meta-llama/Llama-2-8b-hf')"

# List cached models
ls -lh /mnt/models/

# Update DEFAULT_MODELS in .env with pre-cached models
DEFAULT_MODELS=llama3-8b,qwen25-7b,nemotron-nano-4b
```

---

**Version:** 1.0
**Status:** Production Ready
**Last Tested:** 2026-03-24
