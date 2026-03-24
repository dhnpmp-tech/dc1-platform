# Wallet Top-Up Flow Audit

**DCP-799 | Blockchain Engineer | 2026-03-24**

## Summary

The renter wallet top-up flow is **sound for the off-chain halala layer**. Balance
updates are atomic via SQLite transactions with `AND balance_halala >= ?` guards on
deductions. Two gaps are flagged below.

---

## Flow Trace: `POST /api/payments/topup`

### 1. Entrypoint — `backend/src/routes/payments.js`

```
POST /api/payments/topup
  Header: x-renter-key: <api_key>
  Body: { amount_halala: 5000, payment_method: "creditcard" }
```

**Auth**: `requireRenter` middleware reads `renters.api_key` — returns `401` if
missing or inactive.

**Validation**:
- `amount_halala` must be integer in `[100, 1_000_000]` (1 SAR – 10,000 SAR).
- Legacy `amount_sar` field accepted but converted: `amountHalala = round(sar * 100)`.
- `payment_method` must be `creditcard` or `applepay`.
- `callback_url` must be `https://` in production and on an allowlisted origin.

### 2. Moyasar API call

```
POST https://api.moyasar.com/v1/payments
  { amount, currency: "SAR", source: { type: paymentMethod },
    metadata: { renter_id, renter_email } }
```

Returns a hosted checkout URL. **No balance change occurs at this step** — the
record is inserted as `status = 'pending'`.

```sql
INSERT INTO payments (..., status = 'pending', ...)
```

### 3. Balance credit — `POST /api/payments/webhook`

Moyasar POSTs a signed webhook when the payment settles.

**HMAC verification**: `crypto.timingSafeEqual` on SHA-256 HMAC of raw request
body against `MOYASAR_WEBHOOK_SECRET`. The route mounts `express.raw()` before
`express.json()` to preserve the body for signature validation.

On `status = 'paid'`, `markPaymentPaidOnce` runs inside a SQLite transaction:

```js
// Atomic double-write inside db._db.transaction():
UPDATE payments SET status='paid', confirmed_at=? WHERE payment_id=?
    AND status IN ('pending','initiated','failed')   -- idempotency guard
UPDATE renters SET balance_halala = balance_halala + ? WHERE id = ?
```

If `payments.changes === 0` (already processed), the balance update is skipped —
**double-credit is not possible**.

### 4. Sandbox path — `POST /api/payments/topup-sandbox`

Dev-only (blocked in production via `isProduction()` check + Moyasar key guard).
Directly credits balance and inserts a `status='paid'` payment record in one
un-transacted pair of statements.

### 5. Late-sync path — `GET /api/payments/verify/:paymentId`

Frontend polls after redirect. If Moyasar reports `paid` but local record is not,
`markPaymentPaidOnce` is called again — same idempotency guard applies.

---

## Atomicity Assessment

| Operation | Atomic? | Mechanism |
|---|---|---|
| Payment confirmed → balance credited | **Yes** | `db._db.transaction()` with idempotency guard on `payments.status` |
| Job dispatch → balance deducted | **Yes** | `UPDATE renters SET balance_halala = balance_halala - ? WHERE id = ? AND balance_halala >= ?` |
| Refund processed → balance debited | **Yes** | `markPaymentRefundedOnce` with `refunded_at IS NULL` guard |
| Sandbox topup | **Partial** | Two separate statements — not wrapped in a transaction (see Gap 1) |

---

## Minimum Top-Up Amount

| Route | Minimum |
|---|---|
| `POST /api/payments/topup` | **100 halala (1 SAR)** |
| `POST /api/payments/topup-sandbox` | **1 halala (0.01 SAR)** |

---

## Admin Approval Flow

There is **no admin approval step** in the Moyasar flow. Payments are confirmed
directly by the Moyasar webhook. Admin-issued credits use a separate path:

```
POST /api/renters/:id/credit  (admin route in renters.js)
  → creditService.addCredits(db, renterId, amount, 'admin_grant', ...)
  → Writes to credit_grants table + increments renters.balance_halala
```

The `credit_grants` table provides an immutable audit trail for all manual credits.

---

## Gaps & Recommendations

### Gap 1 — Sandbox topup is not transactional (low severity — dev only)

**Location**: `payments.js` `POST /api/payments/topup-sandbox` (lines ~230–260)

The sandbox route inserts into `payments` and then `UPDATE renters` as two separate
statements with no enclosing transaction. A crash between them would leave a `paid`
payment record without a corresponding balance credit.

**Impact**: Dev/test environments only — blocked in production by `isProduction()`.

**Recommendation**: Wrap in `db._db.transaction()` for consistency with the
production path.

```js
// Recommended fix
const creditSandbox = db._db.transaction(() => {
  db.prepare(`INSERT INTO payments (...) VALUES (...)`).run(...);
  db.prepare(`UPDATE renters SET balance_halala = balance_halala + ? WHERE id = ?`).run(amountHalala, renter.id);
  return db.prepare(`SELECT balance_halala FROM renters WHERE id = ?`).get(renter.id);
});
const updated = creditSandbox();
```

### Gap 2 — No minimum top-up enforced on the admin credit route (low severity)

`creditService.addCredits` allows any `amountHalala > 0`. Admin can grant 1 halala
credits. Not a security issue but worth a guard (e.g., `min: 100`) to prevent
noise in the ledger.

### Gap 3 — `MOYASAR_WEBHOOK_SECRET` absence causes 503 (operational risk)

If `MOYASAR_WEBHOOK_SECRET` is unset in production, every webhook returns 503.
Moyasar will retry, but payments initiated during the misconfiguration window will
appear as `pending` until the `/verify` poll or a manual sync resolves them.

**Recommendation**: Add a startup assertion in `server.js`:
```js
if (process.env.NODE_ENV === 'production' && !process.env.MOYASAR_WEBHOOK_SECRET) {
  throw new Error('MOYASAR_WEBHOOK_SECRET must be set in production');
}
```

---

## Key Files

| File | Role |
|---|---|
| `backend/src/routes/payments.js` | Top-up initiation, webhook handling, verify |
| `backend/src/services/creditService.js` | `addCredits`, `deductCredits`, `checkBalance` |
| `backend/src/db.js` | Schema: `payments`, `renter_credit_ledger`, `credit_grants` |
| `backend/src/routes/jobs.js` | Atomic balance deduction on job dispatch |

---

## Conclusion

The production top-up path (Moyasar + webhook) is **correctly atomic** with proper
idempotency guards. The sandbox path has a minor atomicity gap in dev mode only.
The overall balance integrity invariant is maintained: every credit is either from
a verified Moyasar webhook or an admin-authored `credit_grants` record.
