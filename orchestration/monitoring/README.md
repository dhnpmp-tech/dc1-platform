# DC1 Gate 0 — Network Monitor

Monitors STC ISP connectivity from the provider host (PC1) via ICMP ping, detecting packet loss, outages, and latency trends.

## Features

- **Continuous ping** — 8.8.8.8 (primary) + 1.1.1.1 (fallback), every 10s
- **Packet loss detection** — rolling 60s window, alerts if >5%
- **Outage detection** — alerts after 5s consecutive failure
- **Latency trending** — p50/p95/p99 stored hourly in SQLite (7-day retention)
- **MC alerts** — POST to Mission Control API on outage/loss
- **Status endpoint** — `GET :8085/status` returns JSON health summary
- **Graceful shutdown** — handles SIGTERM/SIGINT

## Quick Start

```bash
cd orchestration/monitoring
pip install -r requirements.txt
python network_monitor.py
```

## Run with PM2

```bash
pm2 start network_monitor.py --name dc1-netmon --interpreter python3
pm2 save
```

## Configuration

Edit `network_config.yaml`:

| Section | Key | Default | Description |
|---------|-----|---------|-------------|
| `targets` | `primary` | `8.8.8.8` | Primary ping target |
| `targets` | `fallback` | `1.1.1.1` | Fallback ping target |
| `ping` | `interval_s` | `10` | Seconds between pings |
| `ping` | `timeout_s` | `5` | Ping timeout |
| `thresholds` | `loss_pct_alert` | `5.0` | Loss % to trigger alert |
| `thresholds` | `outage_consecutive_s` | `5` | Seconds of failure = outage |
| `thresholds` | `rolling_window_s` | `60` | Rolling window for loss calc |
| `storage` | `db_path` | `data/network_metrics.db` | SQLite database path |
| `storage` | `retention_days` | `7` | Data retention period |
| `logging` | `log_path` | `logs/network_monitor.log` | Log file path |
| `alerts` | `cooldown_s` | `300` | Min seconds between alerts |
| `status` | `port` | `8085` | Status endpoint port |

Override config path via `NM_CONFIG` env var.

## Status Endpoint

```
GET http://localhost:8085/status
```

```json
{
  "status": "healthy",
  "latency_ms": 12.34,
  "loss_pct": 0.0,
  "uptime_pct_24h": 99.98,
  "last_outage": null
}
```
