const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');

function resolveDiscoveryDir() {
  const candidates = [
    path.join(__dirname, '../../../p2p'),
    path.join(__dirname, '../../p2p'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

const P2P_DISCOVERY_DIR = resolveDiscoveryDir();
const P2P_DISCOVERY_SCRIPT = path.join(P2P_DISCOVERY_DIR, 'provider-announce.js');
const P2P_DISCOVERY_MODULE = path.join(P2P_DISCOVERY_DIR, 'dcp-discovery-scaffold.js');

const READ_MODE = (process.env.P2P_DISCOVERY_READ_PATH || 'sqlite').toLowerCase();
const DEFAULT_SHADOW_THRESHOLDS = {
  minCoveragePct: 95,
  maxStalePct: 5,
  maxMissingPeers: 2,
  maxLookupLatencyMs: 3000,
  fallbackMinCoveragePct: 80,
  fallbackMaxStalePct: 20,
  fallbackMaxLookupLatencyMs: 8000,
};

let dcpDiscoveryModule = null;
let dcpDiscoveryModulePromise = null;

function toBoolean(raw, fallback = false) {
  const value = String(raw || '').toLowerCase();
  if (!value) return fallback;
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function getDiscoveryMode() {
  if (['sqlite', 'shadow', 'p2p-primary'].includes(READ_MODE)) return READ_MODE;
  return 'sqlite';
}

function isAnnouncementEnabled() {
  return toBoolean(process.env.P2P_DISCOVERY_ENABLED);
}

function normalizeBootstrapList(raw) {
  const source = Array.isArray(raw) ? raw : String(raw || '').split(',').map((entry) => entry.trim());
  return source
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry.length > 0 && !entry.includes('REPLACE_WITH_BOOTSTRAP_PEER_ID'));
}

function getBootstrapEnvRaw() {
  return process.env.DCP_P2P_BOOTSTRAP || process.env.DC1_P2P_BOOTSTRAP || '';
}

function hasBootstrap() {
  return normalizeBootstrapList(getBootstrapEnvRaw()).length > 0;
}

function getBootstrapList() {
  return normalizeBootstrapList(getBootstrapEnvRaw());
}

function getFeatureFlags() {
  return {
    mdns: toBoolean(process.env.P2P_DISCOVERY_ENABLE_MDNS, false),
    websocket: toBoolean(process.env.P2P_DISCOVERY_ENABLE_WEBSOCKET, false),
    relay: toBoolean(process.env.P2P_DISCOVERY_ENABLE_RELAY, false),
    gossipsub: toBoolean(process.env.P2P_DISCOVERY_ENABLE_GOSSIPSUB, false),
    localMode: toBoolean(process.env.P2P_DISCOVERY_LOCAL_MODE, false),
  };
}

function isNodeModuleInstalled(packageName) {
  try {
    require.resolve(packageName, { paths: [P2P_DISCOVERY_DIR] });
    return true;
  } catch {
    return false;
  }
}

function getShadowThresholds() {
  return {
    minCoveragePct: toFiniteNumber(
      process.env.P2P_SHADOW_MIN_COVERAGE_PCT,
      DEFAULT_SHADOW_THRESHOLDS.minCoveragePct,
      { min: 0, max: 100 }
    ),
    maxStalePct: toFiniteNumber(
      process.env.P2P_SHADOW_MAX_STALE_PCT,
      DEFAULT_SHADOW_THRESHOLDS.maxStalePct,
      { min: 0, max: 100 }
    ),
    maxMissingPeers: toPositiveInt(
      toFiniteNumber(process.env.P2P_SHADOW_MAX_MISSING_PEERS, DEFAULT_SHADOW_THRESHOLDS.maxMissingPeers, { min: 0 }),
      DEFAULT_SHADOW_THRESHOLDS.maxMissingPeers
    ),
    maxLookupLatencyMs: toPositiveInt(
      process.env.P2P_SHADOW_MAX_LOOKUP_LATENCY_MS,
      DEFAULT_SHADOW_THRESHOLDS.maxLookupLatencyMs
    ),
    fallbackMinCoveragePct: toFiniteNumber(
      process.env.P2P_SHADOW_FALLBACK_MIN_COVERAGE_PCT,
      DEFAULT_SHADOW_THRESHOLDS.fallbackMinCoveragePct,
      { min: 0, max: 100 }
    ),
    fallbackMaxStalePct: toFiniteNumber(
      process.env.P2P_SHADOW_FALLBACK_MAX_STALE_PCT,
      DEFAULT_SHADOW_THRESHOLDS.fallbackMaxStalePct,
      { min: 0, max: 100 }
    ),
    fallbackMaxLookupLatencyMs: toPositiveInt(
      process.env.P2P_SHADOW_FALLBACK_MAX_LOOKUP_LATENCY_MS,
      DEFAULT_SHADOW_THRESHOLDS.fallbackMaxLookupLatencyMs
    ),
  };
}

function nowIso() {
  return new Date().toISOString();
}

function roundPct(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function normalizeShadowCandidateIds(peerIds = []) {
  return Array.from(new Set(toPeerIdList(peerIds)));
}

function buildShadowCycleSummary({
  trackedPeerIds = [],
  resolvedProviders = [],
  lookupLatencyMs = null,
  evaluatedAt = nowIso(),
  thresholds = getShadowThresholds(),
} = {}) {
  const tracked = normalizeShadowCandidateIds(trackedPeerIds);
  const resolvedByPeerId = new Map();
  for (const entry of Array.isArray(resolvedProviders) ? resolvedProviders : []) {
    const peerId = toText(entry?.peer_id, null);
    if (!peerId || resolvedByPeerId.has(peerId)) continue;
    resolvedByPeerId.set(peerId, entry);
  }

  let found = 0;
  let stale = 0;
  const missingPeerIds = [];
  const stalePeerIds = [];
  for (const peerId of tracked) {
    const resolved = resolvedByPeerId.get(peerId);
    if (resolved?.found) {
      found += 1;
      if (resolved.stale) {
        stale += 1;
        stalePeerIds.push(peerId);
      }
    } else {
      missingPeerIds.push(peerId);
    }
  }

  const trackedTotal = tracked.length;
  const coveragePct = trackedTotal > 0 ? roundPct((found / trackedTotal) * 100) : 0;
  const stalePct = found > 0 ? roundPct((stale / found) * 100) : 0;
  const latencyMs = Number.isFinite(Number(lookupLatencyMs)) ? Math.round(Number(lookupLatencyMs)) : null;

  const promoteChecks = {
    coverage: coveragePct >= thresholds.minCoveragePct,
    stale: stalePct <= thresholds.maxStalePct,
    missing: missingPeerIds.length <= thresholds.maxMissingPeers,
    latency: latencyMs == null ? true : latencyMs <= thresholds.maxLookupLatencyMs,
  };
  const promoteReady = Boolean(promoteChecks.coverage && promoteChecks.stale && promoteChecks.missing && promoteChecks.latency);

  const fallbackChecks = {
    coverage: coveragePct < thresholds.fallbackMinCoveragePct,
    stale: stalePct > thresholds.fallbackMaxStalePct,
    latency: latencyMs != null && latencyMs > thresholds.fallbackMaxLookupLatencyMs,
  };
  const fallbackTriggered = Boolean(fallbackChecks.coverage || fallbackChecks.stale || fallbackChecks.latency);

  let decision = 'hold-shadow';
  if (fallbackTriggered) decision = 'fallback-to-sqlite';
  else if (promoteReady) decision = 'promote-to-p2p-primary';

  return {
    evaluated_at: evaluatedAt,
    tracked_peer_ids: tracked,
    tracked_total: trackedTotal,
    discovered_total: found,
    missing_total: missingPeerIds.length,
    stale_total: stale,
    coverage_pct: coveragePct,
    stale_pct: stalePct,
    lookup_latency_ms: latencyMs,
    missing_peer_ids: missingPeerIds,
    stale_peer_ids: stalePeerIds,
    thresholds,
    checks: {
      promote: promoteChecks,
      fallback: fallbackChecks,
    },
    decision,
    promote_ready: promoteReady,
    fallback_triggered: fallbackTriggered,
  };
}

function waitForPeers(node, timeoutMs = 2500) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const check = () => {
      if (node.getPeers().length > 0) return resolve(true);
      if (Date.now() >= deadline) return resolve(false);
      setTimeout(check, 150);
    };
    check();
  });
}

function toText(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const clean = value.trim();
  return clean.length ? clean : fallback;
}

function toPositiveNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function toNonNegativeNumber(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

function toPositiveInt(value, fallback = null) {
  if (!Number.isInteger(value) || value < 1) {
    const num = Number(value);
    if (Number.isInteger(num) && num >= 1) return num;
    return fallback;
  }
  return value;
}

function toFiniteNumber(value, fallback = null, { min = null, max = null } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (min != null && num < min) return fallback;
  if (max != null && num > max) return fallback;
  return num;
}

function toTags(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => toText(entry, ''))
      .map((entry) => entry.toLowerCase())
      .filter(Boolean)
      .filter((entry, index, list) => list.indexOf(entry) === index);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return toTags(parsed);
    } catch (error) {
      return value
        .split(',')
        .map((entry) => toText(entry, ''))
        .map((entry) => entry.toLowerCase())
        .filter(Boolean);
    }
  }
  return [];
}

