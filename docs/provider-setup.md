# Provider Setup — Docker, GPU Passthrough, and Model Cache

This document covers the complete provider bootstrap sequence: Docker install, NVIDIA Container Toolkit (GPU passthrough), model cache setup, and verification.

## Required GPU Baseline

- NVIDIA GPU with at least 8 GB VRAM (16 GB+ recommended for Llama 3/Mistral workloads)
- NVIDIA driver with working `nvidia-smi`
- Docker Engine with NVIDIA Container Toolkit
- Stable network connection (100 Mbps+ recommended)

## Step 1 — Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker          # apply group change without logout
```

Verify Docker is running:

```bash
docker run --rm hello-world
```

## Step 2 — Install NVIDIA Container Toolkit

The NVIDIA Container Toolkit lets Docker containers use your GPU via `--gpus` flag.

```bash
# Add the NVIDIA Container Toolkit GPG key
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
  | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

# Add the repository (Ubuntu 22.04 / 20.04)
distribution=$(. /etc/os-release; echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list \
  | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
  | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Install
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit

# Configure Docker runtime
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

> **Ubuntu 24.04 note:** replace `$distribution` with `ubuntu22.04` if the auto-detect step fails — the 24.04 repo is not yet published but the 22.04 packages work.

## Step 3 — Verify GPU passthrough

```bash
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu22.04 nvidia-smi
```

Expected output: a table showing your GPU model, driver version, and VRAM total. If this passes, Docker can schedule GPU workloads.

## Step 4 — Create model cache directory

DCP jobs mount a shared model cache to avoid re-downloading large model weights on every run.

```bash
sudo mkdir -p /opt/dcp/model-cache
sudo chmod 777 /opt/dcp/model-cache
```

## Step 5 — Restart the DCP daemon

After Docker + toolkit are installed, restart the daemon so it detects GPU availability and enables containerized job routing:

```bash
sudo systemctl restart dcp-daemon
# Check daemon detected GPU:
journalctl -u dcp-daemon -n 30
# Look for: "GPU detected via nvidia-smi" and "docker_enabled: true"
```

---

## Model Cache Layout

Persistent cache root on VPS:

- `/opt/dcp/model-cache/hf` — Hugging Face model snapshots
- `/opt/dcp/model-cache/vllm` — vLLM runtime cache/artifacts
- `/opt/dcp/model-cache/tmp` — temporary download/extract workspace

Docker volume:

- `dcp-model-cache` (local bind volume mapped to `/opt/dcp/model-cache`)

## Bootstrap Script

Create the cache path and Docker volume:

```sh
sh infra/setup-model-cache.sh
```

Behavior:

- Creates cache directories if missing
- Applies owner/perms (defaults to `node:node`, override with `DCP_MODEL_CACHE_OWNER`)
- Creates Docker volume `dcp-model-cache` bound to `/opt/dcp/model-cache`

Environment overrides:

- `DCP_MODEL_CACHE_ROOT` (default `/opt/dcp/model-cache`)
- `DCP_MODEL_CACHE_VOLUME` (default `dcp-model-cache`)
- `DCP_MODEL_CACHE_OWNER` (default `node:node`)

## Prefetch Common Models

Warm the cache for common models:

```sh
sh infra/docker/prefetch-models.sh
```

Default model repos:

- `llama3-8b` → `NousResearch/Meta-Llama-3-8B`
- `mistral-7b` → `mistralai/Mistral-7B-Instruct-v0.2`

Optional overrides:

- `DCP_LLAMA3_REPO`
- `DCP_MISTRAL_REPO`
- `HF_TOKEN` (if repo access requires authentication)

## Heartbeat Monitoring

The provider daemon heartbeat now includes model-cache disk metrics for `/opt/dcp/model-cache`:

- `model_cache_exists`
- `model_cache_total_gb`
- `model_cache_free_gb`
- `model_cache_used_gb`
- `model_cache_used_percent`

These values are sent in `gpu_status` and `model_cache` payload fields.
