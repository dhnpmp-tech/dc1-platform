# DCP Token And Secret Rotation Runbook

Last updated: 2026-03-19

## Scope
- `DC1_ADMIN_TOKEN` (admin API authentication)
- `DC1_HMAC_SECRET` (job/task signature integrity)
- Provider/renter API key format and entropy checks

## 1) Generate A New Admin Token
Use OpenSSL on the VPS host:

```bash
openssl rand -hex 32
```

Expected output: 64 hex characters.

## 2) Set VPS Environment Variable
Set the new token in PM2 ecosystem or secure runtime env:
- Variable name: `DC1_ADMIN_TOKEN`
- Never hardcode a live token in source control or documentation.

Example (edit env source, then reload):

```bash
pm2 reload dc1-provider-onboarding --update-env
```

## 3) Rotation Procedure (Admin Token)
1. Generate token: `openssl rand -hex 32`
2. Update `DC1_ADMIN_TOKEN` on VPS
3. Reload process: `pm2 reload dc1-provider-onboarding --update-env`
4. Verify old token is rejected (401/403)
5. Verify new token can access `/api/admin/dashboard`
6. Invalidate any places where the old token was shared

## 4) Rotation Frequency
- Rotate `DC1_ADMIN_TOKEN` every 90 days
- Rotate immediately after any suspected exposure

## 5) HMAC Secret Audit (`DC1_HMAC_SECRET`)
`DC1_HMAC_SECRET` must be set and must not use placeholder/default values.

Audit checklist:
1. Confirm variable exists in runtime env
2. Confirm value is not empty
3. Confirm value is not `CHANGE_ME_openssl_rand_hex_32`
4. Confirm all app instances use the same value

Quick runtime check (on VPS):

```bash
pm2 env dc1-provider-onboarding | grep -E 'DC1_HMAC_SECRET|DC1_ADMIN_TOKEN'
```

If weak/default, rotate immediately:
1. Generate secret: `openssl rand -hex 32`
2. Set `DC1_HMAC_SECRET` in VPS env
3. Reload PM2 with `--update-env`
4. Validate fresh jobs get valid signatures and daemon verification succeeds

## 6) API Key Entropy Audit (Provider/Renter)
Current format in backend routes:
- Provider: `dc1-provider-` + `crypto.randomBytes(16).toString('hex')`
- Renter: `dc1-renter-` + `crypto.randomBytes(16).toString('hex')`

Entropy:
- 16 random bytes = 128 bits
- 32 hex characters of randomness
- Acceptable for API key identifiers in this system

Recommendation:
- Keep minimum entropy at 128 bits (or increase to 192/256 bits if threat model requires)
- Continue allowing forced key rotation endpoints for incident response

## 7) Post-Rotation Verification
- Admin endpoints work only with the new `DC1_ADMIN_TOKEN`
- Provider/renter flows unaffected
- Job signing/verification works with current `DC1_HMAC_SECRET`
- No live secrets remain in code/docs (`grep` audit clean)
