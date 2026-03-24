'use strict';
/**
 * renterWebhookService.js — Renter webhook delivery (DCP-861)
 *
 * Fires HMAC-SHA256-signed POST requests to renter-registered webhook URLs
 * when job lifecycle events occur (job.completed, job.failed, balance.low).
 *
 * All deliveries are async and non-blocking. Results are logged to
 * renter_webhook_deliveries for audit and retry analysis.
 *
 * Public API:
 *   fireJobWebhooks(db, job, eventName)  — called after job status change
 *   fireBalanceLowWebhooks(db, renterId) — called when balance drops below threshold
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Valid event names for webhook registration
const VALID_EVENTS = new Set(['job.completed', 'job.failed', 'balance.low']);

// Fire-and-forget delivery timeout (ms)
const DELIVERY_TIMEOUT_MS = 10_000;

// ── HMAC signing ─────────────────────────────────────────────────────────────

/**
 * Build a X-DCP-Signature HMAC-SHA256 header value for the payload.
 *
 * @param {string} secret - Webhook secret (16+ chars)
 * @param {string} body   - JSON-serialised payload string
 * @returns {string} hex-encoded HMAC
 */
function signPayload(secret, body) {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

// ── HTTP delivery ─────────────────────────────────────────────────────────────

/**
 * Fire a single webhook delivery (fire-and-forget with timeout).
 * Returns a Promise that never rejects — errors are captured in the result.
 *
 * @returns {Promise<{ statusCode: number|null, delivered: boolean, error: string|null }>}
 */
function deliverOnce(url, body, signature) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return settle({ statusCode: null, delivered: false, error: 'invalid_url' });
    }

    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;
    const bodyBuf = Buffer.from(body, 'utf8');

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': bodyBuf.length,
        'X-DCP-Signature': `sha256=${signature}`,
        'X-DCP-Event': JSON.parse(body).event,
        'User-Agent': 'DCP-Webhook/1.0',
      },
      timeout: DELIVERY_TIMEOUT_MS,
    };

    const req = transport.request(options, (res) => {
      // Drain response body to free the socket
      res.resume();
      res.on('end', () => {
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        settle({ statusCode: res.statusCode, delivered: ok, error: ok ? null : `http_${res.statusCode}` });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      settle({ statusCode: null, delivered: false, error: 'timeout' });
    });

    req.on('error', (err) => {
      settle({ statusCode: null, delivered: false, error: err.message.slice(0, 200) });
    });

    req.write(bodyBuf);
    req.end();
  });
}

// ── Core delivery function ────────────────────────────────────────────────────

/**
 * Deliver an event to all active webhooks for a renter that subscribe to it.
 * All deliveries are async; this function returns immediately after launching them.
 *
 * @param {object} db       - better-sqlite3 handle
 * @param {number} renterId - renter primary key
 * @param {string} event    - e.g. 'job.completed'
 * @param {object} payload  - event payload object
 */
function fireWebhooks(db, renterId, event, payload) {
  let webhooks;
  try {
    webhooks = db.prepare(
      `SELECT id, url, secret FROM renter_webhooks
       WHERE renter_id = ? AND active = 1 AND instr(events, ?) > 0`
    ).all(renterId, event);
  } catch (err) {
    console.error('[renterWebhookService] DB query failed:', err.message);
    return;
  }

  if (!webhooks || webhooks.length === 0) return;

  const body = JSON.stringify({ ...payload, event });
  const now = new Date().toISOString();

  for (const webhook of webhooks) {
    const deliveryId = crypto.randomUUID();
    const signature = signPayload(webhook.secret, body);

    // Log delivery attempt first (so we have a record even if node exits)
    try {
      db.prepare(
        `INSERT INTO renter_webhook_deliveries
           (id, webhook_id, renter_id, job_id, event, payload, attempt, delivered, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)`
      ).run(deliveryId, webhook.id, renterId, payload.jobId || null, event, body, now);
    } catch (err) {
      console.error('[renterWebhookService] failed to log delivery attempt:', err.message);
      continue;
    }

    // Fire async — do not await
    deliverOnce(webhook.url, body, signature).then(({ statusCode, delivered, error }) => {
      try {
        db.prepare(
          `UPDATE renter_webhook_deliveries
             SET status_code = ?, delivered = ?, error = ?
           WHERE id = ?`
        ).run(statusCode, delivered ? 1 : 0, error, deliveryId);
      } catch (dbErr) {
        console.error('[renterWebhookService] failed to update delivery record:', dbErr.message);
      }
      if (!delivered) {
        console.warn(
          `[renterWebhookService] webhook delivery failed: id=${deliveryId} ` +
          `webhook=${webhook.id} event=${event} status=${statusCode} error=${error}`
        );
      }
    }).catch(() => {}); // already handled inside deliverOnce
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fire job lifecycle webhooks (job.completed or job.failed) for the renter
 * who owns the given job.
 *
 * Called by jobQueue after a terminal status transition.
 *
 * @param {object} db  - better-sqlite3 handle
 * @param {object} job - Full jobs row (must include renter_id, job_id, model,
 *                       tokens_used, actual_cost_halala, started_at, completed_at)
 * @param {string} terminalStatus - 'completed' or 'failed'
 */
function fireJobWebhooks(db, job, terminalStatus) {
  if (!job || !job.renter_id) return;

  const event = terminalStatus === 'completed' ? 'job.completed' : 'job.failed';
  const startedMs = job.started_at ? new Date(job.started_at).getTime() : null;
  const completedMs = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
  const elapsedSec = startedMs ? Math.round((completedMs - startedMs) / 1000) : null;

  const costHalala = job.actual_cost_halala ?? job.cost_halala ?? 0;
  const costSar = +(costHalala / 100).toFixed(4);

  const payload = {
    jobId: job.job_id,
    model: job.model || null,
    tokens_used: job.tokens_used ?? null,
    cost_sar: costSar,
    elapsed_sec: elapsedSec,
    status: terminalStatus,
    timestamp: new Date().toISOString(),
  };

  fireWebhooks(db, job.renter_id, event, payload);
}

/**
 * Fire balance.low webhook when renter balance drops below a threshold.
 *
 * @param {object} db       - better-sqlite3 handle
 * @param {number} renterId - renter primary key
 * @param {number} balanceSar - current balance in SAR
 */
function fireBalanceLowWebhooks(db, renterId, balanceSar) {
  if (!renterId) return;
  const payload = {
    balance_sar: balanceSar,
    timestamp: new Date().toISOString(),
  };
  fireWebhooks(db, renterId, 'balance.low', payload);
}

module.exports = {
  fireJobWebhooks,
  fireBalanceLowWebhooks,
  VALID_EVENTS,
  // Exported for testing
  signPayload,
  deliverOnce,
  fireWebhooks,
};