function toPeerIdList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => toText(String(entry || ''), ''))
      .filter(Boolean);
  }
  const commaSplit = String(value).split(',');
  return commaSplit
    .map((entry) => toText(entry, ''))
    .filter(Boolean);
}

function createNodeOptions(overrides = {}) {
  const featureFlags = getFeatureFlags();
  const defaults = {
    port: toPositiveInt(process.env.P2P_DISCOVERY_PORT, 0),
    bootstrapList: getBootstrapList(),
    clientMode: true,
    localMode: featureFlags.localMode,
    enableMdns: featureFlags.mdns,
    enableWebSocket: featureFlags.websocket,
    enableRelay: featureFlags.relay,
    enableGossipsub: featureFlags.gossipsub,
  };
  return { ...defaults, ...overrides };
}

function buildP2PAnnouncementSpec(provider, heartbeatData = {}) {
  const gpuStatus = heartbeatData.gpu_status || {};
  const gpuInfo = heartbeatData.gpu_info || {};
  const resourceSpec = heartbeatData.resource_spec || {};
  const heartbeatVramMb = heartbeatData.resolved_total_vram_mib;

  const model = toText(
    heartbeatData.gpu_model ||
    gpuStatus.gpu_name ||
    gpuInfo.gpu_name ||
    provider.gpu_name_detected ||
    provider.gpu_model,
    'unknown'
  );

  const vramMbRaw = toPositiveNumber(
    heartbeatData.vram_mb ??
    heartbeatData.gpu_vram_mib ??
    gpuStatus.gpu_vram_mib ??
    gpuInfo.vram_mb ??
    heartbeatVramMb ??
    provider.vram_mb ??
    provider.gpu_vram_mib
  );
  if (!vramMbRaw) return null;
  const vramGb = Math.round((vramMbRaw / 1024) * 10) / 10;

  const pricePerHour = toPositiveNumber(
    heartbeatData.price_sar_per_hour ??
    toNonNegativeNumber(gpuStatus.price_sar_per_hour, null) ??
    toNonNegativeNumber(resourceSpec.price_sar_per_hour, null) ??
    toNonNegativeNumber(provider.price_sar_per_hour, null) ??
    toNonNegativeNumber(provider.cost_per_gpu_second_halala, null) / 100 * 3600
  ) || 0;

  const availabilityRaw = heartbeatData.available_slots ?? provider.available_slots ?? provider.gpu_count ?? gpuStatus.gpu_count;
  const availableSlots = toPositiveInt(availabilityRaw, 1) || 1;
  const peerIdHint = toText(heartbeatData.peer_id, null) || toText(provider.p2p_peer_id, null);

  return {
    version: 1,
    announced_from: 'dc1-backend',
    announced_at: nowIso(),
    gpu_model: model,
    vram_gb: vramGb,
    price_sar_per_hour: pricePerHour,
    cuda_version: toText(gpuInfo.cuda_version || gpuStatus.cuda_version || provider.gpu_cuda_version),
    driver_version: toText(gpuStatus.driver_version || gpuInfo.driver_version || provider.gpu_driver),
    os: toText(gpuStatus.os_info || gpuInfo.os || provider.os || 'linux', 'linux'),
    region: toText(resourceSpec.region || heartbeatData.region || provider.location || 'sa'),
    reliability_score: Math.min(100, toNonNegativeNumber(provider.reliability_score, 0)),
    daemon_version: toText(gpuStatus.daemon_version || provider.daemon_version),
    available_slots: availableSlots,
    peer_id: peerIdHint || null,
    tags: toTags(heartbeatData.tags || provider.supported_compute_types || resourceSpec.tags),
  };
}

