# Provider Activation Prerequisites

## Overview

Before a GPU provider can activate on DCP and begin serving workloads, the provider's hardware and infrastructure must meet specific requirements. This guide walks through prerequisite validation, system setup, and earnings estimation.

**Target Audience:** Provider operators (non-technical and technical)
**Setup Time:** 15-30 minutes (hardware validation)
**Networking Requirement:** Minimum 50 Mbps upload to DCP marketplace
**VRAM Requirement:** Varies by GPU model (see table below)

---

## GPU Hardware Eligibility

### Supported GPU Models

| GPU Model | VRAM | Min. Tier | Monthly Earnings (70% util) | RTX 4090 Relative |
|-----------|------|-----------|-------|-------|
| **RTX 4090** | 24 GB | Tier A-C | $255-$315 | 1.0x |
| **RTX 4080** | 12 GB | Tier A-B | $165-$205 | 0.65x |
| **RTX 4070** | 12 GB | Tier A | $140-$170 | 0.55x |
| **H100** | 80 GB | All Tiers | $850-$1,200 | 3.5x |
| **H200** | 141 GB | All Tiers | $1,100-$1,600 | 4.5x |
| **L40S** | 48 GB | All Tiers | $420-$550 | 1.75x |
| **A100** | 40 GB | All Tiers | $380-$500 | 1.65x |

**Notes:**
- Minimum VRAM varies by model tier; larger models require more VRAM
- Earnings estimates assume 70% utilization and $0.30/hour RTX 4090 pricing
- NVIDIA-based GPUs only (no AMD/Intel support at launch)
- Datacenter-class GPUs (H100, H200, L40S, A100) have higher earnings potential

### GPU Validation Checklist

- [ ] GPU is on the supported list above
- [ ] VRAM meets or exceeds model requirements
- [ ] GPU driver is installed (`nvidia-smi` shows device)
- [ ] CUDA Toolkit 12.0+ is installed
- [ ] No other heavyweight processes using GPU (verify with `nvidia-smi`)

---

## System Requirements

### Operating System
- **Ubuntu 20.04 LTS, 22.04 LTS, or 24.04 LTS** (recommended)
- Debian 11+ (supported)
- CentOS 7+, RHEL 8+ (supported)
- Windows Server 2019+ (with WSL2 GPU support)

### CPU & Memory
- **CPU Cores:** 8+ cores recommended (8-core minimum for Tier A inference)
- **RAM:** 32 GB minimum; 64 GB recommended
- **Storage:** 250 GB NVMe SSD minimum (for model cache + OS)

### Network
- **Bandwidth:** 100 Mbps minimum upload (50 Mbps acceptable)
- **Latency:** <100ms to DCP marketplace API (check below)
- **Public IP:** Static IP or dynamic DNS configured
- **Firewall:** Inbound port 8080-8090 open for job submission

### Storage Configuration
DCP stores model cache in a Docker volume at `/opt/dcp/model-cache`. Providers should ensure:
- **Disk Space:** 250+ GB NVMe SSD (dedicated if possible)
- **I/O Performance:** >500 MB/s read for <1 hour model pre-fetch
- **Free Space:** Maintain >20% free for Docker and model updates

---

## Software Prerequisites

### 1. Docker Installation

Docker is required to run GPU workloads on DCP. Install Docker with GPU support.

**Ubuntu/Debian:**
```bash
# Remove old Docker installations
sudo apt-get remove docker docker.io containerd runc

# Install Docker (latest stable)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group (requires logout/login)
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker run hello-world  # Should print welcome message
```

**CentOS/RHEL:**
```bash
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

### 2. NVIDIA Container Toolkit

The NVIDIA Container Toolkit enables Docker containers to access GPU hardware.

**Ubuntu/Debian:**
```bash
# Add NVIDIA package repository
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

# Install toolkit
sudo apt-get update
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker

# Verify installation
docker run --rm --gpus all nvidia/cuda:12.0.0-runtime-ubuntu22.04 nvidia-smi
```

**CentOS/RHEL:**
```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID | sed 's/\.//g')
yum-config-manager --add-repo https://nvidia.github.io/libnvidia-container/stable/$distribution/nvidia-libnvidia-container.repo
sudo yum clean expire-cache
sudo yum install -y nvidia-docker2
sudo systemctl restart docker
```

### 3. Verify GPU Access from Docker

```bash
docker run --rm --gpus all nvidia/cuda:12.0.0-runtime-ubuntu22.04 nvidia-smi
```

Expected output: GPU device listed with VRAM and driver version.

---

## Network Validation

### API Connectivity
Test connectivity to DCP marketplace API:

```bash
# Check latency to api.dcp.sa
curl -w "\nConnect time: %{time_connect}s\n" -I https://api.dcp.sa/health

# Expected: <100ms, HTTP 200 OK
```

### Port Availability
Ensure required ports are open:

```bash
# Test port binding (example: port 8083)
nc -zv api.dcp.sa 443  # Should succeed (port 443 for HTTPS)

# If behind firewall, open ports 8080-8090 for job submission
sudo ufw allow 8080:8090/tcp  # Ubuntu/Debian
sudo firewall-cmd --add-port=8080-8090/tcp --permanent  # CentOS/RHEL
```

---

## System Verification Checklist

Run this verification script before activating:

```bash
#!/bin/bash
echo "=== DCP Provider System Verification ==="

