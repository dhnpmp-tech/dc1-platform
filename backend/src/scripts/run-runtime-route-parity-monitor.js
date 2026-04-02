#!/usr/bin/env node
'use strict';

const { runRuntimeRouteParityMonitor } = require('../services/runtimeRouteParityMonitor');

async function main() {
  const started = Date.now();
  const result = await runRuntimeRouteParityMonitor();
  const elapsedMs = Date.now() - started;

  const summary = result.report.summary;
  console.log(`[runtime-route-parity] base=${result.report.base_url}`);
  console.log(
    `[runtime-route-parity] status=${summary.status} pass=${summary.pass} failed=${summary.failed} latency_breaches=${summary.latency_breaches}`
  );
  console.log(`[runtime-route-parity] artifact=${result.artifactPath}`);

  if (summary.threshold_breaches.length > 0) {
    summary.threshold_breaches.forEach((item) => {
      console.error(`[runtime-route-parity] threshold-breach: ${item}`);
    });
  }

  result.report.routes
    .filter((route) => route.status === 'fail' || route.latencyBreached)
    .forEach((route) => {
      const notes = [];
      if (route.status === 'fail') notes.push(`mismatches=${route.mismatches.join('; ')}`);
      if (route.latencyBreached) notes.push(`latency=${route.runtime.durationMs}ms`);
      console.error(`[runtime-route-parity] route=${route.method} ${route.path} ${notes.join(' | ')}`);
    });

  console.log(`[runtime-route-parity] elapsed_ms=${elapsedMs}`);

  if (summary.status !== 'pass') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[runtime-route-parity] fatal: ${error.message}`);
  process.exit(1);
});
