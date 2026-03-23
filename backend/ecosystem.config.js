module.exports = {
  apps: [
    {
      name: 'dc1-provider-onboarding',
      script: '/bin/sh',
      args: '-lc "/root/dc1-platform/infra/setup-model-cache.sh && node src/server.js"',
      cwd: '/root/dc1-platform/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '/root/dc1-platform/backend/logs/error.log',
      out_file: '/root/dc1-platform/backend/logs/out.log',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        DC1_PROVIDER_PORT: 8083,

        // ── Auth ────────────────────────────────────────────────────────────
        // REQUIRED — generate with: openssl rand -hex 32
        // Never commit real admin tokens to source control
        DC1_ADMIN_TOKEN: '',  // REQUIRED — set in VPS env; generate: openssl rand -hex 32

        // ── HMAC Job Signing (DCP-3) ─────────────────────────────────────────
        // REQUIRED — generate with: openssl rand -hex 32
        // Without this, daemon downloads get empty HMAC secret and job signing is broken
        DC1_HMAC_SECRET: '',  // REQUIRED — set in VPS env; generate: openssl rand -hex 32

        // ── Moyasar Payment Gateway (DCP-31) ────────────────────────────────
        // Get keys from: https://dashboard.moyasar.com/settings/api-keys
        // Test key prefix: sk_test_  |  Live key prefix: sk_live_
        MOYASAR_SECRET_KEY: '',  // Optional — set for live payments
        // Webhook HMAC secret from Moyasar dashboard (defaults to MOYASAR_SECRET_KEY if unset)
        MOYASAR_WEBHOOK_SECRET: '',  // Optional — set for Moyasar webhook verification

        // ── Frontend URL (for Moyasar payment callbacks) ─────────────────────
        FRONTEND_URL: 'https://dcp.sa',

        // ── CORS Extra Origins ────────────────────────────────────────────────
        // dcp.sa is the live frontend domain — must be in CORS allowlist
        CORS_ORIGINS: 'https://dcp.sa,https://www.dcp.sa',

        // ── Backend URL (injected into daemon downloads) ──────────────────────
        // Set to HTTPS once api.dcp.sa DNS + SSL setup is complete
        BACKEND_URL: process.env.BACKEND_URL || 'https://api.dcp.sa',

        // ── Resend Email Service (DCP-54) ─────────────────────────────────────
        // Get API key from: https://resend.com/api-keys
        // Free tier: 100 emails/day — used for welcome emails on registration
        RESEND_API_KEY: '',  // Optional — set for transactional emails via Resend

        // ── On-chain Escrow / Base L2 (DCP-75) ───────────────────────────────
        // Leave ESCROW_CONTRACT_ADDRESS unset to use off-chain SQLite escrow only.
        // Set all three to enable on-chain settlement via Escrow.sol on Base Sepolia.
        // Deploy contract: cd contracts && npx hardhat run scripts/deploy.js --network base-sepolia
        // Generate oracle key: node -e "const {ethers}=require('ethers'); console.log(ethers.Wallet.createRandom().privateKey)"
        ESCROW_CONTRACT_ADDRESS: '',
        ESCROW_ORACLE_PRIVATE_KEY: '',  // Required if ESCROW_CONTRACT_ADDRESS is set
        BASE_RPC_URL: 'https://sepolia.base.org'
      }
    },
    {
      name: 'dcp-vps-health-cron',
      script: '/bin/bash',
      args: '-lc "/root/dc1-platform/scripts/vps-health.sh >> /root/dc1-platform/backend/logs/vps-health.log 2>&1"',
      cwd: '/root/dc1-platform/backend',
      instances: 1,
      autorestart: false,
      cron_restart: '*/5 * * * *',
      watch: false,
      max_memory_restart: '100M',
      env: {
        NODE_ENV: 'production',

        // Telegram bot token used by scripts/vps-health.sh to send threshold alerts
        TELEGRAM_BOT_TOKEN: ''  // Optional — set for VPS health alert Telegram notifications
      }
    },
    {
      name: 'dcp-job-volume-cleanup-cron',
      script: '/bin/sh',
      args: '-lc "node /root/dc1-platform/backend/src/scripts/cleanup-job-volumes.js >> /root/dc1-platform/backend/logs/volume-cleanup.log 2>&1"',
      cwd: '/root/dc1-platform/backend',
      instances: 1,
      autorestart: false,
      cron_restart: '30 2 * * *',
      watch: false,
      max_memory_restart: '100M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'dcp-stale-provider-sweep-cron',
      script: '/bin/sh',
      args: '-lc "node /root/dc1-platform/backend/src/scripts/sweep-stale-providers.js >> /root/dc1-platform/backend/logs/stale-provider-sweep.log 2>&1"',
      cwd: '/root/dc1-platform/backend',
      instances: 1,
      autorestart: false,
      cron_restart: '*/5 * * * *',
      watch: false,
      max_memory_restart: '100M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
