/**
 * DCP Heartbeat Protocol — Node Liveness Tracking
 *
 * Implements periodic heartbeat announcements from provider nodes to track
 * their online status and health metrics. Used for:
 *   - Provider availability detection
 *   - Stale node identification
 *   - Network health monitoring
 *
 * Heartbeat records are stored in DHT with TTL and include:
 *   - peer_id: libp2p peer identifier
 *   - timestamp: ISO 8601 heartbeat time
 *   - sequence: monotonic counter for ordering
 *   - metrics: CPU, memory, GPU utilization
 *   - status: 'healthy', 'degraded', 'warning'
 */

export const DCP_HEARTBEAT_PREFIX = '/dcp/nodes/1.0.0/heartbeats/'
export const DCP_HEARTBEAT_INDEX_KEY = '/dcp/nodes/1.0.0/heartbeat-index'
export const DEFAULT_HEARTBEAT_TTL_MS = 60_000 // 60 second heartbeat TTL
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000 // Emit every 30 seconds
export const HEARTBEAT_STALE_MS = 90_000 // Stale after 90 seconds

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function encodeJson(obj) {
  return textEncoder.encode(JSON.stringify(obj))
}

function decodeJson(bytes) {
  return JSON.parse(textDecoder.decode(bytes))
}

function nowIso() {
  return new Date().toISOString()
}

function heartbeatKey(peerId) {
  return textEncoder.encode(`${DCP_HEARTBEAT_PREFIX}${peerId}`)
}

function heartbeatIndexKey() {
  return textEncoder.encode(DCP_HEARTBEAT_INDEX_KEY)
}

/**
 * Build a heartbeat record for a provider node
 * @param {string} peerId - libp2p peer ID
 * @param {number} sequence - monotonic sequence number
 * @param {object} metrics - performance metrics (cpu, memory, gpu utilization %)
 * @param {string} status - 'healthy', 'degraded', 'warning'
 * @returns {object} heartbeat record
 */
export function buildHeartbeat(peerId, { sequence = 0, metrics = {}, status = 'healthy' } = {}) {
  const cpuUtilization = Math.min(100, Math.max(0, metrics.cpu_utilization || 0))
  const memoryUtilization = Math.min(100, Math.max(0, metrics.memory_utilization || 0))
  const gpuUtilization = Math.min(100, Math.max(0, metrics.gpu_utilization || 0))

  return {
    version: 1,
    peer_id: peerId,
    timestamp: nowIso(),
    sequence: Math.max(0, sequence),
    status,
    metrics: {
      cpu_utilization: Math.round(cpuUtilization * 100) / 100,
      memory_utilization: Math.round(memoryUtilization * 100) / 100,
      gpu_utilization: Math.round(gpuUtilization * 100) / 100,
    },
    heartbeat_interval_ms: DEFAULT_HEARTBEAT_INTERVAL_MS,
  }
}

/**
 * Validate a heartbeat record
 * @param {object} record - heartbeat record from DHT
 * @returns {object} { ok: boolean, reason?: string }
 */
export function validateHeartbeat(record) {
  if (!record || typeof record !== 'object') {
    return { ok: false, reason: 'invalid_record' }
  }
  if (typeof record.peer_id !== 'string' || !record.peer_id.length) {
    return { ok: false, reason: 'missing_peer_id' }
  }
  if (typeof record.timestamp !== 'string') {
    return { ok: false, reason: 'missing_timestamp' }
  }
  const timestampMs = Date.parse(record.timestamp)
  if (!Number.isFinite(timestampMs)) {
    return { ok: false, reason: 'invalid_timestamp' }
  }
  if (!Number.isInteger(record.sequence) || record.sequence < 0) {
    return { ok: false, reason: 'invalid_sequence' }
  }
  return { ok: true }
}

/**
 * Check if a heartbeat is stale (older than HEARTBEAT_STALE_MS)
 * @param {object} record - heartbeat record
 * @param {number} nowMs - current time in ms (default: Date.now())
 * @returns {boolean}
 */
export function isHeartbeatStale(record, nowMs = Date.now()) {
  if (!record?.timestamp) return true
  const heartbeatMs = Date.parse(record.timestamp)
  if (!Number.isFinite(heartbeatMs)) return true
  return nowMs - heartbeatMs > HEARTBEAT_STALE_MS
}

/**
 * Announce a heartbeat from this provider node to the DHT
 * @param {object} node - libp2p node (with dht service)
 * @param {string} peerId - our peer ID
 * @param {object} options - heartbeat options
 * @param {number} options.sequence - heartbeat sequence number
 * @param {object} options.metrics - performance metrics
 * @param {string} options.status - 'healthy', 'degraded', 'warning'
 * @param {number} options.timeoutMs - DHT operation timeout
 * @returns {Promise<object>} { status, timestamp, sequence }
 */
