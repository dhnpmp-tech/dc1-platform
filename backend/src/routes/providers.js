const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Database (use existing connection)
const db = require('../db');

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
        const { api_key, gpu_status, uptime, provider_ip, provider_hostname } = req.body;
        
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
          gpu_driver = COALESCE(?, gpu_driver)
          WHERE id = ?`,
          JSON.stringify(gpu_status), provider_ip || null, provider_hostname || null, now,
          gpuName, gpuVramMib, gpuDriver, p.id
        );

        db.run(`INSERT INTO heartbeat_log (provider_id, received_at, provider_ip, provider_hostname, gpu_util_pct, gpu_temp_c, gpu_power_w, gpu_vram_free_mib, gpu_vram_total_mib, daemon_version, python_version, os_info)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          p.id, now, provider_ip||null, provider_hostname||null,
          gpuUtil, gpuTemp, gpuPower, gpuFreeVram, gpuVramMib,
          daemonVersion, pythonVersion, osInfo
        );

        return res.json({ success: true, message: 'Heartbeat received', timestamp: now });
        
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ error: 'Heartbeat failed' });
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
        script = script.replace(/INJECTED_API_KEY/g, key);

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

        const isLinux = platform === 'linux';
        const templateFile = isLinux ? 'daemon.sh' : 'daemon.ps1';
        const downloadName = isLinux ? 'dc1-setup.sh' : 'dc1-setup.ps1';
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

module.exports = router;

