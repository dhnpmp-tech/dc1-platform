'use strict';

/**
 * Invoice & Settlement Record Generation — DCP-780
 *
 * Endpoints:
 *   GET /api/jobs/:jobId/invoice        — structured invoice JSON
 *   GET /api/jobs/:jobId/invoice.pdf    — downloadable PDF invoice
 *   GET /api/renters/:renterId/invoices — paginated invoice list with CSV export
 *
 * Currency notes:
 *   - All internal amounts are halala (1 SAR = 100 halala).
 *   - USD display: halala / 100 / 3.75 (Saudi Central Bank peg).
 *   - SAR display: halala / 100.
 *   - Platform fee: 15% blended take rate (FOUNDER-STRATEGIC-BRIEF.md).
 *
 * settlement_hash: SHA-256 of a canonical JSON string of key invoice fields.
 * Provides tamper-evidence — any change to amounts/ids breaks the hash.
 */

const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { getApiKeyFromReq, isAdminRequest } = require('../middleware/auth');

// Saudi Central Bank USD/SAR peg (matches creditService.js)
const SAR_PER_USD = 3.75;
const PLATFORM_FEE_PCT = 15;

// ─── Auth helpers (mirrors jobs.js pattern) ──────────────────────────────────

function isAdmin(req) {
  return isAdminRequest(req);
}

function getRenterFromReq(req) {
  const key = getApiKeyFromReq(req, {
    headerName: 'x-renter-key',
    queryNames: ['renter_key', 'key'],
  });
  if (!key) return null;
  return db.get('SELECT id FROM renters WHERE api_key = ? AND status = ?', key, 'active') || null;
}

// ─── Core invoice builder ────────────────────────────────────────────────────

/**
 * Build invoice data for a completed job.
 * Returns null if the job is not found or not yet completed.
 */
function buildInvoiceData(jobId) {
  const job = db.get(
    `SELECT j.job_id, j.renter_id, j.provider_id, j.model, j.job_type,
            j.status, j.started_at, j.completed_at, j.duration_minutes,
            j.duration_seconds,
            COALESCE(j.actual_cost_halala, j.cost_halala, 0) AS cost_halala
     FROM jobs j
     WHERE j.job_id = ?`,
    jobId
  );

  if (!job) return null;

  // Only invoice completed jobs
  if (job.status !== 'completed') return null;

  const renter = db.get(
    'SELECT id, name, email, organization FROM renters WHERE id = ?',
    job.renter_id
  );

  const provider = job.provider_id
    ? db.get(
        'SELECT id, name, gpu_model FROM providers WHERE id = ?',
        job.provider_id
      )
    : null;

  // Settlement record (may not exist for jobs settled before DCP-745)
  const settlement = db.get(
    'SELECT gross_amount_halala, platform_fee_halala, provider_payout_halala, duration_seconds, settled_at FROM job_settlements WHERE job_id = ?',
    jobId
  );

  // Token data from serve_sessions if this was an inference/serve job
  const session = db.get(
    'SELECT total_tokens FROM serve_sessions WHERE job_id = ?',
    jobId
  );

  // Derive amounts — prefer settlement record, fall back to job cost
  const grossHalala = settlement
    ? settlement.gross_amount_halala
    : job.cost_halala;

  const platformFeeHalala = settlement
    ? settlement.platform_fee_halala
    : Math.round(grossHalala * (PLATFORM_FEE_PCT / 100));

  const subtotalHalala = grossHalala - platformFeeHalala;

  const subtotalUsd = +(subtotalHalala / 100 / SAR_PER_USD).toFixed(6);
  const platformFeeUsd = +(platformFeeHalala / 100 / SAR_PER_USD).toFixed(6);
  const totalUsd = +(grossHalala / 100 / SAR_PER_USD).toFixed(6);
  const sarEquivalent = +(grossHalala / 100).toFixed(4);

  // Duration: prefer settlement seconds, then job.duration_seconds, then minutes * 60
  const durationSeconds =
    settlement?.duration_seconds ??
    job.duration_seconds ??
    (job.duration_minutes != null ? job.duration_minutes * 60 : null);

  // Token fields
  const totalTokens = session?.total_tokens ?? null;
  const tokensInput = null;   // not tracked separately yet
  const tokensOutput = totalTokens; // best approximation available
  const ratePerToken = totalTokens && totalTokens > 0
    ? +(totalUsd / totalTokens).toFixed(9)
    : null;

  const timestamp = settlement?.settled_at ?? job.completed_at ?? new Date().toISOString();

  // Build canonical payload for settlement_hash
  const canonical = {
    job_id: job.job_id,
    renter_id: job.renter_id,
    provider_id: job.provider_id ?? null,
    gross_halala: grossHalala,
    platform_fee_halala: platformFeeHalala,
    timestamp,
  };
  const settlementHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');

  return {
    invoice_id: null, // set when persisted
    job_id: job.job_id,
    renter: {
      id: renter?.id ?? job.renter_id,
      name: renter?.name ?? null,
      email: renter?.email ?? null,
      organization: renter?.organization ?? null,
    },
    provider: provider
      ? { id: provider.id, name: provider.name, gpu_model: provider.gpu_model ?? null }
      : null,
    model: job.model ?? null,
    job_type: job.job_type ?? null,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    duration_seconds: durationSeconds,
    rate_per_token: ratePerToken,
    subtotal_usd: subtotalUsd,
    platform_fee_usd: platformFeeUsd,
    total_usd: totalUsd,
    sar_equivalent: sarEquivalent,
    timestamp,
    settlement_hash: settlementHash,
  };
}

