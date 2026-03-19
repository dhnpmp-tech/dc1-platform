const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Database (use existing connection)
const db = require('../db');
const { sendAlert } = require('../services/notifications');
const { sendWelcomeEmail } = require('../services/email');
const { getBenchmarkResult } = require('../services/benchmarkRunner');

function flattenRunParams(params) {
    if (params.length === 1 && Array.isArray(params[0])) return params[0];
    return params.reduce((acc, p) => (Array.isArray(p) ? acc.concat(p) : acc.concat([p])), []);
}

function runStatement(sql, ...params) {
    return db.prepare(sql).run(...flattenRunParams(params));
}

// Import shared billing rates from jobs module
const { COST_RATES } = require('./jobs');

// Minimum daemon version required — daemons older than this get update_available: true
const MIN_DAEMON_VERSION = '3.3.0';
const WINDOWS_INSTALLER_PATH = path.join(__dirname, '../../installers/dc1-provider-setup-Windows.exe');
const LINUX_INSTALL_SCRIPT_PATH = path.join(__dirname, '../../public/install.sh');
const loginEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeString(value, { maxLen = 500, trim = true } = {}) {
    if (typeof value !== 'string') return null;
    const next = trim ? value.trim() : value;
    if (!next) return null;
    return next.slice(0, maxLen);
}

function normalizeEmail(value) {
    const normalized = normalizeString(value, { maxLen: 254 })?.toLowerCase() || null;
    if (!normalized || !EMAIL_REGEX.test(normalized)) return null;
    return normalized;
}

function toFiniteNumber(value, { min = null, max = null } = {}) {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return null;
    if (min != null && num < min) return null;
    if (max != null && num > max) return null;
    return num;
}

function toFiniteInt(value, { min = null, max = null } = {}) {
    const num = toFiniteNumber(value, { min, max });
    if (num == null || !Number.isInteger(num)) return null;
    return num;
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
const marketplaceLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many requests. Limit is 30 requests per minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});
const benchmarkLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many requests. Limit is 30 requests per minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Semantic version comparison: returns -1 (v1<v2), 0 (equal), 1 (v1>v2)
function compareVersions(v1, v2) {
    const p1 = (v1 || '0').split('.').map(Number);
    const p2 = (v2 || '0').split('.').map(Number);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const a = p1[i] || 0, b = p2[i] || 0;
        if (a < b) return -1;
        if (a > b) return 1;
    }
    return 0;
}

