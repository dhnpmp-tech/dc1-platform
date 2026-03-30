# First Provider Activation Runbook

Use this sequence to prove one real provider can move from registered to online and appear in marketplace discovery.

## 1) Start backend

```bash
npm --prefix backend start
```

## 2) Register a provider (or use an existing provider key)

Set these values from your provider record:

```bash
export API_BASE="http://localhost:8083"
export PROVIDER_KEY="dc1-provider-REPLACE_ME"
export PROVIDER_ID="REPLACE_ME"
```

## 3) Send daemon heartbeat (online proof)

```bash
curl -sS -X POST "$API_BASE/api/providers/heartbeat" \
  -H "content-type: application/json" \
  -d '{
    "api_key":"'"$PROVIDER_KEY"'",
    "provider_ip":"203.0.113.10",
    "provider_hostname":"first-provider-node",
    "gpu_status":{
      "gpu_name":"NVIDIA RTX 4090",
      "gpu_vram_mib":24576,
      "gpu_count":1,
      "daemon_version":"3.3.0",
      "python_version":"3.11.0",
      "os_info":"ubuntu-22.04"
    },
    "cached_models":["meta-llama/Meta-Llama-3-8B-Instruct"]
  }'
```

Expected: `"success": true`, `"approved": true|false`, and `capacity_report` in response.

## 4) Activate provider tier (if not already active)

```bash
curl -sS -X POST "$API_BASE/api/providers/$PROVIDER_ID/activate" \
  -H "x-provider-key: $PROVIDER_KEY"
```

Expected: `"success": true` or `"reason": "Already active"`.

## 5) Verify marketplace visibility

```bash
curl -sS "$API_BASE/api/providers/available" | jq '.providers[] | select(.id == '"$PROVIDER_ID"')'
```

Expected: provider exists, `status` is `online`, and `available_gpu_tiers` is present.
