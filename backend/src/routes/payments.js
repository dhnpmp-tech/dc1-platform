// DC1 Payment Routes — Moyasar SAR integration (DCP-31)
// Moyasar: Saudi-first gateway supporting mada, Apple Pay, VISA/MC in SAR
// Docs: https://moyasar.com/docs
const express = require('express');
const crypto = require('crypto');
const https = require('https');
const router = express.Router();
const db = require('../db');

const MOYASAR_BASE = 'https://api.moyasar.com/v1';
const MOYASAR_SECRET = process.env.MOYASAR_SECRET_KEY || '';
const MOYASAR_WEBHOOK_SECRET = process.env.MOYASAR_WEBHOOK_SECRET || MOYASAR_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://dcp.sa';

// ─── Moyasar API helper ────────────────────────────────────────────────────────

function moyasarRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    if (!MOYASAR_SECRET) {
      return reject(new Error('MOYASAR_SECRET_KEY not configured'));
    }

    const bodyStr = body ? JSON.stringify(body) : null;
    const auth = Buffer.from(`${MOYASAR_SECRET}:`).toString('base64');
    const url = new URL(MOYASAR_BASE + path);

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const err = new Error(parsed.message || parsed.type || 'Moyasar API error');
            err.statusCode = res.statusCode;
            err.moyasarError = parsed;
            return reject(err);
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error('Invalid Moyasar response: ' + data.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ─── Webhook HMAC verification ─────────────────────────────────────────────────

function verifyMoyasarWebhook(rawBody, signatureHeader) {
  if (!MOYASAR_WEBHOOK_SECRET || !signatureHeader) return false;
  const expected = crypto
    .createHmac('sha256', MOYASAR_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signatureHeader, 'hex')
    );
  } catch {
    return false;
  }
}

// ─── Renter auth helper ────────────────────────────────────────────────────────

function getRenter(req) {
  const key = req.headers['x-renter-key'] || req.query.key;
  if (!key) return null;
  return db.get('SELECT * FROM renters WHERE api_key = ? AND status = ?', key, 'active');
}

// ─── POST /api/payments/topup ──────────────────────────────────────────────────
// Initiate a SAR top-up via Moyasar. Returns a hosted checkout URL.
// Body: { amount_sar: number, source_type?: "creditcard"|"mada"|"applepay", callback_url?: string }
router.post('/topup', (req, res) => {
  const renter = getRenter(req);
  if (!renter) {
    return res.status(401).json({ error: 'API key required (x-renter-key header or key query)' });
  }

  const { amount_sar, source_type = 'creditcard', callback_url } = req.body;
  const amountSar = parseFloat(amount_sar);

  if (!amountSar || amountSar <= 0) {
    return res.status(400).json({ error: 'amount_sar must be a positive number' });
  }
  if (amountSar < 1) {
    return res.status(400).json({ error: 'Minimum top-up is 1 SAR' });
  }
  if (amountSar > 10000) {
    return res.status(400).json({ error: 'Maximum top-up is 10,000 SAR per transaction' });
  }

  const ALLOWED_SOURCES = ['creditcard', 'mada', 'applepay'];
  if (!ALLOWED_SOURCES.includes(source_type)) {
    return res.status(400).json({ error: `source_type must be one of: ${ALLOWED_SOURCES.join(', ')}` });
  }

  const amountHalala = Math.round(amountSar * 100);
  const callbackUrl = callback_url || `${FRONTEND_URL}/renter/billing?payment=callback`;
  const description = `DC1 balance top-up — ${renter.name} (${renter.email})`;

  const moyasarBody = {
    amount: amountHalala,
    currency: 'SAR',
    description,
    callback_url: callbackUrl,
    source: { type: source_type },
    metadata: {
      renter_id: renter.id,
      renter_email: renter.email,
    },
  };

  moyasarRequest('POST', '/payments', moyasarBody)
    .then(payment => {
      const paymentId = payment.id;
      const checkoutUrl = payment.source?.transaction_url || payment.source?.checkout_url || null;
      const now = new Date().toISOString();

      // Store payment record (status=initiated until webhook confirms)
      db.run(
        `INSERT INTO payments
           (payment_id, renter_id, amount_sar, amount_halala, status, source_type,
            description, callback_url, checkout_url, gateway_response, created_at)
         VALUES (?, ?, ?, ?, 'initiated', ?, ?, ?, ?, ?, ?)`,
        paymentId, renter.id, amountSar, amountHalala, source_type,
        description, callbackUrl, checkoutUrl,
        JSON.stringify(payment), now
      );

      res.json({
        success: true,
        payment_id: paymentId,
        amount_sar: amountSar,
        amount_halala: amountHalala,
        status: payment.status,
        checkout_url: checkoutUrl,
        message: `Redirect renter to checkout_url to complete payment.`,
      });
    })
    .catch(err => {
      console.error('[payments] Moyasar topup error:', err.message, err.moyasarError);
      if (err.message === 'MOYASAR_SECRET_KEY not configured') {
        return res.status(503).json({
          error: 'Payment gateway not configured. Set MOYASAR_SECRET_KEY.',
          sandbox_hint: 'Use POST /api/payments/topup-sandbox for dev/test.',
        });
      }
      const statusCode = err.statusCode === 422 ? 422 : 502;
      res.status(statusCode).json({
        error: 'Payment initiation failed',
        details: err.moyasarError || err.message,
      });
    });
});

