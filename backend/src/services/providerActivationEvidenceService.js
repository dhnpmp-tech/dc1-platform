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

  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    dataLines.push(payload);
    if (payload === '[DONE]') done = true;
  }

  return {
    done,
    data_line_count: dataLines.length,
    preview: dataLines.slice(0, 6),
  };
}

function buildEvidenceBundle({
  route,
  utcTimestamp,
  model,
  requestHeaders,
  responseHeaders,
  streamRaw,
  providerLiveness,
  providerAvailability,
  git,
  command,
  outputPath,
  prompt,
}) {
  const requestId = responseHeaders['x-dcp-request-id'] || null;
  const traceId = responseHeaders['x-dcp-trace-id'] || requestHeaders['x-dcp-trace-id'] || null;
  const providerId = responseHeaders['x-dcp-provider-id'] || null;
  const sessionId = responseHeaders['x-dcp-session-id'] || null;
  const sse = parseSseTranscript(streamRaw || '');

  return {
    generated_at: utcTimestamp,
    route,
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
    output_path: outputPath,
    request_headers: requestHeaders,
    response_headers: responseHeaders,
    prompt_sha256: digestPrompt(prompt),
    summary: sse.done
      ? `Authenticated stream completed on ${route} with request_id=${requestId || 'n/a'} provider_id=${providerId || 'n/a'}.`
      : `Stream completion marker was not observed on ${route}; investigate provider/runtime logs.`,
  };
}

function buildEvidenceMarkdown(bundle) {
  const lines = [];
  lines.push('# Provider Activation Evidence Bundle');
  lines.push('');
  lines.push(`- Generated at (UTC): ${bundle.generated_at}`);
  lines.push(`- Route: ${bundle.route}`);
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
