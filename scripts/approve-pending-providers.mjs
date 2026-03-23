#!/usr/bin/env node
/**
 * approve-pending-providers.mjs
 *
 * Bulk-approves all providers with approval_status='pending' so their daemons
 * can start sending heartbeats and become "active" in the marketplace.
 *
 * Usage:
 *   DC1_ADMIN_TOKEN=<token> node scripts/approve-pending-providers.mjs [--dry-run]
 *
 * Options:
 *   --dry-run   List pending providers without approving them
 *   --base-url  API base URL (default: http://localhost:8083)
 */

const BASE_URL = process.env.DC1_BASE_URL || 'http://localhost:8083';
const ADMIN_TOKEN = process.env.DC1_ADMIN_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run');

if (!ADMIN_TOKEN) {
  console.error('ERROR: DC1_ADMIN_TOKEN env var is required');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'x-admin-token': ADMIN_TOKEN,
};

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json();
}

async function main() {
  console.log(`DCP Provider Activation Script`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE APPROVAL'}`);
  console.log('');

  // Fetch all pending-approval providers
  const data = await fetchJson(`${BASE_URL}/api/admin/providers?status=pending_approval`);
  const pending = data.providers || data;

  if (!pending.length) {
    console.log('No pending providers found.');
    return;
  }

  console.log(`Found ${pending.length} pending provider(s):\n`);
  for (const p of pending) {
    console.log(`  [${p.id}] ${p.name} — GPU: ${p.gpu_model || 'unknown'} — Email: ${p.email || 'n/a'} — Registered: ${p.created_at}`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN: No changes made. Remove --dry-run to approve these providers.');
    return;
  }

  // Bulk approve
  const ids = pending.map(p => p.id);
  const result = await fetchJson(`${BASE_URL}/api/admin/bulk/providers`, {
    method: 'POST',
    body: JSON.stringify({ ids, action: 'approve' }),
  });

  console.log(`Approval result:`);
  console.log(`  Processed: ${result.processed}`);
  console.log(`  Failed:    ${result.failed}`);
  console.log('');
  console.log('Providers approved. Their daemons will be accepted on next heartbeat (within 30s).');
  console.log('Monitor activation with:');
  console.log(`  curl -H "x-admin-token: $DC1_ADMIN_TOKEN" ${BASE_URL}/api/admin/providers/health`);
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
