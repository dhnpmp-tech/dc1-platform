# Topup Flow Security Audit

**DCP-851 | Security Engineer | 2026-03-24**

Scope: `POST /api/payments/topup` (bank_transfer path), `POST /api/admin/payments/confirm-topup`, `GET /api/payments/balance`
Branch: `security/sprint28-topup-flow-audit`
Files reviewed: `backend/src/routes/payments.js`, `backend/src/routes/admin.js`, `backend/src/middleware/adminAuth.js`, `backend/src/middleware/auth.js`

---

## Summary

| # | Check | Result |
|---|---|---|
| 1 | Concurrent pending topup limit (1 pending per renter) | **FAIL** |
| 2 | Amount validation — reject negatives, enforce max | **PASS** |
| 3 | topupId unguessable (UUID-grade randomness) | **PASS** |
| 4 | Admin-only access on confirm-topup | **PASS** |
| 5 | Double-credit idempotency guard in DB transaction | **FAIL** |
| 6 | Audit log of who confirmed which topup | **PASS (minor gap)** |
| 7 | Balance scoped to requesting renter (no IDOR) | **PASS** |

**Critical: 1 | Fail: 2 | Pass: 5**

Phase 1 external users MUST NOT be able to add credit until finding #5 (double-credit) is fixed.

---

## Finding 1 — FAIL: No pending topup limit per renter

**Severity:** Medium
**Location:** `backend/src/routes/payments.js` — `POST /api/payments/topup` (bank_transfer path, ~line 278)

### What the code does

```js
// topup route, bank_transfer branch
const topupId = `pay_bt_${crypto.randomBytes(12).toString('hex')}`;
runStatement(`INSERT INTO payments (..., status, ...) VALUES (?, ?, ?, ?, 'pending', ...)`, ...);
return res.json({ topup_id: topupId, ... });
```

There is no check for existing `pending` bank-transfer payments before inserting a new one. A renter can call `POST /api/payments/topup` with `payment_method: "bank_transfer"` indefinitely, generating unlimited pending entries.

### Fraud scenario

1. Attacker registers as a renter and submits 50 pending bank-transfer topups of 10,000 SAR each (total 500,000 SAR claimed).
2. Admin dashboard shows many pending transfers from the same renter.
3. If admin tooling processes pending topups in batch without careful de-duplication, or if an attacker uses social engineering to get admins to confirm the wrong entry, they receive unearned credits.

Even without batch processing errors, flooding the pending queue creates operational noise and makes legitimate transfers harder to manage.

### Recommendation

Before inserting a new bank-transfer topup, check for an existing `pending` entry for the same renter:

```js
const existingPending = db.get(
  `SELECT payment_id FROM payments WHERE renter_id = ? AND source_type = 'bank_transfer' AND status = 'pending'`,
  renter.id
);
if (existingPending) {
  return res.status(409).json({
    error: 'You already have a pending bank transfer. Cancel or wait for it to be confirmed.',
    pending_topup_id: existingPending.payment_id,
  });
}
```

---

## Finding 2 — PASS: Amount validation

**Location:** `backend/src/routes/payments.js` ~line 255

```js
let amountHalala = toFiniteInt(amount_halala, { min: 100, max: 1000000 });
```

- Rejects negative values (min: 100 halala = 1 SAR) ✓
- Rejects non-integers ✓
- Enforces maximum (1,000,000 halala = 10,000 SAR) ✓
- Legacy `amount_sar` path also validates: min 1 SAR, max 10,000 SAR ✓

No issues found.

---

## Finding 3 — PASS: topupId is unguessable

**Location:** `backend/src/routes/payments.js` ~line 279

```js
const topupId = `pay_bt_${crypto.randomBytes(12).toString('hex')}`;
```

96 bits of cryptographic randomness via Node's `crypto.randomBytes`. IDs are not sequential integers. An attacker cannot enumerate or predict topup IDs.

No issues found.

---

## Finding 4 — PASS: Admin role required on confirm-topup

**Location:** `backend/src/routes/admin.js` ~line 53

```js
router.use(requireAdminRbac);
```

`requireAdminRbac` (from `backend/src/middleware/adminAuth.js`) runs before every route in the admin router, including `POST /api/admin/payments/confirm-topup`. It enforces either:

- JWT Bearer token with `req.user.role === 'admin'`, or
- Static `DC1_ADMIN_TOKEN` env var (constant-time comparison via `crypto.timingSafeEqual`)

A regular renter API key (`x-renter-key`) does not grant access to the admin router. 401 is returned for missing/invalid credentials; 403 for wrong role.

No issues found.

---

## Finding 5 — FAIL (CRITICAL): Double-credit race condition in confirm-topup

**Severity:** Critical
**Location:** `backend/src/routes/admin.js` ~lines 2163–2201

### What the code does

```js
// Application-level check (TOCTOU vulnerability)
const payment = db.get(`SELECT * FROM payments WHERE payment_id = ? AND source_type = 'bank_transfer'`, topupId);
if (payment.status === 'paid') {
  return res.status(409).json({ error: 'Topup already confirmed' });
}
// ...
const tx = db._db.transaction(() => {
  db.prepare(
    `UPDATE payments SET status = 'paid', confirmed_at = ?, gateway_response = ? WHERE payment_id = ?`
    //                                                                            ^^^^^^^^^^^^^^^^^^^
    //                                                   NO status guard — will re-run on already-paid row!
  ).run(now, ..., payment.payment_id);

  db.prepare(
    `UPDATE renters SET balance_halala = balance_halala + ?, updated_at = ? WHERE id = ?`
  ).run(payment.amount_halala, now, renter.id);   // ← credited again!
  // ...
});
tx();
```

