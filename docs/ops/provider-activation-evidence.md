# Provider Activation Evidence Runbook (DCP-153)

This runbook captures one provider moving from registered to online visibility and then records one authenticated `/v1/chat/completions` stream completion with traceable IDs.

## 1) Register Provider + Key Issuance

```bash
curl -sS -X POST "$DCP_API_BASE_URL/api/providers/register" \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Provider Canary 01",
    "email":"provider.canary01@example.com",
    "gpu_model":"RTX 4090",
    "os":"linux",
    "location":"riyadh"
  }'
```

Expected outputs to persist:
- `provider_id`
- `api_key`
- `installer_url`

## 2) Daemon Download + First Heartbeat

Download installer/daemon:

```bash
curl -sS "$DCP_API_BASE_URL/api/providers/download/daemon?key=$DCP_PROVIDER_KEY" -o dc1-daemon.py
```

Start daemon on provider host and verify first heartbeat reaches backend (provider transitions to `online`/`degraded` under liveness thresholds):

```bash
curl -sS "$DCP_API_BASE_URL/api/providers/$DCP_PROVIDER_ID/liveness"
```

## 3) Online Visibility Check

```bash
curl -sS "$DCP_API_BASE_URL/api/providers/available"
```

Provider should be present and schedulable for inference (sufficient VRAM + heartbeat freshness).

## 4) Authenticated Inference Evidence Export

Run the exporter to generate JSON + Markdown + raw stream transcript artifacts:

```bash
DCP_API_BASE_URL="http://127.0.0.1:8083" \
DCP_PROVIDER_ID="<provider-id>" \
DCP_RENTER_KEY="<active-renter-key>" \
DCP_MODEL_ID="<model-id>" \
npm --prefix backend run provider:evidence -- \
  --provider-id "$DCP_PROVIDER_ID" \
  --renter-key "$DCP_RENTER_KEY" \
  --model "$DCP_MODEL_ID" \
  --window-minutes 15
```

Artifacts are written to:
- `docs/ops/provider-activation-evidence/provider-activation-evidence-*.json`
- `docs/ops/provider-activation-evidence/provider-activation-evidence-*.md`
- `docs/ops/provider-activation-evidence/provider-activation-stream-*.txt`

The bundle includes:
- route + UTC timestamp
- locked endpoint URL used for the paid candidate
- request/trace/provider/session IDs (`X-DCP-*` headers)
- branch + SHA
- raw stream output path proving `[DONE]` completion
- raw stream first/last snippets for quick review in issue comments
- duplicate-charge check pack (nearby retries/failures + ledger/payment joins)
- automatic SQLite joinability snapshots (`usage_rows`, `charge_rows`, `ledger_rows`) for immediate candidate-ID reconciliation
- provider liveness + availability snapshots

## 5) Repeat for Next Providers

For each additional provider, repeat in order:
1. Register (or rotate key) and persist `provider_id/api_key`.
2. Install daemon with provider key.
3. Confirm heartbeat + online liveness.
4. Run `provider:evidence` using an active renter key and target model.
5. Attach generated markdown/json/stream artifacts to task evidence.

## Remaining Gaps Before Scaling to 10 Active Providers

- No automated fleet orchestration for daemon rollout/key rotation; still manual per host.
- No single API endpoint currently emits provider activation state + latest inference evidence in one query.
- Capacity prechecks rely on runtime availability snapshots; no admission control reservation for first-token SLA.
- Evidence generation requires an active renter key/model input; control-plane issued ephemeral test keys are not yet automated.
