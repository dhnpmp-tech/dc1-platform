'use strict';

if (!process.env.DC1_DB_PATH) process.env.DC1_DB_PATH = ':memory:';

const path = require('path');

const {
  formatCanaryReport,
  runOpenRouterReliabilityCanary,
  writeCanaryArtifacts,
} = require('./helpers/openrouterReliabilityCanary');

function parseArgs(argv) {
  const args = {
    simulateFailure: false,
    outputDir: path.resolve(__dirname, '../../docs/reports/openrouter/reliability'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--simulate-failure' || arg === '--mode=forced-failure') {
      args.simulateFailure = true;
      continue;
    }
    if (arg === '--mode=clean') {
      args.simulateFailure = false;
      continue;
    }
    if (arg === '--output-dir') {
      const nextValue = argv[index + 1];
      if (nextValue) {
        args.outputDir = path.resolve(nextValue);
        index += 1;
      }
      continue;
    }
    if (arg.startsWith('--output-dir=')) {
      args.outputDir = path.resolve(arg.split('=')[1]);
    }
  }

  if (process.env.CANARY_SIMULATE_FAILURE === '1') {
    args.simulateFailure = true;
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await runOpenRouterReliabilityCanary({
    simulateFailure: args.simulateFailure,
  });
  const artifacts = writeCanaryArtifacts(report, { outputDir: args.outputDir });

  console.log(formatCanaryReport(report));
  console.log('');
  console.log('Artifacts:');
  console.log(`- json: ${artifacts.jsonPath}`);
  console.log(`- markdown: ${artifacts.mdPath}`);
  console.log(`- latest json: ${artifacts.latestJsonPath}`);
  console.log(`- latest markdown: ${artifacts.latestMdPath}`);

  process.exit(report.summary.status === 'pass' ? 0 : 1);
}

main().catch((error) => {
  console.error('OpenRouter reliability canary failed to execute:', error);
  process.exit(1);
});
