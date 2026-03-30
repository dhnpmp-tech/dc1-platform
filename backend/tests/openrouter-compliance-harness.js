'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';

const {
  formatComplianceReport,
  runOpenRouterComplianceHarness,
} = require('./helpers/openrouterComplianceHarness');

async function main() {
  const report = await runOpenRouterComplianceHarness();
  console.log(formatComplianceReport(report));
  process.exit(report.summary.blockingFailures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('OpenRouter compliance harness failed to execute:', error);
  process.exit(1);
});
