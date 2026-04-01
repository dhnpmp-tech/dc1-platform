#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const DEFAULT_EVENT_MAP = {
  templatesCtaImpression: ['template_catalog_viewed', 'templates_page_view', 'landing_page_view'],
  templatesCtaClick: ['landing_primary_cta_clicked', 'developer_flow_landing_cta_click', 'role_path_cta_clicked'],
  renterRegisterStart: ['developer_flow_register_submit', 'renter_register_submit'],
  quickstartOpen: ['quickstart_page_view', 'renter_register_quickstart_opened'],
  firstRequestCompletionProxy: ['quickstart_first_chat_success'],
};

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

function parseList(value, fallback) {
  if (!value || typeof value !== 'string') return fallback.slice();
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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

function toUtcDayString(date) {
  return date.toISOString().slice(0, 10);
}

function getTargetDay(now, explicitDay) {
  if (explicitDay) return explicitDay;
  const priorDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));
  return toUtcDayString(priorDay);
}

function normalizeEvent(raw, idx) {
  const payload = extractPayload(raw);
  const event = payload?.event;
  if (typeof event !== 'string' || !event) return null;

  const ts =
    toDate(payload.timestamp) ||
    toDate(payload.ts) ||
    toDate(payload.occurred_at) ||
    toDate(payload.created_at) ||
    toDate(raw.timestamp) ||
    toDate(raw.ts);

  if (!ts) return null;

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
    utcDay: toUtcDayString(ts),
  };
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function ensureSetContainer(container, key) {
  if (!container[key]) container[key] = new Set();
  return container[key];
}

function emptyBucket() {
  return {
    templatesCtaImpressions: new Set(),
    templatesCtaClicks: new Set(),
    renterRegisterStarts: new Set(),
    quickstartOpens: new Set(),
    firstRequestCompletionProxy: new Set(),
  };
}

function applyEvent(bucket, event, mappings) {
  const { event: eventName, sessionId } = event;
  if (mappings.templatesCtaImpression.has(eventName)) ensureSetContainer(bucket, 'templatesCtaImpressions').add(sessionId);
  if (mappings.templatesCtaClick.has(eventName)) ensureSetContainer(bucket, 'templatesCtaClicks').add(sessionId);
  if (mappings.renterRegisterStart.has(eventName)) ensureSetContainer(bucket, 'renterRegisterStarts').add(sessionId);
  if (mappings.quickstartOpen.has(eventName)) ensureSetContainer(bucket, 'quickstartOpens').add(sessionId);
  if (mappings.firstRequestCompletionProxy.has(eventName)) ensureSetContainer(bucket, 'firstRequestCompletionProxy').add(sessionId);
}

function bucketToRow(label, bucket) {
  const templatesCtaImpressions = bucket.templatesCtaImpressions.size;
  const templatesCtaClicks = bucket.templatesCtaClicks.size;
  return {
    segment: label,
    templates_cta_impressions: templatesCtaImpressions,
    templates_cta_clicks: templatesCtaClicks,
    templates_cta_ctr_pct: percent(templatesCtaClicks, templatesCtaImpressions),
    renter_register_starts: bucket.renterRegisterStarts.size,
    quickstart_opens: bucket.quickstartOpens.size,
    first_request_completion_proxy: bucket.firstRequestCompletionProxy.size,
  };
}

