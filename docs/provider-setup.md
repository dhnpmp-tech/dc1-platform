# Provider Setup — Quick Install, WireGuard, Tray App, and Models

This document covers the current provider onboarding flow for daemon `v3.4.0`, including one-command install, home-network (NAT) setup through WireGuard, system tray monitoring, and model capacity planning.

## Quick Install (Recommended)

Use your provider API key from the provider dashboard.

### Linux and macOS

```bash
curl -fsSL "https://api.dcp.sa/install" | bash
```

If you need the direct setup endpoint with explicit key injection:

```bash
curl -fsSL "https://api.dcp.sa/api/providers/download/setup?key=YOUR_KEY" | bash
```

### Windows PowerShell

```powershell
irm "https://api.dcp.sa/api/providers/download/setup?key=YOUR_KEY&os=windows" | iex
```

### What the installer does

- Detects GPU and validates `nvidia-smi`
- Installs Docker + NVIDIA container runtime dependencies
- Generates a WireGuard keypair for home-provider VPN onboarding
- Installs daemon prerequisites and bootstrap scripts
- Configures and starts the provider daemon service

## Home Providers (NAT/No Port Forwarding) — WireGuard Setup

If you run your GPU node from residential internet, use WireGuard so the control plane can reach your daemon reliably.

- DCP WireGuard endpoint: `76.13.179.86:51820`
- DCP WireGuard server public key: `zVxlVgKwnxq4Z9l6jGgD0yMJH5meHrlodJYyRHrL+wM=`

### Generate WireGuard keys manually (if needed)

```bash
wg genkey | tee privatekey | wg pubkey > publickey
cat publickey
```

After installation, send your WireGuard public key to `setup@dcp.sa` (or support contact provided in your onboarding thread) to request peer addition and tunnel activation.

## System Monitor Tray App

After provider setup, install the tray monitor app to track daemon health without opening logs.

- Windows installer: `/api/providers/download/tray-windows`
- Linux desktop build: `/api/providers/download/tray-linux`
- macOS menu-bar build: `/api/providers/download/tray-mac`

### Tray app telemetry

- Daemon online/offline status
- GPU utilization and health snapshot
- Jobs served
- Earnings in SAR

## Available Models (Daemon v3.4.0 Whitelist)

Use these capacity targets when onboarding hardware.

### Arabic models

- `ALLaM-7B Instruct` — 24 GB VRAM (Node 3 rollout)
- `JAIS-13B Chat` — 24 GB VRAM

### Multilingual models

- `Qwen2.5-7B Instruct` — 8 GB VRAM minimum
- `Qwen2.5-14B Instruct` — 24 GB VRAM recommended

### Standard models

- `Llama 3.1 8B Instruct AWQ INT4` — 8 GB VRAM minimum
- `Mistral 7B Instruct v0.2 AWQ` — 8 GB VRAM minimum
- `Phi-3.5 Mini Instruct` — 8 GB VRAM minimum

## Advanced Manual Setup (Docker, GPU Passthrough, Model Cache)

Use this section if you want manual control instead of the one-line installer.

## Required GPU Baseline

- NVIDIA GPU with at least 8 GB VRAM (16 GB+ recommended for sustained throughput)
- NVIDIA driver with working `nvidia-smi`
- Docker Engine with NVIDIA Container Toolkit
- Stable network connection (100 Mbps+ recommended)

## Step 1 — Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

Verify Docker:

```bash
docker run --rm hello-world
```

## Step 2 — Install NVIDIA Container Toolkit

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
  | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

distribution=$(. /etc/os-release; echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list \
  | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
  | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

> Ubuntu 24.04 note: use `ubuntu22.04` packages if autodetect fails.

## Step 3 — Verify GPU passthrough

```bash
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu22.04 nvidia-smi
```

## Step 4 — Create model cache directory

```bash
sudo mkdir -p /opt/dcp/model-cache
sudo chmod 777 /opt/dcp/model-cache
```

## Step 5 — Restart daemon

```bash
sudo systemctl restart dcp-daemon
journalctl -u dcp-daemon -n 30
```

Look for GPU detection and docker runtime readiness in logs.
