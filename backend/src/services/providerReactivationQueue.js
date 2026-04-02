'use strict';

function toIsoOrNull(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function heartbeatAgeSeconds(lastHeartbeat, nowMs = Date.now()) {
  const iso = toIsoOrNull(lastHeartbeat);
  if (!iso) return null;
  const age = Math.floor((nowMs - new Date(iso).getTime()) / 1000);
  return Number.isFinite(age) && age >= 0 ? age : null;
}

function normalizeString(value, maxLen = 256) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

function parseReadinessDetailFailures(raw) {
  if (!raw || typeof raw !== 'string') return [];

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return [];
  }

  if (!parsed || typeof parsed !== 'object') return [];

  const failedChecks = [];
  const checks = Array.isArray(parsed.checks) ? parsed.checks : [];
  for (const check of checks) {
    const ok = typeof check?.ok === 'boolean' ? check.ok : null;
    const status = String(check?.status || '').toLowerCase();
    if (ok === false || status === 'fail' || status === 'failed' || status === 'error') {
      const code = normalizeString(check?.key || check?.code || check?.name, 64);
      if (code) failedChecks.push(code.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    }
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'checks' || key === 'status') continue;
    if (typeof value === 'boolean' && value === false) {
      failedChecks.push(String(key).toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    }
  }

  return Array.from(new Set(failedChecks));
}

function determineInstallStatus(provider) {
  if (normalizeString(provider?.daemon_version, 100)) return 'installed';
  if (provider?.last_heartbeat) return 'heartbeat_detected_without_daemon_version';
  return 'not_installed';
}

function queryAll(db, sql, ...params) {
  if (db && typeof db.all === 'function') return db.all(sql, ...params);
  if (db && typeof db.prepare === 'function') return db.prepare(sql).all(...params);
  throw new TypeError('db must expose all(sql, ...params) or prepare(sql).all(...params)');
}

function getProviderColumnSet(db) {
  return new Set((queryAll(db, 'PRAGMA table_info(providers)') || []).map((row) => String(row?.name || '')));
}

function buildProviderReactivationQuery(columns) {
  const select = [
    'id',
    'name',
    'email',
    columns.has('phone') ? 'phone' : 'NULL AS phone',
    columns.has('organization') ? 'organization' : 'NULL AS organization',
    columns.has('location') ? 'location' : 'NULL AS location',
    'status',
    "COALESCE(approval_status, 'pending') AS approval_status",
    'last_heartbeat',
    "COALESCE(is_paused, 0) AS is_paused",
    columns.has('daemon_version') ? 'daemon_version' : 'NULL AS daemon_version',
    columns.has('readiness_status') ? 'readiness_status' : 'NULL AS readiness_status',
    columns.has('readiness_details') ? 'readiness_details' : 'NULL AS readiness_details',
    'created_at',
  ];

  return `
    SELECT ${select.join(', ')}
    FROM providers
    WHERE deleted_at IS NULL
  `;
}

function buildReactivationRecord(provider, nowMs = Date.now()) {
  const heartbeatAge = heartbeatAgeSeconds(provider.last_heartbeat, nowMs);
  const installStatus = determineInstallStatus(provider);
  const readinessStatus = normalizeString(provider.readiness_status, 64)?.toLowerCase();
  const readinessFailed = ['failed', 'error', 'blocked'].includes(String(readinessStatus || ''));
  const readinessFailureChecks = parseReadinessDetailFailures(provider.readiness_details);

  const blockerReasonCodes = [];
  if (provider.approval_status !== 'approved') blockerReasonCodes.push('approval_pending');
  if (Number(provider.is_paused || 0) === 1) blockerReasonCodes.push('provider_paused');
  if (provider.status === 'suspended') blockerReasonCodes.push('provider_suspended');
  if (installStatus === 'not_installed') blockerReasonCodes.push('daemon_not_installed');
  if (installStatus === 'heartbeat_detected_without_daemon_version') blockerReasonCodes.push('daemon_version_missing');
  if (heartbeatAge == null) blockerReasonCodes.push('heartbeat_missing');
  else if (heartbeatAge > 15 * 60) blockerReasonCodes.push('heartbeat_stale_critical');
  else if (heartbeatAge > 5 * 60) blockerReasonCodes.push('heartbeat_stale');
  if (readinessFailed || readinessFailureChecks.length > 0) blockerReasonCodes.push('readiness_checks_failed');

  const readyToServe = blockerReasonCodes.length === 0 && provider.status === 'online';

  const blockerPenalties = {
    approval_pending: 35,
    provider_paused: 40,
    provider_suspended: 50,
    daemon_not_installed: 30,
    daemon_version_missing: 15,
    heartbeat_missing: 25,
    heartbeat_stale_critical: 20,
    heartbeat_stale: 10,
    readiness_checks_failed: 20,
  };

  let score = 100;
  for (const code of blockerReasonCodes) score -= blockerPenalties[code] || 0;
  if (heartbeatAge != null && heartbeatAge <= 5 * 60) score += 10;
  else if (heartbeatAge != null && heartbeatAge <= 60 * 60) score += 5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    provider_id: provider.id,
    name: provider.name || null,
    email: provider.email || null,
    phone: provider.phone || null,
    organization: provider.organization || null,
    location: provider.location || null,
    status: provider.status || null,
    approval_status: provider.approval_status || null,
    created_at: toIsoOrNull(provider.created_at),
    last_heartbeat: toIsoOrNull(provider.last_heartbeat),
    heartbeat_age_seconds: heartbeatAge,
    install_status: installStatus,
    readiness_status: readinessStatus || null,
    ready_to_serve: readyToServe,
    blocker_reason_codes: blockerReasonCodes,
    failed_readiness_checks: readinessFailureChecks,
    blocker_count: blockerReasonCodes.length,
    priority_score: score,
    priority_band: score >= 70 ? 'high' : (score >= 40 ? 'medium' : 'low'),
    suggested_action: readyToServe
      ? 'activate_now'
      : (blockerReasonCodes[0] || 'needs_manual_review'),
  };
}

