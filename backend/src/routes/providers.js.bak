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
router.post('/heartbeat', async (req, res) => {
    try {
        const { api_key, gpu_status, uptime, provider_ip, provider_hostname } = req.body;
        
        // Verify API key
        const provider = await db.get(
            'SELECT * FROM providers WHERE api_key = ?',
            [api_key]
        );
        
        if (!provider) {
            return res.status(401).json({ error: 'Invalid API key' });
        }
        
        // Update provider status
        const result = await db.run(
            `UPDATE providers 
             SET gpu_status = ?, provider_ip = ?, provider_hostname = ?, last_heartbeat = ?, status = ?
             WHERE api_key = ?`,
            [
                JSON.stringify(gpu_status),
                provider_ip,
                provider_hostname,
                new Date().toISOString(),
                'online',
                api_key
            ]
        );
        
        res.json({
            success: true,
            message: 'Heartbeat received',
            timestamp: new Date().toISOString()
        });
        
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

module.exports = router;