// ============================================================================
// POST /api/providers/register - Register new provider
// ============================================================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, gpu_model, os, phone, resource_spec } = req.body;
        const cleanName = normalizeString(name, { maxLen: 120 });
        const cleanEmail = normalizeEmail(email);
        const cleanGpuModel = normalizeString(gpu_model, { maxLen: 120 });
        const cleanOs = normalizeString(os, { maxLen: 40 });

        // Validate inputs
        if (!cleanName || !cleanEmail || !cleanGpuModel || !cleanOs) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const validOs = new Set(['windows', 'linux', 'mac', 'darwin']);
        if (!validOs.has(cleanOs.toLowerCase())) {
            return res.status(400).json({ error: 'Invalid OS value' });
        }

        // Check for similar existing accounts (fuzzy duplicate detection)
        const similar = db.all(
            `SELECT id, name, email, status FROM providers
             WHERE LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?)
             LIMIT 3`,
            cleanEmail, cleanName
        );
        if (similar.length > 0) {
            const matches = similar.map(s => `${s.name} (${s.email}, ${s.status})`).join('; ');
            console.warn(`[registration] Potential duplicate for "${cleanName}" <${cleanEmail}>: ${matches}`);
        }

        // Generate unique API key
        const api_key = 'dc1-provider-' + crypto.randomBytes(16).toString('hex');

        // Generate unique provider ID
        const provider_id = 'prov-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        // Validate resource_spec if provided
        let resourceSpecJson = null;
        if (resource_spec && (typeof resource_spec === 'string' || isPlainObject(resource_spec))) {
            try {
                resourceSpecJson = typeof resource_spec === 'string'
                    ? resource_spec
                    : JSON.stringify(resource_spec);
            } catch (_) {}
        }

        // Save to database
        const result = await runStatement(
            `INSERT INTO providers (name, email, gpu_model, os, api_key, status, created_at, resource_spec)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [cleanName, cleanEmail, cleanGpuModel, cleanOs, api_key, 'registered', new Date().toISOString(), resourceSpecJson]
        );
        
        // Generate installer URL
        const installer_url = `/api/providers/installer?key=${api_key}&os=${encodeURIComponent(cleanOs)}`;
        
        res.json({
            success: true,
            provider_id: result.lastInsertRowid,
            api_key,
            installer_url,
            message: `Welcome ${cleanName}! Your API key is ready. Download the installer to get started.`
        });

        // Fire-and-forget welcome email — does not affect registration response
        sendWelcomeEmail('provider', { name: cleanName, email: cleanEmail, apiKey: api_key });
        
    } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'A provider with this email already exists' });
    }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// ============================================================================
// POST /api/providers/login-email - Login with email instead of API key
// ============================================================================
router.post('/login-email', loginEmailLimiter, (req, res) => {
    try {
        const { email } = req.body;
        const cleanEmail = normalizeEmail(email);
        if (!cleanEmail) return res.status(400).json({ error: 'Valid email is required' });

        const provider = db.get('SELECT * FROM providers WHERE LOWER(email) = LOWER(?)', cleanEmail);
        if (!provider) {
            return res.status(404).json({ error: 'No provider account found with this email. Register first at /provider/register' });
        }

        res.json({
            success: true,
            message: 'Account found. Log in via your dashboard to retrieve your key.'
        });
    } catch (error) {
        console.error('Provider email login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ============================================================================
// GET /api/providers/installer - Download installer (with validation)
// ============================================================================
router.get('/installer', (req, res) => {
    try {
        const { key, os } = req.query;
        
        if (!key || !os) {
            return res.status(400).json({ error: 'Missing API key or OS' });
        }
        
        // Determine installer path
        const installerMap = {
            'Windows': 'dc1-provider-setup-Windows.exe',
            'Mac': 'dc1-provider-setup-Mac.pkg',
            'Linux': 'dc1-provider-setup-Linux.deb'
        };
        
        const installerFile = installerMap[os];
        if (!installerFile) {
            return res.status(400).json({ error: 'Invalid OS' });
        }
        
        const installerPath = path.join(__dirname, '../../installers', installerFile);
        
        // Check if file exists
        if (!fs.existsSync(installerPath)) {
            return res.status(404).json({ error: 'Installer not found' });
        }
        
        // Send file with appropriate headers
        res.setHeader('Content-Disposition', `attachment; filename="${installerFile}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        const fileStream = fs.createReadStream(installerPath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Installer download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

// ============================================================================
// REPUTATION: compute uptime%, success_rate, and composite reputation_score
// Called on every heartbeat — rolls a 7-day window.
// Formula: 70% success_rate + 20% uptime + 10% longevity (0–100 each)
// ============================================================================
function computeReputationScore(providerId) {
    // 1. Uptime — heartbeats received in last 7 days vs expected (1/min = 10080)
    const EXPECTED_HEARTBEATS_7D = 7 * 24 * 60;
    const hbRow = db.get(
        `SELECT COUNT(*) AS cnt FROM heartbeat_log
         WHERE provider_id = ? AND received_at >= datetime('now', '-7 days')`,
        providerId
    );
    const uptimePct = Math.min((hbRow.cnt / EXPECTED_HEARTBEATS_7D) * 100, 100);

    // 2. Success rate — completed / (completed + failed) across all jobs
    const jobRow = db.get(
        `SELECT
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN status IN ('completed','failed') THEN 1 ELSE 0 END) AS terminal
         FROM jobs WHERE provider_id = ?`,
        providerId
    );
    const successRate = (jobRow && jobRow.terminal > 0)
        ? (jobRow.completed / jobRow.terminal) * 100
        : 100; // default 100 while no terminal jobs exist

    // 3. Longevity — capped at 1.0 after 30 days of registration
    const provRow = db.get('SELECT created_at FROM providers WHERE id = ?', providerId);
    const daysSince = provRow?.created_at
        ? (Date.now() - new Date(provRow.created_at).getTime()) / (1000 * 60 * 60 * 24)
        : 0;
    const longevityPct = Math.min(daysSince / 30, 1.0) * 100;

    const score = Math.round(0.7 * successRate + 0.2 * uptimePct + 0.1 * longevityPct);
    return {
        reputation_score: Math.min(score, 100),
        uptime_percent: Math.round(uptimePct * 10) / 10,
    };
}

// ============================================================================
// POST /api/providers/heartbeat - Provider heartbeat (GPU status update)
// ============================================================================
//
// HEARTBEAT API CONTRACT
// ----------------------
// Called by dc1_daemon.py every 30 seconds while the provider is active.
//
// Endpoint : POST /api/providers/heartbeat
// Auth     : api_key in request body (no header required)
//
// Required payload fields:
//   api_key        {string}  Provider API key issued at registration
//   gpu_status     {object}  GPU telemetry snapshot — see sub-fields below
//   provider_ip    {string}  Public IP of the provider machine
//   provider_hostname {string} Hostname of the provider machine
//
// gpu_status sub-fields:
//   gpu_name       {string}  GPU model name (e.g. "NVIDIA RTX 3090")
//   gpu_vram_mib   {number}  Total VRAM in MiB
//   driver_version {string}  NVIDIA driver version string
//   gpu_util_pct   {number}  GPU utilisation 0–100
//   temp_c         {number}  GPU temperature in °C
//   power_w        {number}  GPU power draw in Watts
//   free_vram_mib  {number}  Available (free) VRAM in MiB
//   daemon_version {string}  Semver string of the running daemon
//   python_version {string}  Python runtime version
//   os_info        {string}  OS identifier string
//   gpu_count      {number}  Number of GPUs detected
//   all_gpus       {array}   Per-GPU metric objects (multi-GPU rigs)
//   compute_capability {string} CUDA compute capability (e.g. "8.6")
//   cuda_version   {string}  CUDA toolkit version
//
// Optional payload fields:
//   cached_models  {array}   List of model names already downloaded on the node
//   resource_spec  {object}  Ocean-style resource specification object
//   uptime         {number}  (reserved — not currently used)
//
// Response:
//   { success: true, timestamp: ISO-string, update_available: bool, min_version: string }
//
// Daemon interval recommendation: 30 seconds.
// Grace period thresholds (used by GET /api/providers/available):
//   < 2 min since last heartbeat  → status: "online"   (green)
//   2–10 min since last heartbeat → status: "degraded"  (yellow, still bookable)
//   > 10 min since last heartbeat → status: "offline"   (excluded from marketplace)
// ============================================================================
router.post('/heartbeat', (req, res) => {
    try {
        const { api_key, gpu_status, uptime, provider_ip, provider_hostname, cached_models, resource_spec } = req.body;
        const cleanApiKey = normalizeString(api_key, { maxLen: 128, trim: false });
        if (!cleanApiKey) return res.status(400).json({ error: 'api_key required' });
        if (gpu_status != null && !isPlainObject(gpu_status)) {
            return res.status(400).json({ error: 'gpu_status must be an object' });
        }

        const gs = gpu_status || {};
        const gpuName = normalizeString(gs.gpu_name, { maxLen: 200 });
        const gpuVramMib = toFiniteNumber(gs.gpu_vram_mib, { min: 0, max: 1024 * 1024 });
        const gpuDriver = normalizeString(gs.driver_version, { maxLen: 80 });
        const gpuUtil = toFiniteNumber(gs.gpu_util_pct, { min: 0, max: 100 });
        const gpuTemp = toFiniteNumber(gs.temp_c, { min: -40, max: 150 });
        const gpuPower = toFiniteNumber(gs.power_w, { min: 0, max: 2000 });
        const gpuFreeVram = toFiniteNumber(gs.free_vram_mib, { min: 0, max: 1024 * 1024 });
        const daemonVersion = normalizeString(gs.daemon_version, { maxLen: 32 });
        const pythonVersion = normalizeString(gs.python_version, { maxLen: 32 });
        const osInfo = normalizeString(gs.os_info, { maxLen: 200 });
        const providerIp = normalizeString(provider_ip, { maxLen: 64, trim: true });
        const providerHostname = normalizeString(provider_hostname, { maxLen: 255, trim: true });
        const now = new Date().toISOString();

        // Verify API key (sync — better-sqlite3)
        const p = db.get('SELECT id FROM providers WHERE api_key = ?', cleanApiKey);
        if (!p) return res.status(401).json({ error: 'Invalid API key' });

        runStatement(`UPDATE providers SET
          gpu_status = ?, provider_ip = ?, provider_hostname = ?, last_heartbeat = ?, status = 'online',
          gpu_name_detected = COALESCE(?, gpu_name_detected),
          gpu_vram_mib = COALESCE(?, gpu_vram_mib),
          gpu_driver = COALESCE(?, gpu_driver),
          cached_models = COALESCE(?, cached_models)
          WHERE id = ?`,
          JSON.stringify(gpu_status || {}), providerIp || null, providerHostname || null, now,
          gpuName, gpuVramMib, gpuDriver,
          Array.isArray(cached_models) ? JSON.stringify(cached_models) : null,
          p.id
        );

        const allGpus = Array.isArray(gs.all_gpus) ? gs.all_gpus.slice(0, 32) : null;
        const gpuCount = toFiniteInt(gs.gpu_count, { min: 1, max: 64 }) || (allGpus ? allGpus.length : 1);
        const computeCap = gs.compute_capability || null;
        const cudaVersion = gs.cuda_version || null;
        runStatement(`INSERT INTO heartbeat_log (provider_id, received_at, provider_ip, provider_hostname, gpu_util_pct, gpu_temp_c, gpu_power_w, gpu_vram_free_mib, gpu_vram_total_mib, daemon_version, python_version, os_info, gpu_metrics_json, gpu_count)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          p.id, now, providerIp || null, providerHostname || null,
          gpuUtil, gpuTemp, gpuPower, gpuFreeVram, gpuVramMib,
          daemonVersion, pythonVersion, osInfo,
          allGpus ? JSON.stringify(allGpus) : null,
          gpuCount
        );

        // Update GPU spec fields on provider record when new data arrives
        if (computeCap || cudaVersion || allGpus) {
            runStatement(
                `UPDATE providers SET
                  gpu_count_reported = COALESCE(?, gpu_count_reported),
                  gpu_compute_capability = COALESCE(?, gpu_compute_capability),
                  gpu_cuda_version = COALESCE(?, gpu_cuda_version),
                  gpu_spec_json = COALESCE(?, gpu_spec_json)
                 WHERE id = ?`,
                gpuCount, computeCap, cudaVersion,
                allGpus ? JSON.stringify(allGpus) : null,
                p.id
            );
        }

        // Update Ocean-style resource_spec when daemon provides it
        if (resource_spec && (typeof resource_spec === 'string' || isPlainObject(resource_spec))) {
            const resourceSpecJson = typeof resource_spec === 'string'
                ? resource_spec
                : JSON.stringify(resource_spec);
            runStatement('UPDATE providers SET resource_spec = ? WHERE id = ?', resourceSpecJson, p.id);
        }

        // Store daemon version on provider record for job assignment checks
        if (daemonVersion) {
            runStatement('UPDATE providers SET daemon_version = ? WHERE id = ?', daemonVersion, p.id);
        }

        // Recompute reputation score on every heartbeat (rolling 7-day window)
        const rep = computeReputationScore(p.id);
        runStatement(
            'UPDATE providers SET uptime_percent = ?, reputation_score = ? WHERE id = ?',
            rep.uptime_percent, rep.reputation_score, p.id
        );

        // Tell daemon if update is available (semantic version comparison)
        const needsUpdate = !daemonVersion || compareVersions(daemonVersion, MIN_DAEMON_VERSION) < 0;
        return res.json({
            success: true, message: 'Heartbeat received', timestamp: now,
            update_available: needsUpdate,
            min_version: MIN_DAEMON_VERSION,
        });
        
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ error: 'Heartbeat failed' });
    }
});

// ============================================================================
// POST /api/providers/daemon-event - Log daemon events (crashes, job results, etc.)
// ============================================================================
router.post('/daemon-event', (req, res) => {
    try {
        const { api_key, event_type, severity, daemon_version, timestamp,
                hostname, os_info, python_version, details, job_id } = req.body;

        const cleanApiKey = normalizeString(api_key, { maxLen: 128, trim: false });
        const cleanEventType = normalizeString(event_type, { maxLen: 80 });
        if (!cleanApiKey || !cleanEventType) {
            return res.status(400).json({ error: 'Missing api_key or event_type' });
        }

        const provider = db.get('SELECT id FROM providers WHERE api_key = ?', cleanApiKey);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });
        const cleanSeverity = ['info', 'warning', 'error', 'critical'].includes(String(severity || '').toLowerCase())
            ? String(severity).toLowerCase()
            : 'info';
        const cleanTimestamp = normalizeString(timestamp, { maxLen: 40, trim: true }) || new Date().toISOString();
        const cleanDetails = normalizeString(details || '', { maxLen: 5000, trim: false }) || '';

        runStatement(`INSERT INTO daemon_events
            (provider_id, event_type, severity, daemon_version, job_id,
             hostname, os_info, python_version, details, event_timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            provider.id,
            cleanEventType,
            cleanSeverity,
            normalizeString(daemon_version, { maxLen: 32 }) || null,
            normalizeString(job_id, { maxLen: 80 }) || null,
            normalizeString(hostname, { maxLen: 255 }) || null,
            normalizeString(os_info, { maxLen: 200 }) || null,
            normalizeString(python_version, { maxLen: 32 }) || null,
            cleanDetails,  // Cap at 5KB
            cleanTimestamp
        );

        // Log critical events to console for immediate visibility
        if (cleanSeverity === 'critical' || cleanSeverity === 'error') {
            console.warn(`[DAEMON EVENT] provider=${provider.id} type=${cleanEventType} severity=${cleanSeverity}: ${cleanDetails.substring(0, 200)}`);
            // Fire async alert — don't block response
            const provName = db.get('SELECT name FROM providers WHERE id = ?', provider.id)?.name || `ID ${provider.id}`;
            sendAlert(
              cleanEventType === 'crash' ? 'provider_crash' : 'critical_error',
              `Provider: ${provName} (ID ${provider.id})\nEvent: ${cleanEventType}\nSeverity: ${cleanSeverity}\nHost: ${normalizeString(hostname, { maxLen: 255 }) || 'unknown'}\n\n${cleanDetails.substring(0, 500)}`
            ).catch(() => {});
        }

        res.json({ success: true, event_type: cleanEventType, provider_id: provider.id });

    } catch (error) {
        console.error('Daemon event error:', error);
        res.status(500).json({ error: 'Event logging failed' });
    }
});

// ============================================================================
// GET /api/providers/status - Get provider dashboard data
// ============================================================================
router.get('/status/:api_key', async (req, res) => {
    try {
        const { api_key } = req.params;
        
        const provider = await db.get(
            'SELECT * FROM providers WHERE api_key = ?',
            [api_key]
        );
        
        if (!provider) {
            return res.status(404).json({ error: 'Provider not found' });
        }
        
        res.json({
            provider_id: provider.id,
            name: provider.name,
            status: provider.status,
            gpu_model: provider.gpu_model,
            gpu_status: provider.gpu_status ? JSON.parse(provider.gpu_status) : null,
            provider_ip: provider.ip_address || provider.provider_ip,
            last_heartbeat: provider.last_heartbeat,
            total_earnings: provider.total_earnings || 0,
            total_jobs: provider.total_jobs || 0,
            uptime_percent: provider.uptime_percent || 0
        });
        
    } catch (error) {
        res.status(500).json({ error: 'Status fetch failed' });
    }
});

// === SETUP ROUTE - Serve daemon.sh with injected API key ===
router.get('/setup', (req, res) => {
    try {
        const { key } = req.query;
        if (!key) {
            return res.status(400).json({ error: 'API key required: /setup?key=YOUR_KEY' });
        }

        const daemonPath = path.join(__dirname, '../../installers/daemon.sh');
        if (!fs.existsSync(daemonPath)) {
            return res.status(404).json({ error: 'daemon.sh not found' });
        }

        let daemonScript = fs.readFileSync(daemonPath, 'utf-8');
        daemonScript = daemonScript.replace(
            'DC1_API_KEY="${1:-}"',
            'DC1_API_KEY="' + key + '"'
        );

        res.setHeader('Content-Type', 'text/x-shellscript');
        res.setHeader('Content-Disposition', 'inline; filename="daemon.sh"');
        res.send(daemonScript);

    } catch (error) {
        console.error('Setup script error:', error);
        res.status(500).json({ error: 'Failed to serve setup script' });
    }
});

// === SETUP-WINDOWS ROUTE - Serve daemon.ps1 with injected API key ===
router.get('/setup-windows', async (req, res) => {
    try {
        const { key } = req.query;
        if (!key) {
            return res.status(400).json({ error: 'API key required: /setup-windows?key=YOUR_KEY' });
        }

        // Validate API key exists in DB
        const provider = await db.get('SELECT * FROM providers WHERE api_key = ?', [key]);
        if (!provider) {
            return res.status(404).json({ error: 'Invalid API key' });
        }

        const ps1Path = path.join(__dirname, '../../installers/daemon.ps1');
        if (!fs.existsSync(ps1Path)) {
            return res.status(500).json({ error: 'PowerShell installer template not found' });
        }

        let script = fs.readFileSync(ps1Path, 'utf-8');
        // Replace all template placeholders with provider-specific values
        script = script.replace(/\{\{API_KEY\}\}/g, key);
        script = script.replace(/INJECTED_API_KEY/g, key); // legacy fallback
        script = script.replace(/\{\{API_URL\}\}/g, process.env.BACKEND_URL || process.env.DC1_BACKEND_URL || 'http://76.13.179.86:8083');
        script = script.replace(/\{\{RUN_MODE\}\}/g, provider.run_mode || 'always-on');
        script = script.replace(/\{\{SCHEDULED_START\}\}/g, provider.scheduled_start || '23:00');
        script = script.replace(/\{\{SCHEDULED_END\}\}/g, provider.scheduled_end || '07:00');

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'inline; filename="daemon.ps1"');
        res.send(script);

    } catch (error) {
        console.error('Windows setup script error:', error);
        res.status(500).json({ error: 'Failed to serve Windows setup script' });
    }
});

// ============================================================================
// GET /api/providers/me - Provider self-service dashboard data
// ============================================================================
router.get('/me', async (req, res) => {
    try {
        const { key } = req.query;
        if (!key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT * FROM providers WHERE api_key = ?', [key]);
        if (!provider) return res.status(404).json({ error: 'Provider not found' });

        // Today and week earnings
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

        const todayEarnings = db.get(
            `SELECT COALESCE(SUM(provider_earned_halala), 0) as total FROM jobs WHERE provider_id = ? AND status = 'completed' AND completed_at >= ?`,
            provider.id, todayStart.toISOString()
        );
        const weekEarnings = db.get(
            `SELECT COALESCE(SUM(provider_earned_halala), 0) as total FROM jobs WHERE provider_id = ? AND status = 'completed' AND completed_at >= ?`,
            provider.id, weekStart.toISOString()
        );

        // Active job
        const activeJob = db.get(
            `SELECT id, job_id, job_type, started_at, cost_halala FROM jobs WHERE provider_id = ? AND status = 'running' LIMIT 1`,
            provider.id
        );

        // Recent completed/failed jobs for activity table
        const recentJobs = db.all(
            `SELECT id, job_id, job_type, status, submitted_at, completed_at, actual_cost_halala, provider_earned_halala, dc1_fee_halala
             FROM jobs WHERE provider_id = ? ORDER BY submitted_at DESC LIMIT 20`,
            provider.id
        );

        // GPU metrics from gpu_status JSON
        let gpuMetrics = { utilization_pct: 0, vram_used_mib: 0, temperature_c: 0 };
        if (provider.gpu_status) {
            try {
                const gs = JSON.parse(provider.gpu_status);
                gpuMetrics = {
                    utilization_pct: gs.utilization_pct || gs.gpu_utilization || 0,
                    vram_used_mib: gs.vram_used_mib || gs.memory_used || 0,
                    temperature_c: gs.temperature_c || gs.temperature || 0
                };
            } catch (_) {}
        }

        // Parse resource_spec JSON for response
        let resourceSpec = null;
        if (provider.resource_spec) {
            try { resourceSpec = JSON.parse(provider.resource_spec); } catch (_) {}
        }

        const payload = {
            provider: {
                id: provider.id,
                name: provider.name,
                status: provider.status,
                gpu_model: provider.gpu_model,
                gpu_vram_mib: provider.gpu_vram_mib || 0,
                gpu_count_reported: provider.gpu_count_reported || 1,
                gpu_compute_capability: provider.gpu_compute_capability || null,
                gpu_cuda_version: provider.gpu_cuda_version || null,
                resource_spec: resourceSpec,
                last_heartbeat: provider.last_heartbeat || null,
                daemon_version: provider.daemon_version || null,
                run_mode: provider.run_mode || 'always-on',
                scheduled_start: provider.scheduled_start || '23:00',
                scheduled_end: provider.scheduled_end || '07:00',
                gpu_usage_cap_pct: provider.gpu_usage_cap_pct != null ? provider.gpu_usage_cap_pct : 80,
                vram_reserve_gb: provider.vram_reserve_gb != null ? provider.vram_reserve_gb : 1,
                temp_limit_c: provider.temp_limit_c != null ? provider.temp_limit_c : 85,
                is_paused: Boolean(provider.is_paused),
                total_earnings_halala: provider.total_earnings ? Math.round(provider.total_earnings * 100) : 0,
                total_jobs: provider.total_jobs || 0,
                uptime_percent: provider.uptime_percent || 0,
                gpu_metrics: gpuMetrics,
                today_earnings_halala: todayEarnings.total,
                week_earnings_halala: weekEarnings.total,
                active_job: activeJob || null
            },
            recent_jobs: recentJobs
        };
        res.json(payload);
    } catch (error) {
        console.error('Provider me error:', error);
        res.status(500).json({ error: 'Failed to fetch provider data' });
    }
});

// ============================================================================
// GET /api/providers/me/metrics - Provider performance dashboard metrics
// ============================================================================
router.get('/me/metrics', (req, res) => {
    try {
        const api_key = req.query.key || req.headers['x-provider-key'];
        if (!api_key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT id, gpu_model FROM providers WHERE api_key = ?', api_key);
        if (!provider) return res.status(404).json({ error: 'Provider not found' });

        const statsRow = db.get(
            `SELECT
                COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS jobs_completed,
                COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS jobs_failed,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(actual_duration_minutes, duration_minutes, 0) ELSE 0 END), 0) AS total_compute_minutes,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(provider_earned_halala, 0) ELSE 0 END), 0) AS earnings_halala,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN COALESCE(actual_duration_minutes, duration_minutes, NULL) END), 0) AS avg_job_duration_minutes
             FROM jobs
             WHERE provider_id = ?`,
            provider.id
        ) || {};

        const hbRow = db.get(
            `SELECT COALESCE(COUNT(*), 0) AS heartbeat_count
             FROM heartbeat_log
             WHERE provider_id = ? AND received_at >= datetime('now', '-7 days')`,
            provider.id
        ) || {};

        // Heartbeat cadence is every ~30s, so 120 heartbeats ~= 1 hour.
        const uptimeHoursLast7d = Number(((hbRow.heartbeat_count || 0) / 120).toFixed(2));

        const recentJobs = db.all(
            `SELECT
                job_id,
                job_type,
                status,
                COALESCE(actual_duration_minutes, duration_minutes, 0) AS duration_minutes,
                COALESCE(provider_earned_halala, 0) AS earnings_halala,
                completed_at
             FROM jobs
             WHERE provider_id = ? AND status = 'completed'
             ORDER BY datetime(completed_at) DESC
             LIMIT 10`,
            provider.id
        );

        const earningsHalala = Number(statsRow.earnings_halala || 0);
        const response = {
            provider_id: provider.id,
            gpu_model: provider.gpu_model || null,
            stats: {
                jobs_completed: Number(statsRow.jobs_completed || 0),
                jobs_failed: Number(statsRow.jobs_failed || 0),
                total_compute_minutes: Number(statsRow.total_compute_minutes || 0),
                earnings_halala: earningsHalala,
                earnings_sar: Number((earningsHalala / 100).toFixed(2)),
                uptime_hours_last_7d: uptimeHoursLast7d,
                avg_job_duration_minutes: Number(Number(statsRow.avg_job_duration_minutes || 0).toFixed(2)),
            },
            recent_jobs: recentJobs,
        };

        return res.json(response);
    } catch (error) {
        console.error('Provider metrics error:', error);
        return res.status(500).json({ error: 'Failed to fetch provider metrics' });
    }
});

// ============================================================================
// POST /api/providers/pause - Pause provider
// ============================================================================
router.post('/pause', async (req, res) => {
    try {
        const { key } = req.body;
        if (!key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT * FROM providers WHERE api_key = ?', [key]);
        if (!provider) return res.status(404).json({ error: 'Provider not found' });

        runStatement('UPDATE providers SET status = ?, is_paused = 1 WHERE id = ?', 'paused', provider.id);
        res.json({ success: true, status: 'paused' });
    } catch (error) {
        console.error('Pause error:', error);
        res.status(500).json({ error: 'Pause failed' });
    }
});

// ============================================================================
// POST /api/providers/resume - Resume provider
// ============================================================================
router.post('/resume', async (req, res) => {
    try {
        const { key } = req.body;
        if (!key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT * FROM providers WHERE api_key = ?', [key]);
        if (!provider) return res.status(404).json({ error: 'Provider not found' });

        const lastHb = provider.last_heartbeat ? new Date(provider.last_heartbeat) : null;
        const isRecent = lastHb && (Date.now() - lastHb.getTime()) < 60000;
        const newStatus = isRecent ? 'online' : 'connected';

        runStatement('UPDATE providers SET status = ?, is_paused = 0 WHERE id = ?', newStatus, provider.id);
        res.json({ success: true, status: newStatus });
    } catch (error) {
        console.error('Resume error:', error);
        res.status(500).json({ error: 'Resume failed' });
    }
});

// ============================================================================
// POST /api/providers/preferences - Update provider preferences
// ============================================================================
router.post('/preferences', async (req, res) => {
    try {
        const { key, run_mode, scheduled_start, scheduled_end, gpu_usage_cap_pct, vram_reserve_gb, temp_limit_c } = req.body;
        const cleanKey = normalizeString(key, { maxLen: 128, trim: false });
        if (!cleanKey) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT * FROM providers WHERE api_key = ?', [cleanKey]);
        if (!provider) return res.status(404).json({ error: 'Provider not found' });

        // Validate
        const validModes = ['always-on', 'manual', 'scheduled'];
        const cleanRunMode = run_mode == null ? null : normalizeString(run_mode, { maxLen: 24 });
        if (cleanRunMode && !validModes.includes(cleanRunMode)) {
            return res.status(400).json({ error: 'Invalid run_mode' });
        }
        const usageCap = gpu_usage_cap_pct == null
            ? null
            : toFiniteNumber(gpu_usage_cap_pct, { min: 0, max: 100 });
        if (gpu_usage_cap_pct != null && usageCap == null) {
            return res.status(400).json({ error: 'gpu_usage_cap_pct must be 0-100' });
        }
        const vramReserve = vram_reserve_gb == null
            ? null
            : toFiniteNumber(vram_reserve_gb, { min: 0, max: 16 });
        if (vram_reserve_gb != null && vramReserve == null) {
            return res.status(400).json({ error: 'vram_reserve_gb must be 0-16' });
        }
        const tempLimit = temp_limit_c == null
            ? null
            : toFiniteNumber(temp_limit_c, { min: 50, max: 100 });
        if (temp_limit_c != null && tempLimit == null) {
            return res.status(400).json({ error: 'temp_limit_c must be 50-100' });
        }

        const updates = {
            run_mode: cleanRunMode || provider.run_mode || 'always-on',
            scheduled_start: normalizeString(scheduled_start, { maxLen: 5 }) || provider.scheduled_start || '23:00',
            scheduled_end: normalizeString(scheduled_end, { maxLen: 5 }) || provider.scheduled_end || '07:00',
            gpu_usage_cap_pct: usageCap != null ? usageCap : (provider.gpu_usage_cap_pct != null ? provider.gpu_usage_cap_pct : 80),
            vram_reserve_gb: vramReserve != null ? vramReserve : (provider.vram_reserve_gb != null ? provider.vram_reserve_gb : 1),
            temp_limit_c: tempLimit != null ? tempLimit : (provider.temp_limit_c != null ? provider.temp_limit_c : 85)
        };

        runStatement(
            `UPDATE providers SET run_mode = ?, scheduled_start = ?, scheduled_end = ?, gpu_usage_cap_pct = ?, vram_reserve_gb = ?, temp_limit_c = ? WHERE id = ?`,
            updates.run_mode, updates.scheduled_start, updates.scheduled_end, updates.gpu_usage_cap_pct, updates.vram_reserve_gb, updates.temp_limit_c, provider.id
        );

        res.json({ success: true, preferences: updates });
    } catch (error) {
        console.error('Preferences error:', error);
        res.status(500).json({ error: 'Preferences update failed' });
    }
});

// ============================================================================
// GET /api/providers/download - Download daemon installer with injected key
// ============================================================================
router.get('/download', async (req, res) => {
    try {
        const { key, platform } = req.query;
        if (!key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT * FROM providers WHERE api_key = ?', [key]);
        if (!provider) return res.status(404).json({ error: 'Provider not found' });

        const isUnix = platform === 'linux' || platform === 'mac' || platform === 'darwin';
        const templateFile = isUnix ? 'daemon.sh' : 'daemon.ps1';
        const downloadName = isUnix ? 'dc1-setup.sh' : 'dc1-setup.ps1';
        const templatePath = path.join(__dirname, '../../installers', templateFile);

        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ error: 'Installer template not found' });
        }

        let script = fs.readFileSync(templatePath, 'utf-8');
        script = script.replace(/\{\{API_KEY\}\}/g, key);
        script = script.replace(/\{\{RUN_MODE\}\}/g, provider.run_mode || 'always-on');
        script = script.replace(/\{\{SCHEDULED_START\}\}/g, provider.scheduled_start || '23:00');
        script = script.replace(/\{\{SCHEDULED_END\}\}/g, provider.scheduled_end || '07:00');

        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(script);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

// ============================================================================
// GET /api/providers/daemon/windows
// Canonical Windows installer endpoint used by dcp.sa download page
// ============================================================================
function sendWindowsInstaller(res) {
    if (fs.existsSync(WINDOWS_INSTALLER_PATH)) {
        res.setHeader('Content-Disposition', 'attachment; filename="dc1-provider-setup.exe"');
        res.setHeader('Content-Type', 'application/octet-stream');
        return res.sendFile(WINDOWS_INSTALLER_PATH);
    }
    return res.status(404).json({
        error: 'Installer not yet built',
        message: 'makensis is required to build backend/installers/dc1-provider-Windows.nsi',
        build_docs: '/docs/build-installer.md',
        powershell_alternative: '/api/providers/setup-windows?key=YOUR_KEY'
    });
}

router.get('/daemon/windows', (req, res) => {
    return sendWindowsInstaller(res);
});

// ============================================================================
// GET /api/providers/daemon/linux
// Curl-able Linux setup entrypoint: curl -sSL .../daemon/linux | bash
// ============================================================================
router.get('/daemon/linux', (req, res) => {
    if (!fs.existsSync(LINUX_INSTALL_SCRIPT_PATH)) {
        return res.status(404).json({
            error: 'Linux install script not found',
            expected_path: 'backend/public/install.sh'
        });
    }

    res.setHeader('Content-Type', 'text/x-shellscript; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="install.sh"');
    return res.sendFile(LINUX_INSTALL_SCRIPT_PATH);
});

// ============================================================================
// GET /api/providers/download-windows-exe
// Returns the generic Windows .exe installer (asks for API key during install)
// ============================================================================
router.get('/download-windows-exe', (req, res) => {
    return sendWindowsInstaller(res);
});

// ============================================================================
// POST /api/providers/readiness - Daemon reports system check results
// ============================================================================
router.post('/readiness', (req, res) => {
    try {
        const { api_key, checks, daemon_version } = req.body;
        const cleanApiKey = normalizeString(api_key, { maxLen: 128, trim: false });
        if (!cleanApiKey) return res.status(400).json({ error: 'API key required' });
        if (checks != null && !isPlainObject(checks)) {
            return res.status(400).json({ error: 'checks must be an object' });
        }

        const provider = db.get('SELECT id FROM providers WHERE api_key = ?', cleanApiKey);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        // checks = { cuda: bool, pytorch: bool, vram_gb: number, driver: string, ... }
        const vramGb = toFiniteNumber(checks?.vram_gb, { min: 0, max: 1024 });
        const allPassed = !!checks && checks.cuda === true && checks.pytorch === true && vramGb != null && vramGb >= 4;
        const status = allPassed ? 'ready' : 'failed';

        runStatement(
            `UPDATE providers SET readiness_status = ?, readiness_details = ?, daemon_version = ?, updated_at = ? WHERE id = ?`,
            status, JSON.stringify(checks || {}), normalizeString(daemon_version, { maxLen: 32 }) || null, new Date().toISOString(), provider.id
        );

        res.json({ success: true, readiness_status: status, checks });
    } catch (error) {
        console.error('Readiness check error:', error);
        res.status(500).json({ error: 'Readiness check failed' });
    }
});

// ============================================================================
// GET /api/providers/:api_key/jobs - Daemon polls for assigned pending jobs
// ============================================================================
router.get('/:api_key/jobs', (req, res) => {
    try {
        const { api_key } = req.params;
        const provider = db.get('SELECT id, readiness_status FROM providers WHERE api_key = ?', api_key);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        // Find next pending job using priority routing (higher first, FIFO tie-breaker)
        const job = db.get(
            `SELECT id, job_id, job_type, model, priority, task_spec, task_spec_hmac, gpu_requirements, duration_minutes, max_duration_seconds
             FROM jobs WHERE provider_id = ? AND status = 'pending'
             ORDER BY COALESCE(priority, 5) DESC, created_at ASC LIMIT 1`,
            provider.id
        );

        if (!job) {
            return res.json({ job: null });
        }

        // Mark as picked up
        const now = new Date().toISOString();
        runStatement(
            `UPDATE jobs SET picked_up_at = ?, status = 'running', started_at = COALESCE(started_at, ?),
             timeout_at = datetime(?, '+' || COALESCE(max_duration_seconds, 600) || ' seconds')
             WHERE id = ?`,
            now, now, now, job.id
        );
        runStatement(`UPDATE providers SET current_job_id = ? WHERE id = ?`, job.job_id, provider.id);

        // Parse task_spec if it's a string
        let taskSpec = job.task_spec;
        try { taskSpec = JSON.parse(taskSpec); } catch {}

        res.json({
            job: {
                id: job.id,
                job_id: job.job_id,
                job_type: job.job_type,
                model: job.model || null,
                priority: Number.isInteger(job.priority) ? job.priority : 5,
                task_spec: taskSpec,
                task_spec_hmac: job.task_spec_hmac,
                gpu_requirements: job.gpu_requirements ? JSON.parse(job.gpu_requirements) : null,
                duration_minutes: job.duration_minutes,
                max_duration_seconds: job.max_duration_seconds || 600
            }
        });
    } catch (error) {
        console.error('Job poll error:', error);
        res.status(500).json({ error: 'Job poll failed' });
    }
});

// ============================================================================
// POST /api/providers/job-result - Daemon submits completed job result
// ============================================================================
router.post('/job-result', (req, res) => {
    try {
        const { api_key, job_id, result, success, error: jobError, metrics } = req.body;
        const cleanApiKey = normalizeString(api_key, { maxLen: 128, trim: false });
        const cleanJobId = normalizeString(job_id, { maxLen: 80, trim: true });
        if (!cleanApiKey || !cleanJobId) return res.status(400).json({ error: 'api_key and job_id required' });

        const provider = db.get('SELECT id FROM providers WHERE api_key = ?', cleanApiKey);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        const job = db.get('SELECT * FROM jobs WHERE job_id = ? AND provider_id = ?', cleanJobId, provider.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        if (job.status !== 'running') return res.json({ success: true, message: `Job already settled (${job.status})` });

        const now = new Date().toISOString();
        const successFlag = success === true || success === 'true' || success === 1;
        const newStatus = successFlag ? 'completed' : 'failed';

        // Calculate actual duration and billing
        const startedAt = job.started_at || job.submitted_at;
        const actualMinutes = startedAt ? Math.ceil((Date.now() - new Date(startedAt).getTime()) / 60000) : job.duration_minutes || 0;

        // Billing rates (halala/minute) — use shared COST_RATES from jobs module
        const ratePerMin = COST_RATES[job.job_type] || COST_RATES['default'];
        const actualCostHalala = actualMinutes * ratePerMin;
        const providerEarned = Math.floor(actualCostHalala * 0.75);
        const dc1Fee = actualCostHalala - providerEarned;

        runStatement(
            `UPDATE jobs SET status = ?, result = ?, error = ?, completed_at = ?,
             actual_duration_minutes = ?, actual_cost_halala = ?,
             provider_earned_halala = ?, dc1_fee_halala = ?
             WHERE id = ?`,
            newStatus, typeof result === 'string' ? result : JSON.stringify(result || {}), jobError || null, now,
            actualMinutes, actualCostHalala, providerEarned, dc1Fee, job.id
        );

        // Update provider stats
        if (success) {
            runStatement(
                `UPDATE providers SET total_earnings = total_earnings + ?, claimable_earnings_halala = claimable_earnings_halala + ?, total_jobs = total_jobs + 1, current_job_id = NULL WHERE id = ?`,
                providerEarned / 100, providerEarned, provider.id  // total_earnings is in SAR, claimable in halala
            );
        } else {
            runStatement(`UPDATE providers SET current_job_id = NULL WHERE id = ?`, provider.id);
        }

        // ── Release escrow to provider (or back to renter on failure) ──
        if (success) {
            runStatement(
                `UPDATE escrow_holds SET status = 'released_provider', resolved_at = ? WHERE job_id = ? AND status IN ('held','locked')`,
                now, job_id
            );
        } else {
            runStatement(
                `UPDATE escrow_holds SET status = 'released_renter', resolved_at = ? WHERE job_id = ? AND status IN ('held','locked')`,
                now, job_id
            );
        }

        // ── Renter billing settlement ──────────────────────────────────
        // Pre-pay hold was deducted at submit time (cost_halala).
        // Now settle: refund difference if actual < estimated, or charge extra.
        if (job.renter_id) {
            const estimatedCost = job.cost_halala || 0;
            const delta = estimatedCost - actualCostHalala; // positive = refund, negative = extra charge
            if (delta !== 0) {
                runStatement(
                    `UPDATE renters SET balance_halala = balance_halala + ? WHERE id = ?`,
                    delta, job.renter_id
                );
            }
            // Update renter spending stats
            runStatement(
                `UPDATE renters SET total_spent_halala = total_spent_halala + ?, total_jobs = total_jobs + 1 WHERE id = ?`,
                actualCostHalala, job.renter_id
            );
        }

        res.json({
            success: true,
            job_id: cleanJobId,
            status: newStatus,
            actual_minutes: actualMinutes,
            cost_halala: actualCostHalala,
            provider_earned_halala: providerEarned,
            dc1_fee_halala: dc1Fee
        });
    } catch (error) {
        console.error('Job result error:', error);
        res.status(500).json({ error: 'Job result submission failed' });
    }
});

// ============================================================================
// GET /api/providers/download/daemon - Serve dc1-daemon.py with injected key
// ============================================================================
router.get('/download/daemon', (req, res) => {
    try {
        const { key, check_only } = req.query;
        if (!key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT id FROM providers WHERE api_key = ?', key);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        const daemonCandidates = [
            path.join(__dirname, '../../installers/dc1_daemon.py'),
            path.join(__dirname, '../../installers/dc1-daemon.py'),
        ];
        const daemonPath = daemonCandidates.find(candidate => fs.existsSync(candidate));
        if (!daemonPath) {
            return res.status(404).json({ error: 'Daemon file not found' });
        }

        // Extract version from the daemon file
        const script = fs.readFileSync(daemonPath, 'utf-8');
        const versionMatch = script.match(/DAEMON_VERSION\s*=\s*"([^"]+)"/);
        const currentVersion = versionMatch ? versionMatch[1] : 'unknown';

        // check_only mode: return version info without downloading the file
        if (check_only === 'true') {
            return res.json({
                version: currentVersion,
                min_version: MIN_DAEMON_VERSION,
                download_url: `/api/providers/download/daemon?key=${key}`,
            });
        }

        // Full download: inject API key, URL, and HMAC secret for task_spec signature verification
        // Supports both placeholder styles: {{API_KEY}} (v3.2.0+) and INJECT_KEY_HERE (legacy)
        const apiUrl = process.env.BACKEND_URL || process.env.DC1_BACKEND_URL || 'http://76.13.179.86:8083';
        const hmacSecret = process.env.DC1_HMAC_SECRET || '';
        let injected = script
            .replace('API_KEY = "{{API_KEY}}"', `API_KEY = "${key}"`)
            .replace('API_URL = "{{API_URL}}"', `API_URL = "${apiUrl}"`)
            .replace('HMAC_SECRET = "{{HMAC_SECRET}}"', `HMAC_SECRET = "${hmacSecret}"`)
            .replace('API_KEY = "INJECT_KEY_HERE"', `API_KEY = "${key}"`)
            .replace('API_URL = "INJECT_URL_HERE"', `API_URL = "${apiUrl}"`);

        const downloadName = path.basename(daemonPath);
        res.setHeader('Content-Type', 'text/x-python');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.send(injected);
    } catch (error) {
        console.error('Daemon download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

// ============================================================================
// GET /api/providers/download/setup - OS-specific setup script with injected key
// ============================================================================
router.get('/download/setup', (req, res) => {
    try {
        const { key, os: osType } = req.query;
        if (!key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT id FROM providers WHERE api_key = ?', key);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        const isWindows = (osType || '').toLowerCase() === 'windows';
        const templateFile = isWindows ? 'dc1-setup-windows.ps1' : 'dc1-setup-unix.sh';
        const templatePath = path.join(__dirname, '../../installers', templateFile);

        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ error: `Setup script ${templateFile} not found` });
        }

        const apiUrl = process.env.BACKEND_URL || process.env.DC1_BACKEND_URL || 'http://76.13.179.86:8083';
        let script = fs.readFileSync(templatePath, 'utf-8');
        script = script.replace(/INJECT_KEY_HERE/g, key);
        script = script.replace(/INJECT_URL_HERE/g, apiUrl);

        const contentType = isWindows ? 'text/plain' : 'text/x-shellscript';
        const filename = isWindows ? 'dc1-setup.ps1' : 'dc1-setup.sh';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(script);
    } catch (error) {
        console.error('Setup download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

// ============================================================================
// GET /api/providers/earnings — Provider checks earnings balance
// ============================================================================
router.get('/earnings', (req, res) => {
    try {
        const api_key = req.query.key || req.headers['x-provider-key'];
        if (!api_key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get(
            'SELECT id, name, total_earnings, total_jobs, claimable_earnings_halala FROM providers WHERE api_key = ?',
            api_key
        );
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        // Get pending withdrawal amount (in halala — convert from SAR column)
        const pending = db.get(
            `SELECT COALESCE(SUM(amount_sar), 0) as pending_sar FROM withdrawals WHERE provider_id = ? AND status = 'pending'`,
            provider.id
        ) || { pending_sar: 0 };

        // Get completed withdrawals total
        const completed = db.get(
            `SELECT COALESCE(SUM(amount_sar), 0) as withdrawn_sar FROM withdrawals WHERE provider_id = ? AND status = 'completed'`,
            provider.id
        ) || { withdrawn_sar: 0 };

        // Prefer escrow-based halala tracking (DCP-32); fall back to total_earnings SAR for pre-escrow providers
        const claimableHalala = provider.claimable_earnings_halala || 0;
        const totalEarnedHalala = claimableHalala > 0
            ? claimableHalala
            : Math.round((provider.total_earnings || 0) * 100);
        const pendingHalala = Math.round((pending.pending_sar || 0) * 100);
        const withdrawnHalala = Math.round((completed.withdrawn_sar || 0) * 100);
        const availableHalala = Math.max(0, totalEarnedHalala - pendingHalala - withdrawnHalala);

        // Escrow breakdown: active holds and recent releases
        const escrowSummary = db.get(
            `SELECT
               COUNT(CASE WHEN status = 'held' THEN 1 END) as held_count,
               COALESCE(SUM(CASE WHEN status = 'held' THEN amount_halala END), 0) as held_halala,
               COUNT(CASE WHEN status = 'locked' THEN 1 END) as locked_count,
               COALESCE(SUM(CASE WHEN status = 'locked' THEN amount_halala END), 0) as locked_halala
             FROM escrow_holds WHERE provider_id = ?`,
            provider.id
        ) || {};

        res.json({
            provider_id: provider.id,
            name: provider.name,
            total_earned_sar: provider.total_earnings,
            total_earned_halala: totalEarnedHalala,
            claimable_earnings_halala: claimableHalala,
            pending_withdrawal_sar: pending.pending_sar || 0,
            withdrawn_sar: completed.withdrawn_sar || 0,
            available_sar: (availableHalala / 100).toFixed(2),
            available_halala: availableHalala,
            total_jobs: provider.total_jobs,
            escrow: {
                held_jobs: escrowSummary.held_count || 0,
                held_halala: escrowSummary.held_halala || 0,
                locked_jobs: escrowSummary.locked_count || 0,
                locked_halala: escrowSummary.locked_halala || 0,
            }
        });
    } catch (error) {
        console.error('Earnings check error:', error);
        res.status(500).json({ error: 'Earnings check failed' });
    }
});

// ============================================================================
// POST /api/providers/withdraw — Provider requests earnings withdrawal
// ============================================================================
router.post('/withdraw', (req, res) => {
    try {
        const { api_key, amount_sar, payout_method, payout_details } = req.body;
        const cleanApiKey = normalizeString(api_key, { maxLen: 128, trim: false });
        if (!cleanApiKey) return res.status(400).json({ error: 'api_key required' });

        const provider = db.get(
            'SELECT id, name, total_earnings, claimable_earnings_halala FROM providers WHERE api_key = ?',
            cleanApiKey
        );
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        const amountSar = toFiniteNumber(amount_sar, { min: 0.01, max: 1000000 });
        if (amountSar == null) {
            return res.status(400).json({ error: 'amount_sar must be > 0' });
        }

        // Minimum withdrawal: 10 SAR
        if (amountSar < 10) {
            return res.status(400).json({ error: 'Minimum withdrawal is 10 SAR' });
        }

        // Compute available balance using escrow-based halala tracking (DCP-32)
        const pending = db.get(
            `SELECT COALESCE(SUM(amount_sar), 0) as pending_sar FROM withdrawals WHERE provider_id = ? AND status = 'pending'`,
            provider.id
        ) || { pending_sar: 0 };

        const completed = db.get(
            `SELECT COALESCE(SUM(amount_sar), 0) as withdrawn_sar FROM withdrawals WHERE provider_id = ? AND status = 'completed'`,
            provider.id
        ) || { withdrawn_sar: 0 };

        // Prefer escrow-based halala balance; fall back to total_earnings SAR for legacy providers
        const claimableHalala = provider.claimable_earnings_halala || 0;
        const totalEarnedHalala = claimableHalala > 0
            ? claimableHalala
            : Math.round((provider.total_earnings || 0) * 100);
        const pendingHalala = Math.round((pending.pending_sar || 0) * 100);
        const withdrawnHalala = Math.round((completed.withdrawn_sar || 0) * 100);
        const availableHalala = Math.max(0, totalEarnedHalala - pendingHalala - withdrawnHalala);
        const availableSar = availableHalala / 100;

        if (amountSar > availableSar) {
            return res.status(402).json({
                error: 'Insufficient available earnings',
                available_sar: availableSar.toFixed(2),
                available_halala: availableHalala,
                requested_sar: amountSar
            });
        }

        const now = new Date().toISOString();
        const withdrawal_id = 'wd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

        runStatement(
            `INSERT INTO withdrawals (withdrawal_id, provider_id, amount_sar, payout_method, payout_details, status, requested_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
            withdrawal_id, provider.id, amountSar,
            normalizeString(payout_method, { maxLen: 50 }) || 'bank_transfer',
            payout_details && (typeof payout_details === 'string' || isPlainObject(payout_details))
                ? JSON.stringify(payout_details)
                : null,
            now
        );

        res.status(201).json({
            success: true,
            withdrawal_id,
            amount_sar: amountSar,
            status: 'pending',
            message: 'Withdrawal request submitted. Processing takes 1-3 business days.'
        });
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ error: 'Withdrawal request failed' });
    }
});

// ============================================================================
// GET /api/providers/job-history — Provider's completed job history with earnings
// ============================================================================
router.get('/job-history', (req, res) => {
    try {
        const api_key = req.query.key || req.headers['x-provider-key'];
        if (!api_key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT id, name FROM providers WHERE api_key = ?', api_key);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;

        const jobs = db.all(
            `SELECT j.id, j.job_id, j.job_type, j.status, j.submitted_at, j.started_at,
                    j.completed_at, j.progress_phase, j.error,
                    j.actual_cost_halala, j.cost_halala,
                    j.provider_earned_halala, j.dc1_fee_halala,
                    j.actual_duration_minutes, j.duration_minutes,
                    r.name as renter_name
             FROM jobs j
             LEFT JOIN renters r ON j.renter_id = r.id
             WHERE j.provider_id = ? AND j.status IN ('completed', 'failed', 'cancelled')
             ORDER BY j.completed_at DESC
             LIMIT ? OFFSET ?`,
            provider.id, limit, offset
        );

        const totals = db.get(
            `SELECT COUNT(*) as total_jobs,
                    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed_jobs,
                    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed_jobs,
                    COALESCE(SUM(CASE WHEN status='completed' THEN provider_earned_halala ELSE 0 END), 0) as total_earned_halala
             FROM jobs WHERE provider_id = ?`,
            provider.id
        );

        res.json({
            provider_id: provider.id,
            ...totals,
            total_earned_sar: ((totals.total_earned_halala || 0) / 100).toFixed(2),
            success_rate: totals.total_jobs > 0
                ? Math.round((totals.completed_jobs / totals.total_jobs) * 100)
                : 0,
            jobs: jobs.map(j => ({
                ...j,
                earned_sar: j.provider_earned_halala ? (j.provider_earned_halala / 100).toFixed(2) : '0.00',
                cost_sar: j.actual_cost_halala ? (j.actual_cost_halala / 100).toFixed(2) : '0.00'
            }))
        });
    } catch (error) {
        console.error('Provider job history error:', error);
        res.status(500).json({ error: 'Failed to fetch job history' });
    }
});

// ============================================================================
// GET /api/providers/earnings-daily — Daily earnings breakdown for charts
// ============================================================================
router.get('/earnings-daily', (req, res) => {
    try {
        const api_key = req.query.key || req.headers['x-provider-key'];
        if (!api_key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT id FROM providers WHERE api_key = ?', api_key);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        const days = Math.min(parseInt(req.query.days) || 30, 90);
        const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const daily = db.all(
            `SELECT DATE(completed_at) as day,
                    COUNT(*) as jobs,
                    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed,
                    COALESCE(SUM(CASE WHEN status='completed' THEN provider_earned_halala ELSE 0 END), 0) as earned_halala,
                    COALESCE(SUM(CASE WHEN status='completed' THEN actual_duration_minutes ELSE 0 END), 0) as total_minutes
             FROM jobs
             WHERE provider_id = ? AND completed_at >= ?
             GROUP BY DATE(completed_at)
             ORDER BY day DESC`,
            provider.id, sinceDate
        );

        res.json({
            provider_id: provider.id,
            days_requested: days,
            daily: daily.map(d => ({
                ...d,
                earned_sar: (d.earned_halala / 100).toFixed(2)
            }))
        });
    } catch (error) {
        console.error('Earnings daily error:', error);
        res.status(500).json({ error: 'Failed to fetch daily earnings' });
    }
});

// ============================================================================
// GET /api/providers/daemon-logs — Recent daemon events/logs
// ============================================================================
router.get('/daemon-logs', (req, res) => {
    try {
        const api_key = req.query.key || req.headers['x-provider-key'];
        if (!api_key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT id FROM providers WHERE api_key = ?', api_key);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const severity = req.query.severity; // optional filter: error, warning, info

        let query = `SELECT id, event_type, severity, daemon_version, job_id,
                            hostname, os_info, python_version, details, event_timestamp
                     FROM daemon_events
                     WHERE provider_id = ?`;
        const params = [provider.id];

        if (severity) {
            query += ` AND severity = ?`;
            params.push(severity);
        }

        query += ` ORDER BY event_timestamp DESC LIMIT ?`;
        params.push(limit);

        const events = db.all(query, ...params);

        // Get LIVE daemon info from provider heartbeat (most accurate source)
        const providerRecord = db.get(
            `SELECT gpu_status, last_heartbeat, provider_hostname, status, daemon_version
             FROM providers WHERE id = ?`,
            provider.id
        );

        let daemon_info = null;
        if (providerRecord) {
            const gpu = providerRecord.gpu_status ? JSON.parse(providerRecord.gpu_status) : {};
            daemon_info = {
                version: gpu.daemon_version || providerRecord.daemon_version || null,
                hostname: providerRecord.provider_hostname || gpu.hostname || null,
                os: gpu.os_info || null,
                python: gpu.python_version || null,
                gpu_name: gpu.gpu_name || null,
                gpu_vram_mib: gpu.gpu_vram_mib || null,
                free_vram_mib: gpu.free_vram_mib || null,
                gpu_temp_c: gpu.temp_c || null,
                gpu_util_pct: gpu.gpu_util_pct != null ? gpu.gpu_util_pct : null,
                driver_version: gpu.driver_version || null,
                provider_status: providerRecord.status,
                last_heartbeat: providerRecord.last_heartbeat
            };
        }

        res.json({
            provider_id: provider.id,
            daemon_info,
            events
        });
    } catch (error) {
        console.error('Daemon logs error:', error);
        res.status(500).json({ error: 'Failed to fetch daemon logs' });
    }
});

// ============================================================================
// GET /api/providers/withdrawal-history — Withdrawal requests
// ============================================================================
router.get('/withdrawal-history', (req, res) => {
    try {
        const api_key = req.query.key || req.headers['x-provider-key'];
        if (!api_key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT id FROM providers WHERE api_key = ?', api_key);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        const withdrawals = db.all(
            `SELECT withdrawal_id, amount_sar, payout_method, status, requested_at, processed_at
             FROM withdrawals WHERE provider_id = ?
             ORDER BY requested_at DESC LIMIT 50`,
            provider.id
        );

        res.json({ provider_id: provider.id, withdrawals });
    } catch (error) {
        console.error('Withdrawal history error:', error);
        res.status(500).json({ error: 'Failed to fetch withdrawals' });
    }
});

const MODEL_TIERS = {
    tier8: [
        { model_id: 'llama-3-8b', display_name: 'Llama 3 8B' },
        { model_id: 'mistral-7b', display_name: 'Mistral 7B' },
        { model_id: 'phi-3-mini', display_name: 'Phi-3 Mini' },
    ],
    tier24: [
        { model_id: 'llama-3-70b-q4', display_name: 'Llama 3 70B Q4' },
        { model_id: 'codellama-34b', display_name: 'CodeLlama 34B' },
        { model_id: 'mixtral-8x7b', display_name: 'Mixtral 8x7B' },
    ],
    tier40: [
        { model_id: 'llama-3-70b', display_name: 'Llama 3 70B' },
        { model_id: 'falcon-40b', display_name: 'Falcon 40B' },
        { model_id: 'yi-34b', display_name: 'Yi 34B' },
    ],
};

const MODEL_DISPLAY_OVERRIDES = {
    'llama-3-8b': 'Llama 3 8B',
    'mistral-7b': 'Mistral 7B',
    'phi-3-mini': 'Phi-3 Mini',
    'llama-3-70b-q4': 'Llama 3 70B Q4',
    'codellama-34b': 'CodeLlama 34B',
    'mixtral-8x7b': 'Mixtral 8x7B',
    'llama-3-70b': 'Llama 3 70B',
    'falcon-40b': 'Falcon 40B',
    'yi-34b': 'Yi 34B',
    'meta-llama/meta-llama-3-8b-instruct': 'Llama 3 8B Instruct',
    'mistralai/mistral-7b-instruct-v0.2': 'Mistral 7B Instruct',
    'microsoft/phi-3-mini-4k-instruct': 'Phi-3 Mini Instruct',
};

const MODEL_ALIASES = {
    'meta-llama/meta-llama-3-8b-instruct': 'llama-3-8b',
    'meta-llama/llama-3-8b-instruct': 'llama-3-8b',
    'mistralai/mistral-7b-instruct-v0.2': 'mistral-7b',
    'microsoft/phi-3-mini-4k-instruct': 'phi-3-mini',
};

function safeJsonParse(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (_) {
        return null;
    }
}

function toDisplayName(modelId) {
    const known = MODEL_DISPLAY_OVERRIDES[String(modelId).toLowerCase()];
    if (known) return known;
    return String(modelId)
        .split('/')
        .pop()
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function normalizeModelId(modelId) {
    const cleaned = String(modelId || '').trim();
    if (!cleaned) return null;
    const lower = cleaned.toLowerCase();
    return MODEL_ALIASES[lower] || lower;
}

function inferVramGb(provider) {
    if (Number.isFinite(provider.gpu_vram_mib) && provider.gpu_vram_mib > 0) {
        return provider.gpu_vram_mib / 1024;
    }
    if (Number.isFinite(provider.vram_gb) && provider.vram_gb > 0) {
        return provider.vram_gb;
    }
    const resourceSpec = safeJsonParse(provider.resource_spec);
    const gpuResource = Array.isArray(resourceSpec?.resources)
        ? resourceSpec.resources.find(r => String(r?.type || '').toLowerCase() === 'gpu')
        : null;
    if (!gpuResource) return 0;
    const candidates = [
        gpuResource.vram_gb,
        gpuResource.memory_gb,
        gpuResource.total_memory_gb,
        gpuResource.total_gb,
        gpuResource.total,
    ];
    const firstGb = candidates.find(v => Number.isFinite(Number(v)) && Number(v) > 0);
    if (firstGb != null) return Number(firstGb);
    if (Number.isFinite(Number(gpuResource.memory_mib)) && Number(gpuResource.memory_mib) > 0) {
        return Number(gpuResource.memory_mib) / 1024;
    }
    return 0;
}

function getFallbackModelsForVram(vramGb) {
    if (vramGb >= 40) return MODEL_TIERS.tier40;
    if (vramGb >= 24) return MODEL_TIERS.tier24;
    if (vramGb >= 8) return MODEL_TIERS.tier8;
    return [];
}

function extractProviderModels(provider) {
    const parsed = safeJsonParse(provider.cached_models);
    let models = [];
    if (Array.isArray(parsed)) {
        models = parsed;
    } else if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.models)) models = parsed.models;
        else if (Array.isArray(parsed.supported_models)) models = parsed.supported_models;
        else if (Array.isArray(parsed.vllm_models)) models = parsed.vllm_models;
    }

    const normalized = new Map();
    models.forEach(item => {
        const rawModelId = typeof item === 'string'
            ? item
            : item?.model_id || item?.model || item?.id || item?.name;
        const modelId = normalizeModelId(rawModelId);
        if (!modelId) return;
        normalized.set(modelId, {
            model_id: modelId,
            display_name: (item && item.display_name) || toDisplayName(modelId),
        });
    });

    if (normalized.size > 0) return Array.from(normalized.values());
    return getFallbackModelsForVram(inferVramGb(provider));
}

// ============================================================================
// Graduated provider status thresholds (seconds since last heartbeat)
// Used by /models and /available to compute online | degraded | offline status.
// ============================================================================
const HEARTBEAT_ONLINE_THRESHOLD_S   = 120;   // < 2 min  → online   (green)
const HEARTBEAT_DEGRADED_THRESHOLD_S = 600;   // 2–10 min → degraded (yellow, still bookable)
                                               // > 10 min → offline  (excluded)

/**
 * Compute graduated availability status from the age of the last heartbeat.
 * @param {string|null} lastHeartbeat  ISO-8601 timestamp from providers.last_heartbeat
 * @param {number}      now            Current epoch ms (Date.now())
 * @returns {{ status: 'online'|'degraded'|'offline', heartbeat_age_seconds: number|null, degraded_since: string|null }}
 */
function computeProviderStatus(lastHeartbeat, now) {
    if (!lastHeartbeat) {
        return { status: 'offline', heartbeat_age_seconds: null, degraded_since: null };
    }
    const ageMs = now - new Date(lastHeartbeat).getTime();
    const ageSecs = Math.floor(ageMs / 1000);
    if (ageSecs < HEARTBEAT_ONLINE_THRESHOLD_S) {
        return { status: 'online', heartbeat_age_seconds: ageSecs, degraded_since: null };
    }
    if (ageSecs < HEARTBEAT_DEGRADED_THRESHOLD_S) {
        // degraded_since = moment the provider crossed the 2-minute threshold
        const degradedSince = new Date(new Date(lastHeartbeat).getTime() + HEARTBEAT_ONLINE_THRESHOLD_S * 1000).toISOString();
        return { status: 'degraded', heartbeat_age_seconds: ageSecs, degraded_since: degradedSince };
    }
    return { status: 'offline', heartbeat_age_seconds: ageSecs, degraded_since: null };
}

// ============================================================================
// GET /api/providers/models — Public aggregate of available vLLM models
// ============================================================================
router.get('/models', (req, res) => {
    try {
        const providers = db.all(
            `SELECT id, status, is_paused, gpu_vram_mib, vram_gb, cached_models, resource_spec, last_heartbeat
             FROM providers
             WHERE is_paused = 0 AND last_heartbeat IS NOT NULL`
        );

        const llmRateHalalaPerMin = COST_RATES['llm-inference']
            || COST_RATES.llm_inference
            || COST_RATES.vllm_serve
            || COST_RATES.default
            || 10;

        const now = Date.now();
        const modelMap = new Map();

        providers.forEach(provider => {
            // Only include providers whose heartbeat is recent enough (online or degraded)
            const { status: providerStatus } = computeProviderStatus(provider.last_heartbeat, now);
            if (providerStatus === 'offline') return;

            const providerVramGb = inferVramGb(provider);
            const providerModels = extractProviderModels(provider);

            providerModels.forEach(model => {
                const existing = modelMap.get(model.model_id);
                if (!existing) {
                    modelMap.set(model.model_id, {
                        model_id: model.model_id,
                        display_name: model.display_name || toDisplayName(model.model_id),
                        provider_ids: new Set([provider.id]),
                        min_price_sar_per_hr: (llmRateHalalaPerMin * 60) / 100,
                        max_vram_available_gb: providerVramGb,
                        sample_provider_id: String(provider.id),
                    });
                    return;
                }

                existing.provider_ids.add(provider.id);
                existing.max_vram_available_gb = Math.max(existing.max_vram_available_gb || 0, providerVramGb || 0);
            });
        });

        const models = Array.from(modelMap.values())
            .map(m => ({
                model_id: m.model_id,
                display_name: m.display_name,
                providers_count: m.provider_ids.size,
                min_price_sar_per_hr: Number(m.min_price_sar_per_hr.toFixed(2)),
                max_vram_available_gb: Number((m.max_vram_available_gb || 0).toFixed(1)),
                sample_provider_id: m.sample_provider_id,
            }))
            .sort((a, b) => b.providers_count - a.providers_count || a.model_id.localeCompare(b.model_id));

        res.json({ models, total: models.length });
    } catch (error) {
        console.error('Provider models aggregation error:', error);
        res.status(500).json({ error: 'Failed to fetch provider models' });
    }
});

// ============================================================================
// POST /api/providers/rotate-key — Rotate API key (provider self-service)
// ============================================================================
router.post('/rotate-key', (req, res) => {
    try {
        const key = req.headers['x-provider-key'] || req.query.key;
        if (!key) return res.status(400).json({ error: 'Current API key required (x-provider-key header or key query)' });

        const provider = db.get('SELECT * FROM providers WHERE api_key = ?', [key]);
        if (!provider) return res.status(404).json({ error: 'Provider not found' });

        const newKey = 'dc1-provider-' + crypto.randomBytes(16).toString('hex');
        runStatement('UPDATE providers SET api_key = ?, updated_at = ? WHERE id = ?',
            newKey, new Date().toISOString(), provider.id);

        res.json({
            success: true,
            message: 'API key rotated. Save the new key — the old one is now invalid.',
            api_key: newKey,
            provider_id: provider.id
        });
    } catch (error) {
        console.error('Provider key rotation error:', error);
        res.status(500).json({ error: 'Key rotation failed' });
    }
});

// ============================================================================
// GET /api/providers/available — Renter marketplace: all online providers with full GPU specs
// Public endpoint (renter key preferred but not required for browsing)
// Returns GPU model, VRAM, CUDA version, compute capability, cost rates, availability
// ============================================================================
router.get('/available', (req, res) => {
    try {
        const { COST_RATES } = require('./jobs');
        // Fetch all non-paused providers that have ever sent a heartbeat.
        // Graduated status (online/degraded/offline) is computed in JS from heartbeat age,
        // so we do NOT filter by status column here — the DB status column is only updated
        // when a heartbeat arrives (→ 'online'), not when the provider goes silent.
        const providers = db.all(
            `SELECT id, name, gpu_model, gpu_name_detected, gpu_vram_mib, gpu_driver,
                    gpu_compute_capability, gpu_cuda_version, gpu_count_reported, gpu_spec_json,
                    status, location, run_mode, reliability_score, reputation_score,
                    cached_models, last_heartbeat, uptime_percent, total_jobs, is_paused,
                    created_at
             FROM providers
             WHERE is_paused = 0 AND last_heartbeat IS NOT NULL
             ORDER BY reputation_score DESC NULLS LAST, gpu_vram_mib DESC NULLS LAST`
        );

        const now = Date.now();
        const mapped = providers.reduce((acc, p) => {
            const { status: computedStatus, heartbeat_age_seconds, degraded_since } =
                computeProviderStatus(p.last_heartbeat, now);

            // Exclude truly offline providers from the marketplace listing
            if (computedStatus === 'offline') return acc;

            let cachedModels = [];
            if (p.cached_models) { try { cachedModels = JSON.parse(p.cached_models); } catch {} }

            let gpuSpec = null;
            if (p.gpu_spec_json) { try { gpuSpec = JSON.parse(p.gpu_spec_json); } catch {} }

            acc.push({
                id: p.id,
                name: p.name,
                // GPU spec
                gpu_model: p.gpu_name_detected || p.gpu_model,
                vram_gb: p.gpu_vram_mib ? Math.round(p.gpu_vram_mib / 1024 * 10) / 10 : null,
                vram_mib: p.gpu_vram_mib,
                gpu_count: p.gpu_count_reported || 1,
                driver_version: p.gpu_driver,
                compute_capability: p.gpu_compute_capability,
                cuda_version: p.gpu_cuda_version,
                gpu_spec: gpuSpec,
                // Graduated availability status
                status: computedStatus,           // "online" | "degraded"
                is_live: computedStatus === 'online',
                heartbeat_age_seconds,
                degraded_since,                   // ISO timestamp when degraded began; null if online
                location: p.location,
                run_mode: p.run_mode,
                // Quality
                reliability_score: p.reliability_score,
                reputation_score: p.reputation_score ?? 100,
                uptime_percent: p.uptime_percent,
                total_jobs_completed: p.total_jobs,
                cached_models: cachedModels,
                // Pricing (halala per minute by job type)
                cost_rates_halala_per_min: COST_RATES,
            });

            return acc;
        }, []);

        // Degrade sort: online providers first, then degraded, both sub-sorted by reputation
        mapped.sort((a, b) => {
            if (a.status !== b.status) return a.status === 'online' ? -1 : 1;
            return (b.reputation_score ?? 100) - (a.reputation_score ?? 100);
        });

        res.json({
            providers: mapped,
            total: mapped.length,
            online_count: mapped.filter(p => p.status === 'online').length,
            degraded_count: mapped.filter(p => p.status === 'degraded').length,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Available providers error:', error);
        res.status(500).json({ error: 'Failed to fetch available providers' });
    }
});

// ============================================================================
// GET /api/providers/marketplace — Public provider cards for marketplace page
// Returns only online providers with minimal card fields (no auth required)
// ============================================================================
router.get('/marketplace', marketplaceLimiter, (req, res) => {
    try {
        const defaultPrice = COST_RATES.default || 10;
        const providers = db.all(
            `SELECT id, gpu_model, gpu_name_detected, gpu_vram_mib, vram_gb, uptime_percent, total_jobs
             FROM providers
             WHERE status = 'online' AND COALESCE(is_paused, 0) = 0
             ORDER BY COALESCE(reputation_score, 0) DESC, id DESC`
        );

        const payload = providers.map((p) => ({
            id: p.id,
            gpu_model: p.gpu_name_detected || p.gpu_model || 'Unknown GPU',
            vram_gb: p.vram_gb != null
                ? Number(p.vram_gb)
                : (p.gpu_vram_mib != null ? Math.round((p.gpu_vram_mib / 1024) * 10) / 10 : null),
            price_per_min_halala: defaultPrice,
            uptime_pct: p.uptime_percent != null ? Number(p.uptime_percent) : 0,
            jobs_completed: p.total_jobs != null ? Number(p.total_jobs) : 0,
        }));

        res.json(payload);
    } catch (error) {
        console.error('Marketplace providers error:', error);
        res.status(500).json({ error: 'Failed to fetch marketplace providers' });
    }
});

// ============================================================================
// GET /api/providers/:id/benchmarks — Most recent benchmark result for provider
// ============================================================================
router.get('/:id/benchmarks', benchmarkLimiter, (req, res) => {
    try {
        const isAdminReq = (() => {
            const provided = req.headers['x-admin-token'] || '';
            const expected = process.env.DC1_ADMIN_TOKEN;
            return !!expected && provided === expected;
        })();

        const providerId = parseInt(req.params.id, 10);
        if (!Number.isFinite(providerId)) {
            return res.status(400).json({ error: 'Provider id must be a number' });
        }

        if (!isAdminReq) {
            const key = req.headers['x-provider-key'] || req.query.key;
            if (!key) return res.status(401).json({ error: 'API key required' });
            const own = db.get('SELECT id FROM providers WHERE api_key = ?', key);
            if (!own || own.id !== providerId) return res.status(403).json({ error: 'Forbidden' });
        }

        const provider = db.get('SELECT id FROM providers WHERE id = ?', providerId);
        if (!provider) {
            return res.status(404).json({ error: 'Provider not found' });
        }

        const benchmarkJob = db.get(
            `SELECT job_id
             FROM jobs
             WHERE provider_id = ? AND job_type = 'benchmark' AND status = 'completed' AND result IS NOT NULL
             ORDER BY datetime(COALESCE(completed_at, submitted_at)) DESC, id DESC
             LIMIT 1`,
            providerId
        );

        if (!benchmarkJob) {
            return res.status(404).json({ error: 'No benchmark found for this provider' });
        }

        const benchmark = getBenchmarkResult(benchmarkJob.job_id);
        if (!benchmark) {
            return res.status(404).json({ error: 'Benchmark data unavailable' });
        }

        res.json({
            provider_id: providerId,
            benchmark,
        });
    } catch (error) {
        console.error('Provider benchmark fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch provider benchmark' });
    }
});

// ============================================================================
// GET /api/providers/:id/gpu-metrics — GPU metric history for charts and monitoring
// Returns last N heartbeat samples with GPU utilization, temp, VRAM, multi-GPU JSON
// Auth: provider key (own data) or admin token
// Query params: limit (default 60, max 1440), since (ISO timestamp)
// ============================================================================
router.get('/:id/gpu-metrics', (req, res) => {
    try {
        const isAdminReq = (() => {
            const provided = req.headers['x-admin-token'] || '';
            const expected = process.env.DC1_ADMIN_TOKEN;
            return !!expected && provided === expected;
        })();

        const providerIdParam = req.params.id;

        // Allow provider to fetch own metrics by numeric ID or 'me'
        let provider;
        if (providerIdParam === 'me') {
            const key = req.headers['x-provider-key'] || req.query.key;
            if (!key) return res.status(401).json({ error: 'API key required' });
            provider = db.get('SELECT id, gpu_name_detected, gpu_vram_mib, gpu_count_reported, gpu_spec_json FROM providers WHERE api_key = ?', key);
        } else {
            provider = db.get('SELECT id, gpu_name_detected, gpu_vram_mib, gpu_count_reported, gpu_spec_json FROM providers WHERE id = ?', providerIdParam);
            if (provider && !isAdminReq) {
                // Non-admin must supply own key
                const key = req.headers['x-provider-key'] || req.query.key;
                const own = key ? db.get('SELECT id FROM providers WHERE api_key = ?', key) : null;
                if (!own || own.id !== provider.id) return res.status(403).json({ error: 'Forbidden' });
            }
        }

        if (!provider) return res.status(404).json({ error: 'Provider not found' });

        const limit = Math.min(parseInt(req.query.limit) || 60, 1440);
        const since = req.query.since || null;

        let samples;
        if (since) {
            samples = db.all(
                `SELECT received_at, gpu_util_pct, gpu_temp_c, gpu_power_w, gpu_vram_free_mib, gpu_vram_total_mib, gpu_metrics_json, gpu_count
                 FROM heartbeat_log WHERE provider_id = ? AND received_at > ?
                 ORDER BY received_at DESC LIMIT ?`,
                provider.id, since, limit
            );
        } else {
            samples = db.all(
                `SELECT received_at, gpu_util_pct, gpu_temp_c, gpu_power_w, gpu_vram_free_mib, gpu_vram_total_mib, gpu_metrics_json, gpu_count
                 FROM heartbeat_log WHERE provider_id = ?
                 ORDER BY received_at DESC LIMIT ?`,
                provider.id, limit
            );
        }

        // Parse gpu_metrics_json inline
        const parsed = samples.map(s => ({
            ...s,
            all_gpus: s.gpu_metrics_json ? (() => { try { return JSON.parse(s.gpu_metrics_json); } catch { return null; } })() : null,
            gpu_metrics_json: undefined,
        }));

        res.json({
            provider_id: provider.id,
            gpu_name: provider.gpu_name_detected,
            gpu_vram_mib: provider.gpu_vram_mib,
            gpu_count: provider.gpu_count_reported || 1,
            gpu_spec: provider.gpu_spec_json ? (() => { try { return JSON.parse(provider.gpu_spec_json); } catch { return null; } })() : null,
            samples: parsed,
            sample_count: parsed.length,
        });
    } catch (error) {
        console.error('GPU metrics error:', error);
        res.status(500).json({ error: 'Failed to fetch GPU metrics' });
    }
});

// ============================================================================
// DELETE /api/providers/me — PDPL right to erasure (soft delete)
// Anonymizes PII while preserving job records for financial audit trail.
// Auth: x-provider-key header or key query param
// ============================================================================
router.delete('/me', (req, res) => {
    try {
        const key = req.headers['x-provider-key'] || req.query.key;
        if (!key) return res.status(400).json({ error: 'API key required (x-provider-key header or key query)' });

        const provider = db.get('SELECT id, status FROM providers WHERE api_key = ?', key);
        if (!provider) return res.status(404).json({ error: 'Provider not found' });
        if (provider.status === 'deleted') return res.status(410).json({ error: 'Account already deleted' });

        const now = new Date().toISOString();
        const anonId = 'deleted-' + provider.id;

        // Soft delete: anonymize all PII columns, invalidate key, mark deleted
        runStatement(
            `UPDATE providers SET
               name        = ?,
               email       = ?,
               phone       = NULL,
               api_key     = ?,
               status      = 'deleted',
               ip_address  = NULL,
               hostname    = NULL,
               updated_at  = ?
             WHERE id = ?`,
            anonId,
            anonId + '@deleted.invalid',
            'revoked-' + crypto.randomBytes(8).toString('hex'),
            now,
            provider.id
        );

        // Job records are intentionally retained with provider_id for financial audit (SAMA 7-year req)
        console.log(`[pdpl] Provider ${provider.id} account deleted and PII anonymized`);

        res.json({
            success: true,
            message: 'Your account has been deleted and personal data anonymized in accordance with PDPL. Financial records are retained for 7 years as required by SAMA regulations.',
            deleted_at: now,
        });
    } catch (error) {
        console.error('Provider delete error:', error);
        res.status(500).json({ error: 'Account deletion failed' });
    }
});

module.exports = router;
