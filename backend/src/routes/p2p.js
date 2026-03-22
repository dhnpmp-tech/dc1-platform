const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { getApiKeyFromReq } = require('../middleware/auth');
const {
  announceFromHttpInput,
  getDiscoveryStatus,
  runShadowDiscoveryCycle,
  listProviders,
  resolveProvider,
  resolveProviders,
  resolveEnvironment,
  probeDiscovery,
} = require('../services/p2p-discovery');

const router = express.Router();

const announceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many discovery announce requests. Slow down.' },
  keyGenerator: (req) => req.ip,
});

const lookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many P2P lookup requests. Slow down.' },
  keyGenerator: (req) => req.ip,
});

function parseBool(value) {
  const normalized = String(value || '').toLowerCase();
  return normalized === '1' || normalized === 'true';
}

function parseIntOrDefault(value, fallback) {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePeerIdList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  return String(value).split(',').map((entry) => String(entry || '').trim()).filter(Boolean);
}

function parseCachedModels(rawCachedModels) {
  if (!rawCachedModels) return [];
  if (Array.isArray(rawCachedModels)) {
    return rawCachedModels.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(rawCachedModels);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function toProviderShape(row, source = 'sqlite') {
  const heartbeatAge = row.last_heartbeat
    ? Math.floor((Date.now() - new Date(row.last_heartbeat).getTime()) / 1000)
    : null;
  const stale = heartbeatAge !== null && heartbeatAge >= 120;

  const vramMb = row.vram_mib != null ? row.vram_mib : (row.gpu_vram_mib || null);
  const vramGb = row.vram_gb != null ? row.vram_gb : (vramMb ? Math.round(vramMb / 1024) : null);

  return {
    id: row.peer_id || row.id,
    peer_id: row.peer_id || null,
    name: row.name || null,
    gpu_model: row.gpu_name_detected || row.gpu_model || null,
    vram_gb: vramGb,
    vram_mib: vramMb,
    gpu_count: row.gpu_count_reported || row.gpu_count || 1,
    driver_version: row.gpu_driver || null,
    compute_capability: row.gpu_compute_capability || null,
    cuda_version: row.gpu_cuda_version || null,
    status: stale ? 'degraded' : (row.status || 'online'),
    is_live: heartbeatAge !== null ? heartbeatAge < 120 : false,
    location: row.location || null,
    reliability_score: row.reliability_score || 0,
    cached_models: parseCachedModels(row.cached_models),
    source,
    stale,
    discovered_at: row.discovered_at || null,
    env_cid: row.env_cid || null,
    addrs: row.addrs || [],
  };
}

function toDhtProviderShape(entry) {
  const env = entry.provider_environment || {};
  const provider = entry.provider_record || {};

  return {
    id: entry.peer_id || provider.peer_id,
    peer_id: entry.peer_id || null,
    name: null,
    gpu_model: env.gpu_model || 'unknown',
    vram_gb: env.vram_gb || null,
    vram_mib: env.vram_gb != null ? Math.round(Number(env.vram_gb) * 1024) : null,
    gpu_count: env.available_slots || 1,
    driver_version: env.driver_version || null,
    compute_capability: env.compute_capability || null,
    cuda_version: env.cuda_version || null,
    status: entry.stale ? 'degraded' : 'online',
    is_live: !entry.stale,
    location: env.region || null,
    reliability_score: env.reliability_score || 0,
    cached_models: env.cached_models || [],
    source: entry.source || 'dht',
    stale: Boolean(entry.stale),
    discovered_at: provider.announced_at || null,
    env_cid: provider.env_cid || null,
    addrs: provider.addrs || [],
    found: true,
  };
}

function getProviderByApiKey(req) {
  const apiKey = getApiKeyFromReq(req, {
    headerName: 'x-provider-key',
    queryNames: ['key', 'api_key'],
    bodyNames: ['api_key', 'key'],
    maxLen: 128,
  });
  if (!apiKey) return null;
  return db.get('SELECT * FROM providers WHERE api_key = ?', [apiKey]);
}

router.get('/health', async (req, res) => {
  const status = getDiscoveryStatus();
  if (!parseBool(req.query.probe)) {
    return res.json({
      service: 'dcp-p2p',
      ...status,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const probe = await probeDiscovery({
      ttlMs: parseIntOrDefault(req.query.probe_ttl_ms, 60000),
      bootstrapProbeMs: parseIntOrDefault(req.query.bootstrap_probe_ms, 3000),
    });
    return res.json({
      service: 'dcp-p2p',
      ...status,
      probe,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[p2p] health probe error:', error.message);
    return res.status(500).json({
      service: 'dcp-p2p',
      ...status,
      probe: { status: 'failed', reason: error.message },
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/announce', announceLimiter, async (req, res) => {
  try {
    const provider = getProviderByApiKey(req);
    if (!provider) {
      return res.status(401).json({ error: 'Invalid provider API key' });
    }

    const result = announceFromHttpInput(provider, req.body || {});
    const status = result?.status || 'failed';
    const code = status === 'enqueued' ? 202 : 200;

    return res.status(code).json({
      success: status === 'enqueued' || status === 'skipped',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[p2p] announce error:', error.message);
    return res.status(500).json({ error: 'Failed to enqueue P2P announce' });
  }
});

router.get('/providers', lookupLimiter, async (req, res) => {
  try {
    const peerIds = parsePeerIdList(req.query.peer_ids || req.query.peerId || req.query.peers);
    const allowStale = parseBool(req.query.allow_stale);
    const maxAgeMs = parseIntOrDefault(req.query.max_age_ms, 120000);
    const includeMissing = parseBool(req.query.include_missing);
    const discoverAll = parseBool(req.query.discover_all || req.query.discoverAll || req.query.all);
    const limit = parseIntOrDefault(req.query.limit, 200);
    const status = getDiscoveryStatus();

    const shouldUseDhtList = (!peerIds.length) && (discoverAll || status.mode === 'p2p-primary');
    if (shouldUseDhtList) {
      const resolved = await listProviders({
        allowStale,
        maxAgeMs,
      });
      const providers = resolved
        .filter((entry) => entry && (entry.found || includeMissing))
        .map((entry) => {
          if (!entry.found) {
            return {
              found: false,
              peer_id: entry.peer_id,
              source: entry.source || 'dht',
              stale: false,
            };
          }
          return toDhtProviderShape({
            peer_id: entry.peer_id,
            provider_record: entry.provider,
            provider_environment: entry.environment,
            stale: entry.stale,
            source: entry.source,
          });
        });

      return res.json({
        source: 'dht',
        discovery_mode: status.mode,
        total: resolved.length,
        providers,
        resolved: providers.filter((entry) => entry && entry.found !== false).length,
        missing: providers.filter((entry) => entry && entry.found === false).map((entry) => entry.peer_id),
        timestamp: new Date().toISOString(),
      });
    }

    if (!peerIds.length) {
      const rows = db.all(
        `SELECT id, p2p_peer_id AS peer_id, name, gpu_model, gpu_name_detected, vram_gb, gpu_vram_mib AS vram_mib,
                gpu_driver, gpu_compute_capability, gpu_cuda_version,
                gpu_count_reported, gpu_count, status, location, reliability_score, cached_models,
                last_heartbeat
         FROM providers WHERE status = 'online' AND is_paused = 0
         ORDER BY vram_mib DESC NULLS LAST
         LIMIT ?`,
        Number.isFinite(limit) ? limit : 200
      );
      const providers = rows.map((row) => toProviderShape(row));
      return res.json({
        source: 'sqlite',
        discovery_mode: status.mode,
        total: providers.length,
        providers,
        timestamp: new Date().toISOString(),
      });
    }

    const resolved = await resolveProviders(peerIds, {
      allowStale,
      maxAgeMs,
    });

    const providers = resolved
      .filter((entry) => entry && (entry.found || includeMissing))
      .map((entry) => {
        if (!entry.found) {
          return {
            found: false,
            peer_id: entry.peer_id,
            source: entry.source || 'dht',
            stale: false,
          };
        }
        return toDhtProviderShape({
          peer_id: entry.peer_id,
          provider_record: entry.provider,
          provider_environment: entry.environment,
          stale: entry.stale,
          source: entry.source,
        });
      });

    return res.json({
      source: 'dht',
      discovery_mode: status.mode,
      total: resolved.length,
      providers,
      resolved: providers.filter((entry) => entry && entry.found !== false).length,
      missing: providers.filter((entry) => entry && entry.found === false).map((entry) => entry.peer_id),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[p2p] providers error:', error.message);
    return res.status(500).json({ error: 'P2P provider list failed' });
  }
});

router.get('/shadow-cycle', lookupLimiter, async (req, res) => {
  try {
    const allowStale = parseBool(req.query.allow_stale);
    const maxAgeMs = parseIntOrDefault(req.query.max_age_ms, 120000);
    const limit = parseIntOrDefault(req.query.limit, 500);

    const rows = db.all(
      `SELECT p2p_peer_id
       FROM providers
       WHERE status = 'online'
         AND is_paused = 0
         AND p2p_peer_id IS NOT NULL
         AND TRIM(p2p_peer_id) != ''
       ORDER BY id DESC
       LIMIT ?`,
      Number.isFinite(limit) ? limit : 500
    );
    const peerIds = rows.map((row) => String(row.p2p_peer_id || '').trim()).filter(Boolean);
    const cycle = await runShadowDiscoveryCycle(peerIds, { allowStale, maxAgeMs });
    const status = cycle.status === 'degraded' ? 503 : 200;

    return res.status(status).json({
      service: 'dcp-p2p',
      tracked_peers_from_sqlite: peerIds.length,
      ...cycle,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[p2p] shadow-cycle error:', error.message);
    return res.status(500).json({ error: 'Failed to run P2P shadow cycle' });
  }
});

router.get('/providers/:peerId', lookupLimiter, async (req, res) => {
  try {
    const { peerId } = req.params;
    if (!peerId) {
      return res.status(400).json({ error: 'peerId required' });
    }
    const allowStale = parseBool(req.query.allow_stale);
    const maxAgeMs = parseIntOrDefault(req.query.max_age_ms, 120000);

    const resolved = await resolveProvider(peerId, {
      allowStale,
      maxAgeMs,
    });
    if (!resolved || !resolved.provider) {
      return res.status(404).json({ error: 'Provider record not found in DHT' });
    }
    return res.json({
      source: 'dht',
      provider: resolved.provider,
      provider_environment: resolved.environment,
      stale: Boolean(resolved.stale),
    });
  } catch (error) {
    console.error('[p2p] provider resolve error:', error.message);
    return res.status(500).json({ error: 'P2P provider lookup failed' });
  }
});

router.get('/environments/:cid', lookupLimiter, async (req, res) => {
  try {
    const { cid } = req.params;
    if (!cid) {
      return res.status(400).json({ error: 'cid required' });
    }
    const allowStale = parseBool(req.query.allow_stale);
    const maxAgeMs = parseIntOrDefault(req.query.max_age_ms, 120000);

    const environment = await resolveEnvironment(cid, {
      allowStale,
      maxAgeMs,
    });
    if (!environment) {
      return res.status(404).json({ error: 'Environment record not found in DHT' });
    }

    return res.json({ source: 'dht', environment });
  } catch (error) {
    console.error('[p2p] environment resolve error:', error.message);
    return res.status(500).json({ error: 'P2P environment lookup failed' });
  }
});

module.exports = router;
