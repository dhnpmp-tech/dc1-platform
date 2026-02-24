# NEXUS — Heartbeat & Alert Router

DC1 agent heartbeat tracking and severity-based alert routing.

## Setup

```bash
cd orchestration/nexus
pip install -r requirements.txt
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DC1_MC_API_URL` | No | `http://localhost:8080` | Mission Control API base URL |
| `DC1_MC_TOKEN` | **Yes** | — | MC API bearer token |
| `DC1_TELEGRAM_BOT_TOKEN` | **Yes** | — | Telegram Bot API token |
| `DC1_HEARTBEAT_PORT` | No | `8086` | Heartbeat HTTP server port |
| `DC1_HEARTBEAT_DB` | No | `data/heartbeats.db` | SQLite database path |
| `DC1_AGENT_ID` | No | `37c0fd6b` | This agent's UUID |

> ⚠️ **Never hardcode tokens.** Always use env vars.

## Run with PM2

```bash
pm2 start "python -m orchestration.nexus.heartbeat" --name nexus-heartbeat
```

## Integrate AlertRouter

```python
from orchestration.nexus import AlertRouter, Alert, Severity, NexusConfig

config = NexusConfig.from_env()
router = AlertRouter(config)

await router.route(Alert(
    severity=Severity.HIGH,
    source_agent="VOLT",
    title="GPU Temperature Critical",
    message="RTX 4090 #3 at 95°C",
))
```

## Tests

```bash
pytest orchestration/nexus/tests/ -v
```
