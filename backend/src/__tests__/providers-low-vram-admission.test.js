const providersRouter = require('../routes/providers');

describe('providers low VRAM admission helpers', () => {
  const {
    loadVllmCompatibilityIndex,
    evaluateLowVramInferenceCompatibility,
    evaluateProviderAdmission,
    PROVIDER_ADMISSION_REASON_CODES,
  } = providersRouter.__private;

  it('loads compatibility matrix aliases and variants', () => {
    const index = loadVllmCompatibilityIndex();

    expect(index.available).toBe(true);
    expect(index.byAlias.has('qwen-2.5-7b-instruct')).toBe(true);
    expect(index.byAlias.has('qwen/qwen2.5-7b-instruct-awq')).toBe(true);

    const qwenEntry = index.byAlias.get('qwen-2.5-7b-instruct');
    expect(qwenEntry.defaultVariant).toBe('awq');
    expect(qwenEntry.variants.awq.min_vram_mb).toBe(8192);
    expect(qwenEntry.variants.fp16.min_vram_mb).toBe(20480);
  });

  it('rejects unsupported model ids on low-VRAM inference providers', () => {
    const outcome = evaluateLowVramInferenceCompatibility(
      { vram_mb: 8192 },
      {
        compute_type: 'inference',
        model_id: 'unknown-model-123',
        tier_mode: 'on-demand',
        prewarm_class: 'cold',
      }
    );

    expect(outcome.accepted).toBe(false);
    expect(outcome.reason_code).toBe(PROVIDER_ADMISSION_REASON_CODES.MODEL_UNSUPPORTED_ON_PROVIDER);
    expect(outcome.reason).toContain("unknown-model-123");
  });

  it('accepts compatible AWQ model ids for 8GB inference providers', () => {
    const outcome = evaluateLowVramInferenceCompatibility(
      { vram_mb: 8192 },
      {
        compute_type: 'inference',
        model_id: 'qwen-2.5-7b-instruct',
        tier_mode: 'on-demand',
        prewarm_class: 'cold',
      }
    );

    expect(outcome.accepted).toBe(true);
  });

  it('rejects ALLaM low-VRAM routing when AWQ is unavailable and fallback does not fit', () => {
    const outcome = evaluateLowVramInferenceCompatibility(
      { vram_mb: 12288 },
      {
        compute_type: 'inference',
        model_id: 'allam-7b-it',
        tier_mode: 'on-demand',
        prewarm_class: 'cold',
      }
    );

    expect(outcome.accepted).toBe(false);
    expect(outcome.reason_code).toBe(PROVIDER_ADMISSION_REASON_CODES.MODEL_UNSUPPORTED_ON_PROVIDER);
    expect(outcome.reason).toContain('AWQ weights unavailable');
    expect(outcome.reason).toContain('needs at least 20480 MiB VRAM');
  });

  it('applies low-VRAM model gating before generic vram checks', () => {
    const outcome = evaluateProviderAdmission(
      {
        vram_mb: 8192,
        gpu_count: 1,
        supported_compute_types: new Set(['inference']),
        cached_models: new Set(),
      },
      {
        compute_type: 'inference',
        vram_required_mb: 4096,
        gpu_count: 1,
        model_id: 'nonexistent-awq-model',
        tier_mode: 'instant',
        prewarm_class: 'warm',
      }
    );

    expect(outcome.accepted).toBe(false);
    expect(outcome.reason_code).toBe(PROVIDER_ADMISSION_REASON_CODES.MODEL_UNSUPPORTED_ON_PROVIDER);
  });
});