function sortReactivationQueue(queue) {
  return [...queue].sort((a, b) => {
    if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
    if (a.blocker_count !== b.blocker_count) return a.blocker_count - b.blocker_count;
    const ageA = a.heartbeat_age_seconds == null ? Number.MAX_SAFE_INTEGER : a.heartbeat_age_seconds;
    const ageB = b.heartbeat_age_seconds == null ? Number.MAX_SAFE_INTEGER : b.heartbeat_age_seconds;
    if (ageA !== ageB) return ageA - ageB;
    return Number(a.provider_id || 0) - Number(b.provider_id || 0);
  });
}

function generateProviderReactivationQueue(db, options = {}) {
  const {
    nowMs = Date.now(),
    inactiveOnly = true,
    limit = 1000,
  } = options;

  const columns = getProviderColumnSet(db);
  const providers = queryAll(db, buildProviderReactivationQuery(columns));
  let queue = providers.map((provider) => buildReactivationRecord(provider, nowMs));

  if (inactiveOnly) {
    queue = queue.filter((entry) => !entry.ready_to_serve);
  }

  const ranked = sortReactivationQueue(queue).map((entry, index) => ({
    ...entry,
    queue_position: index + 1,
  }));

  const boundedLimit = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(5000, Number(limit)))
    : 1000;
  const providersLimited = ranked.slice(0, boundedLimit);

  return {
    total: ranked.length,
    returned: providersLimited.length,
    summary: {
      ready_to_serve: ranked.filter((entry) => entry.ready_to_serve).length,
      blocked: ranked.filter((entry) => !entry.ready_to_serve).length,
      top_10_ids: providersLimited.slice(0, 10).map((entry) => entry.provider_id),
    },
    generated_at: new Date(nowMs).toISOString(),
    providers: providersLimited,
  };
}

function escapeCsvValue(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toProviderReactivationCsv(queuePayload) {
  const columns = [
    'queue_position',
    'provider_id',
    'name',
    'email',
    'phone',
    'organization',
    'location',
    'status',
    'approval_status',
    'priority_score',
    'priority_band',
    'suggested_action',
    'ready_to_serve',
    'blocker_count',
    'blocker_reason_codes',
    'failed_readiness_checks',
    'last_heartbeat',
    'heartbeat_age_seconds',
    'install_status',
    'readiness_status',
    'created_at',
  ];

  const rows = [columns.join(',')];
  for (const entry of queuePayload.providers || []) {
    const row = columns.map((column) => {
      if (column === 'blocker_reason_codes') return escapeCsvValue((entry.blocker_reason_codes || []).join(';'));
      if (column === 'failed_readiness_checks') return escapeCsvValue((entry.failed_readiness_checks || []).join(';'));
      return escapeCsvValue(entry[column]);
    });
    rows.push(row.join(','));
  }

  return `${rows.join('\n')}\n`;
}

module.exports = {
  generateProviderReactivationQueue,
  toProviderReactivationCsv,
  __private: {
    buildReactivationRecord,
    heartbeatAgeSeconds,
    parseReadinessDetailFailures,
    sortReactivationQueue,
  },
};
