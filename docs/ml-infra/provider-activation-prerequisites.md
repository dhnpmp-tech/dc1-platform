# Provider Activation Prerequisites Checklist

**Document Version:** 2026-03-24
**Target Audience:** GPU Provider Operators
**Setup Time:** 45–90 minutes

---

## Executive Summary

Before provider activation, verify:
1. **GPU Hardware** — RTX 4090, RTX 4080, or equivalent
2. **Docker + nvidia-container-toolkit** installed
3. **Network** — 500+ Mbps, ports 5001–6000 open
4. **Disk** — 250+ GB NVMe free
5. **Permissions** — Docker daemon access

---

## GPU Hardware Eligibility

| GPU | VRAM | Tier A? | Monthly Earnings (70% util) |
|-----|------|---------|---------------------------|
| RTX 4090 | 24 GB | ✅ | $2,140–$2,980 |
| RTX 4080 | 12 GB | ✅ | $1,480–$2,100 |
| RTX 4070 Ti | 12 GB | ✅ | $1,200–$1,680 |
| H100 | 80 GB | ✅ | $3,200–$4,500 |
| A100 | 40 GB | ✅ | $2,400–$3,200 |

---

## Hardware Verification

```bash
# Check GPU
nvidia-smi
# Expected: RTX 4090, 4080, etc. with correct VRAM

# Check Docker
docker --version
# Expected: Docker 20.10 or later

# Check nvidia-container-toolkit
docker run --rm --gpus all nvidia/cuda:12.0.0-base-ubuntu22.04 nvidia-smi
# Expected: GPU visible inside container
```

**GPU drivers:** Must be >= 530 (for CUDA 12.x)

---

## Network Requirements

```bash
# Speed test
speedtest-cli
# Expected: >= 500 Mbps (Tier A pre-fetch takes ~60 min at this speed)

# Connectivity test
curl -I https://api.dcp.sa/health
curl -I https://huggingface.co/
# Both should return 200 OK
```

**Firewall rules:**
- Outbound: 443 (HTTPS) to api.dcp.sa, huggingface.co, docker.io
- Inbound: 5001–6000 (inference endpoints) from 0.0.0.0/0

---

## Disk Space Validation

```bash
# Check available space
df -h /

# Need:
# - 93 GB for Tier A models cache
# - 20 GB for OS + Docker
# - 50 GB for scratch space
# - 50 GB safety margin
# = 213 GB minimum (250+ GB recommended)
```

**Storage:** NVMe SSD required (>= 500 MB/s throughput)

```bash
# Test NVMe speed
fio --name=test --filename=/test --ioengine=libaio \
    --rw=read --bs=1m --size=1g --numjobs=1 \
    --iodepth=32 --group_reporting
# Look for "read: bw=" — should be >= 500 MB/s
```

---

## Docker Setup

### Install Docker (if needed)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y docker.io
sudo usermod -aG docker $USER
# Log out and back in for group to take effect
```

### Install nvidia-container-toolkit

```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt update
sudo apt install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### Verify GPU Access

```bash
docker run --rm --gpus all ubuntu:latest nvidia-smi
# Should show your GPU without errors
```

---

## System Verification Checklist

- [ ] `nvidia-smi` detects GPU (RTX 4090, 4080, etc.)
- [ ] GPU has >= 12 GB VRAM
- [ ] Driver version >= 530
- [ ] Docker version >= 20.10
- [ ] `docker run --gpus all` works without errors
- [ ] Download speed >= 500 Mbps
- [ ] api.dcp.sa reachable (curl test passes)
- [ ] Available disk space >= 250 GB
- [ ] Disk is NVMe (not SATA HDD)
- [ ] User is in docker group (`groups | grep docker`)

---

## Provider Activation Flow

### 1. Run Prerequisite Checks

```bash
#!/bin/bash
echo "=== DCP Provider Activation Verification ==="
nvidia-smi -L | head -1  # GPU
docker --version         # Docker
df -h / | awk 'NR==2 {print $4 " available"}' # Disk
curl -s -w "HTTP %{http_code}\n" -o /dev/null https://api.dcp.sa/health
echo "=== All checks passed! ==="
```

### 2. Run Onboarding CLI

```bash
node scripts/provider-onboard.mjs
# Flow:
# 1. Prerequisites check
# 2. GPU benchmark
# 3. Provider registration
# 4. Benchmark submission
# Total: 5–10 min (+ 60 min Tier A pre-fetch async)
```

### 3. Verify Activation

```bash
curl -H "Authorization: Bearer <provider-token>" \
  https://api.dcp.sa/api/providers/me
# Should show: status: "active", monthlyEarningsEstimate
```

---

## Post-Activation: Earnings API

```bash
curl -H "Authorization: Bearer <provider-token>" \
  https://api.dcp.sa/api/earnings/estimates \
  -d '{"gpuModel":"RTX4090","locationHourlyCost":0.25,"utilizationPercent":70}'

# Response:
{
  "gpuModel": "RTX4090",
  "hourlyRate": 5.38,
  "monthlyRevenue": 2550,
  "monthlyNetEarnings": 2370,
  "paybackMonths": 18
}
```

---

## Troubleshooting

**"Docker daemon is not reachable"**
- Is Docker running? `sudo systemctl start docker`
- Is user in docker group? `groups | grep docker`

**"No GPU detected"**
- Run `nvidia-smi` directly (outside Docker)
- Update drivers from nvidia.com

**"Pre-fetch is slow"**
- Check speed: `speedtest-cli`
- Check disk I/O: `iostat -x 1` (%util should be < 80%)

**"Disk full during pre-fetch"**
- Free up space: `df -h /opt/dcp/model-cache`
- Need 250+ GB available

---

## References

- Pre-fetch guide: `docs/ml-infra/prefetch-deployment-guide.md`
- Earnings calculator: `backend/src/routes/earnings.js`
- Provider economics: `docs/FOUNDER-STRATEGIC-BRIEF.md`

---

## Support

- Technical: #gpu-providers on Dev Discord
- Billing: setup@oida.ae
- Emergency: @founder on Telegram
