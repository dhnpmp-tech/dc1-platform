const express = require('express');
const router = express.Router();
const db = require('../db');
const { listContainerRegistry } = require('../lib/container-registry');

// GET /api/containers/registry
// Public catalog of runnable container images:
// - built-in templates
// - admin-approved custom images
router.get('/registry', (req, res) => {
  try {
    const images = listContainerRegistry(db);
    res.json({ images, total: images.length });
  } catch (error) {
    console.error('Container registry list error:', error);
    res.status(500).json({ error: 'Failed to fetch container registry' });
  }
});

module.exports = router;
