const crypto = require('crypto');

function maskSecret(value) {
  if (typeof value !== 'string' || value.length === 0) return '';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function digestPrompt(prompt) {
  return crypto.createHash('sha256').update(String(prompt || ''), 'utf8').digest('hex');
}

function parseSseTranscript(rawText) {
  const lines = String(rawText || '').split(/\r?\n/);
  const dataLines = [];
  let done = false;
  let done_line_index = null;

  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    dataLines.push(payload);
    if (payload === '[DONE]') {
      done = true;
      done_line_index = dataLines.length - 1;
    }
  }

  return {
    done,
    done_line_index,
    data_line_count: dataLines.length,
    preview: dataLines.slice(0, 6),
  };
}

function buildRawOutputSnippets(rawText, clipLines = 6) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
  return {
    total_lines: lines.length,
    first_lines: lines.slice(0, clipLines),
    last_lines: lines.slice(Math.max(0, lines.length - clipLines)),
  };
}

function buildEvidenceBundle({
  route,
  endpointUrl,
  utcTimestamp,
  model,
  requestHeaders,
  responseHeaders,
  streamRaw,
  providerLiveness,
  providerAvailability,
  git,
  command,
  commandPack,
  duplicateChargeChecks,
  linkageSnapshots,
  nearbyWindowMinutes,
  outputPath,
  prompt,
}) {
  const requestId = responseHeaders['x-dcp-request-id'] || null;
  const traceId = responseHeaders['x-dcp-trace-id'] || requestHeaders['x-dcp-trace-id'] || null;
  const providerId = responseHeaders['x-dcp-provider-id'] || null;
  const sessionId = responseHeaders['x-dcp-session-id'] || null;
  const sse = parseSseTranscript(streamRaw || '');
  const snippets = buildRawOutputSnippets(streamRaw || '');
  const checks = Array.isArray(duplicateChargeChecks) ? duplicateChargeChecks : [];
  const snapshots = linkageSnapshots || null;
  const usageRows = Array.isArray(snapshots?.usage_rows) ? snapshots.usage_rows.length : 0;
  const chargeRows = Array.isArray(snapshots?.charge_rows) ? snapshots.charge_rows.length : 0;
  const ledgerRows = Array.isArray(snapshots?.ledger_rows) ? snapshots.ledger_rows.length : 0;
  const hasJoinableCandidate = usageRows > 0 || chargeRows > 0 || ledgerRows > 0;

  return {
    generated_at: utcTimestamp,
    route,
    endpoint_url: endpointUrl || null,
    model,
    request_id: requestId,
    trace_id: traceId,
    provider_id: providerId,
    session_id: sessionId,
    stream_completed: sse.done,
    sse_data_line_count: sse.data_line_count,
    sse_preview: sse.preview,
    provider_liveness: providerLiveness || null,
    provider_availability: providerAvailability || null,
    git: git || null,
    command,
    command_pack: commandPack || null,
    nearby_window_minutes: Number(nearbyWindowMinutes) || null,
    duplicate_charge_checks: checks,
    linkage_snapshots: snapshots,
    joinability_has_candidate: hasJoinableCandidate,
    output_path: outputPath,
    raw_output_snippets: snippets,
    request_headers: requestHeaders,
    response_headers: responseHeaders,
    prompt_sha256: digestPrompt(prompt),
    summary: sse.done
      ? `Authenticated stream completed on ${route} with request_id=${requestId || 'n/a'} provider_id=${providerId || 'n/a'}; duplicate-charge checks attached (${checks.length}); joinable rows usage=${usageRows} charge=${chargeRows} ledger=${ledgerRows}.`
      : `Stream completion marker was not observed on ${route}; investigate provider/runtime logs.`,
  };
}

function buildEvidenceMarkdown(bundle) {
  const lines = [];
  lines.push('# Provider Activation Evidence Bundle');
  lines.push('');
  lines.push(`- Generated at (UTC): ${bundle.generated_at}`);
  lines.push(`- Route: ${bundle.route}`);
  lines.push(`- Endpoint: ${bundle.endpoint_url || 'n/a'}`);
  lines.push(`- Model: ${bundle.model}`);
  lines.push(`- Request ID: ${bundle.request_id || 'n/a'}`);
  lines.push(`- Trace ID: ${bundle.trace_id || 'n/a'}`);
  lines.push(`- Provider ID: ${bundle.provider_id || 'n/a'}`);
  lines.push(`- Session ID: ${bundle.session_id || 'n/a'}`);
  lines.push(`- Stream completed: ${bundle.stream_completed}`);
  lines.push(`- Branch/SHA: ${bundle.git?.branch || 'n/a'} @ ${bundle.git?.sha || 'n/a'}`);
  lines.push('');

  lines.push('## Operator Command');
  lines.push('');
  lines.push('```bash');
  lines.push(bundle.command);
  lines.push('```');
  lines.push('');

  lines.push('## Raw Stream Output');
  lines.push('');
  lines.push('```text');
  lines.push(bundle.output_path || '(missing stream output path)');
  lines.push('```');
  lines.push('');

  lines.push('## Raw Stream Snippets');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(bundle.raw_output_snippets || null, null, 2));
  lines.push('```');
  lines.push('');

  lines.push('## Duplicate-Charge Risk Checks');
  lines.push('');
  if (!Array.isArray(bundle.duplicate_charge_checks) || bundle.duplicate_charge_checks.length === 0) {
    lines.push('No duplicate-charge checks were attached.');
  } else {
    for (const check of bundle.duplicate_charge_checks) {
      lines.push(`### ${check.title}`);
      lines.push('');
      lines.push('```bash');
      lines.push(check.command || '');
      lines.push('```');
      lines.push('');
    }
  }

  if (bundle.command_pack) {
    lines.push('## Command Pack');
    lines.push('');
    lines.push('```bash');
    lines.push(bundle.command_pack);
    lines.push('```');
    lines.push('');
  }

  lines.push('## Joinability Snapshots');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(bundle.linkage_snapshots || null, null, 2));
  lines.push('```');
  lines.push('');
  lines.push(`- Joinability candidate present: ${Boolean(bundle.joinability_has_candidate)}`);
  lines.push('');

  lines.push('## Provider Online Evidence');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify({
    provider_liveness: bundle.provider_liveness,
    provider_availability: bundle.provider_availability,
  }, null, 2));
  lines.push('```');
  lines.push('');

  lines.push('## Headers');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify({
    request_headers: {
      ...bundle.request_headers,
      authorization: maskSecret(bundle.request_headers?.authorization || ''),
    },
    response_headers: bundle.response_headers,
  }, null, 2));
  lines.push('```');
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(bundle.summary);
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  buildEvidenceBundle,
  buildEvidenceMarkdown,
  parseSseTranscript,
  maskSecret,
};
