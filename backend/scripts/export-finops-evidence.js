#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const db = require('../src/db');
const { buildEvidenceBundle } = require('../src/services/finopsEvidenceService');

function parseArgs(argv) {
  const args = { outDir: path.resolve(__dirname, '..', '..', 'docs', 'finance') };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--out-dir') {
      args.outDir = argv[i + 1] ? path.resolve(argv[i + 1]) : args.outDir;
      i += 1;
    } else if (token === '--candidate-limit') {
      const raw = Number(argv[i + 1]);
      if (Number.isFinite(raw) && raw > 0) args.candidateLimit = raw;
      i += 1;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    }
  }
  return args;
}

function toStamp(iso) {
  return iso.replace(/[:.]/g, '-');
}

function buildMarkdown(bundle) {
  const lines = [];
  lines.push('# FinOps Evidence Bundle: First Paid SAR Transaction');
  lines.push('');
  lines.push(`- Generated at: ${bundle.generated_at}`);
  lines.push(`- Candidates evaluated: ${bundle.candidates_evaluated}`);
  lines.push(`- Summary: ${bundle.summary}`);
  lines.push('');

  lines.push('## 1) Request / Inference Identifiers');
  lines.push('');
  if (!bundle.transaction_path) {
    lines.push('No candidate transaction was selected.');
  } else {
    lines.push('```json');
    lines.push(JSON.stringify(bundle.transaction_path, null, 2));
    lines.push('```');
  }
  lines.push('');

  lines.push('## 2) Metering Record');
  lines.push('');
  if (!bundle.metering_record) {
    lines.push('No metering record was found for the selected candidate.');
  } else {
    lines.push('```json');
    lines.push(JSON.stringify(bundle.metering_record, null, 2));
    lines.push('```');
  }
  lines.push('');

  lines.push('## 3) Payment / Charge Row');
  lines.push('');
  if (!bundle.payment_charge_row) {
    lines.push('No linked payment row was found.');
  } else {
    lines.push('```json');
    lines.push(JSON.stringify(bundle.payment_charge_row, null, 2));
    lines.push('```');
  }
  lines.push('');

  lines.push('## 4) Ledger Postings');
  lines.push('');
  if (!bundle.ledger_postings || bundle.ledger_postings.length === 0) {
    lines.push('No linked ledger postings were found.');
  } else {
    lines.push('```json');
    lines.push(JSON.stringify(bundle.ledger_postings, null, 2));
    lines.push('```');
  }
  lines.push('');

  lines.push('## 5) Missing Linkage Fields');
  lines.push('');
  if (!bundle.missing_linkage_fields || bundle.missing_linkage_fields.length === 0) {
    lines.push('No missing linkage fields detected.');
  } else {
    for (const gap of bundle.missing_linkage_fields) {
      lines.push(`- [${gap.table}.${gap.field}] ${gap.message}`);
      lines.push(`  - Recommended fix: ${gap.recommended_fix}`);
    }
  }
  lines.push('');

  lines.push('## 6) SQL / Command Pack');
  lines.push('');
  lines.push('```sql');
  lines.push(bundle.sql_command_pack || '-- no SQL available');
  lines.push('```');
  lines.push('');

  lines.push('## 7) Table Capabilities Snapshot');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(bundle.table_capabilities, null, 2));
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node backend/scripts/export-finops-evidence.js [--out-dir <path>] [--candidate-limit <n>]');
    process.exit(0);
  }

  const bundle = buildEvidenceBundle(db._db || db, { candidateLimit: args.candidateLimit });
  const stamp = toStamp(bundle.generated_at);

  fs.mkdirSync(args.outDir, { recursive: true });
  const jsonPath = path.join(args.outDir, `first-paid-sar-evidence-${stamp}.json`);
  const mdPath = path.join(args.outDir, `first-paid-sar-evidence-${stamp}.md`);

  fs.writeFileSync(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, `${buildMarkdown(bundle)}\n`, 'utf8');

  console.log(`[finops-evidence] Wrote JSON: ${jsonPath}`);
  console.log(`[finops-evidence] Wrote Markdown: ${mdPath}`);
  console.log(`[finops-evidence] Summary: ${bundle.summary}`);
}

main();
