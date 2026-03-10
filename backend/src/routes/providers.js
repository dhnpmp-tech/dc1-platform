const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Database (use existing connection)
const db = require('../db');

// Import shared billing rates from jobs module
const { COST_RATES } = require('./jobs');

// Minimum daemon version required — daemons older than this get update_available: true
const MIN_DAEMON_VERSION = '3.3.0';

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
        const { name, email, gpu_model, os, phone } = req.body;
        
        // Validate inputs
        if (!name || !email || !gpu_model || !os) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Generate unique API key
        const api_key = 'dc1-provider-' + crypto.randomBytes(16).toString('hex');
        
        // Generate unique provider ID
        const provider_id = 'prov-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        // Save to database
        const result = await db.run(
            `INSERT INTO providers (name, email, gpu_model, os, api_key, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, email, gpu_model, os, api_key, 'registered', new Date().toISOString()]
        );
        
        // Generate installer URL
        const installer_url = `/api/providers/installer?key=${api_key}&os=${os}`;
        
        res.json({
            success: true,
            provider_id: result.lastInsertRowid,
            api_key,
            installer_url,
            message: `Welcome ${name}! Your API key is ready. Download the installer to get started.`
        });
        
    } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'A provider with this email already exists' });
    }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
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
// POST /api/providers/heartbeat - Provider heartbeat (GPU status update)
// ============================================================================
router.post('/heartbeat', (req, res) => {
    try {
        const { api_key, gpu_status, uptime, provider_ip, provider_hostname, cached_models } = req.body;

        const gs = gpu_status || {};
        const gpuName = gs.gpu_name || null;
        const gpuVramMib = (gs.gpu_vram_mib != null) ? gs.gpu_vram_mib : null;
        const gpuDriver = gs.driver_version || null;
        const gpuUtil = (gs.gpu_util_pct != null) ? gs.gpu_util_pct : null;
        const gpuTemp = (gs.temp_c != null) ? gs.temp_c : null;
        const gpuPower = (gs.power_w != null) ? gs.power_w : null;
        const gpuFreeVram = (gs.free_vram_mib != null) ? gs.free_vram_mib : null;
        const daemonVersion = gs.daemon_version || null;
        const pythonVersion = gs.python_version || null;
        const osInfo = gs.os_info || null;
        const now = new Date().toISOString();

        // Verify API key (sync — better-sqlite3)
        const p = db.get('SELECT id FROM providers WHERE api_key = ?', api_key);
        if (!p) return res.status(401).json({ error: 'Invalid API key' });

        db.run(`UPDATE providers SET
          gpu_status = ?, provider_ip = ?, provider_hostname = ?, last_heartbeat = ?, status = 'online',
          gpu_name_detected = COALESCE(?, gpu_name_detected),
          gpu_vram_mib = COALESCE(?, gpu_vram_mib),
          gpu_driver = COALESCE(?, gpu_driver),
          cached_models = COALESCE(?, cached_models)
          WHERE id = ?`,
          JSON.stringify(gpu_status), provider_ip || null, provider_hostname || null, now,
          gpuName, gpuVramMib, gpuDriver,
          cached_models ? JSON.stringify(cached_models) : null,
          p.id
        );

        db.run(`INSERT INTO heartbeat_log (provider_id, received_at, provider_ip, provider_hostname, gpu_util_pct, gpu_temp_c, gpu_power_w, gpu_vram_free_mib, gpu_vram_total_mib, daemon_version, python_version, os_info)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          p.id, now, provider_ip||null, provider_hostname||null,
          gpuUtil, gpuTemp, gpuPower, gpuFreeVram, gpuVramMib,
          daemonVersion, pythonVersion, osInfo
        );

        // Store daemon version on provider record for job assignment checks
        if (daemonVersion) {
            db.run('UPDATE providers SET daemon_version = ? WHERE id = ?', daemonVersion, p.id);
        }

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

        if (!api_key || !event_type) {
            return res.status(400).json({ error: 'Missing api_key or event_type' });
        }

        const provider = db.get('SELECT id FROM providers WHERE api_key = ?', api_key);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        db.run(`INSERT INTO daemon_events
            (provider_id, event_type, severity, daemon_version, job_id,
             hostname, os_info, python_version, details, event_timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            provider.id,
            event_type,
            severity || 'info',
            daemon_version || null,
            job_id || null,
            hostname || null,
            os_info || null,
            python_version || null,
            (details || '').substring(0, 5000),  // Cap at 5KB
            timestamp || new Date().toISOString()
        );

        // Log critical events to console for immediate visibility
        if (severity === 'critical' || severity === 'error') {
            console.warn(`[DAEMON EVENT] provider=${provider.id} type=${event_type} severity=${severity}: ${(details || '').substring(0, 200)}`);
        }

        res.json({ success: true, event_type, provider_id: provider.id });

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
            `SELECT COALESCE(SUM(cost_halala), 0) as total FROM jobs WHERE provider_id = ? AND status = 'completed' AND completed_at >= ?`,
            provider.id, todayStart.toISOString()
        );
        const weekEarnings = db.get(
            `SELECT COALESCE(SUM(cost_halala), 0) as total FROM jobs WHERE provider_id = ? AND status = 'completed' AND completed_at >= ?`,
            provider.id, weekStart.toISOString()
        );

        // Active job
        const activeJob = db.get(
            `SELECT id, job_id, job_type, started_at, cost_halala FROM jobs WHERE provider_id = ? AND status = 'running' LIMIT 1`,
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

        res.json({
            provider: {
                id: provider.id,
                name: provider.name,
                status: provider.status,
                gpu_model: provider.gpu_model,
                gpu_vram_mib: provider.gpu_vram_mib || 0,
                last_heartbeat: provider.last_heartbeat || null,
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
            }
        });
    } catch (error) {
        console.error('Provider me error:', error);
        res.status(500).json({ error: 'Failed to fetch provider data' });
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

        db.run('UPDATE providers SET status = ?, is_paused = 1 WHERE id = ?', 'paused', provider.id);
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

        db.run('UPDATE providers SET status = ?, is_paused = 0 WHERE id = ?', newStatus, provider.id);
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
        if (!key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT * FROM providers WHERE api_key = ?', [key]);
        if (!provider) return res.status(404).json({ error: 'Provider not found' });

        // Validate
        const validModes = ['always-on', 'manual', 'scheduled'];
        if (run_mode && !validModes.includes(run_mode)) {
            return res.status(400).json({ error: 'Invalid run_mode' });
        }
        if (gpu_usage_cap_pct != null && (gpu_usage_cap_pct < 0 || gpu_usage_cap_pct > 100)) {
            return res.status(400).json({ error: 'gpu_usage_cap_pct must be 0-100' });
        }
        if (vram_reserve_gb != null && (vram_reserve_gb < 0 || vram_reserve_gb > 16)) {
            return res.status(400).json({ error: 'vram_reserve_gb must be 0-16' });
        }
        if (temp_limit_c != null && (temp_limit_c < 50 || temp_limit_c > 100)) {
            return res.status(400).json({ error: 'temp_limit_c must be 50-100' });
        }

        const updates = {
            run_mode: run_mode || provider.run_mode || 'always-on',
            scheduled_start: scheduled_start || provider.scheduled_start || '23:00',
            scheduled_end: scheduled_end || provider.scheduled_end || '07:00',
            gpu_usage_cap_pct: gpu_usage_cap_pct != null ? gpu_usage_cap_pct : (provider.gpu_usage_cap_pct != null ? provider.gpu_usage_cap_pct : 80),
            vram_reserve_gb: vram_reserve_gb != null ? vram_reserve_gb : (provider.vram_reserve_gb != null ? provider.vram_reserve_gb : 1),
            temp_limit_c: temp_limit_c != null ? temp_limit_c : (provider.temp_limit_c != null ? provider.temp_limit_c : 85)
        };

        db.run(
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
// GET /api/providers/download-windows-exe
// Returns the generic Windows .exe installer (asks for API key during install)
// ============================================================================
router.get('/download-windows-exe', (req, res) => {
    const exePath = path.join(__dirname, '../../installers/dc1-provider-setup-Windows.exe');
    if (fs.existsSync(exePath)) {
        res.setHeader('Content-Disposition', 'attachment; filename="dc1-provider-setup.exe"');
        res.setHeader('Content-Type', 'application/octet-stream');
        return res.sendFile(exePath);
    }
    res.status(404).json({
        error: 'Installer not yet built',
        message: 'Run: makensis backend/installers/dc1-provider-Windows.nsi to build the installer',
        powershell_alternative: '/api/providers/setup-windows?key=YOUR_KEY'
    });
});

// ============================================================================
// POST /api/providers/readiness - Daemon reports system check results
// ============================================================================
router.post('/readiness', (req, res) => {
    try {
        const { api_key, checks, daemon_version } = req.body;
        if (!api_key) return res.status(400).json({ error: 'API key required' });

        const provider = db.get('SELECT id FROM providers WHERE api_key = ?', api_key);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        // checks = { cuda: bool, pytorch: bool, vram_gb: number, driver: string, ... }
        const allPassed = checks && checks.cuda && checks.pytorch && (checks.vram_gb >= 4);
        const status = allPassed ? 'ready' : 'failed';

        db.run(
            `UPDATE providers SET readiness_status = ?, readiness_details = ?, daemon_version = ?, updated_at = ? WHERE id = ?`,
            status, JSON.stringify(checks || {}), daemon_version || null, new Date().toISOString(), provider.id
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

        // Find oldest pending job assigned to this provider
        const job = db.get(
            `SELECT id, job_id, job_type, task_spec, task_spec_hmac, gpu_requirements, duration_minutes, max_duration_seconds
             FROM jobs WHERE provider_id = ? AND status = 'pending'
             ORDER BY submitted_at ASC LIMIT 1`,
            provider.id
        );

        if (!job) {
            return res.json({ job: null });
        }

        // Mark as picked up
        const now = new Date().toISOString();
        db.run(
            `UPDATE jobs SET picked_up_at = ?, status = 'running', started_at = COALESCE(started_at, ?),
             timeout_at = datetime(?, '+' || COALESCE(max_duration_seconds, 600) || ' seconds')
             WHERE id = ?`,
            now, now, now, job.id
        );
        db.run(`UPDATE providers SET current_job_id = ? WHERE id = ?`, job.job_id, provider.id);

        // Parse task_spec if it's a string
        let taskSpec = job.task_spec;
        try { taskSpec = JSON.parse(taskSpec); } catch {}

        res.json({
            job: {
                id: job.id,
                job_id: job.job_id,
                job_type: job.job_type,
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
        if (!api_key || !job_id) return res.status(400).json({ error: 'api_key and job_id required' });

        const provider = db.get('SELECT id FROM providers WHERE api_key = ?', api_key);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        const job = db.get('SELECT * FROM jobs WHERE job_id = ? AND provider_id = ?', job_id, provider.id);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        if (job.status === 'completed') return res.json({ success: true, message: 'Already completed' });

        const now = new Date().toISOString();
        const newStatus = success ? 'completed' : 'failed';

        // Calculate actual duration and billing
        const startedAt = job.started_at || job.submitted_at;
        const actualMinutes = startedAt ? Math.ceil((Date.now() - new Date(startedAt).getTime()) / 60000) : job.duration_minutes || 0;

        // Billing rates (halala/minute) — use shared COST_RATES from jobs module
        const ratePerMin = COST_RATES[job.job_type] || COST_RATES['default'];
        const actualCostHalala = actualMinutes * ratePerMin;
        const providerEarned = Math.floor(actualCostHalala * 0.75);
        const dc1Fee = actualCostHalala - providerEarned;

        db.run(
            `UPDATE jobs SET status = ?, result = ?, error = ?, completed_at = ?,
             actual_duration_minutes = ?, actual_cost_halala = ?,
             provider_earned_halala = ?, dc1_fee_halala = ?
             WHERE id = ?`,
            newStatus, typeof result === 'string' ? result : JSON.stringify(result || {}), jobError || null, now,
            actualMinutes, actualCostHalala, providerEarned, dc1Fee, job.id
        );

        // Update provider stats
        if (success) {
            db.run(
                `UPDATE providers SET total_earnings = total_earnings + ?, total_jobs = total_jobs + 1, current_job_id = NULL WHERE id = ?`,
                providerEarned / 100, provider.id  // total_earnings is in SAR
            );
        } else {
            db.run(`UPDATE providers SET current_job_id = NULL WHERE id = ?`, provider.id);
        }

        // ── Renter billing settlement ──────────────────────────────────
        // Pre-pay hold was deducted at submit time (cost_halala).
        // Now settle: refund difference if actual < estimated, or charge extra.
        if (job.renter_id) {
            const estimatedCost = job.cost_halala || 0;
            const delta = estimatedCost - actualCostHalala; // positive = refund, negative = extra charge
            if (delta !== 0) {
                db.run(
                    `UPDATE renters SET balance_halala = balance_halala + ? WHERE id = ?`,
                    delta, job.renter_id
                );
            }
            // Update renter spending stats
            db.run(
                `UPDATE renters SET total_spent_halala = total_spent_halala + ?, total_jobs = total_jobs + 1 WHERE id = ?`,
                actualCostHalala, job.renter_id
            );
        }

        res.json({
            success: true,
            job_id,
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

        const daemonPath = path.join(__dirname, '../../installers/dc1-daemon.py');
        if (!fs.existsSync(daemonPath)) {
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

        // Full download: inject API key and URL
        // Supports both placeholder styles: {{API_KEY}} (v3.2.0+) and INJECT_KEY_HERE (legacy)
        const apiUrl = process.env.BACKEND_URL || process.env.DC1_BACKEND_URL || 'http://76.13.179.86:8083';
        let injected = script
            .replace('API_KEY = "{{API_KEY}}"', `API_KEY = "${key}"`)
            .replace('API_URL = "{{API_URL}}"', `API_URL = "${apiUrl}"`)
            .replace('API_KEY = "INJECT_KEY_HERE"', `API_KEY = "${key}"`)
            .replace('API_URL = "INJECT_URL_HERE"', `API_URL = "${apiUrl}"`);

        res.setHeader('Content-Type', 'text/x-python');
        res.setHeader('Content-Disposition', 'attachment; filename="dc1-daemon.py"');
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

        const provider = db.get('SELECT id, name, total_earnings, total_jobs FROM providers WHERE api_key = ?', api_key);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        // Get pending withdrawal amount
        const pending = db.get(
            `SELECT COALESCE(SUM(amount_sar), 0) as pending_sar FROM withdrawals WHERE provider_id = ? AND status = 'pending'`,
            provider.id
        ) || { pending_sar: 0 };

        // Get completed withdrawals total
        const completed = db.get(
            `SELECT COALESCE(SUM(amount_sar), 0) as withdrawn_sar FROM withdrawals WHERE provider_id = ? AND status = 'completed'`,
            provider.id
        ) || { withdrawn_sar: 0 };

        const availableSar = provider.total_earnings - (pending.pending_sar || 0) - (completed.withdrawn_sar || 0);

        res.json({
            provider_id: provider.id,
            name: provider.name,
            total_earned_sar: provider.total_earnings,
            pending_withdrawal_sar: pending.pending_sar || 0,
            withdrawn_sar: completed.withdrawn_sar || 0,
            available_sar: Math.max(0, availableSar),
            total_jobs: provider.total_jobs
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
        if (!api_key) return res.status(400).json({ error: 'api_key required' });

        const provider = db.get('SELECT id, name, total_earnings FROM providers WHERE api_key = ?', api_key);
        if (!provider) return res.status(401).json({ error: 'Invalid API key' });

        if (!amount_sar || amount_sar <= 0) {
            return res.status(400).json({ error: 'amount_sar must be > 0' });
        }

        // Minimum withdrawal: 10 SAR
        if (amount_sar < 10) {
            return res.status(400).json({ error: 'Minimum withdrawal is 10 SAR' });
        }

        // Check available balance (total_earnings minus pending/completed withdrawals)
        const pending = db.get(
            `SELECT COALESCE(SUM(amount_sar), 0) as pending_sar FROM withdrawals WHERE provider_id = ? AND status = 'pending'`,
            provider.id
        ) || { pending_sar: 0 };

        const completed = db.get(
            `SELECT COALESCE(SUM(amount_sar), 0) as withdrawn_sar FROM withdrawals WHERE provider_id = ? AND status = 'completed'`,
            provider.id
        ) || { withdrawn_sar: 0 };

        const availableSar = provider.total_earnings - (pending.pending_sar || 0) - (completed.withdrawn_sar || 0);

        if (amount_sar > availableSar) {
            return res.status(402).json({
                error: 'Insufficient available earnings',
                available_sar: Math.max(0, availableSar),
                requested_sar: amount_sar
            });
        }

        const now = new Date().toISOString();
        const withdrawal_id = 'wd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

        db.run(
            `INSERT INTO withdrawals (withdrawal_id, provider_id, amount_sar, payout_method, payout_details, status, requested_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
            withdrawal_id, provider.id, amount_sar,
            payout_method || 'bank_transfer',
            payout_details ? JSON.stringify(payout_details) : null,
            now
        );

        res.status(201).json({
            success: true,
            withdrawal_id,
            amount_sar,
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

module.exports = router;
