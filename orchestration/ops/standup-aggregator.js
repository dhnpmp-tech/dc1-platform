#!/usr/bin/env node
// DC1 Daily Standup Aggregator — standalone cron script
// Usage: node standup-aggregator.js
// Env: TELEGRAM_BOT_TOKEN, DC1_TELEGRAM_CHAT_ID (optional, defaults to -5275672778)
//
// Cron example (6 AM Dubai = 02:00 UTC):
//   0 2 * * * cd /path/to/backend && node ../orchestration/ops/standup-aggregator.js

// Load the standup module (reuses db connection from backend/src/db)
const path = require('path');

// Set working directory context so db.js finds providers.db
process.chdir(path.join(__dirname, '..', '..', 'backend'));

const { generateStandupData, sendToTelegram } = require(path.join(__dirname, '..', '..', 'backend', 'src', 'routes', 'standup'));

async function main() {
  console.log('[standup-aggregator] Generating daily standup...');

  try {
    const data = generateStandupData();
    console.log('[standup-aggregator] Report generated:', data.date);
    console.log(data.telegram_text);

    const result = await sendToTelegram(data.telegram_text);
    if (result.ok) {
      console.log('[standup-aggregator] ✅ Sent to Telegram');
    } else {
      console.error('[standup-aggregator] ⚠️ Telegram send issue:', result.error || result.description);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[standup-aggregator] ❌ Fatal error:', err.message);
    process.exitCode = 1;
  }
}

main();
