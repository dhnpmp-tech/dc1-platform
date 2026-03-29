# OpenRouter Provider Readiness Checklist

Date: 2026-03-29
Owner: Staff Engineer (`DCP-38`)
Scope: Independent readiness and risk review for onboarding DC1's decentralized GPU marketplace into an OpenRouter-style provider/compliance lane.

## Source Snapshot

External requirements below are based on OpenRouter public docs reviewed on 2026-03-29:

- API reference: OpenRouter uses an OpenAI-compatible chat schema, supports streaming, tool calling, provider routing, and a stable `user` identifier for abuse prevention.
- Parameters: OpenRouter exposes a wider request surface than basic `model` plus `messages`, and expects model/provider compatibility to be explicit.
- Uptime guidance: OpenRouter monitors provider response times, error rates, and availability in real time, then routes using that health data.
- ZDR guidance: OpenRouter tracks endpoint-specific retention/training policy and can enforce Zero Data Retention per request.

Primary source URLs:

- `https://openrouter.ai/docs/api/reference/overview`
- `https://openrouter.ai/docs/api/reference/parameters`
- `https://openrouter.ai/docs/guides/best-practices/uptime-optimization`
- `https://openrouter.ai/docs/guides/features/zdr`

## Architecture Cross-Check

Observed DC1 implementation evidence:

- `backend/src/routes/providers.js`
  - Provider registration stores basic identity plus optional `resource_spec`.
  - Provider heartbeat stores GPU telemetry, daemon version, `vllm_endpoint_url`, `vllm_models`, cached models, and capacity summary.
  - Heartbeat authenticity depends on `DC1_REQUIRE_HEARTBEAT_HMAC`; without that env, invalid signatures only warn.
- `backend/src/routes/v1.js`
  - Exposes `GET /v1/models` and `POST /v1/chat/completions`.
  - Routes by provider VRAM, recent heartbeat, and lowest utilization, with direct proxy fallback only when `vllm_endpoint_url` exists.
  - For direct proxy, only forwards `model`, `messages`, `max_tokens`, `temperature`, and `stream`.
  - Parses `tools` and `tool_choice` but does not forward them to the upstream provider.
  - Does not forward `provider`, `models`, `route`, `user`, `response_format`, `top_p`, `seed`, penalties, or ZDR/privacy preferences.
- `backend/src/routes/models.js`
  - Tracks benchmark and cold-start/readiness metadata for internal cataloging.
  - This richer readiness metadata is not surfaced in `/v1/models`.
- `backend/src/routes/renters.js`
  - `GET /api/renters/available-providers` exposes live providers, but not policy metadata such as geography, moderation, or data-retention guarantees.

## Requirement Matrix

| Requirement | Current DC1 state | Status | Notes |
| --- | --- | --- | --- |
| OpenAI-compatible chat endpoint | `/v1/chat/completions` exists | Partial | Basic path exists, but request contract is materially narrower than OpenRouter docs. |
| Streaming support | Implemented in `/v1/chat/completions` | Partial | Streaming works, but no final normalized usage handling for proxied streams. |
| Tool-calling compatibility | Request parser recognizes tool messages | Gap | `tools` and `tool_choice` are not forwarded to provider endpoints today. |
| Model listing | `/v1/models` exists | Partial | Returns a basic model list, but omits support/policy metadata needed for provider selection clarity. |
| Provider health and failover | Heartbeats plus endpoint fallback exist | Partial | Routing is based on self-reported heartbeats and point-in-time utilization, not measured latency/error SLOs. |
| Policy-aware routing (ZDR, no-train, moderation, geography) | No provider policy model in DB/routes | Gap | Cannot enforce OpenRouter-style policy constraints per request or per provider. |
| Abuse prevention traceability | No stable `user` field propagation in `/v1` | Gap | Limits downstream abuse detection and incident forensics. |
| Moderation/compliance hooks | No moderation gate in request path | Gap | Risk if onboarding requires moderation-required models/providers. |
| Trusted provider telemetry | HMAC exists but can run in warn-only mode | Partial | Production trust depends on env discipline rather than hard enforcement in code. |
| Observability for onboarding claims | Basic logs and counters exist | Partial | Missing endpoint-level latency/error reporting per provider and no explicit provider SLA dashboard. |

## Risk Register

### Must Fix Before Go-Live

1. `Critical` Policy-aware routing metadata does not exist.
   - We do not store or enforce provider-level data-retention, no-training, moderation-required, or geography constraints.
   - This makes OpenRouter-style ZDR or region-constrained onboarding claims indefensible.

2. `Critical` Provider health scoring is not based on measured serving behavior.
   - OpenRouter’s public guidance is explicit that routing uses response times, error rates, and availability.
   - DC1 currently routes mostly from heartbeat freshness, VRAM, and utilization, which is not enough for external provider onboarding.

3. `High` `/v1/chat/completions` only implements a narrow request subset.
   - Current direct proxy path drops major request fields documented by OpenRouter, including `provider`, `models`, `route`, `user`, `response_format`, and generation controls beyond `temperature`.
   - Tool-calling is especially misleading because the route parses tool-related fields but does not actually send them upstream.

4. `High` Abuse and moderation controls are not integrated.
   - OpenRouter documents a stable `user` identifier for abuse prevention, and some provider paths publicly signal moderation requirements.
   - DC1 has no first-class moderation or abuse-routing control in the `/v1` request path.

5. `High` Heartbeat trust boundary is soft unless production env is perfect.
   - `providers.js` allows warn-only heartbeat HMAC validation when `DC1_REQUIRE_HEARTBEAT_HMAC` is not enabled.
   - For third-party provider onboarding, spoofable health/capacity signals are not acceptable.

### Can Follow Up After Initial Controlled Pilot

1. `Medium` `/v1/models` should publish richer readiness metadata.
   - Supported parameters, latency class, cold-start expectations, and policy flags should be discoverable.

2. `Medium` Generation audit endpoints are incomplete.
   - OpenRouter exposes post-request stats and richer usage semantics; DC1 currently relies on inline response usage and local billing state.

3. `Medium` Public provider discovery lacks policy filters.
   - Renters cannot currently filter live providers by geography, trust tier, or retention policy.

## What DCP-36 Needs To Close

The sibling backend implementation lane should be considered complete only if it delivers all of the following:

1. A provider policy model in storage and routing logic.
   - Minimum fields: `retention_policy`, `training_policy`, `moderation_required`, `region`, `zdr_eligible`.

2. Active endpoint health measurement.
   - Persist per-provider success rate, timeout rate, and latency windows from real proxy traffic or synthetic probes.

3. `/v1` contract clarification.
   - Either forward the documented request fields end-to-end, or explicitly narrow the API contract and remove misleading partial parsing.

4. Abuse/compliance traceability.
   - Accept and persist the request `user` identifier and define moderation-handling behavior.

5. Hard production trust requirements.
   - Enforce heartbeat HMAC in production and validate provider endpoint ownership/onboarding attestation before routing traffic.

## Go/No-Go Recommendation

Recommendation: `No-go` for broad OpenRouter-style provider onboarding today.

Reasoning:

- The current stack is technically promising for a controlled pilot because it already has provider registration, heartbeat telemetry, direct vLLM endpoint routing, and basic failover.
- It is not ready for a provider/compliance claim set that depends on policy-aware routing, measurable serving SLOs, moderation handling, and ZDR-style assurances.

Safe near-term scope:

- Proceed only with a tightly controlled pilot on trusted providers.
- Explicitly avoid claiming ZDR, moderation coverage, geography guarantees, or full OpenRouter request-surface compatibility until the must-fix items are closed.
