# DC1 GPU Health Check Daemon

Monitors GPU providers via SSH every 30 seconds. Reports to Mission Control and sends Telegram alerts.

## Quick Start

```bash
cd orchestration/healthcheck
pip install -r requirements.txt
cp .env.example .env   # Edit with your values
python daemon.py
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GPU_SSH_HOST` | ✅ | — | Provider IP/hostname |
| `GPU_SSH_USER` | — | `dc1` | SSH username |
| `GPU_SSH_KEY_PATH` | — | `~/.ssh/id_rsa` | Path to SSH private key |
| `GPU_ID` | — | `pc1-rtx3090` | GPU identifier for MC API |
| `CHECK_INTERVAL_SECONDS` | — | `30` | Seconds between checks |
| `SSH_TIMEOUT_SECONDS` | — | `10` | SSH connection timeout |
| `TEMP_ALERT_THRESHOLD` | — | `80` | °C before HIGH alert |
| `LATENCY_ALERT_MS` | — | `2000` | ms before HIGH alert |
| `MC_API_BASE` | — | `http://76.13.179.86:8084/api` | Mission Control URL |
| `MC_API_TOKEN` | — | `dc1-mc-gate0-2026` | MC auth token |
| `TELEGRAM_BOT_TOKEN` | — | — | Bot token for alerts |
| `TELEGRAM_GROUP_ID` | — | `-5275672778` | Telegram group for alerts |

## Alert Levels

- **HIGH**: Temp > 80°C, latency > 2000ms, memory ECC errors
- **CRITICAL**: GPU offline after 5 retries with exponential backoff

## Testing Without a Real GPU

```bash
# Mock mode: set GPU_SSH_HOST to localhost and run a fake nvidia-smi
# Or just run — it will report OFFLINE status to MC, useful for testing alert flow
GPU_SSH_HOST=127.0.0.1 GPU_SSH_USER=$USER python daemon.py
```

## Docker

```bash
docker build -t dc1-healthcheck .
docker run -e GPU_SSH_HOST=x.x.x.x -v ~/.ssh:/root/.ssh:ro dc1-healthcheck
```

## Logs

Rotating daily in `logs/daemon.log`, 7-day retention.
