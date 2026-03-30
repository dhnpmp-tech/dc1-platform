const {
  buildEvidenceBundle,
  buildEvidenceMarkdown,
  parseSseTranscript,
  maskSecret,
} = require('../services/providerActivationEvidenceService');

describe('providerActivationEvidenceService', () => {
  test('parseSseTranscript detects done marker and counts data lines', () => {
    const parsed = parseSseTranscript([
      'event: message',
      'data: {"id":"abc"}',
      '',
      'data: [DONE]',
      '',
    ].join('\n'));

    expect(parsed.done).toBe(true);
    expect(parsed.data_line_count).toBe(2);
    expect(parsed.preview[0]).toContain('{"id":"abc"}');
  });

  test('buildEvidenceBundle surfaces IDs and stream completion summary', () => {
    const bundle = buildEvidenceBundle({
      route: '/v1/chat/completions',
      endpointUrl: 'https://dcp.sa/v1/chat/completions',
      utcTimestamp: '2026-03-30T19:30:00.000Z',
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      requestHeaders: {
        authorization: 'Bearer renter-secret-token',
        'x-dcp-trace-id': 'trace-123',
      },
      responseHeaders: {
        'x-dcp-request-id': 'req-abc',
        'x-dcp-trace-id': 'trace-123',
        'x-dcp-provider-id': '42',
        'x-dcp-session-id': 'session-xyz',
      },
      streamRaw: 'data: {"chunk":1}\n\ndata: [DONE]\n',
      providerLiveness: { liveness_status: 'online' },
      providerAvailability: { id: 42, status: 'online' },
      git: { branch: 'agent/backend-dev/dcp-153', sha: 'abc123' },
      command: 'node backend/scripts/export-provider-activation-evidence.js',
      commandPack: 'echo check',
      duplicateChargeChecks: [{ title: 'check-a', command: 'echo a' }],
      linkageSnapshots: {
        usage_rows: [{ request_id: 'req-abc' }],
        charge_rows: [],
        ledger_rows: [],
        warnings: [],
      },
      nearbyWindowMinutes: 15,
      outputPath: '/tmp/stream.txt',
      prompt: 'hello world',
    });

    expect(bundle.endpoint_url).toBe('https://dcp.sa/v1/chat/completions');
    expect(bundle.request_id).toBe('req-abc');
    expect(bundle.trace_id).toBe('trace-123');
    expect(bundle.provider_id).toBe('42');
    expect(bundle.session_id).toBe('session-xyz');
    expect(bundle.stream_completed).toBe(true);
    expect(bundle.raw_output_snippets.total_lines).toBe(2);
    expect(bundle.duplicate_charge_checks).toHaveLength(1);
    expect(bundle.joinability_has_candidate).toBe(true);
    expect(bundle.nearby_window_minutes).toBe(15);
    expect(bundle.linkage_snapshots.usage_rows).toHaveLength(1);
    expect(bundle.summary).toContain('request_id=req-abc');
    expect(bundle.summary).toContain('joinable rows usage=1');
  });

  test('buildEvidenceMarkdown redacts renter bearer token', () => {
    const bundle = buildEvidenceBundle({
      route: '/v1/chat/completions',
      utcTimestamp: '2026-03-30T19:30:00.000Z',
      model: 'test-model',
      requestHeaders: {
        authorization: 'Bearer renter-secret-token',
        'x-dcp-trace-id': 'trace-123',
      },
      responseHeaders: {
        'x-dcp-request-id': 'req-abc',
      },
      streamRaw: 'data: [DONE]\n',
      providerLiveness: null,
      providerAvailability: null,
      git: null,
      command: 'cmd',
      outputPath: '/tmp/raw.txt',
      prompt: 'hello',
    });

    const markdown = buildEvidenceMarkdown(bundle);
    expect(markdown).toContain('Bear***oken');
    expect(markdown).not.toContain('renter-secret-token');
    expect(markdown).toContain('Joinability Snapshots');
  });

  test('maskSecret handles short and empty values', () => {
    expect(maskSecret('')).toBe('');
    expect(maskSecret('abcd')).toBe('***');
  });
});
