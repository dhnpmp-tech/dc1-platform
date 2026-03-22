const express = require('express');
const db = require('../db');

const router = express.Router();

const VALID_CATEGORIES = new Set([
  'general',
  'account',
  'billing',
  'provider',
  'renter',
  'bug',
  'enterprise',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

db.run(`
  CREATE TABLE IF NOT EXISTS support_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    source TEXT,
    provider_state TEXT,
    created_at TEXT NOT NULL
  )
`);
db.run(`CREATE INDEX IF NOT EXISTS idx_support_contacts_created_at ON support_contacts(created_at DESC)`);

// POST /api/support/contact
router.post('/contact', (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const category = String(req.body?.category || '').trim().toLowerCase();
    const message = String(req.body?.message || '').trim();
    const source = String(req.body?.source || '').trim().slice(0, 80) || null;
    const providerState = String(req.body?.provider_state || '').trim().slice(0, 40) || null;

    if (!name || !email || !category || !message) {
      return res.status(400).json({ error: 'name, email, category, and message are required' });
    }
    if (name.length > 120) {
      return res.status(400).json({ error: 'name must be 120 characters or less' });
    }
    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'email must be a valid address' });
    }
    if (!VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ error: 'category is invalid' });
    }
    if (message.length < 10) {
      return res.status(400).json({ error: 'message must be at least 10 characters' });
    }
    if (message.length > 5000) {
      return res.status(400).json({ error: 'message must be 5000 characters or less' });
    }

    const now = new Date().toISOString();
    const result = db.run(
      `INSERT INTO support_contacts (name, email, category, message, source, provider_state, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      name,
      email,
      category,
      message,
      source,
      providerState,
      now
    );

    return res.status(201).json({
      success: true,
      contact_id: Number(result.lastInsertRowid),
      created_at: now,
    });
  } catch (error) {
    console.error('[support] Failed to submit support contact:', error?.message || error);
    return res.status(500).json({ error: 'Failed to submit support request' });
  }
});

module.exports = router;