/**
 * Persist or fetch the invoice record for a job.
 * Idempotent: re-uses existing record if present.
 */
function upsertInvoiceRecord(data) {
  const existing = db.get('SELECT invoice_id FROM invoices WHERE job_id = ?', data.job_id);
  if (existing) return existing.invoice_id;

  const invoiceId = uuidv4();
  db.run(
    `INSERT INTO invoices (invoice_id, job_id, renter_id, provider_id, amount_usd, sar_equivalent, settlement_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    invoiceId,
    data.job_id,
    data.renter.id,
    data.provider?.id ?? null,
    data.total_usd,
    data.sar_equivalent,
    data.settlement_hash
  );
  return invoiceId;
}

// ─── PDF generator ───────────────────────────────────────────────────────────
// Requires pdfkit: add to package.json dependencies and run npm install.
// Falls back to a plaintext response if pdfkit is not installed.

let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch (_) {
  PDFDocument = null;
}

function generatePdf(invoice, res) {
  if (!PDFDocument) {
    // pdfkit not installed — return plaintext invoice as fallback
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoice.job_id}.txt"`);
    res.send(formatPlaintextInvoice(invoice));
    return;
  }

  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.job_id}.pdf"`);
  doc.pipe(res);

  // ── Header ──
  doc.fontSize(20).font('Helvetica-Bold').text('DCP — Decentralized Compute Platform', { align: 'left' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor('#666').text('Tax Invoice / Receipt', { align: 'left' });
  doc.moveDown(1.5);

  // ── Invoice metadata ──
  doc.fillColor('#000').fontSize(11).font('Helvetica-Bold').text('INVOICE DETAILS');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Invoice ID:      ${invoice.invoice_id}`);
  doc.text(`Job ID:          ${invoice.job_id}`);
  doc.text(`Date:            ${formatDate(invoice.timestamp)}`);
  doc.moveDown(1);

  // ── Renter / Provider ──
  doc.fontSize(11).font('Helvetica-Bold').text('BILLED TO');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Name:            ${invoice.renter.name ?? '—'}`);
  doc.text(`Email:           ${invoice.renter.email ?? '—'}`);
  if (invoice.renter.organization) doc.text(`Organization:    ${invoice.renter.organization}`);
  doc.moveDown(1);

  doc.fontSize(11).font('Helvetica-Bold').text('SERVICE PROVIDER');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Provider ID:     ${invoice.provider?.id ?? '—'}`);
  doc.text(`GPU Model:       ${invoice.provider?.gpu_model ?? '—'}`);
  doc.moveDown(1);

  // ── Job details ──
  doc.fontSize(11).font('Helvetica-Bold').text('JOB DETAILS');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10);
  doc.text(`Model:           ${invoice.model ?? '—'}`);
  doc.text(`Job Type:        ${invoice.job_type ?? '—'}`);
  if (invoice.duration_seconds != null) {
    doc.text(`Duration:        ${invoice.duration_seconds}s (${(invoice.duration_seconds / 60).toFixed(2)} min)`);
  }
  if (invoice.tokens_output != null) {
    doc.text(`Tokens (output): ${invoice.tokens_output.toLocaleString()}`);
  }
  if (invoice.rate_per_token != null) {
    doc.text(`Rate per token:  $${invoice.rate_per_token.toFixed(9)} USD`);
  }
  doc.moveDown(1);

  // ── Line items ──
  doc.fontSize(11).font('Helvetica-Bold').text('CHARGES');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10);

  const lineY = doc.y;
  doc.rect(50, lineY, 495, 1).fill('#ccc');
  doc.fillColor('#000').moveDown(0.3);

  doc.text(`Compute subtotal:`, 60, doc.y);
  doc.text(`$${invoice.subtotal_usd.toFixed(4)} USD`, 400, doc.y - doc.currentLineHeight(), { align: 'right', width: 145 });
  doc.moveDown(0.3);

  doc.text(`Platform fee (${PLATFORM_FEE_PCT}%):`, 60);
  doc.text(`$${invoice.platform_fee_usd.toFixed(4)} USD`, 400, doc.y - doc.currentLineHeight(), { align: 'right', width: 145 });
  doc.moveDown(0.3);

  const totalY = doc.y;
  doc.rect(50, totalY, 495, 1).fill('#999');
  doc.fillColor('#000').moveDown(0.3);

  doc.fontSize(12).font('Helvetica-Bold').text('TOTAL:', 60);
  doc.text(`$${invoice.total_usd.toFixed(4)} USD`, 400, doc.y - doc.currentLineHeight(), { align: 'right', width: 145 });
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(10).fillColor('#555');
  doc.text(`SAR equivalent: ${invoice.sar_equivalent.toFixed(4)} SAR (1 USD = 3.75 SAR fixed peg)`, 60);
  doc.moveDown(1.5);

  // ── Settlement hash ──
  doc.fillColor('#000').fontSize(9).font('Helvetica');
  doc.text('SETTLEMENT HASH (SHA-256 tamper-evidence seal):');
  doc.text(invoice.settlement_hash, { oblique: true });
  doc.moveDown(0.5);
  doc.text('This invoice is automatically generated by DCP and is valid without a signature.', { align: 'center' });

  doc.end();
}

function formatDate(iso) {
  try {
    return new Date(iso).toUTCString();
  } catch {
    return iso;
  }
}

function formatPlaintextInvoice(inv) {
  const lines = [
    '====================================================',
    '  DCP — Decentralized Compute Platform',
    '  Tax Invoice / Receipt',
    '====================================================',
    '',
    `Invoice ID:      ${inv.invoice_id}`,
    `Job ID:          ${inv.job_id}`,
    `Date:            ${formatDate(inv.timestamp)}`,
    '',
    'BILLED TO',
    `  Name:          ${inv.renter.name ?? '—'}`,
    `  Email:         ${inv.renter.email ?? '—'}`,
    inv.renter.organization ? `  Organization:  ${inv.renter.organization}` : null,
    '',
    'SERVICE PROVIDER',
    `  Provider ID:   ${inv.provider?.id ?? '—'}`,
    `  GPU Model:     ${inv.provider?.gpu_model ?? '—'}`,
    '',
    'JOB DETAILS',
    `  Model:         ${inv.model ?? '—'}`,
    `  Job Type:      ${inv.job_type ?? '—'}`,
    inv.duration_seconds != null ? `  Duration:      ${inv.duration_seconds}s` : null,
    inv.tokens_output != null ? `  Tokens:        ${inv.tokens_output}` : null,
    '',
    'CHARGES',
    `  Compute:       $${inv.subtotal_usd.toFixed(4)} USD`,
    `  Platform fee:  $${inv.platform_fee_usd.toFixed(4)} USD (${PLATFORM_FEE_PCT}%)`,
    `  ─────────────────────────`,
    `  TOTAL:         $${inv.total_usd.toFixed(4)} USD`,
    `                 ${inv.sar_equivalent.toFixed(4)} SAR (1 USD = 3.75 SAR)`,
    '',
    'SETTLEMENT HASH (SHA-256):',
    `  ${inv.settlement_hash}`,
    '',
    '====================================================',
  ].filter(l => l !== null);
  return lines.join('\n');
}

// ─── Route factory ───────────────────────────────────────────────────────────

/**
 * Job-scoped invoice routes — mount at /api/jobs
 */
const jobsInvoiceRouter = express.Router();

// GET /api/jobs/:jobId/invoice — JSON invoice
jobsInvoiceRouter.get('/:jobId/invoice', (req, res) => {
  const { jobId } = req.params;

  const job = db.get('SELECT renter_id, provider_id, status FROM jobs WHERE job_id = ?', jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Auth: admin, owning renter, or owning provider
  if (!isAdmin(req)) {
    const renter = getRenterFromReq(req);
    if (!renter || renter.id !== job.renter_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  if (job.status !== 'completed') {
    return res.status(409).json({ error: 'Invoice not available', detail: `Job status is '${job.status}' — invoices are generated for completed jobs only.` });
  }

  const data = buildInvoiceData(jobId);
  if (!data) return res.status(404).json({ error: 'Invoice data not available' });

  const invoiceId = upsertInvoiceRecord(data);
  data.invoice_id = invoiceId;

  return res.json(data);
});

// GET /api/jobs/:jobId/invoice.pdf — PDF invoice
jobsInvoiceRouter.get('/:jobId/invoice.pdf', (req, res) => {
  const { jobId } = req.params;

  const job = db.get('SELECT renter_id, provider_id, status FROM jobs WHERE job_id = ?', jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  if (!isAdmin(req)) {
    const renter = getRenterFromReq(req);
    if (!renter || renter.id !== job.renter_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  if (job.status !== 'completed') {
    return res.status(409).json({ error: 'Invoice not available', detail: `Job status is '${job.status}'` });
  }

  const data = buildInvoiceData(jobId);
  if (!data) return res.status(404).json({ error: 'Invoice data not available' });

  const invoiceId = upsertInvoiceRecord(data);
  data.invoice_id = invoiceId;

  generatePdf(data, res);
});

/**
 * Renter-scoped invoice routes — mount at /api/renters
 */
const rentersInvoiceRouter = express.Router();

// GET /api/renters/:renterId/invoices — paginated invoice list + optional CSV export
rentersInvoiceRouter.get('/:renterId/invoices', (req, res) => {
  const { renterId } = req.params;
  const renterIdInt = parseInt(renterId, 10);
  if (!Number.isFinite(renterIdInt)) {
    return res.status(400).json({ error: 'Invalid renter ID' });
  }

  // Auth: admin or the renter themselves
  if (!isAdmin(req)) {
    const renter = getRenterFromReq(req);
    if (!renter || renter.id !== renterIdInt) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const format = req.query.format; // 'csv' triggers CSV export

  const total = db.get('SELECT COUNT(*) AS n FROM invoices WHERE renter_id = ?', renterIdInt);
  const rows = db.all(
    `SELECT i.invoice_id, i.job_id, i.amount_usd, i.sar_equivalent,
            i.settlement_hash, i.created_at,
            j.model, j.job_type, j.status AS job_status,
            j.completed_at, j.duration_seconds,
            p.name AS provider_name, p.gpu_model AS provider_gpu
     FROM invoices i
     LEFT JOIN jobs j ON j.job_id = i.job_id
     LEFT JOIN providers p ON p.id = i.provider_id
     WHERE i.renter_id = ?
     ORDER BY i.created_at DESC
     LIMIT ? OFFSET ?`,
    renterIdInt,
    limit,
    offset
  );

  if (format === 'csv') {
    const headers = ['invoice_id', 'job_id', 'model', 'job_type', 'amount_usd', 'sar_equivalent', 'provider_gpu', 'completed_at', 'settlement_hash'];
    const csvLines = [headers.join(',')];
    for (const r of rows) {
      csvLines.push([
        csvEscape(r.invoice_id),
        csvEscape(r.job_id),
        csvEscape(r.model ?? ''),
        csvEscape(r.job_type ?? ''),
        r.amount_usd.toFixed(6),
        r.sar_equivalent.toFixed(4),
        csvEscape(r.provider_gpu ?? ''),
        csvEscape(r.completed_at ?? ''),
        csvEscape(r.settlement_hash),
      ].join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoices-renter-${renterIdInt}.csv"`);
    return res.send(csvLines.join('\r\n'));
  }

  return res.json({
    invoices: rows,
    pagination: {
      page,
      limit,
      total: total?.n ?? 0,
      pages: Math.ceil((total?.n ?? 0) / limit),
    },
  });
});

function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

module.exports = { jobsInvoiceRouter, rentersInvoiceRouter };
