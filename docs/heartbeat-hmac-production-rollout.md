# Heartbeat HMAC Production Rollout

## Change Summary

As of this change, `POST /api/providers/heartbeat` always enforces `X-DC1-Signature` validation when `NODE_ENV=production`.

- Production no longer supports warn-only heartbeat HMAC mode.
- Invalid or missing heartbeat signatures now return `401`.
- Non-production still supports explicit toggle-based rollout via `DC1_REQUIRE_HEARTBEAT_HMAC=1`.

## Safe Activation Checklist

1. Ensure `DC1_HMAC_SECRET` is set in production to a strong shared secret (32+ random bytes).
2. Verify provider daemons sign heartbeat payloads using:
   - header: `X-DC1-Signature: sha256=<hex>`
   - message: exact raw JSON body bytes sent to `/api/providers/heartbeat`
3. Deploy backend first, then monitor for `HMAC rejected` log lines.
4. If rejects occur, rotate affected provider daemon configs and restart daemons.
5. Keep alerting on heartbeat drop/rate anomalies for at least one full provider heartbeat cycle window.

## Operational Notes

- A missing `DC1_HMAC_SECRET` in production now blocks all heartbeat updates by design.
- This intentionally fails closed to prevent spoofed provider status injection.
