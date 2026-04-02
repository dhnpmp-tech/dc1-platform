'use strict';

const db = require('../db');

function classifySensitiveAction(req) {
  const method = String(req.method || '').toUpperCase();
  const originalUrl = String(req.originalUrl || req.url || '');
  const pathname = originalUrl.split('?')[0];

  let match = pathname.match(/^\/api\/admin\/payouts\/([^/]+)\/approve$/i);
  if (method === 'POST' && match) {
    return { action: 'admin.payout.approve', resourceType: 'payout', resourceId: match[1] };
  }

  match = pathname.match(/^\/api\/admin\/payouts\/([^/]+)\/reject$/i);
  if (method === 'POST' && match) {
    return { action: 'admin.payout.reject', resourceType: 'payout', resourceId: match[1] };
  }

  match = pathname.match(/^\/api\/admin\/payouts\/([^/]+)$/i);
  if (method === 'PATCH' && match) {
    const actionRaw = String(req.body?.action || '').trim().toLowerCase();
    const action = actionRaw === 'paid'
      ? 'admin.payout.mark_paid'
      : actionRaw === 'reject'
        ? 'admin.payout.reject_legacy'
        : 'admin.payout.patch';
    return { action, resourceType: 'payout', resourceId: match[1] };
  }

  match = pathname.match(/^\/api\/jobs\/([^/]+)\/result$/i);
  if (method === 'POST' && match) {
    return { action: 'job.result.submit', resourceType: 'job', resourceId: match[1] };
  }

  match = pathname.match(/^\/api\/jobs\/([^/]+)\/output(?:\/[^/]+)?$/i);
  if (method === 'GET' && match) {
    return { action: 'job.result.read', resourceType: 'job', resourceId: match[1] };
  }

  return null;
}

function resolveActor(req) {
  if (req.adminUser?.id) return { actorType: 'admin', actorId: String(req.adminUser.id) };
  if (req.headers?.['x-admin-token']) return { actorType: 'admin', actorId: 'token' };
  if (req.headers?.['x-provider-key']) return { actorType: 'provider', actorId: 'key_header' };
  if (req.headers?.['x-renter-key']) return { actorType: 'renter', actorId: 'key_header' };
  if (req.query?.provider_key || req.query?.key) return { actorType: 'provider', actorId: 'key_query' };
  if (req.query?.renter_key) return { actorType: 'renter', actorId: 'key_query' };
  return { actorType: 'unknown', actorId: null };
}

function logSensitiveAudit(rawDb, row) {
  try {
    const dbInst = rawDb && rawDb.prepare ? rawDb : (rawDb?._db || db._db || db);
    dbInst.prepare(
      `INSERT INTO security_audit_events
         (action, resource_type, resource_id, method, route_path, status_code, outcome, actor_type, actor_id, ip_address, user_agent, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      row.action,
      row.resourceType,
      row.resourceId,
      row.method,
      row.routePath,
      row.statusCode,
      row.outcome,
      row.actorType,
      row.actorId,
      row.ipAddress,
      row.userAgent,
      row.metadataJson,
      row.createdAt
    );
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[sensitive-audit] Failed to write security_audit_events:', err?.message || err);
    }
  }
}

function sensitiveAuditLogger(req, res, next) {
  const classified = classifySensitiveAction(req);
  if (!classified) return next();

  // Guard against duplicate writes if middleware is mounted more than once.
  if (req._sensitiveAuditHookAttached === true) return next();
  req._sensitiveAuditHookAttached = true;

  res.on('finish', () => {
    if (req._sensitiveAuditLogged === true) return;
    req._sensitiveAuditLogged = true;

    const actor = resolveActor(req);
    const statusCode = Number(res.statusCode || 0);
    const nowIso = new Date().toISOString();
    const outcome = statusCode >= 200 && statusCode < 400 ? 'success' : 'error';
    const metadata = {
      original_url: req.originalUrl || req.url || '',
      request_id: req.headers?.['x-request-id'] || null,
      run_id: req.headers?.['x-paperclip-run-id'] || null,
    };

    logSensitiveAudit(null, {
      action: classified.action,
      resourceType: classified.resourceType,
      resourceId: classified.resourceId,
      method: String(req.method || '').toUpperCase(),
      routePath: String((req.originalUrl || req.url || '').split('?')[0]),
      statusCode,
      outcome,
      actorType: actor.actorType,
      actorId: actor.actorId,
      ipAddress: req.ip || req.socket?.remoteAddress || null,
      userAgent: req.headers?.['user-agent'] || null,
      metadataJson: JSON.stringify(metadata),
      createdAt: nowIso,
    });
  });

  next();
}

module.exports = { sensitiveAuditLogger, classifySensitiveAction };
