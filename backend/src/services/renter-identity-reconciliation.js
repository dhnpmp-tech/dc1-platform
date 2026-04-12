const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const RENTER_TYPES = new Set(['renter', 'both']);

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;
  return normalized;
}

function normalizeName(value, email) {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 120);
  const localPart = String(email || '').split('@')[0] || 'Renter';
  return localPart.slice(0, 120);
}

function parseIso(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

function generateApiKey() {
  return `dcp-renter-${crypto.randomBytes(16).toString('hex')}`;
}

function ensureUniqueApiKey(db, preferredApiKey, existingRenterId = null) {
  const preferred = typeof preferredApiKey === 'string' && preferredApiKey.trim()
    ? preferredApiKey.trim()
    : generateApiKey();
  let candidate = preferred;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const owner = db.get('SELECT id FROM renters WHERE api_key = ?', candidate);
    if (!owner || owner.id === existingRenterId) return candidate;
    candidate = generateApiKey();
  }
  return `${generateApiKey()}-${Date.now().toString(36)}`;
}

function mapStatus(rawStatus) {
  const status = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
  if (status === 'suspended') return 'suspended';
  if (status === 'deleted') return 'deleted';
  return 'active';
}

function extractWalletBalanceHalala(wallet) {
  if (!wallet || typeof wallet !== 'object') return 0;

  const explicitHalalaFields = [
    'balance_halala',
    'available_halala',
    'available_balance_halala',
  ];
  for (const field of explicitHalalaFields) {
    const raw = wallet[field];
    if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
    if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) {
      const parsed = Number(raw);
      if (parsed >= 0) return Math.floor(parsed);
    }
  }

  const sarFields = ['balance_sar', 'available_sar', 'balance', 'available'];
  for (const field of sarFields) {
    const raw = wallet[field];
    if (Number.isFinite(raw) && raw >= 0) return Math.floor(raw * 100);
    if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) {
      const parsed = Number(raw);
      if (parsed >= 0) return Math.floor(parsed * 100);
    }
  }

  return 0;
}

function isRenterUser(supabaseUser) {
  if (!supabaseUser || typeof supabaseUser !== 'object') return false;
  const type = typeof supabaseUser.type === 'string' ? supabaseUser.type.toLowerCase() : '';
  if (!type) return true;
  return RENTER_TYPES.has(type);
}

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || null;
  if (url && key) {
    return createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  // Fallback for legacy environments where backend/src/supabase.js
  // already provisions a service-role client.
  try {
    // eslint-disable-next-line global-require
    const fallback = require('../supabase');
    if (fallback?.supabase) return fallback.supabase;
  } catch (_) {}

  return null;
}

async function fetchWalletForUser(supabase, userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .limit(1);
  if (error) return null;
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function fetchSupabaseRenterByEmail(supabase, email) {
  if (!supabase) return null;
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  let user = null;
  const exact = await supabase
    .from('users')
    .select('*')
    .eq('email', normalized)
    .limit(1);
  if (!exact.error && Array.isArray(exact.data) && exact.data.length) {
    user = exact.data[0];
  }

  if (!user) {
    const insensitive = await supabase
      .from('users')
      .select('*')
      .ilike('email', normalized)
      .limit(1);
    if (!insensitive.error && Array.isArray(insensitive.data) && insensitive.data.length) {
      user = insensitive.data[0];
    }
  }

  if (!user || !isRenterUser(user)) return null;

  const wallet = await fetchWalletForUser(supabase, user.id);
  return { user, wallet };
}

async function fetchAllSupabaseRenters(supabase, { pageSize = 200, limit = null } = {}) {
  if (!supabase) throw new Error('Supabase client unavailable');
  const renters = [];
  let offset = 0;

  while (true) {
    const upper = offset + pageSize - 1;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('email', { ascending: true, nullsFirst: false })
      .range(offset, upper);
    if (error) throw new Error(`Supabase users query failed: ${error.message}`);

    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) break;

    for (const row of rows) {
      if (!isRenterUser(row)) continue;
      const normalized = normalizeEmail(row.email);
      if (!normalized) continue;
      renters.push(row);
      if (limit != null && renters.length >= limit) {
        return renters;
      }
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return renters;
}

function upsertSqliteRenterFromSupabase(db, supabaseUser, wallet) {
  const email = normalizeEmail(supabaseUser?.email);
  if (!email) {
    return { action: 'skipped', reason: 'missing_email', renter: null };
  }

  const nowIso = new Date().toISOString();
  const existing = db.get('SELECT * FROM renters WHERE LOWER(email) = LOWER(?)', email);
  const status = mapStatus(supabaseUser?.status);
  const name = normalizeName(supabaseUser?.name, email);
  const organization = typeof supabaseUser?.organization === 'string' && supabaseUser.organization.trim()
    ? supabaseUser.organization.trim().slice(0, 160)
    : null;

  if (existing) {
    const apiKey = ensureUniqueApiKey(db, existing.api_key || supabaseUser?.api_key, existing.id);
    db.prepare(
      `UPDATE renters
       SET name = ?, email = ?, api_key = ?, organization = COALESCE(organization, ?), status = ?, updated_at = ?
       WHERE id = ?`
    ).run(name, email, apiKey, organization, existing.status || status, nowIso, existing.id);
    const renter = db.get('SELECT * FROM renters WHERE id = ?', existing.id);
    return { action: 'updated', renter };
  }

  const apiKey = ensureUniqueApiKey(db, supabaseUser?.api_key);
  const createdAt = parseIso(supabaseUser?.created_at, nowIso);
  const balanceHalala = extractWalletBalanceHalala(wallet);
  const insert = db.prepare(
    `INSERT INTO renters
     (name, email, api_key, organization, status, balance_halala, total_spent_halala, total_jobs, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
  ).run(name, email, apiKey, organization, status, balanceHalala, createdAt, nowIso);
  const renter = db.get('SELECT * FROM renters WHERE id = ?', insert.lastInsertRowid);
  return { action: 'created', renter };
}

async function reconcileRenterByEmailFromSupabase({ db, email, supabase = null }) {
  const client = supabase || getSupabaseAdminClient();
  if (!client) return { reconciled: false, reason: 'supabase_unavailable', renter: null };

  const match = await fetchSupabaseRenterByEmail(client, email);
  if (!match) return { reconciled: false, reason: 'supabase_user_not_found', renter: null };

  const result = upsertSqliteRenterFromSupabase(db, match.user, match.wallet);
  return { reconciled: true, ...result };
}

module.exports = {
  extractWalletBalanceHalala,
  fetchAllSupabaseRenters,
  fetchSupabaseRenterByEmail,
  getSupabaseAdminClient,
  normalizeEmail,
  reconcileRenterByEmailFromSupabase,
  upsertSqliteRenterFromSupabase,
};
