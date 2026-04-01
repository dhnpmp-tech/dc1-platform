# DCP-240 Quickstart Evidence (2026-03-31 UTC)

## Scope

Validated the new EN/AR 60-second quickstart path for `/v1` and captured executable output.

## Runtime Evidence

### 1) Signup (create renter key)

Command:

```bash
curl -sS -X POST https://dcp.sa/api/dc1/renters/register \
  -H "Content-Type: application/json" \
  -d '{"name":"DX Quickstart Bot 1774961753","email":"dx-quickstart-1774961753@example.com"}'
```

Output:

```json
{"success":true,"renter_id":1774351995123,"api_key":"dc1-renter-REDACTED","message":"Welcome DX Quickstart Bot 1774961753! Save your API key - it won't be shown again."}
```

### 2) Model catalog check (`GET /v1/models`)

Command:

```bash
curl -sS https://api.dcp.sa/v1/models
```

Observed response starts with:

```json
{"object":"list","data":[{"id":"ALLaM-AI/ALLaM-7B-Instruct-preview"},{"id":"BAAI/bge-m3"}]}
```

### 3) cURL first completion (`POST /v1/chat/completions`)

Command:

```bash
curl -sS https://api.dcp.sa/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-renter-key: dc1-renter-REDACTED" \
  -d '{"model":"ALLaM-AI/ALLaM-7B-Instruct-preview","messages":[{"role":"user","content":"Reply with exactly: quickstart-ok"}],"max_tokens":12}'
```

Output:

```json
{"error":"no_capacity","message":"No online providers currently satisfy this model GPU requirement","diagnostics":{"model_id":"ALLaM-AI/ALLaM-7B-Instruct-preview","min_vram_gb":24,"capable_providers":0,"queued_vllm_jobs":0,"provider_heartbeat_stale_ms":600000,"wait_timeout_ms":300000,"job_id":null}}
```

### 4) Node path execution (same payload)

Output:

```json
{"error":"no_capacity","message":"No online providers currently satisfy this model GPU requirement","diagnostics":{"model_id":"ALLaM-AI/ALLaM-7B-Instruct-preview","min_vram_gb":24,"capable_providers":0,"queued_vllm_jobs":0,"provider_heartbeat_stale_ms":600000,"wait_timeout_ms":300000,"job_id":null}}
```

### 5) Python path runtime note

Python interpreter is not installed in this run environment (`python` and `python3` not found). The quickstart includes a copy-paste Python snippet, but runtime execution of that snippet must be completed on a host with Python installed.

## Quickstart Completion Metric Plan

Track one funnel metric weekly:

- **Metric:** `quickstart_first_completion_rate`
- **Definition:** `completed_first_chat_completion / quickstart_page_visits`
- **Completion event:** first successful `POST /v1/chat/completions` (HTTP 200) within 15 minutes of first quickstart page view
- **Cut dimensions:** locale (`en`/`ar`), entry source (`landing`, `docs_map`, `renter_register`), error class (`auth`, `no_capacity`, `validation`)
- **Target:** improve baseline by +15 percentage points over 2 weekly releases