function makeSummary(events, targetDay, mappings, now, inputPath) {
  const byLocaleSource = new Map();
  const totalBucket = emptyBucket();

  for (const event of events) {
    if (event.utcDay !== targetDay) continue;

    applyEvent(totalBucket, event, mappings);

    const key = `${event.locale}||${event.source}`;
    if (!byLocaleSource.has(key)) byLocaleSource.set(key, emptyBucket());
    applyEvent(byLocaleSource.get(key), event, mappings);
  }

  const breakdown = Array.from(byLocaleSource.entries())
    .map(([key, bucket]) => {
      const [locale, source] = key.split('||');
      return {
        locale,
        source,
        ...bucketToRow('segment', bucket),
      };
    })
    .sort((a, b) => {
      const byStarts = b.renter_register_starts - a.renter_register_starts;
      if (byStarts !== 0) return byStarts;
      return b.quickstart_opens - a.quickstart_opens;
    });

  return {
    generated_at: now.toISOString(),
    input: inputPath,
    target_utc_day: targetDay,
    totals: bucketToRow('total', totalBucket),
    locale_source_breakdown: breakdown,
    event_mapping: {
      templates_cta_impression_events: Array.from(mappings.templatesCtaImpression),
      templates_cta_click_events: Array.from(mappings.templatesCtaClick),
      renter_register_start_events: Array.from(mappings.renterRegisterStart),
      quickstart_open_events: Array.from(mappings.quickstartOpen),
      first_request_completion_proxy_events: Array.from(mappings.firstRequestCompletionProxy),
    },
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function formatMarkdown(summary) {
  const totals = summary.totals;
  const lines = [
    '# Daily Growth KPI Export',
    '',
    `- Generated at (UTC): \`${summary.generated_at}\``,
    `- Input: \`${summary.input}\``,
    `- Target UTC day: \`${summary.target_utc_day}\``,
    '',
    '## KPI Table (Totals)',
    '',
    '| utc_day | templates_cta_impressions | templates_cta_clicks | templates_cta_ctr_pct | renter_register_starts | quickstart_opens | first_request_completion_proxy |',
    '|---|---:|---:|---:|---:|---:|---:|',
    `| ${summary.target_utc_day} | ${totals.templates_cta_impressions} | ${totals.templates_cta_clicks} | ${totals.templates_cta_ctr_pct} | ${totals.renter_register_starts} | ${totals.quickstart_opens} | ${totals.first_request_completion_proxy} |`,
    '',
    '## Breakdown (locale + source)',
    '',
    '| locale | source | templates_cta_ctr_pct | renter_register_starts | quickstart_opens | first_request_completion_proxy |',
    '|---|---|---:|---:|---:|---:|',
  ];

  for (const row of summary.locale_source_breakdown) {
    lines.push(
      `| ${row.locale} | ${row.source} | ${row.templates_cta_ctr_pct} | ${row.renter_register_starts} | ${row.quickstart_opens} | ${row.first_request_completion_proxy} |`
    );
  }

  if (summary.locale_source_breakdown.length === 0) {
    lines.push('| n/a | n/a | 0 | 0 | 0 | 0 |');
  }

  lines.push('');
  lines.push('## Event Mapping');
  lines.push('');
  lines.push(`- templates CTA impressions: \`${summary.event_mapping.templates_cta_impression_events.join(', ')}\``);
  lines.push(`- templates CTA clicks: \`${summary.event_mapping.templates_cta_click_events.join(', ')}\``);
  lines.push(`- register starts: \`${summary.event_mapping.renter_register_start_events.join(', ')}\``);
  lines.push(`- quickstart opens: \`${summary.event_mapping.quickstart_open_events.join(', ')}\``);
  lines.push(`- first-request completion proxy: \`${summary.event_mapping.first_request_completion_proxy_events.join(', ')}\``);
  lines.push('');

  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  const cwd = process.cwd();
  const input = path.resolve(cwd, String(args.input || 'artifacts/analytics/growth-kpi-events.sample.jsonl'));
  const outDir = path.resolve(cwd, String(args.outdir || 'artifacts/analytics'));
  const now = args.now ? new Date(String(args.now)) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid --now value: ${String(args.now)}`);
  }
  const targetDay = getTargetDay(now, args.day ? String(args.day) : '');

  if (!fs.existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  const mappings = {
    templatesCtaImpression: new Set(parseList(args['templates-cta-impression-events'], DEFAULT_EVENT_MAP.templatesCtaImpression)),
    templatesCtaClick: new Set(parseList(args['templates-cta-click-events'], DEFAULT_EVENT_MAP.templatesCtaClick)),
    renterRegisterStart: new Set(parseList(args['register-start-events'], DEFAULT_EVENT_MAP.renterRegisterStart)),
    quickstartOpen: new Set(parseList(args['quickstart-open-events'], DEFAULT_EVENT_MAP.quickstartOpen)),
    firstRequestCompletionProxy: new Set(parseList(args['first-request-events'], DEFAULT_EVENT_MAP.firstRequestCompletionProxy)),
  };

  const events = readEvents(input)
    .map((raw, idx) => normalizeEvent(raw, idx))
    .filter(Boolean);

  const summary = makeSummary(events, targetDay, mappings, now, input);
  ensureDir(outDir);

  const jsonPath = path.join(outDir, `growth-kpi-daily-${targetDay}.json`);
  const mdPath = path.join(outDir, `growth-kpi-daily-${targetDay}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, formatMarkdown(summary), 'utf8');

  process.stdout.write(`${jsonPath}\n${mdPath}\n`);
}

main();
