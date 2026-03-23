// DC1 Health Check & Monitoring Service
//
// Exposes:
// - /health — Basic health status
// - /metrics — Prometheus-format metrics
// - /status — Detailed system status
// - /history — Health check history

const http = require('http');
const url = require('url');
const { promiseWithTimeout } = require('./utils');

const PORT = process.env.HEALTHCHECK_PORT || 9090;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8083';
const DATABASE_URL = process.env.DATABASE_URL;

// Health check results history
const history = {
  frontend: [],
  backend: [],
  database: [],
  timestamp: new Date(),
};

const MAX_HISTORY = 100;

// Utility functions
function recordCheck(service, status, latency, error = null) {
  const record = {
    timestamp: new Date().toISOString(),
    status,
    latency,
    error,
  };

  if (!history[service]) {
    history[service] = [];
  }

  history[service].push(record);
  if (history[service].length > MAX_HISTORY) {
    history[service].shift();
  }
}

function getAverageLatency(service) {
  if (!history[service] || history[service].length === 0) {
    return 0;
  }
  const sum = history[service].reduce((acc, h) => acc + (h.latency || 0), 0);
  return Math.round(sum / history[service].length);
}

function getSuccessRate(service) {
  if (!history[service] || history[service].length === 0) {
    return 0;
  }
  const successes = history[service].filter(h => h.status === 'ok').length;
  return Math.round((successes / history[service].length) * 100);
}

// Health check functions
async function checkFrontend() {
  const startTime = Date.now();
  try {
    const response = await promiseWithTimeout(
      fetch(`${FRONTEND_URL}`, { method: 'HEAD' }),
      5000
    );
    const latency = Date.now() - startTime;
    if (response.ok) {
      recordCheck('frontend', 'ok', latency);
      return { status: 'ok', latency, statusCode: response.status };
    } else {
      recordCheck('frontend', 'error', latency, `HTTP ${response.status}`);
      return { status: 'error', latency, statusCode: response.status };
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    recordCheck('frontend', 'error', latency, error.message);
    return { status: 'error', latency, error: error.message };
  }
}

async function checkBackend() {
  const startTime = Date.now();
  try {
    const response = await promiseWithTimeout(
      fetch(`${BACKEND_URL}/api/health`),
      5000
    );
    const latency = Date.now() - startTime;
    if (response.ok) {
      const data = await response.json();
      recordCheck('backend', 'ok', latency);
      return { status: 'ok', latency, statusCode: response.status, data };
    } else {
      recordCheck('backend', 'error', latency, `HTTP ${response.status}`);
      return { status: 'error', latency, statusCode: response.status };
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    recordCheck('backend', 'error', latency, error.message);
    return { status: 'error', latency, error: error.message };
  }
}

async function checkDatabase() {
  // Database health is verified via the backend's /api/health endpoint
  // (backend uses SQLite — no separate DB process to probe)
  const startTime = Date.now();
  try {
    const response = await promiseWithTimeout(
      fetch(`${BACKEND_URL}/api/health`),
      5000
    );
    const latency = Date.now() - startTime;
    const data = await response.json();
    // Backend /api/health returns { db: 'ok' } for SQLite; support both shapes
    if (data.db === 'ok' || data.database === 'connected') {
      recordCheck('database', 'ok', latency);
      return { status: 'ok', latency };
    } else {
      recordCheck('database', 'error', latency, 'Database not healthy');
      return { status: 'error', latency, error: 'Database not healthy' };
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    recordCheck('database', 'error', latency, error.message);
    return { status: 'error', latency, error: error.message };
  }
}

// HTTP server request handler
async function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    if (pathname === '/health') {
      // Simple liveness probe
      const frontendCheck = await checkFrontend();
      const backendCheck = await checkBackend();

      const allHealthy = frontendCheck.status === 'ok' && backendCheck.status === 'ok';

      res.writeHead(allHealthy ? 200 : 503);
      res.end(JSON.stringify({
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          frontend: frontendCheck.status,
          backend: backendCheck.status,
        },
      }));
    } else if (pathname === '/status') {
      // Detailed status with metrics
      const frontendCheck = await checkFrontend();
      const backendCheck = await checkBackend();
      const databaseCheck = await checkDatabase();

      res.writeHead(200);
      res.end(JSON.stringify({
        timestamp: new Date().toISOString(),
        services: {
          frontend: {
            status: frontendCheck.status,
            latency: frontendCheck.latency,
            avgLatency: getAverageLatency('frontend'),
            successRate: getSuccessRate('frontend'),
            ...(frontendCheck.statusCode && { statusCode: frontendCheck.statusCode }),
          },
          backend: {
            status: backendCheck.status,
            latency: backendCheck.latency,
            avgLatency: getAverageLatency('backend'),
            successRate: getSuccessRate('backend'),
            ...(backendCheck.statusCode && { statusCode: backendCheck.statusCode }),
            ...(backendCheck.data && { data: backendCheck.data }),
          },
          database: {
            status: databaseCheck.status,
            latency: databaseCheck.latency,
            avgLatency: getAverageLatency('database'),
            successRate: getSuccessRate('database'),
          },
        },
      }));
    } else if (pathname === '/metrics') {
      // Prometheus-format metrics
      let metrics = '';

      // Frontend metrics
      metrics += `# HELP frontend_check_status Frontend health check status\n`;
      metrics += `# TYPE frontend_check_status gauge\n`;
      metrics += `frontend_check_status ${(await checkFrontend()).status === 'ok' ? 1 : 0}\n`;

      metrics += `# HELP frontend_latency_ms Frontend response latency in milliseconds\n`;
      metrics += `# TYPE frontend_latency_ms gauge\n`;
      metrics += `frontend_latency_ms ${getAverageLatency('frontend')}\n`;

      // Backend metrics
      metrics += `# HELP backend_check_status Backend health check status\n`;
      metrics += `# TYPE backend_check_status gauge\n`;
      metrics += `backend_check_status ${(await checkBackend()).status === 'ok' ? 1 : 0}\n`;

      metrics += `# HELP backend_latency_ms Backend response latency in milliseconds\n`;
      metrics += `# TYPE backend_latency_ms gauge\n`;
      metrics += `backend_latency_ms ${getAverageLatency('backend')}\n`;

      res.setHeader('Content-Type', 'text/plain');
      res.writeHead(200);
      res.end(metrics);
    } else if (pathname === '/history') {
      // Health check history
      res.writeHead(200);
      res.end(JSON.stringify(history, null, 2));
    } else {
      // Root endpoint
      res.writeHead(200);
      res.end(JSON.stringify({
        service: 'dc1-health-monitor',
        version: '1.0.0',
        endpoints: {
          '/health': 'Liveness probe (200 if healthy)',
          '/status': 'Detailed system status with metrics',
          '/metrics': 'Prometheus-format metrics',
          '/history': 'Health check history',
        },
        timestamp: new Date().toISOString(),
      }));
    }
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({
      error: error.message,
      timestamp: new Date().toISOString(),
    }));
  }
}

// Create HTTP server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`[healthcheck] DC1 Health Monitor listening on port ${PORT}`);
  console.log(`[healthcheck] Endpoints:`);
  console.log(`[healthcheck]   /health   — Liveness probe`);
  console.log(`[healthcheck]   /status   — Detailed status`);
  console.log(`[healthcheck]   /metrics  — Prometheus metrics`);
  console.log(`[healthcheck]   /history  — Check history`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[healthcheck] Shutting down gracefully...');
  server.close(() => {
    console.log('[healthcheck] Shutdown complete');
    process.exit(0);
  });
});
