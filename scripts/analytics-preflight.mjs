#!/usr/bin/env node
/**
 * DCP Analytics Pre-Flight Verification (DCP-935)
 *
 * Verifies that the Segment write key is configured and that
 * test events can be sent successfully before Phase 1 launch.
 *
 * Usage:
 *   SEGMENT_WRITE_KEY=<key> node scripts/analytics-preflight.mjs
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — SEGMENT_WRITE_KEY not set (analytics disabled, non-fatal for launch)
 *   2 — Segment HTTP API returned an error
 */

import https from 'https';

const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY || '';
const DRY_RUN = process.env.DRY_RUN === '1';

function log(level, msg, extra = '') {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] ${msg}${extra ? ' ' + extra : ''}`);
}

function segmentTrack(userId, event, properties) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      userId,
      event,
      properties: { platform: 'dcp', preflight: true, ...properties },
      sentAt: new Date().toISOString(),
      context: { library: { name: 'dc1-preflight', version: '1.0.0' } },
    });

    const credentials = Buffer.from(`${SEGMENT_WRITE_KEY}:`).toString('base64');
    const options = {
      hostname: 'api.segment.io',
      port: 443,
      path: '/v1/track',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `Basic ${credentials}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Segment returned ${res.statusCode}: ${data}`));
        } else {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Segment request timed out after 5s'));
    });

    req.write(body);
    req.end();
  });
}

async function run() {
  log('INFO', 'DCP Analytics Pre-Flight Verification starting');
  log('INFO', `SEGMENT_WRITE_KEY configured: ${SEGMENT_WRITE_KEY ? 'YES' : 'NO'}`);
  log('INFO', `Dry run: ${DRY_RUN}`);

  if (!SEGMENT_WRITE_KEY) {
    log('WARN', 'SEGMENT_WRITE_KEY is not set.');
    log('WARN', 'Analytics will be disabled at launch. Set SEGMENT_WRITE_KEY in PM2 env to enable.');
    log('WARN', 'This is non-fatal for Phase 1 launch but analytics data will not be collected.');
    process.exit(1);
  }

  const testEvents = [
    { userId: 'preflight-test-user-001', event: 'renter_signup_complete', props: { test: true } },
    { userId: 'preflight-test-provider-001', event: 'provider_signup_complete', props: { test: true } },
    { userId: 'preflight-test-user-001', event: 'renter_deployment_start', props: { job_id: 'preflight-job-001', model_id: 'alm-alm-7b', test: true } },
    { userId: 'preflight-test-user-001', event: 'api_latency', props: { endpoint: '/api/models', method: 'GET', status_code: 200, duration_ms: 45, test: true } },
  ];

  let passed = 0;
  let failed = 0;

  for (const { userId, event, props } of testEvents) {
    if (DRY_RUN) {
      log('INFO', `[DRY RUN] Would track: ${event} for ${userId}`);
      passed++;
      continue;
    }

    try {
      const result = await segmentTrack(userId, event, props);
      log('OK', `  ✓ ${event} → HTTP ${result.statusCode}`);
      passed++;
    } catch (err) {
      log('ERROR', `  ✗ ${event} → ${err.message}`);
      failed++;
    }
  }

  log('INFO', `\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    log('ERROR', 'Pre-flight FAILED — Segment webhook delivery errors detected.');
    log('ERROR', 'Check SEGMENT_WRITE_KEY validity and Segment project settings.');
    process.exit(2);
  }

  log('INFO', 'Pre-flight PASSED — Analytics instrumentation verified.');
  log('INFO', 'Events should appear in Segment debugger within 30 seconds.');
  log('INFO', 'Filter by property preflight=true to identify test events.');
  process.exit(0);
}

run().catch((err) => {
  log('ERROR', 'Unexpected error:', err.message);
  process.exit(2);
});
