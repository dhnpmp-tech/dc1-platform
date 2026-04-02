'use strict';

const fs = require('fs');
const path = require('path');

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';

const {
  formatComplianceReport,
  runOpenRouterComplianceHarness,
} = require('./helpers/openrouterComplianceHarness');

function makeStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function resolveArtifactDir() {
  if (process.env.DC1_COMPLIANCE_ARTIFACT_DIR) {
    return path.resolve(process.cwd(), process.env.DC1_COMPLIANCE_ARTIFACT_DIR);
  }
  return path.resolve(__dirname, '..', 'artifacts', 'openrouter-compliance');
}

function writeArtifacts(report, markdown) {
  const artifactDir = resolveArtifactDir();
  const stamp = makeStamp();
  const jsonName = `report-${stamp}.json`;
  const mdName = `report-${stamp}.md`;
  const latestJsonName = 'latest.json';
  const latestMdName = 'latest.md';

  fs.mkdirSync(artifactDir, { recursive: true });

  const jsonPayload = JSON.stringify(report, null, 2);
  fs.writeFileSync(path.join(artifactDir, jsonName), jsonPayload);
  fs.writeFileSync(path.join(artifactDir, mdName), markdown);
  fs.writeFileSync(path.join(artifactDir, latestJsonName), jsonPayload);
  fs.writeFileSync(path.join(artifactDir, latestMdName), markdown);

  return {
    artifactDir,
    files: [jsonName, mdName, latestJsonName, latestMdName],
  };
}

async function main() {
  const report = await runOpenRouterComplianceHarness();
  const markdown = formatComplianceReport(report);
  const written = writeArtifacts(report, markdown);

  console.log(markdown);
  console.log('');
  console.log('Compliance artifacts written:');
  for (const name of written.files) {
    console.log(`- ${path.join(written.artifactDir, name)}`);
  }
  console.log('');
  console.log('Local rerun command:');
  console.log('cd backend && npm run test:openrouter:compliance');

  process.exit(report.summary.blockingFailures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('OpenRouter compliance harness failed to execute:', error);
  process.exit(1);
});