function buildProbeAnnouncementSpec() {
  return {
    version: 1,
    announced_from: 'dc1-backend-health-probe',
    announced_at: nowIso(),
    gpu_model: 'probe',
    vram_gb: 1,
    price_sar_per_hour: 0,
    os: 'linux',
    region: 'sa',
    reliability_score: 0,
    available_slots: 1,
    tags: ['health-probe'],
  };
}

function enqueueAnnouncement(spec) {
  if (!isAnnouncementEnabled()) {
    return { status: 'skipped', reason: 'discovery_disabled' };
  }
  if (!hasBootstrap()) {
    return { status: 'skipped', reason: 'bootstrap_missing' };
  }
  if (!fs.existsSync(P2P_DISCOVERY_SCRIPT)) {
    return { status: 'skipped', reason: 'script_missing' };
  }
  if (!spec) {
    return { status: 'skipped', reason: 'invalid_spec' };
  }

  try {
    const payload = JSON.stringify(spec);
    const child = spawn(process.execPath, [P2P_DISCOVERY_SCRIPT, '--spec', payload], {
      cwd: P2P_DISCOVERY_DIR,
      stdio: ['ignore', 'ignore', 'ignore'],
      env: { ...process.env },
    });
    child.unref();
    child.on('error', (error) => {
      console.error('[p2p-discovery] announce spawn failed:', error.message);
    });
    return { status: 'enqueued', requested_at: nowIso(), peer_script: 'provider-announce.js' };
  } catch (error) {
    return { status: 'failed', reason: error.message };
  }
}

