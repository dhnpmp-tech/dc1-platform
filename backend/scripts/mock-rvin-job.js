#!/usr/bin/env node
// Mock RVIN Job Script — manually submit a simulated RVIN job to DC1
const http = require('http');

const BASE = process.env.DC1_API_URL || 'http://localhost:8083';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = { method, hostname: url.hostname, port: url.port, path: url.pathname, headers: { 'Content-Type': 'application/json' } };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  console.log('🚀 DC1 Mock RVIN Job — Self-Test');
  console.log('='.repeat(50));
  console.log(`Target: ${BASE}\n`);

  // Step 1: Submit RVIN job
  console.log('📤 Submitting 60-min LLM inference job...');
  const submit = await req('POST', '/api/jobs/submit', {
    provider_id: 1,
    job_type: 'llm-inference',
    duration_minutes: 60,
    gpu_requirements: { min_vram_gb: 20, gpu_model: 'RTX 3090' }
  });

  if (submit.status !== 201) {
    console.error('❌ Submit failed:', submit.body);
    process.exit(1);
  }

  const job = submit.body.job;
  console.log(`✅ Job #${job.id} submitted → status: ${job.status}`);
  console.log(`   Provider: #${job.provider_id} | Cost: ${job.cost_halala} halala (${(job.cost_halala / 100).toFixed(2)} SAR)`);

  // Step 2: Check status
  console.log('\n📊 Checking job status...');
  const status = await req('GET', `/api/jobs/${job.id}`);
  console.log(`   Status: ${status.body.job.status}`);

  // Step 3: Complete job
  console.log('\n✔️  Completing job...');
  const complete = await req('POST', `/api/jobs/${job.id}/complete`);
  if (complete.status === 200) {
    console.log(`✅ Job #${job.id} completed at ${complete.body.job.completed_at}`);
  } else {
    console.error('❌ Complete failed:', complete.body);
  }

  // Step 4: Verify final state
  const final = await req('GET', `/api/jobs/${job.id}`);
  console.log(`\n📋 Final state: ${final.body.job.status}`);
  console.log('='.repeat(50));
  console.log('🏁 Mock RVIN job test complete.');
})();
