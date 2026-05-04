# DCP Dispatch Context — for remote Claude Code agents

## Infrastructure
- VPS: 76.13.179.86 (NOT directly SSH-accessible from remote agents)
- Backend: https://api.dcp.sa (port 8083 behind nginx)
- Frontend: https://dcp.sa (Vercel)
- DB: SQLite at /root/dc1-platform/backend/data/providers.db
- PM2 process: dc1-provider-onboarding

## API Endpoints (accessible via curl)
- Health: GET https://api.dcp.sa/api/health
- Fleet health: GET https://api.dcp.sa/api/admin/fleet-health (header: x-admin-token: 6bcd314335b4929e84b15649a15089ab7dc2b36f431af2e2caf27455d2b8eec4)
- Fleet errors: GET https://api.dcp.sa/api/admin/fleet-errors?hours=24
- Inference: POST https://api.dcp.sa/v1/chat/completions (Bearer dcp-renter-33e11826e1846dddf86a453cdc29103a)
- Provider status: GET https://api.dcp.sa/v1/provider/node-status (Bearer <provider-api-key>)

## Downloads
- Mac: https://api.dcp.sa/download/mac
- Windows: https://api.dcp.sa/download/windows

## Telegram Bot
- Token: 8397318012:AAEVIyEYiAM8rckObwHGjJKut6Q9nZv25f4
- Group: -1003773787353
- Send: POST https://api.telegram.org/bot<TOKEN>/sendMessage {"chat_id": "<GROUP>", "text": "..."}

## Providers
| ID | Email | GPU | OS | WG IP | Status |
|----|-------|-----|-----|-------|--------|
| 1774351995311 | dhnpmp@gmail.com | Apple M2 12GB | macOS | 10.8.0.3 | online |
| 1774351995309 | mcmazyad@live.com | RTX 3060 Ti 8GB | Windows | 10.8.0.2 | offline |

## Current versions
- Daemon: 4.3.0 (14 features: thread restart, job dedup, status.json, health endpoint, etc.)
- Desktop installer: 0.2.8 (Tauri, persistent WG, download progress)
- Model routing: supports Ollama tags, MLX names, HuggingFace IDs

## Known issues
- Fadi (1774351995309): 1 Mbps connection, installer model download was hanging — fixed with progress UI
- macOS WG: persistent via launchd keeper (sa.dcp.wireguard)
- Windows WG: persistent via wireguard /installtunnelservice