export async function announceHeartbeat(
  node,
  peerId,
  { sequence = 0, metrics = {}, status = 'healthy', timeoutMs = 8000 } = {}
) {
  if (!node?.services?.dht) {
    throw new Error('Node must have dht service')
  }

  const heartbeat = buildHeartbeat(peerId, { sequence, metrics, status })
  const key = heartbeatKey(peerId)
  const value = encodeJson(heartbeat)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      for await (const _ of node.services.dht.put(key, value, { signal: controller.signal })) {
        // DHT put completes when quorum is reached
      }
    } finally {
      clearTimeout(timeout)
    }

    return {
      status: 'announced',
      timestamp: heartbeat.timestamp,
      sequence: heartbeat.sequence,
    }
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.warn(`[DCP-Heartbeat] DHT put timed out (${timeoutMs}ms)`)
      return { status: 'timeout', sequence }
    }
    throw error
  }
}

/**
 * Resolve a single peer's latest heartbeat
 * @param {object} node - libp2p node
 * @param {string} peerId - target peer ID
 * @param {number} timeoutMs - DHT query timeout
 * @returns {Promise<object|null>} heartbeat record or null if not found
 */
export async function resolveHeartbeat(node, peerId, timeoutMs = 8000) {
  if (!node?.services?.dht) {
    throw new Error('Node must have dht service')
  }

  const key = heartbeatKey(peerId)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    for await (const event of node.services.dht.get(key, { signal: controller.signal })) {
      if (event.name === 'VALUE') {
        try {
          const record = decodeJson(event.value)
          const validation = validateHeartbeat(record)
          if (validation.ok) {
            return record
          }
        } catch (error) {
          console.warn(`[DCP-Heartbeat] Failed to parse heartbeat for ${peerId}:`, error.message)
        }
      }
    }
    return null
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return null
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Resolve heartbeats for multiple peers
 * @param {object} node - libp2p node
 * @param {string[]} peerIds - list of peer IDs
 * @param {number} timeoutMs - per-peer timeout
 * @returns {Promise<object[]>} array of { peer_id, found, stale, heartbeat }
 */
export async function resolveHeartbeats(node, peerIds = [], timeoutMs = 8000) {
  const results = []
  for (const peerId of peerIds) {
    try {
      const hb = await resolveHeartbeat(node, peerId, timeoutMs)
      if (!hb) {
        results.push({
          peer_id: peerId,
          found: false,
          stale: true,
          heartbeat: null,
        })
      } else {
        const stale = isHeartbeatStale(hb)
        results.push({
          peer_id: peerId,
          found: true,
          stale,
          heartbeat: hb,
        })
      }
    } catch (error) {
      console.warn(`[DCP-Heartbeat] Failed to resolve heartbeat for ${peerId}:`, error.message)
      results.push({
        peer_id: peerId,
        found: false,
        stale: true,
        heartbeat: null,
      })
    }
  }
  return results
}

/**
 * Start a periodic heartbeat emitter (for provider nodes)
 * @param {object} node - libp2p node
 * @param {string} peerId - our peer ID
 * @param {object} options
 * @param {Function} options.getMetrics - async function returning { cpu_utilization, memory_utilization, gpu_utilization }
 * @param {Function} options.getStatus - function returning 'healthy', 'degraded', 'warning'
 * @param {number} options.intervalMs - emit interval (default: DEFAULT_HEARTBEAT_INTERVAL_MS)
 * @returns {object} emitter with stop() and getStats() methods
 */
export function createHeartbeatEmitter(node, peerId, options = {}) {
  const {
    getMetrics = async () => ({}),
    getStatus = () => 'healthy',
    intervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  } = options

  let running = true
  let sequence = 0
  let lastAnnounceMs = 0
  const stats = {
    announced: 0,
    failed: 0,
    lastAnnounceAt: null,
    lastError: null,
  }

  async function emitHeartbeat() {
    try {
      const metrics = await getMetrics()
      const status = getStatus()
      const result = await announceHeartbeat(node, peerId, {
        sequence: sequence++,
        metrics,
        status,
      })
      if (result.status === 'announced') {
        stats.announced++
        stats.lastAnnounceAt = result.timestamp
      } else if (result.status === 'timeout') {
        stats.failed++
      }
    } catch (error) {
      stats.failed++
      stats.lastError = error.message
      console.warn('[DCP-Heartbeat] Emission failed:', error.message)
    }
    lastAnnounceMs = Date.now()
  }

  function scheduleNext() {
    if (!running) return
    const now = Date.now()
    const elapsed = now - lastAnnounceMs
    const delayMs = Math.max(0, intervalMs - elapsed)
    setTimeout(async () => {
      await emitHeartbeat()
      scheduleNext()
    }, delayMs)
  }

  // Start immediately
  emitHeartbeat()
  scheduleNext()

  return {
    stop() {
      running = false
    },
    getStats() {
      return { ...stats, sequence }
    },
  }
}

/**
 * Build a health summary for a list of peers based on their heartbeats
 * @param {object[]} heartbeatResults - from resolveHeartbeats()
 * @returns {object} { healthy: [], degraded: [], offline: [], total: number }
 */
export function summarizeHeartbeatHealth(heartbeatResults = []) {
  const summary = {
    healthy: [],
    degraded: [],
    offline: [],
    total: heartbeatResults.length,
  }

  for (const result of heartbeatResults) {
    if (!result.found || result.stale) {
      summary.offline.push(result.peer_id)
    } else if (result.heartbeat?.status === 'degraded' || result.heartbeat?.status === 'warning') {
      summary.degraded.push(result.peer_id)
    } else {
      summary.healthy.push(result.peer_id)
    }
  }

  return summary
}
