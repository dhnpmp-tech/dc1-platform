module.exports = {
  apps: [
    {
      name: 'dc1-provider-onboarding',
      script: 'src/server.js',
      cwd: '/root/dc1-platform/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        DC1_PROVIDER_PORT: 8083,

        // ── Auth ────────────────────────────────────────────────────────────
        // ROTATE THIS — default token is exposed in source control
        DC1_ADMIN_TOKEN: '9ca7c4f924374229b9c9f584758f055373878dfce3fea309ff192d638756342b',

        // ── HMAC Job Signing (DCP-3) ─────────────────────────────────────────
        // REQUIRED — generate with: openssl rand -hex 32
        // Without this, daemon downloads get empty HMAC secret and job signing is broken
        DC1_HMAC_SECRET: 'CHANGE_ME_openssl_rand_hex_32',

        // ── Moyasar Payment Gateway (DCP-31) ────────────────────────────────
        // Get keys from: https://dashboard.moyasar.com/settings/api-keys
        // Test key prefix: sk_test_  |  Live key prefix: sk_live_
        MOYASAR_SECRET_KEY: 'CHANGE_ME_sk_test_or_sk_live_key',
        // Webhook HMAC secret from Moyasar dashboard (defaults to MOYASAR_SECRET_KEY if unset)
        MOYASAR_WEBHOOK_SECRET: 'CHANGE_ME_moyasar_webhook_secret',

        // ── Frontend URL (for Moyasar payment callbacks) ─────────────────────
        FRONTEND_URL: 'https://dc1st.com',

        // ── CORS Extra Origins ────────────────────────────────────────────────
        // dc1st.com is the live frontend domain — must be in CORS allowlist
        CORS_ORIGINS: 'https://dc1st.com,https://www.dc1st.com',

        // ── Backend URL (injected into daemon downloads) ──────────────────────
        // Set to HTTPS once api.dcp.sa DNS + SSL setup is complete
        BACKEND_URL: 'http://76.13.179.86:8083'
      }
    }
  ]
};
