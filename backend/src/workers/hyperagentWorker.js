'use strict';

/**
 * hyperagentWorker.js
 *
 * PM2 cron entry point for the HyperAgent meta-agent self-improvement cycle.
 * Runs every 6 hours. Calls MiniMax M2.7 to analyse job outcomes and rewrite
 * the task agent's strategy parameters. Falls back to hill climbing if the
 * LLM is unreachable.
 *
 * Can run as:
 *   1. PM2 cron: node src/workers/hyperagentWorker.js
 *   2. Manual:   node src/workers/hyperagentWorker.js --force
 */

const hyperagent = require('../services/hyperagent');

const TAG = '[hyperagent-worker]';

async function run() {
  const started = new Date().toISOString();
  console.log(`${TAG} Starting meta-cycle at ${started}`);

  // Initialise schema (idempotent)
  hyperagent.init();

  // Run the meta-agent improvement cycle (may call M2.7 API)
  const result = await hyperagent.runMetaCycle();

  console.log(
    `${TAG} Meta-cycle #${result.cycle} completed at ${new Date().toISOString()}. ` +
    `Improved: ${result.improved}. Changes: ${result.changes.length}`
  );

  if (result.reasoning) {
    console.log(`${TAG} Reasoning: ${result.reasoning.slice(0, 500)}`);
  }

  if (result.changes.length > 0) {
    console.log(`${TAG} Changes applied:`);
    for (const change of result.changes) {
      console.log(`${TAG}   • ${change}`);
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`${TAG} Fatal error:`, error.message);
    console.error(error.stack);
    process.exit(1);
  });
