# DCP Provider Guide — Earn SAR with your NVIDIA GPU

DCP connects your NVIDIA GPU to active AI workloads in a Saudi-hosted marketplace. When jobs complete, your earnings are reflected in the provider wallet dashboard.

For providers in Saudi Arabia, this model can improve long-run compute economics when your machine is available and demand matches. DCP also supports Arabic-first use cases by routing jobs compatible with local model choices.

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
    "message": "Provider registered. Install the daemon and wait for marketplace matching."
}
```

**Save your `api_key`** and keep it secure for daemon configuration.

---

## Step 2 — Install the daemon

The DCP daemon (`dcp_daemon.py`) runs on your machine, polls for jobs, executes them in Docker containers, and sends heartbeats every 30 seconds.

### Linux / macOS (recommended)

```bash
# One-line installer
curl -sL "https://dcp.sa/api/dc1/providers/download/setup?key=YOUR_PROVIDER_KEY&os=linux" | bash
```

Or manual install:

```bash
# Download daemon (if you prefer manual setup)
curl -o dcp_daemon.py "https://dcp.sa/api/dc1/providers/download/daemon?key=YOUR_PROVIDER_KEY"

# Install Python dependencies
pip3 install requests psutil GPUtil docker

# Run the daemon
DC1_API_KEY=dc1-YOUR_KEY_HERE DC1_API_URL=https://api.dcp.sa python3 dcp_daemon.py
```

### Windows

Download the installer from the [provider download page](https://dcp.sa/provider/download):

1. Download the DCP Windows installer package
2. Run as administrator
3. Enter your API key when prompted
4. The daemon runs as a managed background process on Windows and supports automatic startup when configured

### As a systemd service (Linux — production)

```ini
# /etc/systemd/system/dcp_daemon.service
[Unit]
Description=DCP GPU Daemon
After=network.target docker.service
Requires=docker.service

[Service]
Environment=DC1_API_KEY=dc1-YOUR_KEY_HERE
Environment=DC1_API_URL=https://api.dcp.sa
ExecStart=/usr/bin/python3 /opt/dc1/dcp_daemon.py
Restart=always
RestartSec=10
User=root

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable dcp_daemon
sudo systemctl start dcp_daemon
sudo journalctl -u dcp_daemon -f  # watch logs
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

1. **Heartbeat** — Reports GPU stats (utilization, VRAM, temperature) to DCP
2. **Poll for jobs** — Checks for assigned `pending` jobs
3. **Execute** — Pulls the Docker image and runs the job payload inside the container
4. **Report result** — Sends output back to DCP (text, image base64, endpoint URL)
### Daemon environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DC1_API_KEY` | — | **Required.** Your provider API key |
| `DC1_API_URL` | `https://api.dcp.sa` | DCP backend URL |
| `DC1_RUN_MODE` | `docker` | `docker` or `local` (for testing) |
| `DC1_LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |

---

## Earnings model

| Item | Amount |
|------|--------|
| You earn | Percentage share from completed jobs |
| DCP fee | Platform fee is configurable by policy |
| Payout timing | Visible in the provider wallet settings |
| Payout method | Configured in platform withdrawal settings |

### Planning earnings

Use provider dashboard tools to estimate outcomes based on your utilization, job mix, and uptime.

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

DCP tracks a **reliability score** (0–100) for each provider:

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
- Check daemon logs: `journalctl -u dcp_daemon -f`

---

## Security

The daemon executes jobs from the DCP backend with a valid HMAC signature. Job payloads run inside isolated Docker containers, and renter API keys are only used through request context.

Never share your provider API key. If you suspect it is compromised, contact DCP support to rotate it.
