# DC1 Provider Onboarding

Automated setup script for new GPU providers joining the DC1 network.

## Prerequisites

- SSH key access to the provider machine (passwordless)
- Provider runs Ubuntu 20.04+
- NVIDIA GPU with drivers installed
- 20GB+ free disk space

## Usage

```bash
chmod +x onboard-provider.sh
./onboard-provider.sh <provider_ip> <ssh_user> "<gpu_name>"

# Example:
./onboard-provider.sh 192.168.1.100 dc1 "RTX 3090"
```

## What It Does

1. **Pre-flight**: Tests SSH, GPU, OS version, disk space
2. **Dependencies**: Installs curl, wget, git, python3
3. **Docker**: Installs Docker + nvidia-container-toolkit (GPU passthrough)
4. **DC1 Agent**: Deploys monitoring agent as systemd service
5. **Firewall**: Locks down to DC1 server only (SSH + agent port)
6. **Registration**: Registers provider with Mission Control API

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MC_API_BASE` | `http://76.13.179.86:8084/api` | Mission Control URL |
| `MC_API_TOKEN` | `dc1-mc-gate0-2026` | Auth token |
| `DC1_SERVER_IP` | Auto-detected | DC1 server public IP |
| `DC1_AGENT_SECRET` | Auto-generated | Shared secret for agent auth |

## Monitoring Agent

The agent (`dc1-monitoring-agent.py`) runs as a systemd service on the provider:
- Heartbeat every 60s with GPU metrics
- HTTP server on port 8085 for commands
- Commands: `start_job`, `stop_job`, `checkpoint`, `wipe_memory`, `status`

## Troubleshooting

```bash
# Check agent status on provider
ssh user@provider systemctl status dc1-agent

# View agent logs
ssh user@provider journalctl -u dc1-agent -f

# Test agent endpoint
curl http://provider-ip:8085/
```

## Logs

All onboarding output saved to `provider-setup.log`.
