// Magic link callback exchange  after Supabase verifies a magic link token
// and redirects the browser to /auth/callback, the frontend POSTs here with
// the Supabase access_token.  We verify it server-side (via getUser), look up
// the matching renter/provider in SQLite (with Supabase reconciliation fallback),
// and return their API key + metadata so the frontend can complete login exactly
// as the OTP flow does.

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const db = require('../db');
const { reconcileRenterByEmailFromSupabase } = require('../services/renter-identity-reconciliation');

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

router.post('/magic-link-exchange', async (req, res) => {
  try {
    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ error: 'access_token is required' });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error } = await supabaseClient.auth.getUser(access_token);

    if (error || !user || !user.email) {
      console.error('[AUTH] Magic link exchange - getUser failed:', error?.message);
      return res.status(401).json({ error: 'Invalid or expired magic link session' });
    }

    const email = user.email.toLowerCase().trim();
    console.log('[AUTH] Magic link exchange for ' + email);

    // Try renter first (mirrors /api/renters/verify-otp)
    let renter = db.get(
      'SELECT * FROM renters WHERE LOWER(email) = LOWER(?) AND status = ?',
      email, 'active'
    );

    // Reconciliation fallback: sync from Supabase if not in SQLite
    if (!renter) {
      try {
        const reconciliation = await reconcileRenterByEmailFromSupabase({ db, email });
        if (reconciliation.reconciled && reconciliation.renter && reconciliation.renter.status === 'active') {
          renter = reconciliation.renter;
          console.log('[AUTH] Reconciled renter from Supabase for ' + email);
        }
      } catch (reconcileErr) {
        console.error('[AUTH] Renter reconciliation error:', reconcileErr.message);
      }
    }

    if (renter) {
      return res.json({
        success: true,
        role: 'renter',
        api_key: renter.api_key,
        renter: {
          id: renter.id,
          name: renter.name,
          email: renter.email,
          organization: renter.organization,
          balance_halala: renter.balance_halala,
          total_spent_halala: renter.total_spent_halala,
          total_jobs: renter.total_jobs,
        },
      });
    }

    // Try provider (mirrors /api/providers/verify-otp)
    const provider = db.get(
      'SELECT * FROM providers WHERE LOWER(email) = LOWER(?)',
      email
    );

    if (provider) {
      return res.json({
        success: true,
        role: 'provider',
        api_key: provider.api_key,
        provider: {
          id: provider.id,
          name: provider.name,
          email: provider.email,
          gpu_model: provider.gpu_model,
          status: provider.status,
        },
      });
    }

    return res.status(404).json({
      error: 'No account found for this email. Please register first.',
    });
  } catch (err) {
    console.error('[AUTH] Magic link exchange error:', err);
    res.status(500).json({ error: 'Authentication exchange failed' });
  }
});

module.exports = router;
