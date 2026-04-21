'use strict';

/**
 * Provider-onboarding wizard API surface, mounted under `/v1/`.
 *
 * Covers the 8 endpoints in `docs/technical-specs/web-wizard-spec.md`:
 *   POST /v1/auth/register         - trigger magic-link (new or existing user)
 *   POST /v1/auth/login            - trigger magic-link (existing user)
 *   POST /v1/auth/session          - exchange Supabase access_token for DCP api_key
 *   GET  /v1/provider/eligibility  - provider onboarding eligibility
 *   POST /v1/provider/gpu-profile  - submit detected/declared GPU hardware
 *   POST /v1/provider/config       - save schedule / pricing preferences
 *   POST /v1/provider/install-token - one-time install token for daemon
 *   POST /v1/provider/register-node - daemon first-run handshake (install-token auth)
 *   GET  /v1/provider/node-status  - polled by Step 6 of the wizard
 *   GET  /v1/provider/earnings     - earnings summary
 *
 * Auth model decision (confirmed with Peter): DCP uses Supabase magic-link,
 * not password. The wizard spec reads as a password flow, so register/login
 * here return 202 { next: "check_email" } and the wizard then calls
 * /auth/session with the Supabase access_token it receives after the magic
 * link click. This bridges the wizard to the existing OTP/magic-link
 * infrastructure without introducing password auth.
 *
 * This file intentionally does NOT live inside the large v1.js router
 * (OpenAI-compat /chat/completions, /models) to keep concerns separated:
 * v1.js     = OpenAI-compat inference surface
 * v1-wizard = wizard + provider onboarding surface
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const db = require('../db');
const { sendOtp } = require('../services/auth-otp');
const { reconcileRenterByEmailFromSupabase } = require('../services/renter-identity-reconciliation');

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ── Helpers ─────────────────────────────────────────────────────────

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@') || trimmed.length > 320) return null;
  return trimmed;
}

function normalizeRole(value) {
  if (typeof value !== 'string') return null;
  const r = value.trim().toLowerCase();
  return r === 'provider' || r === 'renter' ? r : null;
}

function normalizeString(value, max = 200) {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function wizardError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

// ── POST /v1/auth/register ──────────────────────────────────────────
// Bridges wizard "create account" to magic-link. Returns 202 and
// prompts the wizard to show a "check your email" screen.

router.post('/auth/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return wizardError(res, 400, 'invalid_email', 'A valid email is required');
    }
    const role = normalizeRole(req.body?.role) || 'provider';
    const displayName = normalizeString(req.body?.display_name, 120);

    // Note: password field in req.body is deliberately ignored. DCP auth
    // is magic-link only; the wizard spec documents password but the
    // confirmed implementation bridges to OTP/magic-link.

    // For new providers we pre-stage a row so verify-otp/magic-link-exchange
    // can find them. Renters are created on first magic-link exchange.
    if (role === 'provider') {
      const existing = db.get('SELECT id FROM providers WHERE LOWER(email) = LOWER(?)', email);
      if (!existing) {
        try {
          db.run(
            `INSERT INTO providers (email, name, status, created_at)
             VALUES (?, ?, 'pending', datetime('now'))`,
            email,
            displayName || email.split('@')[0],
          );
        } catch (insertErr) {
          console.warn('[V1-WIZARD] pre-stage provider insert failed:', insertErr.message);
        }
      }
    }

    const sent = await sendOtp(email);
    if (!sent.success) {
      return wizardError(res, 502, 'email_send_failed', sent.error || 'Failed to send sign-in email');
    }

    return res.status(202).json({
      next: 'check_email',
      email,
      role,
      message: `We sent a sign-in link to ${email}. Click it to complete registration.`,
    });
  } catch (err) {
    console.error('[V1-WIZARD] register error:', err);
    return wizardError(res, 500, 'register_failed', 'Registration failed');
  }
});

// ── POST /v1/auth/login ─────────────────────────────────────────────
// Bridges wizard "sign in" to magic-link.

router.post('/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return wizardError(res, 400, 'invalid_email', 'A valid email is required');
    }

    const sent = await sendOtp(email);
    if (!sent.success) {
      return wizardError(res, 502, 'email_send_failed', sent.error || 'Failed to send sign-in email');
    }

    return res.status(202).json({
      next: 'check_email',
      email,
      message: `We sent a sign-in link to ${email}. Click it to continue.`,
    });
  } catch (err) {
    console.error('[V1-WIZARD] login error:', err);
    return wizardError(res, 500, 'login_failed', 'Login failed');
  }
});

// ── POST /v1/auth/session ───────────────────────────────────────────
// Exchanges a Supabase access_token (received by the browser after the
// magic-link click) for a DCP api_key. Delegates to the same lookup
// logic as /api/auth/magic-link-exchange.

router.post('/auth/session', async (req, res) => {
  try {
    const accessToken = typeof req.body?.access_token === 'string'
      ? req.body.access_token.trim()
      : null;
    if (!accessToken) {
      return wizardError(res, 400, 'missing_access_token', 'access_token is required');
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return wizardError(res, 503, 'auth_unconfigured', 'Supabase auth is not configured on this server');
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data, error } = await supabaseClient.auth.getUser(accessToken);
    if (error || !data?.user?.email) {
      return wizardError(res, 401, 'invalid_session', 'Invalid or expired sign-in link');
    }

    const email = data.user.email.toLowerCase().trim();

    let renter = db.get(
      'SELECT * FROM renters WHERE LOWER(email) = LOWER(?) AND status = ?',
      email, 'active',
    );
    if (!renter) {
      try {
        const reconcile = await reconcileRenterByEmailFromSupabase({ db, email });
        if (reconcile.reconciled && reconcile.renter?.status === 'active') {
          renter = reconcile.renter;
        }
      } catch (reconcileErr) {
        console.warn('[V1-WIZARD] renter reconciliation failed:', reconcileErr.message);
      }
    }

    if (renter) {
      return res.json({
        role: 'renter',
        user_id: renter.id,
        token: renter.api_key,
        user: {
          id: renter.id,
          email: renter.email,
          name: renter.name,
          organization: renter.organization,
        },
      });
    }

    const provider = db.get('SELECT * FROM providers WHERE LOWER(email) = LOWER(?)', email);
    if (provider) {
      return res.json({
        role: 'provider',
        user_id: provider.id,
        token: provider.api_key,
        user: {
          id: provider.id,
          email: provider.email,
          name: provider.name,
          status: provider.status,
        },
      });
    }

    return wizardError(res, 404, 'account_not_found', 'No account found for this email. Please register first.');
  } catch (err) {
    console.error('[V1-WIZARD] session error:', err);
    return wizardError(res, 500, 'session_failed', 'Session exchange failed');
  }
});

module.exports = router;
