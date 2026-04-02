'use strict';

const {
  evaluateProviderModelCompatibility,
} = require('../src/services/vllmCompatibilityMatrix');
const providersRouter = require('../src/routes/providers');

describe('vLLM compatibility matrix', () => {
  test('8GB provider supports 7B AWQ model selection (RTX 3060 Ti path)', () => {
    const compatibility = evaluateProviderModelCompatibility({
      modelId: 'Qwen/Qwen2.5-7B-Instruct-AWQ',
      providerVramMb: 8 * 1024,
    });

    expect(compatibility.supported).toBe(true);
    expect(compatibility.resolved_variant).toBe('awq');
    expect(compatibility.recommended_script).toBe('infra/vllm-configs/awq-8gb-bootstrap.sh');
  });

  test('8GB provider rejects unsupported ALLaM fallback with descriptive reason', () => {
    const compatibility = evaluateProviderModelCompatibility({
      modelId: 'BOLT-IS/ALLaM-IT-7B',
      providerVramMb: 8 * 1024,
    });

    expect(compatibility.supported).toBe(false);
    expect(compatibility.min_required_vram_mb).toBe(20480);
    expect(compatibility.reason).toContain('requires >=');
  });
});

describe('provider admission consumes compatibility matrix', () => {
  test('admission accepts 8GB provider for supported 7B AWQ model', () => {
    const { getProviderRoutingProfile, evaluateProviderAdmission, PROVIDER_ADMISSION_REASON_CODES } = providersRouter.__private;
    const providerProfile = getProviderRoutingProfile({
      vram_mb: 8192,
      gpu_count: 1,
      supported_compute_types: JSON.stringify(['inference']),
      cached_models: JSON.stringify(['qwen/qwen2.5-7b-instruct-awq']),
    });

    const admission = evaluateProviderAdmission(providerProfile, {
      tier_mode: 'cached',
      prewarm_class: 'warm',
      compute_type: 'inference',
      vram_required_mb: 7168,
      gpu_count: 1,
      model_id: 'Qwen/Qwen2.5-7B-Instruct-AWQ',
    });

    expect(admission.accepted).toBe(true);
    expect(admission.reason_code).toBe(PROVIDER_ADMISSION_REASON_CODES.OK);
    expect(admission.recommended_script).toBe('infra/vllm-configs/awq-8gb-bootstrap.sh');
  });

  test('admission rejects unsupported model on 8GB provider with explicit reason code', () => {
    const { getProviderRoutingProfile, evaluateProviderAdmission, PROVIDER_ADMISSION_REASON_CODES } = providersRouter.__private;
    const providerProfile = getProviderRoutingProfile({
      vram_mb: 8192,
      gpu_count: 1,
      supported_compute_types: JSON.stringify(['inference']),
      cached_models: JSON.stringify([]),
    });

    const admission = evaluateProviderAdmission(providerProfile, {
      tier_mode: 'cached',
      prewarm_class: 'warm',
      compute_type: 'inference',
      vram_required_mb: 7168,
      gpu_count: 1,
      model_id: 'BOLT-IS/ALLaM-IT-7B',
    });

    expect(admission.accepted).toBe(false);
    expect(admission.reason_code).toBe(PROVIDER_ADMISSION_REASON_CODES.MODEL_COMPATIBILITY_UNSUPPORTED);
    expect(admission.reason).toContain('requires >=');
    expect(admission.recommended_script).toBe('infra/vllm-configs/awq-12gb-bootstrap.sh');
  });
});
