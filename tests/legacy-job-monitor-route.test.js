const fs = require('fs');
const path = require('path');
const assert = require('assert');

const monitorPagePath = path.join(__dirname, '..', 'app', 'jobs', '[id]', 'monitor', 'page.tsx');
const source = fs.readFileSync(monitorPagePath, 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  ❌ ${name}: ${error.message}`);
  }
}

console.log('\n=== Legacy job monitor route tests ===\n');

test('tracks redirect analytics event for authenticated renter flow', () => {
  assert(source.includes('job_monitor_redirected_to_renter_detail'));
});

test('tracks login-required analytics event for unauthenticated flow', () => {
  assert(source.includes('job_monitor_login_required'));
});

test('redirect target is canonical renter details route', () => {
  assert(source.includes('`/renter/jobs/${params.id}`'));
  assert(source.includes('router.replace(target)'));
});

test('login CTA preserves redirect back to canonical renter route', () => {
  assert(source.includes('`/login?role=renter&redirect=${encodeURIComponent(target)}`'));
});

test('legacy monitor page does not render JobMonitor component', () => {
  assert(!source.includes('<JobMonitor'));
  assert(!source.includes("from '../../../../components/jobs/JobMonitor'"));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