function announceFromProviderHeartbeat(provider, heartbeatData) {
  const spec = buildP2PAnnouncementSpec(provider, heartbeatData);
  return enqueueAnnouncement(spec);
}

function announceFromHttpInput(provider, payload) {
  const rawSpec = payload || {};
  const requestedSpec = rawSpec.spec && typeof rawSpec.spec === 'object' ? rawSpec.spec : rawSpec;
  const merged = {
    ...buildP2PAnnouncementSpec(provider, payload),
    ...requestedSpec,
  };
  if (rawSpec.price_sar_per_hour !== undefined) merged.price_sar_per_hour = rawSpec.price_sar_per_hour;
  return enqueueAnnouncement(merged);
}

function getDiscoveryStatus() {
  const featureFlags = getFeatureFlags();
  const optionalPackages = {
    websocket: isNodeModuleInstalled('@libp2p/websockets'),
    mdns: isNodeModuleInstalled('@libp2p/mdns'),
    relay: isNodeModuleInstalled('@libp2p/circuit-relay-v2'),
    gossipsub: isNodeModuleInstalled('@chainsafe/libp2p-gossipsub'),
  };

  return {
    mode: getDiscoveryMode(),
    announcement_enabled: isAnnouncementEnabled(),
    bootstrap_configured: hasBootstrap(),
    bootstrap_addrs: getBootstrapList(),
    script_exists: fs.existsSync(P2P_DISCOVERY_SCRIPT),
    module_path: fs.existsSync(P2P_DISCOVERY_MODULE),
    package_available: fs.existsSync(path.join(P2P_DISCOVERY_DIR, 'node_modules')),
    node_port: toPositiveInt(process.env.P2P_DISCOVERY_PORT, 0),
    feature_flags: featureFlags,
    transport: {
      tcp: true,
      websocket: featureFlags.websocket,
      relay: featureFlags.relay,
      mdns: featureFlags.mdns,
      gossipsub: featureFlags.gossipsub,
    },
    optional_packages: optionalPackages,
    optional_features_ready: {
      websocket: featureFlags.websocket && optionalPackages.websocket,
      mdns: featureFlags.mdns && optionalPackages.mdns,
      relay: featureFlags.relay && optionalPackages.relay,
      gossipsub: featureFlags.gossipsub && optionalPackages.gossipsub,
    },
  };
}