### Race condition (TOCTOU)

Two concurrent HTTP requests for the same `topup_id` can both read `payment.status = 'pending'` before either transaction commits. Since the `UPDATE payments` statement has no `AND status = 'pending'` guard:

1. Request A reads `status = 'pending'` → passes 409 check
2. Request B reads `status = 'pending'` → passes 409 check
3. Request A transaction: sets `status = 'paid'`, credits `balance_halala += X`
4. Request B transaction: sets `status = 'paid'` again (already paid, but WHERE clause matches), credits `balance_halala += X` **again**

Result: the renter receives **double the credited amount**.

Note: SQLite serializes transactions in WAL mode, but the TOCTOU window exists between the `db.get()` read and the transaction commit. The `.changes` return value is never checked on the UPDATE, so the route cannot detect that it ran against an already-paid row.

### Contrast with the correctly-implemented Moyasar path

`markPaymentPaidOnce` (used for Moyasar webhooks) is implemented correctly:

```js
const paymentUpdate = runStatement(
  `UPDATE payments SET status = 'paid', confirmed_at = ?, gateway_response = ?
   WHERE payment_id = ? AND status IN ('pending', 'initiated', 'failed')`,
  //                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //                       DB-level idempotency guard
  nowIso, gatewayPayload, paymentId
);
if (!paymentUpdate.changes) return false;  // ← checks effect, skips balance update
```

The admin confirm-topup path needs the same pattern.

### Required fix

```js
const tx = db._db.transaction(() => {
  const result = db.prepare(
    `UPDATE payments SET status = 'paid', confirmed_at = ?, gateway_response = ?
     WHERE payment_id = ? AND status = 'pending'`  // ← add status guard
  ).run(now, JSON.stringify({ confirmed_by: req.adminUser?.id || 'admin', note: normalizedNote, confirmed_at: now }), payment.payment_id);

  if (!result.changes) {
    return false;  // already confirmed by a concurrent request — skip balance update
  }

  db.prepare(
    `UPDATE renters SET balance_halala = balance_halala + ?, updated_at = ? WHERE id = ?`
  ).run(payment.amount_halala, now, renter.id);
  // ... ledger and audit inserts ...
  return true;
});
const credited = tx();
if (!credited) {
  return res.status(409).json({ error: 'Topup already confirmed (concurrent request)' });
}
```

---

## Finding 6 — PASS (minor gap): Audit log of confirmations

**Location:** `backend/src/routes/admin.js` ~lines 2182–2199

The confirm-topup transaction inserts into both `renter_credit_ledger` and `admin_audit_log`:

```js
// renter_credit_ledger: amount, payment_ref, note, created_at
db.prepare(`INSERT INTO renter_credit_ledger (...) VALUES (...)`).run(
  `rcl_${crypto.randomBytes(10).toString('hex')}`, renter.id, payment.amount_halala, payment.payment_id, normalizedNote, now
);

// admin_audit_log: action='topup_confirmed', target_type='renter', target_id=renter.id
db.prepare(`INSERT INTO admin_audit_log (action, target_type, target_id, details, timestamp) VALUES (?,?,?,?,?)`).run(
  'topup_confirmed', 'renter', renter.id, `Bank transfer topup ${payment.payment_id} confirmed...`, now
);
```

Audit trail exists. ✓

**Minor gap:** The `gateway_response` JSON stores `confirmed_by: 'admin'` (hardcoded string) rather than the actual admin user ID (`req.adminUser?.id`). The `admin_audit_log` written by the route also does not include the admin identity (it's a text description only). The middleware-level audit (`_auditAndProceed`) does record the hashed token identity, but it fires asynchronously and is not joined to the specific topup.

Recommendation: Replace `confirmed_by: 'admin'` with `confirmed_by: req.adminUser?.id` and add `admin_user_id` to the `admin_audit_log` route insert for direct traceability.

---

## Finding 7 — PASS: Balance scoped to requesting renter (no IDOR)

**Location:** `backend/src/routes/payments.js` ~line 228

```js
router.get('/balance', requireRenter, (req, res) => {
  const renter = req.renter;  // set from authenticated api_key
  const fresh = db.get('SELECT balance_halala FROM renters WHERE id = ?', renter.id);
  return res.json({ balance_sar: ..., renter_id: renter.id, ... });
});
```

The balance query uses `renter.id` from the authenticated session — not from a query parameter or URL segment. Renter A cannot query Renter B's balance. No IDOR vulnerability.

No issues found.

---

## Fix Priority

| Priority | Finding | Action |
|---|---|---|
| **P0 — Block Phase 1** | #5 Double-credit race | Add `AND status = 'pending'` to UPDATE + check `.changes` |
| **P1 — Before public** | #1 No pending topup limit | Add pending-count check before INSERT |
| **P2 — Operational** | #6 Audit gap | Replace `confirmed_by: 'admin'` with `req.adminUser?.id` |

---

## Relation to prior audit (DCP-799)

The Blockchain Engineer's DCP-799 audit covered the Moyasar webhook path (`markPaymentPaidOnce`) and confirmed it is correctly atomic. That path is **not affected** by the findings above. The bank-transfer admin confirm-topup endpoint was added in DCP-846 and was not in scope of DCP-799.
