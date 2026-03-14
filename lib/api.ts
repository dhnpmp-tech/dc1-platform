/**
 * DC1 Platform API utilities
 *
 * Centralizes API base URL logic and auth helpers.
 * On production (https), uses the Vercel proxy at /api/dc1.
 * On local dev (http), hits the VPS directly.
 */

const VPS_DIRECT = 'http://76.13.179.86:8083/api';
const PROXY_PATH = '/api/dc1';

/** Mission Control API */
const MC_DIRECT = 'http://76.13.179.86:8084/api';

/**
 * Returns the correct API base URL for the current environment.
 * - Production (Vercel): /api/dc1  (proxied via next.config.js)
 * - Local dev: direct VPS URL
 */
export function getApiBase(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return PROXY_PATH;
  }
  return VPS_DIRECT;
}

/**
 * Returns the Mission Control API base URL.
 */
export function getMcBase(): string {
  return (process.env.NEXT_PUBLIC_MC_URL || MC_DIRECT.replace('/api', '')) + '/api';
}

/**
 * Returns the Mission Control auth token.
 */
export function getMcToken(): string {
  return process.env.NEXT_PUBLIC_MC_TOKEN || 'dc1-mc-gate0-2026';
}

/**
 * Returns the admin token from localStorage, or null if not logged in.
 */
export function getAdminToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') : null;
}

/**
 * Returns the provider API key from localStorage, or null.
 */
export function getProviderKey(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('dc1_provider_key') : null;
}

/**
 * Returns the renter API key from localStorage, or null.
 */
export function getRenterKey(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('dc1_renter_key') : null;
}
