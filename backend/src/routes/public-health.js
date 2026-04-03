const express = require('express');
const router = express.Router();
const db = require('../db');
const { buildDaemonHealthSummary } = require('../services/daemonHealthSummary');

// Public-safe reliability snapshot (no API keys, no provider identifiers).
router.get('/reliability', (_req, res) => {
  try {
    const summary = buildDaemonHealthSummary(db);
    res.json(summary);
  } catch (error) {
    console.error('Public reliability summary error:', error);
    res.status(500).json({ error: 'Failed to fetch reliability summary' });
  }
});

module.exports = router;
