#!/usr/bin/env node

const db = require('../db');
const {
  fetchAllSupabaseRenters,
  getSupabaseAdminClient,
  normalizeEmail,
  upsertSqliteRenterFromSupabase,
} = require('../services/renter-identity-reconciliation');

function parseArgs(argv) {
  const args = { dryRun: false, limit: null };
  for (const token of argv) {
    if (token === '--dry-run') args.dryRun = true;
    if (token.startsWith('--limit=')) {
      const value = Number.parseInt(token.split('=')[1], 10);
      if (Number.isFinite(value) && value > 0) args.limit = value;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.error('[backfill] Supabase admin client unavailable. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
    process.exitCode = 1;
    return;
  }

  const renters = await fetchAllSupabaseRenters(supabase, { limit: args.limit });
  const uniqueByEmail = new Map();
  for (const user of renters) {
    const email = normalizeEmail(user.email);
    if (!email || uniqueByEmail.has(email)) continue;
    uniqueByEmail.set(email, user);
  }

  const stats = {
    scanned_users: renters.length,
    unique_renter_emails: uniqueByEmail.size,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  console.log(`[backfill] Starting Supabase -> SQLite renter backfill (${uniqueByEmail.size} unique renter emails)`);
  if (args.dryRun) console.log('[backfill] Dry-run mode enabled (no DB writes)');

  for (const supabaseUser of uniqueByEmail.values()) {
    const email = normalizeEmail(supabaseUser.email);
    try {
      const wallet = await (async () => {
        const { data, error } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', supabaseUser.id)
          .limit(1);
        if (error) return null;
        return Array.isArray(data) && data.length ? data[0] : null;
      })();

      if (args.dryRun) {
        const existing = db.get('SELECT id, api_key FROM renters WHERE LOWER(email) = LOWER(?)', email);
        if (existing) stats.updated += 1;
        else stats.created += 1;
        continue;
      }

      const result = upsertSqliteRenterFromSupabase(db, supabaseUser, wallet);
      if (result.action === 'created') stats.created += 1;
      else if (result.action === 'updated') stats.updated += 1;
      else stats.skipped += 1;
    } catch (error) {
      stats.errors += 1;
      console.error(`[backfill] Failed for ${email}:`, error.message);
    }
  }

  console.log('[backfill] Summary:', JSON.stringify(stats, null, 2));
  if (stats.errors > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[backfill] Fatal error:', error.message);
  process.exit(1);
});
