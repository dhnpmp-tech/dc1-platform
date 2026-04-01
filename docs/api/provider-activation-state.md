# Provider Activation State API

Canonical activation progress endpoint for provider onboarding.

This endpoint is the single source of truth for frontend activation rails and support tooling.

## Endpoint

`GET /api/providers/activation-state`

## Auth

- Provider self lookup: `x-provider-key: <provider-api-key>` (or `Authorization: Bearer <provider-api-key>`)
- Admin lookup: `x-admin-token: <admin-token>` + `provider_id` query param

## Query Params

- `provider_id` (admin only): target provider id

## Canonical States

- `not_started`: no daemon activity and no heartbeat yet
- `install_started`: daemon detected but first heartbeat not received
- `heartbeat_received`: heartbeat received and onboarding is progressing but not yet ready for jobs
- `ready_for_jobs`: fully activated and ready to receive jobs
- `blocked`: onboarding is blocked by one or more hard blockers

## Response Shape

```json
{
  "provider_id": 123,
  "activation_state": "heartbeat_received",
  "blocker_codes": ["approval_pending", "provider_not_online"],
  "blockers": [
    {
      "code": "approval_pending",
      "severity": "soft",
      "hint_key": "wait_approval",
      "hint_en": "Provider registration is pending admin approval.",
      "hint_ar": "تسجيل المزود بانتظار موافقة الإدارة."
    }
  ],
  "next_action": {
    "hint_key": "wait_approval",
    "hint_en": "Provider registration is pending admin approval.",
    "hint_ar": "تسجيل المزود بانتظار موافقة الإدارة."
  },
  "signals": {
    "approval_status": "pending",
    "provider_status": "offline",
    "readiness_status": "pending",
    "is_paused": false,
    "daemon_seen": true,
    "heartbeat_received": true,
    "heartbeat_fresh": true,
    "heartbeat_age_seconds": 42,
    "last_heartbeat": "2026-04-01T18:20:00.000Z",
    "gpu_profile_complete": true
  },
  "generated_at": "2026-04-01T18:21:00.000Z"
}
```

## Blocker Codes

- `daemon_not_detected`
- `heartbeat_missing`
- `heartbeat_stale`
- `approval_pending`
- `approval_rejected`
- `provider_paused`
- `provider_suspended`
- `readiness_pending`
- `readiness_failed`
- `gpu_profile_incomplete`
- `provider_not_online`

## Error Contract

Errors follow the standard JSON contract:

```json
{
  "error": "Provider API key required",
  "code": "PROVIDER_AUTH_REQUIRED",
  "statusCode": 401,
  "details": {
    "remediation_hint": {
      "hint_key": "install_daemon",
      "hint_en": "Install and start the provider daemon, then send the first heartbeat.",
      "hint_ar": "قم بتثبيت وتشغيل دايمون المزود ثم أرسل أول نبضة."
    }
  }
}
```
