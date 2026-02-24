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
- **Rate limiting** — /status endpoint limited to 60 requests/minute
- **Configuration validation** — startup validation of all config parameters

## Quick Start

```bash
cd orchestration/monitoring
pip install -r requirements.txt

# Set required environment variables
export DC1_MC_TOKEN="your-mission-control-token"
export DC1_AGENT_ID="your-agent-uuid"

python network_monitor.py
```

## Run with PM2

```bash
# Set environment variables first
export DC1_MC_TOKEN="your-mission-control-token"
export DC1_AGENT_ID="your-agent-uuid"

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

## Security

### Credentials Management

**IMPORTANT**: Sensitive credentials must NEVER be hardcoded in configuration files or the source code.

All authentication credentials are provided exclusively through environment variables at startup:

- **DC1_MC_TOKEN** — Mission Control API authentication token
- **DC1_AGENT_ID** — Agent UUID for identification with Mission Control

The application validates these variables at startup and raises a `RuntimeError` if either is missing, preventing the monitor from running without proper credentials.

### Configuration Validation

All configuration parameters are validated at startup:

- Timeouts and intervals must be positive values
- Packet loss threshold must be between 0-100%
- Port number must be valid (1-65535)
- Data retention period must be positive

Invalid configuration raises a `ConfigValidationError` and prevents startup.

### Endpoint Security

- **Status endpoint rate limiting**: Limited to 60 requests per minute (429 Too Many Requests on exceeding limit)
- **SIGTERM/SIGINT handling**: Graceful shutdown on terminate signals
- **No sensitive data in logs**: Credentials are never logged or displayed
- **No sensitive data in responses**: Status endpoint returns only health metrics, no credentials

### Database Security

- Metrics data stored in SQLite database with automatic cleanup based on retention policy (default 7 days)
- Database file should be protected with appropriate filesystem permissions
- No credentials stored in database

### Deployment Best Practices

1. Set environment variables securely (use systemd EnvironmentFile or similar)
2. Restrict file permissions on config file (mode 0640)
3. Run with minimal required privileges (non-root if possible)
4. Monitor logs for unexpected errors or credential-related failures
5. Rotate API tokens regularly and update DC1_MC_TOKEN
6. Use secure secret management (HashiCorp Vault, AWS Secrets Manager, etc.) in production

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

Response codes:
- **200 OK** — Normal response
- **429 Too Many Requests** — Rate limit exceeded
- **500 Internal Server Error** — Server error

## Testing

Run the test suite:

```bash
pytest test_network_monitor.py -v
```

## Logs

Monitor logs are stored in `logs/network_monitor.log`. Check logs for:

- Startup validation errors
- Ping failures and outages
- Alert notifications
- Configuration issues

## Troubleshooting

**Missing environment variables:**
```
ERROR: Missing required environment variable: DC1_MC_TOKEN
```

**Solution**: Set the required environment variables before starting:
```bash
export DC1_MC_TOKEN="your-token"
export DC1_AGENT_ID="your-uuid"
```

**Configuration validation errors:**
```
CONFIG ERROR: thresholds.loss_pct_alert must be between 0 and 100
```

**Solution**: Fix the invalid configuration value in `network_config.yaml`.

**Cannot connect to status endpoint:**
Make sure the monitor is running and the port matches `status.port` in config (default 8085).
