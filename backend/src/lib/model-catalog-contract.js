'use strict';

function parseUseCases(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').toLowerCase().trim()).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => String(entry || '').toLowerCase().trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function toUsdStringFromHalalaPerMinute(halalaPerMinute) {
  const halala = Number(halalaPerMinute || 0);
  if (!Number.isFinite(halala) || halala <= 0) return '0.000000';
  const sarPerMinute = halala / 100;
  const usdPerMinute = sarPerMinute / 3.75;
  return usdPerMinute.toFixed(6);
}

function inferModalitiesFromUseCases(useCases) {
  const set = new Set(['text']);
  useCases.forEach((entry) => {
    if (entry.includes('image')) set.add('image');
    if (entry.includes('audio') || entry.includes('speech') || entry.includes('voice')) set.add('audio');
  });
  return Array.from(set).sort();
}

function inferSupportedFeaturesFromUseCases(useCases) {
  const featureSet = new Set(['chat.completions']);
  useCases.forEach((entry) => {
    if (entry.includes('reason')) featureSet.add('reasoning');
    if (entry.includes('code')) featureSet.add('code_generation');
    if (entry.includes('tool')) featureSet.add('tool_calling');
    if (entry.includes('embed')) featureSet.add('embeddings');
    if (entry.includes('image')) featureSet.add('image_generation');
    if (entry.includes('arabic') || entry.includes('translation')) featureSet.add('multilingual');
  });
  return Array.from(featureSet).sort();
}

function createCapabilityFlags(supportedFeatures) {
  const set = new Set(supportedFeatures || []);
  return {
    chat_completions: set.has('chat.completions'),
    reasoning: set.has('reasoning'),
    code_generation: set.has('code_generation'),
    tool_calling: set.has('tool_calling'),
    embeddings: set.has('embeddings'),
    image_generation: set.has('image_generation'),
    multilingual: set.has('multilingual'),
  };
}

function toCatalogContractCore({ model, providerCount = 0, maxVramGb = 0, created = null, nameFallback = null }) {
  const modelId = String(model?.model_id || '').trim();
  const useCases = parseUseCases(model?.use_cases);
  const supportedFeatures = inferSupportedFeaturesFromUseCases(useCases);
  const contextWindow = Number(model?.context_window) > 0 ? Number(model.context_window) : 4096;
  const maxOutputTokens = Math.max(512, Math.min(16384, Math.floor(contextWindow / 2)));
  const usdPerMinute = toUsdStringFromHalalaPerMinute(model?.default_price_halala_per_min);

  // Keep field insertion deterministic so JSON serialization is stable in tests and clients.
  return {
    id: modelId,
    name: model?.display_name || nameFallback || modelId,
    created: created != null ? created : Math.floor(Date.now() / 1000),
    modalities: inferModalitiesFromUseCases(useCases),
    context_length: contextWindow,
    max_output_tokens: maxOutputTokens,
    quantization: model?.quantization || 'unknown',
    pricing: {
      usd_per_minute: usdPerMinute,
      usd_per_1m_input_tokens: usdPerMinute,
      usd_per_1m_output_tokens: usdPerMinute,
    },
    capability_flags: createCapabilityFlags(supportedFeatures),
    supported_features: supportedFeatures,
    provider_count: Number(providerCount || 0),
    max_vram_gb: Number((Number(maxVramGb || model?.vram_gb || 0)).toFixed(1)),
  };
}

module.exports = {
  parseUseCases,
  toUsdStringFromHalalaPerMinute,
  inferModalitiesFromUseCases,
  inferSupportedFeaturesFromUseCases,
  toCatalogContractCore,
};
