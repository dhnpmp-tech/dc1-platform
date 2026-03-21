# DC1 Provider Guide — Earn SAR with Your NVIDIA GPU

DC1 lets you earn Saudi Riyals by connecting your NVIDIA GPU to the marketplace. Renters pay for compute; you keep 75% of every job's cost. Payments are settled to your IBAN weekly.

---

## Hardware requirements

| Requirement | Minimum |
|-------------|---------|
| GPU | NVIDIA (GeForce, RTX, Quadro, Tesla, A-series) |
| VRAM | 8 GB |
| OS | Ubuntu 20.04+ (Linux recommended), Windows 10+ supported |
| Python | 3.8 or newer |
| Internet | 100 Mbps symmetric |
| Docker | 20.10+ with NVIDIA Container Toolkit |

GPUs with more VRAM (16–80 GB) attract higher-value jobs (Llama-3 8B, SDXL, training runs).

---

## Step 1 — Register

```bash
curl -X POST https://api.dcp.sa/api/providers/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My GPU Node",
    "email": "provider@example.com",
    "gpu_model": "RTX 4090",
    "vram_gb": 24,
    "location": "SA"
  }'
```

**Response:**

```json
{
  "success": true,
  "api_key": "dc1-abc123...",
  "provider_id": 3,
  "message": "Provider registered. Install the daemon and start heartbeating."
}
```

**Save your `api_key`.** You'll need it for the daemon configuration.

---

## Step 2 — Install the daemon

The DC1 daemon (`dc1_daemon.py v3.4.0`) runs on your machine, polls for jobs, executes them in Docker containers, and sends heartbeats every 30 seconds.

### Linux / macOS (recommended)

```bash
# One-line installer
curl -fsSL https://api.dcp.sa/api/providers/install-script/linux | bash
```

Or manual install:

```bash
# Download daemon
curl -o dc1_daemon.py https://api.dcp.sa/api/providers/daemon-download

# Install Python dependencies
pip3 install requests psutil GPUtil docker

# Run the daemon
DC1_API_KEY=dc1-YOUR_KEY_HERE python3 dc1_daemon.py
```

### Windows

Download the installer from the [provider download page](https://dcp.sa/provider/download):

1. Download `DC1-Daemon-Installer.exe`
2. Run as administrator
3. Enter your API key when prompted
4. The daemon registers as a Windows service and starts automatically

### As a systemd service (Linux — production)

```ini
# /etc/systemd/system/dc1-daemon.service
[Unit]
Description=DC1 GPU Daemon
After=network.target docker.service
Requires=docker.service

[Service]
Environment=DC1_API_KEY=dc1-YOUR_KEY_HERE
Environment=DC1_API_URL=https://api.dcp.sa
ExecStart=/usr/bin/python3 /opt/dc1/dc1_daemon.py
Restart=always
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable dc1-daemon
sudo systemctl start dc1-daemon
sudo journalctl -u dc1-daemon -f  # watch logs
```

---

## Step 3 — Install prerequisites

### Docker + NVIDIA Container Toolkit

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

Verify:

```bash
docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
```

---

## How the daemon works

The daemon runs a loop every 30 seconds:

1. **Heartbeat** — Reports GPU stats (utilization, VRAM, temperature) to DC1
2. **Poll for jobs** — Checks for assigned `pending` jobs
3. **Execute** — Pulls the Docker image, runs the task script inside the container
4. **Report result** — Sends output back to DC1 (text, image base64, endpoint URL)
5. **Auto-update** — Downloads new daemon versions automatically when released

### Daemon environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DC1_API_KEY` | — | **Required.** Your provider API key |
| `DC1_API_URL` | `https://api.dcp.sa` | DC1 backend URL |
| `DC1_RUN_MODE` | `docker` | `docker` or `local` (for testing) |
| `DC1_LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |

---

## Earnings model

| Item | Amount |
|------|--------|
| You earn | 75% of job cost |
| DC1 fee | 25% of job cost |
| LLM inference rate | 0.15 SAR/min |
| Image generation rate | 0.20 SAR/min |
| Training rate | 0.25 SAR/min |
| Minimum payout | 50 SAR |
| Payout schedule | Weekly (Sunday) |
| Payout method | IBAN bank transfer (Saudi banks) |

### Example earnings

A provider with a 24GB RTX 4090 running continuously:

- 8 × LLM inference jobs/day × 10 min avg × 0.15 SAR/min × 0.75 = **9 SAR/day**
- 4 × image generation jobs/day × 15 min avg × 0.20 SAR/min × 0.75 = **9 SAR/day**
- **Total: ~18 SAR/day → ~540 SAR/month** from a single GPU

Providers with multiple GPUs or enterprise-class cards (A100, H100) can earn significantly more.

---

## Monitoring your provider

```bash
# Check your provider status
curl "https://api.dcp.sa/api/providers/me?key=dc1-YOUR_KEY"

# Check earnings
curl "https://api.dcp.sa/api/providers/earnings" \
  -H "x-provider-key: dc1-YOUR_KEY"

# List your jobs
curl "https://api.dcp.sa/api/providers/YOUR_KEY/jobs"
```

---

## Reliability score

DC1 tracks a **reliability score** (0–100) for each provider:

- Starts at 100
- Decreases when jobs fail or time out
- Increases with successful completions
- Providers with score < 50 are deprioritized for new job assignments

Keep your daemon running continuously and ensure your GPU has adequate cooling and power.

---

## Troubleshooting

**Daemon shows "offline" after starting:**
- Check your API key is correct: `DC1_API_KEY=dc1-...`
- Verify network connectivity: `curl https://api.dcp.sa/api/providers/me?key=YOUR_KEY`
- Firewall may be blocking outbound to port 8083

**Job fails with "CUDA out of memory":**
- Reduce the VRAM usage of other processes before running jobs
- `nvidia-smi` shows current VRAM usage

**Docker permission denied:**
- Run `sudo usermod -aG docker $USER` and log out/in
- Or run daemon with `sudo`

**NVIDIA Container Toolkit not working:**
- Verify: `docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi`
- If it fails: re-run `sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker`

**Job stuck in "pending":**
- The daemon polls every 30 seconds — wait up to a minute
- Check daemon logs: `journalctl -u dc1-daemon -f`

---

## Security

The daemon only executes jobs that arrive from the DC1 backend with a valid HMAC signature. Your machine runs job scripts inside isolated Docker containers — no DC1 code runs outside of Docker. Providers cannot access renter API keys or personal data.

Never share your provider API key. If you suspect it is compromised, contact DC1 support to rotate it.
