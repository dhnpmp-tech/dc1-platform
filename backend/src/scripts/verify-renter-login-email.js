#!/usr/bin/env node

const express = require('express');
const request = require('supertest');
const db = require('../db');
const rentersRouter = require('../routes/renters');
const {
  fetchAllSupabaseRenters,
  getSupabaseAdminClient,
  normalizeEmail,
} = require('../services/renter-identity-reconciliation');

async function main() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.error('[verify-login-email] Supabase admin client unavailable. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.');
    process.exitCode = 1;
    return;
  }

  const users = await fetchAllSupabaseRenters(supabase);
  const emails = [...new Set(users.map((user) => normalizeEmail(user.email)).filter(Boolean))];
  if (!emails.length) {
    console.log('[verify-login-email] No Supabase renter emails found.');
    return;
  }

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/renters', rentersRouter);

  const failures = [];
  let success = 0;
  for (let i = 0; i < emails.length; i += 1) {
    const email = emails[i];
    const xff = `10.1.${Math.floor(i / 250)}.${(i % 250) + 1}`;
    const res = await request(app)
      .post('/api/renters/login-email')
      .set('X-Forwarded-For', xff)
      .send({ email });

    if (res.status === 200 && res.body?.api_key) {
      success += 1;
      continue;
    }

    failures.push({ email, status: res.status, error: res.body?.error || 'Unknown error' });
  }

  const sqliteResolvable = db.get(
    `SELECT COUNT(*) AS count
     FROM renters
     WHERE status = 'active'
       AND LOWER(email) IN (${emails.map(() => '?').join(', ')})`,
    ...emails
  )?.count || 0;

  const summary = {
    supabase_renter_emails: emails.length,
    login_email_successes: success,
    login_email_failures: failures.length,
    sqlite_active_matches: sqliteResolvable,
  };

  console.log('[verify-login-email] Summary:', JSON.stringify(summary, null, 2));
  if (failures.length) {
    console.log('[verify-login-email] Failures:', JSON.stringify(failures, null, 2));
    process.exitCode = 1;
  } else {
    console.log('[verify-login-email] PASS: all Supabase renter emails resolved by /api/renters/login-email');
  }
}

main().catch((error) => {
  console.error('[verify-login-email] Fatal error:', error.message);
  process.exit(1);
});