# GPU Check
echo "✓ GPU Detection:"
nvidia-smi -L | head -1

# Docker Check
echo "✓ Docker Status:"
docker info | grep -E "Containers|Images|Storage"

# NVIDIA Container Toolkit Check
echo "✓ GPU Docker Access:"
docker run --rm --gpus all nvidia/cuda:12.0.0-runtime-ubuntu22.04 nvidia-smi | head -3

# Storage Check
echo "✓ Available Disk Space:"
df -h /opt/dcp | tail -1

# Network Check
echo "✓ API Connectivity:"
curl -s -w "HTTP %{http_code} | Latency: %{time_total}s\n" -I https://api.dcp.sa/health

# Memory Check
echo "✓ System Memory:"
free -h | grep "Mem:"

echo "=== Verification Complete ==="
```

Save as `verify-provider-setup.sh` and run:
```bash
chmod +x verify-provider-setup.sh
./verify-provider-setup.sh
```

---

## Model Cache Setup

DCP uses a Docker volume to store cached model weights. Initialize the cache before pre-fetching:

```bash
# Run setup script
./infra/setup-model-cache.sh

# Verify volume creation
docker volume inspect dcp-model-cache
docker volume ls | grep dcp-model-cache
```

Expected output: Volume listed with 250+ GB available space.

---

## Troubleshooting

### Problem: `nvidia-smi` not found
**Solution:** Install NVIDIA GPU drivers
```bash
ubuntu-drivers autoinstall  # Ubuntu
# Or manual: https://www.nvidia.com/Download/driverDetails.aspx
```

### Problem: "Docker permission denied"
**Solution:** Add user to docker group and restart session
```bash
sudo usermod -aG docker $USER
# Logout and login, or:
newgrp docker
```

### Problem: "Failed to initialize NVIDIA Container Toolkit"
**Solution:** Restart Docker daemon
```bash
sudo systemctl restart docker
docker run --rm --gpus all nvidia/cuda:12.0.0-runtime-ubuntu22.04 nvidia-smi
```

### Problem: "Not enough VRAM for model"
**Solution:** Check VRAM availability and reduce batch size or model context length
```bash
docker run --rm --gpus all nvidia/cuda:12.0.0-runtime-ubuntu22.04 nvidia-smi
# Use --gpu-memory-utilization 0.80 instead of 0.90 to reduce memory usage
```

### Problem: "Slow model pre-fetch (>2 hours)"
**Solution:** Check network bandwidth and disk I/O
```bash
# Test download speed
curl -L -o /tmp/test-file.bin https://huggingface.co/large-file.bin
# Expected: 50-100 MB/s for fast pre-fetch

# Check disk I/O
sudo fio --name=test --filename=/opt/dcp/test --direct=1 --rw=write --bs=4k --size=1G
# Expected: >500 MB/s
```

---

## Post-Activation Integration

After prerequisite validation, providers proceed to:

1. **Model Pre-fetching:** Run `infra/docker/prefetch-models.sh` (see prefetch-deployment-guide.md)
2. **Model Serving:** Deploy vLLM or other inference containers
3. **Provider Onboarding:** Register GPU via DCP marketplace CLI
4. **Earnings API Integration:** Connect to `/api/earnings` for revenue estimation (see below)

---

## Earnings API Reference

Once activated, providers can estimate monthly earnings using the DCP Earnings Calculator API.

### Endpoint
```
GET https://api.dcp.sa/api/earnings?gpu_model={model}&utilization_pct={percent}
```

### Example Requests

**RTX 4090 at 70% Utilization:**
```bash
curl "https://api.dcp.sa/api/earnings?gpu_model=rtx-4090&utilization_pct=70"

# Response:
{
  "gpu_model": "rtx-4090",
  "monthly_revenue_usd": 255.00,
  "electricity_cost_usd": 45.00,
  "platform_fee_usd": 38.25,
  "net_monthly_margin_usd": 171.75,
  "hourly_rate_usd": 0.267,
  "gpu_payback_months": 18
}
```

**H100 at 85% Utilization:**
```bash
curl "https://api.dcp.sa/api/earnings?gpu_model=h100&utilization_pct=85"

# Response:
{
  "gpu_model": "h100",
  "monthly_revenue_usd": 1020.00,
  "electricity_cost_usd": 120.00,
  "platform_fee_usd": 153.00,
  "net_monthly_margin_usd": 747.00,
  "hourly_rate_usd": 0.567,
  "gpu_payback_months": 8
}
```

### Supported GPU Models
- `rtx-4090`, `rtx-4080`, `rtx-4070`
- `h100`, `h200`, `l40s`, `a100`

### Response Fields
| Field | Description |
|-------|-------------|
| `monthly_revenue_usd` | Gross revenue at given utilization |
| `electricity_cost_usd` | Monthly electricity cost (Saudi rates) |
| `platform_fee_usd` | DCP marketplace fee (15% of revenue) |
| `net_monthly_margin_usd` | Net profit after all costs |
| `hourly_rate_usd` | Effective hourly rate to renter |
| `gpu_payback_months` | Time to ROI on GPU hardware cost |

---

## Contact & Support

For prerequisite questions or issues:
- **Email:** provider-support@dcp.sa
- **Slack:** #provider-activation channel
- **Docs:** https://dcp.sa/docs/provider-activation