// ─── POST /api/payments/topup-sandbox ─────────────────────────────────────────
// Dev-only sandbox top-up: directly credits balance without Moyasar (when key not set).
// Disabled in production (requires MOYASAR_SECRET_KEY to be absent).
router.post('/topup-sandbox', (req, res) => {
  if (MOYASAR_SECRET) {
    return res.status(403).json({
      error: 'Sandbox top-up disabled when MOYASAR_SECRET_KEY is configured. Use /api/payments/topup.',
    });
  }

  const renter = getRenter(req);
  if (!renter) {
    return res.status(401).json({ error: 'API key required (x-renter-key header or key query)' });
  }

  const { amount_sar } = req.body;
  const amountSar = parseFloat(amount_sar);
  if (!amountSar || amountSar <= 0 || amountSar > 10000) {
    return res.status(400).json({ error: 'amount_sar must be between 0 and 10,000' });
  }

  const amountHalala = Math.round(amountSar * 100);
  const paymentId = 'sandbox-' + crypto.randomBytes(8).toString('hex');
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO payments
       (payment_id, renter_id, amount_sar, amount_halala, status, source_type,
        description, created_at, confirmed_at)
     VALUES (?, ?, ?, ?, 'paid', 'sandbox', ?, ?, ?)`,
    paymentId, renter.id, amountSar, amountHalala,
    'Sandbox top-up (dev mode)', now, now
  );

  db.run(
    `UPDATE renters SET balance_halala = balance_halala + ?, updated_at = ? WHERE id = ?`,
    amountHalala, now, renter.id
  );

  const updated = db.get('SELECT balance_halala FROM renters WHERE id = ?', renter.id);

  res.json({
    success: true,
    sandbox: true,
    payment_id: paymentId,
    amount_sar: amountSar,
    credited_halala: amountHalala,
    new_balance_sar: updated.balance_halala / 100,
    new_balance_halala: updated.balance_halala,
  });
});

// ─── POST /api/payments/webhook ────────────────────────────────────────────────
// Moyasar webhook handler. Verifies HMAC-SHA256 signature, credits balance on `paid`.
// Moyasar retries webhooks on non-2xx response.
// Raw body needed for HMAC — must be mounted BEFORE express.json() for this route.
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody = req.body; // Buffer (express.raw)
  const signature = req.headers['x-moyasar-signature'];

  // Verify HMAC signature (skip if webhook secret not configured — log warning)
  if (MOYASAR_WEBHOOK_SECRET) {
    if (!verifyMoyasarWebhook(rawBody, signature)) {
      console.warn('[payments/webhook] Invalid HMAC signature — rejected');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  } else {
    console.warn('[payments/webhook] MOYASAR_WEBHOOK_SECRET not set — skipping signature verification');
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const paymentId = event.id;
  const status = event.status; // 'paid' | 'failed' | 'refunded' | 'initiated'
  const now = new Date().toISOString();

  // Look up stored payment record
  const payment = db.get('SELECT * FROM payments WHERE payment_id = ?', paymentId);

  if (!payment) {
    // Unknown payment — return 200 to prevent Moyasar retries for stale events
    console.warn(`[payments/webhook] Unknown payment_id: ${paymentId} — acknowledging`);
    return res.json({ received: true, action: 'ignored_unknown' });
  }

  if (payment.status === status) {
    // Idempotent: already processed
    return res.json({ received: true, action: 'already_processed' });
  }

  if (status === 'paid') {
    // Credit renter balance
    db.run(
      `UPDATE renters SET balance_halala = balance_halala + ?, updated_at = ? WHERE id = ?`,
      payment.amount_halala, now, payment.renter_id
    );
    db.run(
      `UPDATE payments SET status = 'paid', confirmed_at = ?, gateway_response = ? WHERE payment_id = ?`,
      now, JSON.stringify(event), paymentId
    );
    console.log(`[payments/webhook] Payment ${paymentId} paid — credited ${payment.amount_halala} halala to renter ${payment.renter_id}`);
    return res.json({ received: true, action: 'balance_credited', amount_halala: payment.amount_halala });
  }

  if (status === 'failed') {
    db.run(
      `UPDATE payments SET status = 'failed', gateway_response = ? WHERE payment_id = ?`,
      JSON.stringify(event), paymentId
    );
    console.log(`[payments/webhook] Payment ${paymentId} failed`);
    return res.json({ received: true, action: 'marked_failed' });
  }

  if (status === 'refunded') {
    const refundAmount = event.amount_refunded || payment.amount_halala;
    // Deduct from renter balance only if it was previously paid and not yet refunded
    if (payment.status === 'paid' && !payment.refunded_at) {
      const deduct = Math.min(refundAmount, payment.amount_halala);
      db.run(
        `UPDATE renters SET balance_halala = MAX(0, balance_halala - ?), updated_at = ? WHERE id = ?`,
        deduct, now, payment.renter_id
      );
    }
    db.run(
      `UPDATE payments SET status = 'refunded', refunded_at = ?, refund_amount_halala = ?, gateway_response = ? WHERE payment_id = ?`,
      now, refundAmount, JSON.stringify(event), paymentId
    );
    console.log(`[payments/webhook] Payment ${paymentId} refunded — ${refundAmount} halala`);
    return res.json({ received: true, action: 'refund_processed' });
  }

  // For any other status (e.g. 'initiated'), just update the gateway response
  db.run(
    `UPDATE payments SET status = ?, gateway_response = ? WHERE payment_id = ?`,
    status, JSON.stringify(event), paymentId
  );
  res.json({ received: true, action: 'status_updated', new_status: status });
});

// ─── GET /api/payments/verify/:paymentId ──────────────────────────────────────
// Fetch live payment status from Moyasar. Used by frontend to poll after redirect.
// Auth: renter key must own the payment.
router.get('/verify/:paymentId', (req, res) => {
  const renter = getRenter(req);
  if (!renter) {
    return res.status(401).json({ error: 'API key required' });
  }

  const { paymentId } = req.params;
  const localPayment = db.get(
    'SELECT * FROM payments WHERE payment_id = ? AND renter_id = ?',
    paymentId, renter.id
  );
  if (!localPayment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  // If already confirmed, return local record
  if (localPayment.status === 'paid') {
    return res.json({
      payment_id: localPayment.payment_id,
      status: 'paid',
      amount_sar: localPayment.amount_sar,
      amount_halala: localPayment.amount_halala,
      confirmed_at: localPayment.confirmed_at,
    });
  }

  // Fetch live status from Moyasar
  if (!MOYASAR_SECRET) {
    return res.json({
      payment_id: localPayment.payment_id,
      status: localPayment.status,
      amount_sar: localPayment.amount_sar,
      amount_halala: localPayment.amount_halala,
      note: 'Gateway not configured — showing local status',
    });
  }

  moyasarRequest('GET', `/payments/${paymentId}`, null)
    .then(payment => {
      const now = new Date().toISOString();

      // Sync local record if Moyasar reports paid
      if (payment.status === 'paid' && localPayment.status !== 'paid') {
        db.run(
          `UPDATE renters SET balance_halala = balance_halala + ?, updated_at = ? WHERE id = ?`,
          localPayment.amount_halala, now, renter.id
        );
        db.run(
          `UPDATE payments SET status = 'paid', confirmed_at = ?, gateway_response = ? WHERE payment_id = ?`,
          now, JSON.stringify(payment), paymentId
        );
        console.log(`[payments/verify] Late sync: payment ${paymentId} paid — credited ${localPayment.amount_halala} halala`);
      }

      res.json({
        payment_id: payment.id,
        status: payment.status,
        amount_sar: payment.amount / 100,
        amount_halala: payment.amount,
        source_type: payment.source?.type,
        created_at: payment.created_at,
      });
    })
    .catch(err => {
      console.error('[payments/verify] Moyasar fetch error:', err.message);
      // Fallback to local record
      res.json({
        payment_id: localPayment.payment_id,
        status: localPayment.status,
        amount_sar: localPayment.amount_sar,
        amount_halala: localPayment.amount_halala,
        gateway_error: 'Could not reach Moyasar — showing local status',
      });
    });
});

// ─── GET /api/payments/history ─────────────────────────────────────────────────
// Renter's own payment history (paginated).
router.get('/history', (req, res) => {
  const renter = getRenter(req);
  if (!renter) {
    return res.status(401).json({ error: 'API key required' });
  }

  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  const payments = db.all(
    `SELECT payment_id, amount_sar, amount_halala, status, source_type,
            description, created_at, confirmed_at, refunded_at, refund_amount_halala
     FROM payments WHERE renter_id = ?
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    renter.id, limit, offset
  );

  const total = db.get('SELECT COUNT(*) as count FROM payments WHERE renter_id = ?', renter.id);
  const totalPaid = db.get(
    `SELECT COALESCE(SUM(amount_halala), 0) as total FROM payments WHERE renter_id = ? AND status = 'paid'`,
    renter.id
  );

  res.json({
    payments,
    pagination: { limit, offset, total: total.count },
    summary: {
      total_paid_sar: totalPaid.total / 100,
      total_paid_halala: totalPaid.total,
    },
  });
});

module.exports = router;
