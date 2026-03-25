const { supabase } = require('../supabase');

const SITE_URL = (process.env.FRONTEND_URL || 'https://dcp.sa').replace(/\/+$/, '');

/**
 * Send OTP code via Supabase Auth
 * @param {string} email  normalized email
 * @returns {{ success: boolean, error?: string }}
 */
async function sendOtp(email) {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${SITE_URL}/auth/callback`,
      }
    });

    if (error) {
      console.error('[AUTH] Supabase OTP send error:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[AUTH] OTP sent to ${email}`);
    return { success: true };
  } catch (err) {
    console.error('[AUTH] OTP send exception:', err.message);
    return { success: false, error: 'Failed to send verification code' };
  }
}

/**
 * Verify OTP code via Supabase Auth
 * For NEW (unconfirmed) users, signInWithOtp stores a confirmation_token  type 'email'.
 * For EXISTING (confirmed) users, signInWithOtp stores a recovery_token  type 'magiclink'.
 * We try 'email' first, then fall back to 'magiclink' to handle both cases.
 * @param {string} email  normalized email
 * @param {string} token  6-digit OTP code
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
async function verifyOtp(email, token) {
  try {
    // First try type 'email' (works for new/unconfirmed users)
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: token.trim(),
      type: 'email'
    });

    if (!error) {
      console.log(`[AUTH] OTP verified for ${email} (type: email)`);
      return { success: true, user: data.user };
    }

    // If 'email' type failed with token-related error, try 'magiclink'
    // (works for existing confirmed users where token is stored as recovery_token)
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      console.log(`[AUTH] OTP type 'email' failed, trying 'magiclink' for ${email}`);
      const { data: data2, error: error2 } = await supabase.auth.verifyOtp({
        email,
        token: token.trim(),
        type: 'magiclink'
      });

      if (!error2) {
        console.log(`[AUTH] OTP verified for ${email} (type: magiclink)`);
        return { success: true, user: data2.user };
      }

      console.error('[AUTH] OTP verify error (both types failed):', error2.message);
      return { success: false, error: error2.message };
    }

    console.error('[AUTH] OTP verify error:', error.message);
    return { success: false, error: error.message };
  } catch (err) {
    console.error('[AUTH] OTP verify exception:', err.message);
    return { success: false, error: 'Verification failed' };
  }
}

module.exports = { sendOtp, verifyOtp };
