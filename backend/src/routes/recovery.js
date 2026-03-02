const express = require('express');
const router = express.Router();
const db = require('../db');
const { runRecoveryCycle } = require('../services/recovery-engine');

// POST /api/recovery/trigger — manually trigger recovery for a job
router.post('/trigger', (req, res) => {
  try {
    const { job_id } = req.body;
    if (!job_id) {
      return res.status(400).json({ error: 'job_id is required' });
    }

    const job = db.get('SELECT * FROM jobs WHERE job_id = ?', job_id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const { findBackupProvider, migrateJob } = require('../services/recovery-engine');
    const backup = findBackupProvider(job.vram_required || 0, job.provider_id);
    const result = migrateJob(job.job_id, job.provider_id, backup ? backup.id : null);

    res.json({ success: true, job_id, recovery_status: result.status });
  } catch (error) {
    console.error('Recovery trigger error:', error);
    res.status(500).json({ error: 'Recovery trigger failed' });
  }
});

// GET /api/recovery/status/:job_id — get recovery status for a job
router.get('/status/:job_id', (req, res) => {
  try {
    const events = db.all(
      'SELECT * FROM recovery_events WHERE job_id = ? ORDER BY started_at DESC',
      req.params.job_id
    );
    res.json({ job_id: req.params.job_id, events });
  } catch (error) {
    res.status(500).json({ error: 'Status fetch failed' });
  }
});

// GET /api/recovery/history — list all recovery events (last 50)
router.get('/history', (req, res) => {
  try {
    const events = db.all(
      'SELECT * FROM recovery_events ORDER BY started_at DESC LIMIT 50'
    );
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: 'History fetch failed' });
  }
});

// GET /api/recovery/stats — aggregate stats
router.get('/stats', (req, res) => {
  try {
    const total = db.get('SELECT COUNT(*) as count FROM recovery_events');
    const success = db.get("SELECT COUNT(*) as count FROM recovery_events WHERE status = 'success'");
    const failed = db.get("SELECT COUNT(*) as count FROM recovery_events WHERE status = 'failed'");
    const noBackup = db.get("SELECT COUNT(*) as count FROM recovery_events WHERE status = 'no_backup'");

    const avgTime = db.get(
      `SELECT AVG(
        (julianday(completed_at) - julianday(started_at)) * 86400
      ) as avg_seconds
      FROM recovery_events
      WHERE completed_at IS NOT NULL`
    );

    const successRate = total.count > 0
      ? ((success.count / total.count) * 100).toFixed(1)
      : 0;

    res.json({
      total_recoveries: total.count,
      successful: success.count,
      failed: failed.count,
      no_backup: noBackup.count,
      avg_recovery_time_seconds: avgTime.avg_seconds ? parseFloat(avgTime.avg_seconds.toFixed(2)) : 0,
      success_rate_percent: parseFloat(successRate),
    });
  } catch (error) {
    res.status(500).json({ error: 'Stats fetch failed' });
  }
});

module.exports = router;
