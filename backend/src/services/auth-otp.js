// Supabase Auth OTP helpers for magic link login
// Uses Supabase's built-in signInWithOtp / verifyOtp
const { supabase } = require('../supabase');

/**
 * Send OTP code to email via Supabase Auth
 * @param {string} email - normalized email
 * @returns {{ success: boolean, error?: string }}
 */
async function sendOtp(email) {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
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
 * @param {string} email - normalized email
 * @param {string} token - 6-digit OTP code
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
async function verifyOtp(email, token) {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: token.trim(),
      type: 'email'
    });

    if (error) {
      console.error('[AUTH] OTP verify error:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[AUTH] OTP verified for ${email}`);
    return { success: true, user: data.user };
  } catch (err) {
    console.error('[AUTH] OTP verify exception:', err.message);
    return { success: false, error: 'Verification failed' };
  }
}

module.exports = { sendOtp, verifyOtp };