async function loadDiscoveryModule() {
  if (dcpDiscoveryModule) return dcpDiscoveryModule;
  if (dcpDiscoveryModulePromise) return dcpDiscoveryModulePromise;
  dcpDiscoveryModulePromise = import(pathToFileURL(P2P_DISCOVERY_MODULE).href)
    .then((mod) => {
      dcpDiscoveryModule = mod;
      return mod;
    })
    .catch((error) => {
      console.error('[p2p-discovery] Failed to load dcp-discovery module:', error.message);
      dcpDiscoveryModulePromise = null;
      return null;
    });
  return dcpDiscoveryModulePromise;
}

async function runNodeQuery(queryHandler, options = {}) {
  if (!['shadow', 'p2p-primary'].includes(getDiscoveryMode())) {
    return null;
  }
  const module = await loadDiscoveryModule();
  if (!module) return null;
  const node = await module.createDiscoveryNode(createNodeOptions(options));
  try {
    return await queryHandler(module, node);
  } finally {
    if (node) {
      await node.stop().catch(() => {});
    }
  }
}

async function resolveProvider(peerId, { allowStale = false, maxAgeMs = 120000, fallbackResolver = null } = {}) {
  if (!peerId) return null;
  return runNodeQuery((module, node) => module.resolveProviderByPeerId(node, peerId, {
    allowStale,
    maxAgeMs,
    fallbackResolver,
  }));
}

async function resolvePeersWithNode(module, node, peerIds, { allowStale = false, maxAgeMs = 120000, fallbackResolver = null }) {
  const results = [];
  for (const peerId of peerIds) {
    const resolved = await module.resolveProviderByPeerId(node, peerId, {
      allowStale,
      maxAgeMs,
      fallbackResolver,
    });
    if (!resolved || !resolved.provider) {
      results.push({ peer_id: peerId, found: false, source: 'dht', reason: 'provider_record_missing' });
    } else {
      results.push({
        peer_id: peerId,
        found: true,
        source: resolved.source || 'dht',
        stale: Boolean(resolved.stale),
        provider: resolved.provider,
        environment: resolved.environment?.env ? resolved.environment.env : null,
        envelope: resolved.environment || null,
      });
    }
  }
  return results;
}

async function listProviders({ allowStale = false, maxAgeMs = 120000, fallbackResolver = null } = {}) {
  if (!['shadow', 'p2p-primary'].includes(getDiscoveryMode())) {
    return [];
  }

  const module = await loadDiscoveryModule();
  if (!module || typeof module.getRegisteredProviderPeers !== 'function') return [];

  let node = null;
  try {
    node = await module.createDiscoveryNode(createNodeOptions());
  } catch (error) {
    console.warn('[p2p-discovery] Failed to create discovery node for provider listing:', error.message);
    return [];
  }
  try {
    const discoveredPeerIds = toPeerIdList(await module.getRegisteredProviderPeers(node));
    if (!discoveredPeerIds.length) return [];

    return resolvePeersWithNode(module, node, discoveredPeerIds, {
      allowStale,
      maxAgeMs,
      fallbackResolver,
    });
  } finally {
    await node.stop().catch(() => {});
  }
}

async function resolveProviders(peerIds, { allowStale = false, maxAgeMs = 120000, fallbackResolver = null } = {}) {
  const uniqueIds = Array.from(new Set(toPeerIdList(peerIds)));
  if (!uniqueIds.length) return [];

  const module = await loadDiscoveryModule();
  if (!module) return [];

  if (!['shadow', 'p2p-primary'].includes(getDiscoveryMode())) {
    return uniqueIds.map((peerId) => ({ peer_id: peerId, found: false, source: 'disabled', reason: 'mode_sqlite' }));
  }

  const node = await module.createDiscoveryNode(createNodeOptions());
  try {
    return resolvePeersWithNode(module, node, uniqueIds, {
      allowStale,
      maxAgeMs,
      fallbackResolver,
    });
  } finally {
    await node.stop().catch(() => {});
  }
}

