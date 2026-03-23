const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../db');
const { publicEndpointLimiter } = require('../middleware/rateLimiter');

// Templates are stored as JSON files in /docker-templates at the repo root
const TEMPLATES_DIR = path.join(__dirname, '../../../docker-templates');

// Collect all approved images across all templates (for daemon whitelist)
const APPROVED_IMAGES_EXTRA = [
  'dc1/general-worker:latest',
  'dc1/llm-worker:latest',
  'dc1/sd-worker:latest',
  'dc1/base-worker:latest',
  'pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime',
  'pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime',
  'nvcr.io/nvidia/pytorch:24.01-py3',
  'nvcr.io/nvidia/tensorflow:24.01-tf2-py3',
  'tensorflow/tensorflow:2.15.0-gpu',
];

function loadTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  try {
    return fs.readdirSync(TEMPLATES_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
  } catch {
    return [];
  }
}

// Category → tag mappings for the ?category= filter
const CATEGORY_TAG_MAP = {
  llm:       ['llm', 'inference', 'chat', 'instruct', 'arabic'],
  embedding: ['embedding', 'embed', 'rag'],
  image:     ['image', 'diffusion', 'sdxl', 'stable-diffusion'],
  notebook:  ['notebook', 'jupyter', 'python', 'scientific'],
  training:  ['training', 'finetune', 'lora', 'qlora'],
};

// GET /api/templates — list all templates (optionally filter by tag or category)
router.get('/', publicEndpointLimiter, (req, res) => {
  const templates = loadTemplates();
  const { tag, category } = req.query;

  let filtered = templates;
  if (tag) {
    filtered = filtered.filter(t => Array.isArray(t.tags) && t.tags.includes(tag));
  }
  if (category) {
    const catKey = String(category).toLowerCase();
    const catTags = CATEGORY_TAG_MAP[catKey];
    if (catTags) {
      filtered = filtered.filter(t =>
        // Match on template category field directly, or by tag intersection
        t.category === catKey ||
        (Array.isArray(t.tags) && catTags.some(ct => t.tags.includes(ct)))
      );
    }
  }

  // Strip approved_images from list response (security — returned only on whitelist endpoint)
  const safe = filtered.map(({ approved_images: _ai, ...t }) => t);
  res.json({ templates: safe, count: safe.length });
});

// GET /api/templates/whitelist — approved Docker image list for daemon validation
router.get('/whitelist', publicEndpointLimiter, (req, res) => {
  const templates = loadTemplates();
  const fromTemplates = templates.flatMap(t => t.approved_images || []);
  const fromImages = templates.map(t => t.image).filter(i => i && i !== 'custom');
  let approvedFromDb = [];
  try {
    approvedFromDb = db.all(
      `SELECT image_ref, resolved_digest
         FROM approved_container_images
        WHERE is_active = 1
        ORDER BY approved_at DESC`
    ).flatMap((row) => {
      const refs = [];
      if (row.image_ref) refs.push(row.image_ref);
      if (row.image_ref && row.resolved_digest) refs.push(`${String(row.image_ref).split('@')[0]}@${row.resolved_digest}`);
      return refs;
    });
  } catch (_) {
    approvedFromDb = [];
  }

  const all = [...new Set([...APPROVED_IMAGES_EXTRA, ...fromImages, ...fromTemplates, ...approvedFromDb])];
  res.json({ approved_images: all });
});

// GET /api/templates/:id — single template with full detail
router.get('/:id', publicEndpointLimiter, (req, res) => {
  const templates = loadTemplates();
  const template = templates.find(t => t.id === req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  // Strip approved_images from direct response too — daemon uses /whitelist
  const { approved_images: _ai, ...safe } = template;
  res.json(safe);
});

module.exports = router;
