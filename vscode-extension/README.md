# DCP GPU Compute — VS Code Extension

Submit and monitor GPU jobs on **DCP** directly from VS Code or Cursor.

## Features

### Provider workflow
- Provider status sidebar (`DCP Provider`) with online state, GPU profile, jobs, and earnings.
- Provider API key stored in VS Code `SecretStorage`.
- Provider connection status bar (`DCP Provider ✅/❌`).

### Renter workflow
- GPU marketplace tree (`Available GPUs`) with model, VRAM, location, and reliability.
- `DCP: Run AI Inference` panel for vLLM prompts and model selection.
- `DCP: Submit Container Job (Advanced)` panel for explicit container spec jobs.
- `My Jobs` tree with status icons and per-job log viewing.
- Live log streaming command (`DCP: Watch Job Logs`) with auto-retry and polling fallback when SSE is unavailable.
- Wallet/status bar signal showing active jobs and quick link to billing (`https://dcp.sa/renter/billing`).

## Key Commands

- `DCP: Set Renter API Key`
- `DCP: Set Provider API Key`
- `DCP: Run AI Inference`
- `DCP: Submit Container Job (Advanced)`
- `DCP: Watch Job Logs`
- `DCP: Model Cache Status`
- `DCP: Settings`

## Configuration

| Setting | Default | Description |
|---|---|---|
| `dc1.apiBase` | `https://api.dcp.sa` | DCP API base URL |
| `dc1.renterApiKey` | `""` | Optional renter key in settings (prefer command + SecretStorage) |
| `dc1.pollIntervalSeconds` | `10` | Job status polling interval (seconds) |
| `dc1.autoRefreshGPUs` | `true` | Auto-refresh GPU list every 30s |

## Security Notes

- Preferred key storage is VS Code `SecretStorage` via `DCP: Set Renter API Key` or `DCP: Set Provider API Key`.
- If a renter key was previously saved in `dc1.renterApiKey`, the extension now migrates it into `SecretStorage` on load and clears the plain-text setting.
- Auth/session failures (401/403) trigger a re-authentication prompt during submit and log operations.
- Avoid committing workspace/user settings files that contain API keys.

## Reliability Behavior

- Job submission (container and vLLM) retries transient failures up to 3 attempts with short backoff.
- Log streaming retries transient connect failures before reporting stream unavailability.
- When streaming remains unavailable, the extension falls back to job status polling using `dc1.pollIntervalSeconds`.

## Quick Start

1. Install extension from VSIX.
2. Run `DCP: Set Renter API Key` (or provider key for provider workflow).
3. Open the `DCP Compute` activity bar view.
4. Run `DCP: Run AI Inference` and submit a test prompt.
5. Use `DCP: Watch Job Logs` for live stream output.

## API Surface Used

- `GET /api/renters/available-providers`
- `GET /api/renters/me?key=`
- `POST /api/jobs/submit`
- `GET /api/jobs/:id/output`
- `GET /api/jobs/:id/logs/stream`
- `GET /api/vllm/models`
- `POST /api/vllm/complete`
- `GET /api/providers/me?key=`

## Demo Script

Use [`DEMO-SCRIPT.md`](./DEMO-SCRIPT.md) for a partner-ready live demo flow.