async function runShadowDiscoveryCycle(peerIds, { allowStale = false, maxAgeMs = 120000 } = {}) {
  const mode = getDiscoveryMode();
  const trackedPeerIds = normalizeShadowCandidateIds(peerIds);
  const evaluatedAt = nowIso();
  const thresholds = getShadowThresholds();

  if (mode === 'sqlite') {
    return {
      status: 'skipped',
      reason: 'mode_sqlite',
      mode,
      max_age_ms: maxAgeMs,
      allow_stale: allowStale,
      shadow_cycle: buildShadowCycleSummary({
        trackedPeerIds,
        resolvedProviders: [],
        lookupLatencyMs: null,
        evaluatedAt,
        thresholds,
      }),
    };
  }

  const started = Date.now();
  const resolvedProviders = await resolveProviders(trackedPeerIds, {
    allowStale,
    maxAgeMs,
  });
  const shadowCycle = buildShadowCycleSummary({
    trackedPeerIds,
    resolvedProviders,
    lookupLatencyMs: Date.now() - started,
    evaluatedAt,
    thresholds,
  });

  return {
    status: shadowCycle.fallback_triggered ? 'degraded' : (shadowCycle.promote_ready ? 'healthy' : 'holding'),
    mode,
    max_age_ms: maxAgeMs,
    allow_stale: allowStale,
    shadow_cycle: shadowCycle,
  };
}

async function resolveEnvironment(cid, { allowStale = false, maxAgeMs = 120000, fallbackResolver = null } = {}) {
  return runNodeQuery((module, node) => module.resolveEnvironmentByCid(node, cid, {
    allowStale,
    maxAgeMs,
    fallbackResolver,
  }));
}

async function probeDiscovery({ ttlMs = 120000, bootstrapProbeMs = 3000 } = {}) {
  if (!['shadow', 'p2p-primary'].includes(getDiscoveryMode())) {
    return { status: 'skipped', reason: 'sqlite_mode' };
  }
  if (!hasBootstrap()) {
    return { status: 'skipped', reason: 'bootstrap_missing' };
  }
  const module = await loadDiscoveryModule();
  if (!module) {
    return { status: 'skipped', reason: 'module_unavailable' };
  }

  const startedAt = Date.now();
  const node = await module.createDiscoveryNode(createNodeOptions({ clientMode: false }));
  try {
    const bootstrapReachable = await waitForPeers(node, bootstrapProbeMs);
    let probeResolved = null;
    let probe = null;

    try {
      probe = await module.announceProviderEnvironment(node, buildProbeAnnouncementSpec(), {
        ttlMs,
      });
      probeResolved = await module.resolveProviderByPeerId(node, probe.peer_id, {
        allowStale: true,
        maxAgeMs: ttlMs,
      });
    } catch (error) {
      return {
        status: 'failed',
        reason: error.message,
        mode: getDiscoveryMode(),
        elapsed_ms: Date.now() - startedAt,
        bootstrap_reachable: bootstrapReachable,
        peers_connected: node.getPeers().length,
      };
    }

    return {
      status: probeResolved && probeResolved.provider ? 'ok' : 'degraded',
      mode: getDiscoveryMode(),
      elapsed_ms: Date.now() - startedAt,
      bootstrap_reachable: bootstrapReachable,
      peers_connected: node.getPeers().length,
      loopback_resolved: Boolean(probeResolved && probeResolved.provider),
      loopback_stale: Boolean(probeResolved && probeResolved.stale),
      peer_id: probe?.peer_id || null,
      env_cid: probe?.env_cid || null,
      ttl_ms: ttlMs,
      features: getFeatureFlags(),
    };
  } finally {
    await node.stop().catch(() => {});
  }
}

module.exports = {
  getDiscoveryStatus,
  getShadowThresholds,
  buildShadowCycleSummary,
  runShadowDiscoveryCycle,
  announceFromProviderHeartbeat,
  announceFromHttpInput,
  resolveProvider,
  listProviders,
  resolveProviders,
  resolveEnvironment,
  probeDiscovery,
};
