#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const parsed = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    i += 1;
  }
  return parsed;
}

function readEvents(inputPath) {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[')) {
    const list = JSON.parse(trimmed);
    return Array.isArray(list) ? list : [];
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function extractPayload(record) {
  if (record && typeof record === 'object' && record.detail && typeof record.detail === 'object') {
    return record.detail;
  }
  return record;
}

function toDate(value) {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeEvent(raw, idx) {
  const payload = extractPayload(raw);
  const event = payload?.event;
  if (typeof event !== 'string') return null;

  const ts =
    toDate(payload.timestamp) ||
    toDate(payload.ts) ||
    toDate(payload.occurred_at) ||
    toDate(payload.created_at) ||
    toDate(raw.timestamp) ||
    toDate(raw.ts);

  const locale = typeof payload.locale === 'string' && payload.locale ? payload.locale : 'unknown';
  const source = typeof payload.source === 'string' && payload.source ? payload.source : 'direct';
  const sessionId =
    payload.session_id ||
    payload.sessionId ||
    payload.anon_id ||
    payload.anonymous_id ||
    payload.visitor_id ||
    payload.user_id ||
    payload.userId ||
    payload.renter_id ||
    `unknown-session-${idx}`;

  return {
    event,
    locale,
    source,
    sessionId: String(sessionId),
    timestamp: ts,
  };
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function makeSummary(events, now, days) {
  const windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const filtered = events.filter((event) => {
    if (!event.timestamp) return false;
    return event.timestamp >= windowStart && event.timestamp <= now;
  });

  const buckets = new Map();
  for (const event of filtered) {
    const key = `${event.locale}||${event.source}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        views: new Set(),
        apiKeys: new Set(),
        firstChats: new Set(),
      });
    }
    const bucket = buckets.get(key);
    if (event.event === 'quickstart_page_view') bucket.views.add(event.sessionId);
    if (event.event === 'quickstart_api_key_created') bucket.apiKeys.add(event.sessionId);
    if (event.event === 'quickstart_first_chat_success') bucket.firstChats.add(event.sessionId);
  }

  const breakdown = Array.from(buckets.entries())
    .map(([key, value]) => {
      const [locale, source] = key.split('||');
      const views = value.views.size;
      const apiKeys = value.apiKeys.size;
      const firstChats = value.firstChats.size;
      return {
        locale,
        source,
        quickstart_page_view: views,
        quickstart_api_key_created: apiKeys,
        quickstart_first_chat_success: firstChats,
        page_to_api_key_rate_pct: percent(apiKeys, views),
        page_to_first_chat_rate_pct: percent(firstChats, views),
        api_key_to_first_chat_rate_pct: percent(firstChats, apiKeys),
      };
    })
    .sort((a, b) => b.quickstart_page_view - a.quickstart_page_view);

  const totals = {
    quickstart_page_view: breakdown.reduce((sum, row) => sum + row.quickstart_page_view, 0),
    quickstart_api_key_created: breakdown.reduce((sum, row) => sum + row.quickstart_api_key_created, 0),
    quickstart_first_chat_success: breakdown.reduce((sum, row) => sum + row.quickstart_first_chat_success, 0),
  };

  return {
    generated_at: now.toISOString(),
    window_start: windowStart.toISOString(),
    window_end: now.toISOString(),
    window_days: days,
    totals: {
      ...totals,
      page_to_api_key_rate_pct: percent(totals.quickstart_api_key_created, totals.quickstart_page_view),
      page_to_first_chat_rate_pct: percent(totals.quickstart_first_chat_success, totals.quickstart_page_view),
      api_key_to_first_chat_rate_pct: percent(totals.quickstart_first_chat_success, totals.quickstart_api_key_created),
    },
    locale_source_breakdown: breakdown,
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function formatMarkdown(summary, inputPath) {
  const lines = [
    '# Quickstart Weekly Funnel Rollup',
    '',
    `- Input: \`${inputPath}\``,
    `- Generated at (UTC): \`${summary.generated_at}\``,
    `- Window: \`${summary.window_start}\` -> \`${summary.window_end}\` (${summary.window_days} days)`,
    '',
    '## Totals',
    '',
    `- quickstart_page_view: **${summary.totals.quickstart_page_view}**`,
    `- quickstart_api_key_created: **${summary.totals.quickstart_api_key_created}**`,
    `- quickstart_first_chat_success: **${summary.totals.quickstart_first_chat_success}**`,
    `- page -> API key: **${summary.totals.page_to_api_key_rate_pct}%**`,
    `- page -> first chat: **${summary.totals.page_to_first_chat_rate_pct}%**`,
    `- API key -> first chat: **${summary.totals.api_key_to_first_chat_rate_pct}%**`,
    '',
    '## Breakdown (locale + source)',
    '',
    '| locale | source | page_view | api_key_created | first_chat_success | page->api_key % | page->first_chat % | api_key->first_chat % |',
    '|---|---|---:|---:|---:|---:|---:|---:|',
  ];

  for (const row of summary.locale_source_breakdown) {
    lines.push(
      `| ${row.locale} | ${row.source} | ${row.quickstart_page_view} | ${row.quickstart_api_key_created} | ${row.quickstart_first_chat_success} | ${row.page_to_api_key_rate_pct} | ${row.page_to_first_chat_rate_pct} | ${row.api_key_to_first_chat_rate_pct} |`
    );
  }

  if (summary.locale_source_breakdown.length === 0) {
    lines.push('| n/a | n/a | 0 | 0 | 0 | 0 | 0 | 0 |');
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  const cwd = process.cwd();
  const input = path.resolve(cwd, String(args.input || 'artifacts/analytics/quickstart-events.sample.jsonl'));
  const outDir = path.resolve(cwd, String(args.outdir || 'artifacts/analytics'));
  const days = Number(args.days || 7);
  const now = args.now ? new Date(String(args.now)) : new Date();

  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid --now value: ${String(args.now)}`);
  }

  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const events = readEvents(input)
    .map((raw, idx) => normalizeEvent(raw, idx))
    .filter(Boolean);

  const summary = makeSummary(events, now, days);
  const stamp = now.toISOString().slice(0, 10);
  ensureDir(outDir);
  const jsonPath = path.join(outDir, `quickstart-weekly-rollup-${stamp}.json`);
  const mdPath = path.join(outDir, `quickstart-weekly-rollup-${stamp}.md`);

  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, formatMarkdown(summary, input), 'utf8');

  process.stdout.write(`${jsonPath}\n${mdPath}\n`);
}

main();
