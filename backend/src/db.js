// DC1 Provider Onboarding - SQLite Database Module
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DC1_DB_PATH || path.join(__dirname, '..', 'data', 'providers.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// ─── TABLE DEFINITIONS (single definition per table, no duplicates) ───

db.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    organization TEXT,
    gpu_model TEXT,
    gpu_count INTEGER DEFAULT 1,
    vram_gb INTEGER,
    vram_mb INTEGER,
    supported_compute_types TEXT,
    gpu_profile_source TEXT DEFAULT 'manual',
    gpu_profile_updated_at TEXT,
    os TEXT DEFAULT 'linux',
    bandwidth_mbps INTEGER,
    storage_tb REAL,
    location TEXT,
    ip_address TEXT,
    cost_per_gpu_second_halala REAL DEFAULT 0.25,
    status TEXT DEFAULT 'pending',
    approval_status TEXT DEFAULT 'pending',
    approved_at TEXT,
    rejected_reason TEXT,
    api_key TEXT,
    notes TEXT,
    container_restart_count INTEGER DEFAULT 0,
    model_cache_disk_mb INTEGER DEFAULT 0,
    model_cache_disk_total_mb INTEGER DEFAULT 0,
    model_cache_disk_used_pct REAL DEFAULT 0,
    model_preload_status TEXT DEFAULT 'none',
    model_preload_model TEXT,
    model_preload_requested_at TEXT,
    model_preload_updated_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE,
    provider_id INTEGER,
    job_type TEXT,
    model TEXT,
    status TEXT DEFAULT 'pending',
    container_id TEXT,
    workspace_volume_name TEXT,
    checkpoint_name TEXT,
    checkpoint_path TEXT,
    checkpoint_enabled INTEGER DEFAULT 0,
    checkpointed_at TEXT,
    vram_required INTEGER DEFAULT 0,
    cost_halala INTEGER DEFAULT 0,
    gpu_requirements TEXT,
    container_spec TEXT,
    notes TEXT,
    submitted_at TEXT,
    started_at TEXT,
    first_token_at TEXT,
    completed_at TEXT,
    updated_at TEXT,
    created_at TEXT,
    duration_minutes INTEGER,
    logs_jsonl TEXT,
    webhook_notified_at TEXT,
    webhook_delivery_status TEXT,
    webhook_delivery_attempts INTEGER DEFAULT 0,
    completion_email_sent_at TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS job_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    started_at TEXT,
    ended_at TEXT,
    exit_code INTEGER,
    log_path TEXT,
    gpu_seconds_used REAL DEFAULT 0,
    cost_halala INTEGER DEFAULT 0
  )
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_job_exec_job_attempt ON job_executions(job_id, attempt_number)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_job_exec_job_id ON job_executions(job_id, started_at DESC)`);

// ─── SERVE SESSIONS TABLE ───
// Tracks active vLLM serving sessions exposed through DC1 proxy.
db.exec(`
  CREATE TABLE IF NOT EXISTS serve_sessions (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL UNIQUE,
    provider_id INTEGER NOT NULL,
    model TEXT NOT NULL,
    port INTEGER NOT NULL,
    provider_ip TEXT,
    endpoint_url TEXT,
    session_token TEXT,
    status TEXT DEFAULT 'starting' CHECK(status IN ('starting','serving','stopped','expired')),
    started_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    stopped_at TEXT,
    last_inference_at TEXT,
    total_inferences INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_billed_halala INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id),
    FOREIGN KEY (job_id) REFERENCES jobs(job_id)
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_serve_sessions_provider ON serve_sessions(provider_id, status)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_serve_sessions_expiry ON serve_sessions(status, expires_at)`);

// ─── COST RATES TABLE ───
// Supports model-specific token rates for vLLM serve billing.
db.exec(`
  CREATE TABLE IF NOT EXISTS cost_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL UNIQUE,
    token_rate_halala INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  )
`);
const nowIso = new Date().toISOString();
try { db.prepare(`INSERT OR IGNORE INTO cost_rates (model, token_rate_halala, is_active, created_at)
   VALUES (?, ?, 1, ?)`).run('__default__', 1, nowIso); } catch(e) {}
try { db.prepare(`INSERT OR IGNORE INTO cost_rates (model, token_rate_halala, is_active, created_at)
   VALUES (?, ?, 1, ?)`).run('mistralai/Mistral-7B-Instruct-v0.2', 2, nowIso); } catch(e) {}
try { db.prepare(`INSERT OR IGNORE INTO cost_rates (model, token_rate_halala, is_active, created_at)
   VALUES (?, ?, 1, ?)`).run('meta-llama/Meta-Llama-3-8B-Instruct', 3, nowIso); } catch(e) {}
try { db.prepare(`INSERT OR IGNORE INTO cost_rates (model, token_rate_halala, is_active, created_at)
   VALUES (?, ?, 1, ?)`).run('microsoft/Phi-3-mini-4k-instruct', 1, nowIso); } catch(e) {}
try { db.prepare(`INSERT OR IGNORE INTO cost_rates (model, token_rate_halala, is_active, created_at)
   VALUES (?, ?, 1, ?)`).run('google/gemma-2b-it', 1, nowIso); } catch(e) {}
try { db.prepare(`INSERT OR IGNORE INTO cost_rates (model, token_rate_halala, is_active, created_at)
   VALUES (?, ?, 1, ?)`).run('TinyLlama/TinyLlama-1.1B-Chat-v1.0', 1, nowIso); } catch(e) {}

// ─── GPU PRICING TABLE ───
// Admin-controlled base rental rates per GPU model in halala/hour.
db.exec(`
  CREATE TABLE IF NOT EXISTS gpu_pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gpu_model TEXT UNIQUE NOT NULL,
    rate_halala INTEGER NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try {
  db.prepare(
    `INSERT OR IGNORE INTO gpu_pricing (gpu_model, rate_halala, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`
  ).run('RTX 3060 Ti', 500);
} catch (e) {}

// ─── MODEL REGISTRY TABLE ───
// Curated model catalog exposed to renters via GET /api/models.
db.exec(`
  CREATE TABLE IF NOT EXISTS model_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    family TEXT NOT NULL,
    vram_gb INTEGER NOT NULL,
    quantization TEXT NOT NULL,
    context_window INTEGER NOT NULL,
    use_cases TEXT NOT NULL,
    min_gpu_vram_gb INTEGER NOT NULL,
    default_price_halala_per_min INTEGER NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )
`);
const modelSeedNow = new Date().toISOString();
try {
  db.prepare(
    `INSERT OR IGNORE INTO model_registry
     (model_id, display_name, family, vram_gb, quantization, context_window, use_cases, min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    'mistralai/Mistral-7B-Instruct-v0.2',
    'Mistral 7B Instruct',
    'mistral',
    14,
    'bf16',
    32768,
    JSON.stringify(['chat', 'coding', 'arabic']),
    16,
    15,
    modelSeedNow
  );
} catch (e) {}
try {
  db.prepare(
    `INSERT OR IGNORE INTO model_registry
     (model_id, display_name, family, vram_gb, quantization, context_window, use_cases, min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    'meta-llama/Meta-Llama-3-8B-Instruct',
    'LLaMA 3 8B Instruct',
    'llama',
    16,
    'bf16',
    8192,
    JSON.stringify(['chat', 'reasoning']),
    16,
    17,
    modelSeedNow
  );
} catch (e) {}
try {
  db.prepare(
    `INSERT OR IGNORE INTO model_registry
     (model_id, display_name, family, vram_gb, quantization, context_window, use_cases, min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    'Qwen/Qwen2-7B-Instruct',
    'Qwen2 7B Instruct',
    'qwen',
    14,
    'bf16',
    32768,
    JSON.stringify(['chat', 'arabic', 'translation']),
    16,
    14,
    modelSeedNow
  );
} catch (e) {}
try {
  db.prepare(
    `INSERT OR IGNORE INTO model_registry
     (model_id, display_name, family, vram_gb, quantization, context_window, use_cases, min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    'microsoft/Phi-3-mini-4k-instruct',
    'Phi-3 Mini',
    'phi',
    4,
    'int4',
    4096,
    JSON.stringify(['chat', 'classification']),
    6,
    8,
    modelSeedNow
  );
} catch (e) {}
try {
  db.prepare(
    `INSERT OR IGNORE INTO model_registry
     (model_id, display_name, family, vram_gb, quantization, context_window, use_cases, min_gpu_vram_gb, default_price_halala_per_min, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
    'DeepSeek R1 7B',
    'deepseek',
    16,
    'bf16',
    32768,
    JSON.stringify(['reasoning', 'coding']),
    16,
    18,
    modelSeedNow
  );
} catch (e) {}

// ─── CONTAINER IMAGE ALLOWLIST ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS allowed_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_ref TEXT NOT NULL UNIQUE,
    image_type TEXT NOT NULL DEFAULT 'custom',
    description TEXT,
    approved_at TEXT NOT NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_allowed_images_approved_at ON allowed_images(approved_at DESC)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS recovery_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    provider_id INTEGER,
    from_provider_id INTEGER,
    to_provider_id INTEGER,
    event_type TEXT,
    reason TEXT,
    status TEXT CHECK(status IN ('pending','success','failed','no_backup')),
    timestamp TEXT,
    details TEXT,
    started_at TEXT,
    completed_at TEXT,
    resolved_at TEXT,
    notes TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS daemon_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER,
    event_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    daemon_version TEXT,
    job_id TEXT,
    hostname TEXT,
    os_info TEXT,
    python_version TEXT,
    details TEXT,
    event_timestamp TEXT,
    received_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS benchmark_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    benchmark_type TEXT NOT NULL CHECK(benchmark_type IN ('quick','standard','full')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed')),
    started_at TEXT,
    completed_at TEXT,
    score_gflops REAL,
    temp_max_celsius REAL,
    vram_used_mib INTEGER,
    latency_ms REAL,
    notes TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS bottleneck_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    trigger TEXT NOT NULL CHECK(trigger IN ('high_utilization','queue_overflow','timeout')),
    utilization_pct REAL,
    jobs_affected INTEGER DEFAULT 0,
    action_taken TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at TEXT NOT NULL,
    jobs_checked INTEGER DEFAULT 0,
    jobs_clean INTEGER DEFAULT 0,
    jobs_flagged INTEGER DEFAULT 0,
    total_collected_halala INTEGER DEFAULT 0,
    total_paid_halala INTEGER DEFAULT 0,
    dc1_margin_halala INTEGER DEFAULT 0,
    notes TEXT
  )
`);

// ─── MIGRATIONS (idempotent — safe to re-run) ───

const migrations = [
  // providers columns
  'ALTER TABLE providers ADD COLUMN gpu_status TEXT',
  'ALTER TABLE providers ADD COLUMN provider_ip TEXT',
  'ALTER TABLE providers ADD COLUMN provider_hostname TEXT',
  'ALTER TABLE providers ADD COLUMN last_heartbeat TEXT',
  'ALTER TABLE providers ADD COLUMN gpu_name_detected TEXT',
  'ALTER TABLE providers ADD COLUMN gpu_vram_mib INTEGER DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN vram_mb INTEGER',
  'ALTER TABLE providers ADD COLUMN gpu_driver TEXT',
  'ALTER TABLE providers ADD COLUMN gpu_compute TEXT',
  'ALTER TABLE providers ADD COLUMN total_earnings REAL DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN total_jobs INTEGER DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN uptime_percent REAL DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN reliability_score INTEGER DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN rotated_at TEXT',
  'ALTER TABLE providers ADD COLUMN cost_per_gpu_second_halala REAL DEFAULT 0.25',
  // jobs columns (for existing DBs that had the old narrow schema)
  'ALTER TABLE jobs ADD COLUMN job_type TEXT',
  'ALTER TABLE jobs ADD COLUMN model TEXT',
  'ALTER TABLE jobs ADD COLUMN cost_halala INTEGER DEFAULT 0',
  'ALTER TABLE jobs ADD COLUMN gpu_requirements TEXT',
  'ALTER TABLE jobs ADD COLUMN container_spec TEXT',
  'ALTER TABLE jobs ADD COLUMN notes TEXT',
  'ALTER TABLE jobs ADD COLUMN submitted_at TEXT',
  'ALTER TABLE jobs ADD COLUMN started_at TEXT',
  'ALTER TABLE jobs ADD COLUMN completed_at TEXT',
  'ALTER TABLE jobs ADD COLUMN duration_minutes INTEGER',
  'ALTER TABLE jobs ADD COLUMN container_id TEXT',
  'ALTER TABLE jobs ADD COLUMN workspace_volume_name TEXT',
  'ALTER TABLE jobs ADD COLUMN checkpoint_name TEXT',
  'ALTER TABLE jobs ADD COLUMN checkpoint_path TEXT',
  'ALTER TABLE jobs ADD COLUMN checkpoint_enabled INTEGER DEFAULT 0',
  'ALTER TABLE jobs ADD COLUMN checkpointed_at TEXT',
  // jobs columns added by sync E2E branch (needed on deployed VPS)
  'ALTER TABLE jobs ADD COLUMN assigned_at TEXT',
  'ALTER TABLE jobs ADD COLUMN picked_up_at TEXT',
  'ALTER TABLE jobs ADD COLUMN task_spec TEXT',
  'ALTER TABLE jobs ADD COLUMN result TEXT',
  'ALTER TABLE jobs ADD COLUMN error TEXT',
  // billing actuals — set at completion from real elapsed time (not submitted estimate)
  'ALTER TABLE jobs ADD COLUMN actual_cost_halala INTEGER',
  'ALTER TABLE jobs ADD COLUMN actual_duration_minutes INTEGER',
  'ALTER TABLE jobs ADD COLUMN provider_earned_halala INTEGER',
  'ALTER TABLE jobs ADD COLUMN dc1_fee_halala INTEGER',
  // renter_id for renter auth (existing jobs may lack this)
  'ALTER TABLE jobs ADD COLUMN renter_id INTEGER',
  // job timeout enforcement
  'ALTER TABLE jobs ADD COLUMN max_duration_seconds INTEGER DEFAULT 600',
  'ALTER TABLE jobs ADD COLUMN timeout_at TEXT',
  // HMAC signature for task_spec security
  'ALTER TABLE jobs ADD COLUMN task_spec_hmac TEXT',
  // provider self-service columns
  'ALTER TABLE providers ADD COLUMN run_mode TEXT DEFAULT \'always-on\'',
  'ALTER TABLE providers ADD COLUMN scheduled_start TEXT DEFAULT \'23:00\'',
  'ALTER TABLE providers ADD COLUMN scheduled_end TEXT DEFAULT \'07:00\'',
  'ALTER TABLE providers ADD COLUMN gpu_usage_cap_pct INTEGER DEFAULT 80',
  'ALTER TABLE providers ADD COLUMN vram_reserve_gb INTEGER DEFAULT 1',
  'ALTER TABLE providers ADD COLUMN temp_limit_c INTEGER DEFAULT 85',
  'ALTER TABLE providers ADD COLUMN is_paused INTEGER DEFAULT 0',
  // provider readiness + daemon tracking
  'ALTER TABLE providers ADD COLUMN readiness_status TEXT DEFAULT \'pending\'',
  'ALTER TABLE providers ADD COLUMN readiness_details TEXT',
  'ALTER TABLE providers ADD COLUMN daemon_version TEXT',
  'ALTER TABLE providers ADD COLUMN current_job_id TEXT',
  'ALTER TABLE providers ADD COLUMN approval_status TEXT DEFAULT \'pending\'',
  'ALTER TABLE providers ADD COLUMN approved_at TEXT',
  'ALTER TABLE providers ADD COLUMN rejected_reason TEXT',
  // machine verification columns
  'ALTER TABLE providers ADD COLUMN verification_status TEXT DEFAULT \'unverified\'',
  'ALTER TABLE providers ADD COLUMN verification_score INTEGER',
  'ALTER TABLE providers ADD COLUMN verification_last_at TEXT',
  'ALTER TABLE providers ADD COLUMN verification_challenge TEXT',
  'ALTER TABLE providers ADD COLUMN verified_gpu TEXT',
  // recovery_events columns (for existing DBs that had the old narrow schema)
  'ALTER TABLE recovery_events ADD COLUMN job_id TEXT',
  'ALTER TABLE recovery_events ADD COLUMN provider_id INTEGER',
  'ALTER TABLE recovery_events ADD COLUMN from_provider_id INTEGER',
  'ALTER TABLE recovery_events ADD COLUMN to_provider_id INTEGER',
  'ALTER TABLE recovery_events ADD COLUMN event_type TEXT',
  'ALTER TABLE recovery_events ADD COLUMN reason TEXT',
  'ALTER TABLE recovery_events ADD COLUMN status TEXT',
  'ALTER TABLE recovery_events ADD COLUMN timestamp TEXT',
  'ALTER TABLE recovery_events ADD COLUMN details TEXT',
  'ALTER TABLE recovery_events ADD COLUMN started_at TEXT',
  'ALTER TABLE recovery_events ADD COLUMN completed_at TEXT',
  'ALTER TABLE recovery_events ADD COLUMN resolved_at TEXT',
  'ALTER TABLE recovery_events ADD COLUMN notes TEXT',
  // Job progress phase — daemon reports download/load/generate phases in real-time
  'ALTER TABLE jobs ADD COLUMN progress_phase TEXT',
  'ALTER TABLE jobs ADD COLUMN progress_updated_at TEXT',
  // SSE job log streaming storage (JSON-lines)
  'ALTER TABLE jobs ADD COLUMN logs_jsonl TEXT',
  // Refund tracking for failed/timed-out jobs
  'ALTER TABLE jobs ADD COLUMN refunded_at TEXT',
  // Cached HuggingFace models — daemon reports which models are pre-downloaded
  'ALTER TABLE providers ADD COLUMN cached_models TEXT',
  // Job execution engine — DCP-18
  'ALTER TABLE jobs ADD COLUMN priority INTEGER DEFAULT 2',         // 1=high, 2=normal, 3=low
  'ALTER TABLE jobs ADD COLUMN retry_count INTEGER DEFAULT 0',      // how many times job was retried
  'ALTER TABLE jobs ADD COLUMN max_retries INTEGER DEFAULT 2',      // transient failure retry ceiling
  // Container crash recovery telemetry — daemon-managed retry metadata
  'ALTER TABLE jobs ADD COLUMN restart_count INTEGER DEFAULT 0',
  'ALTER TABLE jobs ADD COLUMN last_error TEXT',
  // GPU metrics — DCP-19: multi-GPU data stored as JSON per heartbeat
  'ALTER TABLE heartbeat_log ADD COLUMN gpu_metrics_json TEXT',     // full all_gpus array from daemon
  'ALTER TABLE heartbeat_log ADD COLUMN gpu_count INTEGER DEFAULT 1',
  // Provider GPU spec — DCP-20
  'ALTER TABLE providers ADD COLUMN gpu_count_reported INTEGER',    // number of GPUs reported by daemon
  'ALTER TABLE providers ADD COLUMN gpu_spec_json TEXT',            // full GPU spec array from daemon
  'ALTER TABLE providers ADD COLUMN gpu_compute_capability TEXT',   // e.g. "8.9"
  'ALTER TABLE providers ADD COLUMN gpu_cuda_version TEXT',         // e.g. "12.2"
  // Ocean-style structured resource advertisement — DCP-27
  'ALTER TABLE providers ADD COLUMN resource_spec TEXT',            // JSON: {resources:[{id,total,type,...}]}
  // SAR payment integration — DCP-31
  'ALTER TABLE payments ADD COLUMN moyasar_id TEXT',
  'ALTER TABLE payments ADD COLUMN payment_method TEXT DEFAULT \'creditcard\'',
  'ALTER TABLE payments ADD COLUMN refunded_at TEXT',               // when refund processed
  'ALTER TABLE payments ADD COLUMN refund_amount_halala INTEGER',   // partial refund support
  // Escrow-based earnings tracking — DCP-32 (integer halala, avoids SAR float drift)
  'ALTER TABLE providers ADD COLUMN claimable_earnings_halala INTEGER DEFAULT 0',
  // vLLM serverless endpoint — DCP-34
  'ALTER TABLE jobs ADD COLUMN endpoint_url TEXT',          // OpenAI-compatible /v1 endpoint URL (vllm_serve)
  'ALTER TABLE jobs ADD COLUMN serve_port INTEGER',         // provider-side port the vLLM container listens on
  // Provider reputation system — DCP-51
  'ALTER TABLE providers ADD COLUMN reputation_score REAL DEFAULT 100.0', // composite trust score (0–100)
  // Provider per-minute pricing — DCP-205 job router (NULL = use global COST_RATES)
  'ALTER TABLE providers ADD COLUMN price_per_min_halala INTEGER DEFAULT NULL',
  // Canonical GPU info payload from daemon heartbeat (DCP-244)
  'ALTER TABLE providers ADD COLUMN gpu_info_json TEXT',
  'ALTER TABLE providers ADD COLUMN gpu_vram_mb INTEGER',
  'ALTER TABLE providers ADD COLUMN supported_compute_types TEXT',
  'ALTER TABLE providers ADD COLUMN gpu_profile_source TEXT DEFAULT \'manual\'',
  'ALTER TABLE providers ADD COLUMN gpu_profile_updated_at TEXT',
  'ALTER TABLE providers ADD COLUMN container_restart_count INTEGER DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN model_cache_disk_mb INTEGER DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN model_cache_disk_total_mb INTEGER DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN model_cache_disk_used_pct REAL DEFAULT 0',
  'ALTER TABLE providers ADD COLUMN model_preload_status TEXT DEFAULT \'none\'',
  'ALTER TABLE providers ADD COLUMN model_preload_model TEXT',
  'ALTER TABLE providers ADD COLUMN model_preload_requested_at TEXT',
  'ALTER TABLE providers ADD COLUMN model_preload_updated_at TEXT',
  // Optional renter callback endpoint for job lifecycle webhooks
  'ALTER TABLE renters ADD COLUMN webhook_url TEXT',
  'ALTER TABLE renters ADD COLUMN rotated_at TEXT',
  // PDPL deletion lifecycle tracking
  'ALTER TABLE renters ADD COLUMN deleted_at TEXT',
  'ALTER TABLE renters ADD COLUMN deletion_scheduled_for TEXT',
  'ALTER TABLE providers ADD COLUMN deleted_at TEXT',
  'ALTER TABLE providers ADD COLUMN deletion_scheduled_for TEXT',
  // Job completion callback delivery tracking
  'ALTER TABLE jobs ADD COLUMN webhook_notified_at TEXT',
  'ALTER TABLE jobs ADD COLUMN webhook_delivery_status TEXT',
  'ALTER TABLE jobs ADD COLUMN webhook_delivery_attempts INTEGER DEFAULT 0',
  'ALTER TABLE jobs ADD COLUMN completion_email_sent_at TEXT',
  'ALTER TABLE jobs ADD COLUMN retried_from_job_id INTEGER',
  'ALTER TABLE jobs ADD COLUMN first_token_at TEXT',
  'ALTER TABLE job_executions ADD COLUMN gpu_seconds_used REAL DEFAULT 0',
  'ALTER TABLE job_executions ADD COLUMN cost_halala INTEGER DEFAULT 0',
  'ALTER TABLE heartbeat_log ADD COLUMN container_restart_count INTEGER DEFAULT 0',
  'ALTER TABLE heartbeat_log ADD COLUMN model_cache_used_mb INTEGER DEFAULT 0',
  'ALTER TABLE heartbeat_log ADD COLUMN model_cache_total_mb INTEGER DEFAULT 0',
  'ALTER TABLE heartbeat_log ADD COLUMN model_cache_used_pct REAL DEFAULT 0',
  'ALTER TABLE withdrawal_requests ADD COLUMN updated_at TEXT',
  'ALTER TABLE withdrawal_requests ADD COLUMN is_amount_reserved INTEGER DEFAULT 1',
];

migrations.forEach(sql => {
  try {
    db.exec(sql);
  } catch (e) {
    // Column already exists — safe to ignore
  }
});

// ─── RENTERS TABLE ───
db.exec(`
  CREATE TABLE IF NOT EXISTS renters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    api_key TEXT NOT NULL UNIQUE,
    organization TEXT,
    status TEXT DEFAULT 'active',
    balance_halala INTEGER DEFAULT 0,
    total_spent_halala INTEGER DEFAULT 0,
    total_jobs INTEGER DEFAULT 0,
    webhook_url TEXT,
    rotated_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )
`);

// ─── CREDIT GRANTS TABLE ───
// Immutable audit trail for admin-issued renter credits.
db.exec(`
  CREATE TABLE IF NOT EXISTS credit_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    renter_id INTEGER NOT NULL,
    amount_halala INTEGER NOT NULL CHECK (amount_halala > 0),
    reason TEXT NOT NULL,
    granted_by TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL,
    FOREIGN KEY (renter_id) REFERENCES renters(id)
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_credit_grants_renter_time ON credit_grants(renter_id, created_at DESC)`);

// ─── API KEY ROTATION AUDIT TABLE ───
// Security audit trail + per-account rate limiting support.
db.exec(`
  CREATE TABLE IF NOT EXISTS api_key_rotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_type TEXT NOT NULL CHECK(account_type IN ('provider', 'renter')),
    account_id INTEGER NOT NULL,
    rotated_at TEXT NOT NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_api_key_rotations_account_time ON api_key_rotations(account_type, account_id, rotated_at DESC)`);

// ─── IMAGE SECURITY TABLES ───
// Trivy scan evidence + approved image digest pinning for container execution policy.
db.exec(`
  CREATE TABLE IF NOT EXISTS image_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_ref TEXT NOT NULL,
    registry TEXT NOT NULL,
    resolved_digest TEXT,
    scanned_at TEXT NOT NULL,
    critical_count INTEGER NOT NULL DEFAULT 0,
    scan_report_json TEXT,
    approved INTEGER NOT NULL DEFAULT 0,
    approved_at TEXT,
    approved_by TEXT,
    created_at TEXT NOT NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_image_scans_image_time ON image_scans(image_ref, scanned_at DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_image_scans_digest ON image_scans(resolved_digest, scanned_at DESC)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS approved_container_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_ref TEXT NOT NULL UNIQUE,
    registry TEXT NOT NULL,
    resolved_digest TEXT NOT NULL,
    scan_id INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    approved_at TEXT NOT NULL,
    approved_by TEXT,
    last_validated_at TEXT,
    FOREIGN KEY (scan_id) REFERENCES image_scans(id)
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_approved_container_images_active ON approved_container_images(is_active, approved_at DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_approved_container_images_digest ON approved_container_images(resolved_digest)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS admin_rate_limit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_key TEXT NOT NULL,
    actor_fingerprint TEXT NOT NULL,
    created_at TEXT NOT NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_admin_rate_limit_log_action_actor_time ON admin_rate_limit_log(action_key, actor_fingerprint, created_at DESC)`);

// ─── PDPL REQUEST AUDIT TABLE ───
// Records immutable export/deletion requests for compliance evidence.
db.exec(`
  CREATE TABLE IF NOT EXISTS pdpl_request_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_type TEXT NOT NULL CHECK(account_type IN ('provider', 'renter')),
    account_id INTEGER NOT NULL,
    request_type TEXT NOT NULL CHECK(request_type IN ('export', 'delete')),
    requested_at TEXT NOT NULL,
    metadata_json TEXT
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_pdpl_request_log_account_time ON pdpl_request_log(account_type, account_id, requested_at DESC)`);

// ─── RENTER QUOTA TABLE ───
// Per-renter submission/spend controls enforced at job submission.
db.exec(`
  CREATE TABLE IF NOT EXISTS renter_quota (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    renter_id INTEGER NOT NULL UNIQUE,
    daily_jobs_limit INTEGER NOT NULL DEFAULT 100,
    monthly_spend_limit_halala INTEGER NOT NULL DEFAULT 10000,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY (renter_id) REFERENCES renters(id)
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_renter_quota_renter_id ON renter_quota(renter_id)`);

// ─── QUOTA LOG TABLE ───
// Audit trail for quota and balance checks on job submissions.
db.exec(`
  CREATE TABLE IF NOT EXISTS quota_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    renter_id INTEGER NOT NULL,
    job_id TEXT,
    check_type TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 0,
    limit_value INTEGER,
    current_value INTEGER,
    requested_value INTEGER,
    reason TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (renter_id) REFERENCES renters(id)
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_quota_log_renter_id ON quota_log(renter_id, created_at DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_quota_log_job_id ON quota_log(job_id, created_at DESC)`);

// ─── PAYMENTS TABLE ─── (DCP-31: Moyasar SAR payment integration)
db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT NOT NULL UNIQUE,        -- Internal/external payment identifier
    moyasar_id TEXT UNIQUE,                 -- Canonical Moyasar payment ID
    renter_id INTEGER NOT NULL,
    amount_sar REAL NOT NULL,
    amount_halala INTEGER NOT NULL,
    status TEXT DEFAULT 'initiated',        -- initiated|paid|failed|refunded
    source_type TEXT DEFAULT 'creditcard',  -- creditcard|mada|applepay
    payment_method TEXT DEFAULT 'creditcard',
    description TEXT,
    callback_url TEXT,
    checkout_url TEXT,                      -- Moyasar hosted checkout URL
    gateway_response TEXT,                  -- Full Moyasar response JSON
    created_at TEXT NOT NULL,
    confirmed_at TEXT,                      -- When webhook confirmed payment
    refunded_at TEXT,
    refund_amount_halala INTEGER,
    FOREIGN KEY (renter_id) REFERENCES renters(id)
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_renter_id ON payments(renter_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(payment_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_moyasar_id ON payments(moyasar_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at DESC)`);

// ─── WITHDRAWALS TABLE ───
db.exec(`
  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    withdrawal_id TEXT NOT NULL UNIQUE,
    provider_id INTEGER NOT NULL,
    amount_sar REAL NOT NULL,
    payout_method TEXT DEFAULT 'bank_transfer',
    payout_details TEXT,
    status TEXT DEFAULT 'pending',
    requested_at TEXT NOT NULL,
    processed_at TEXT,
    notes TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id TEXT PRIMARY KEY,
    provider_id INTEGER NOT NULL,
    amount_halala INTEGER NOT NULL,
    is_amount_reserved INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','paid','failed')),
    iban TEXT NOT NULL,
    admin_note TEXT,
    created_at TEXT NOT NULL,
    processed_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_provider ON withdrawal_requests(provider_id, created_at DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status, created_at DESC)`);

// ─── VERIFICATION RUNS TABLE ───
db.exec(`
  CREATE TABLE IF NOT EXISTS verification_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    challenge_id TEXT NOT NULL UNIQUE,
    challenge_params TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','running','completed','failed')),
    requested_at TEXT,
    completed_at TEXT,
    result_data TEXT,
    verdict TEXT CHECK(verdict IN ('verified','suspect','failed')),
    score INTEGER,
    flags TEXT,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

// ─── HEARTBEAT LOG TABLE ───
db.exec(`
  CREATE TABLE IF NOT EXISTS heartbeat_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    received_at TEXT NOT NULL,
    provider_ip TEXT,
    provider_hostname TEXT,
    gpu_util_pct REAL,
    gpu_temp_c REAL,
    gpu_power_w REAL,
    gpu_vram_free_mib INTEGER,
    gpu_vram_total_mib INTEGER,
    daemon_version TEXT,
    python_version TEXT,
    os_info TEXT,
    gpu_metrics_json TEXT,
    gpu_count INTEGER DEFAULT 1,
    container_restart_count INTEGER DEFAULT 0,
    model_cache_used_mb INTEGER DEFAULT 0,
    model_cache_total_mb INTEGER DEFAULT 0,
    model_cache_used_pct REAL DEFAULT 0,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);

// ─── PROVIDER GPU TELEMETRY TABLE ───
// Time-series heartbeat snapshots used for fleet-level utilization analytics.
db.exec(`
  CREATE TABLE IF NOT EXISTS provider_gpu_telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    gpu_name TEXT,
    gpu_vram_gb INTEGER,
    gpu_util_pct REAL,
    vram_used_gb REAL,
    cold_start_ms INTEGER,
    active_jobs INTEGER DEFAULT 0,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_telemetry_provider_time ON provider_gpu_telemetry(provider_id, recorded_at)`);

try {
  db.prepare('ALTER TABLE provider_gpu_telemetry ADD COLUMN cold_start_ms INTEGER').run();
} catch (e) {}

// ─── ESCROW HOLDS TABLE ─── (DCP-32: off-chain escrow for GPU job billing)
// Tracks pre-paid funds through the job lifecycle:
//   held → locked → released_provider (success)
//                 → released_renter   (failure/cancel)
//                 → expired           (timeout)
db.exec(`
  CREATE TABLE IF NOT EXISTS escrow_holds (
    id TEXT PRIMARY KEY,
    renter_api_key TEXT NOT NULL,
    provider_id INTEGER NOT NULL,
    job_id TEXT NOT NULL UNIQUE,
    amount_halala INTEGER NOT NULL,
    status TEXT DEFAULT 'held' CHECK(status IN ('held','locked','released_provider','released_renter','expired')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    resolved_at DATETIME,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_escrow_job_id ON escrow_holds(job_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_escrow_renter ON escrow_holds(renter_api_key, status)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_escrow_provider ON escrow_holds(provider_id, status)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_escrow_expires ON escrow_holds(status, expires_at)`);

// ─── JOB LOGS TABLE ───
// Stores stdout/stderr lines from job execution; daemon streams these after execution
db.exec(`
  CREATE TABLE IF NOT EXISTS job_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    line_no INTEGER NOT NULL,
    level TEXT DEFAULT 'info',
    message TEXT NOT NULL,
    logged_at TEXT NOT NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON job_logs(job_id, line_no)`);

// ─── JOB SWEEP LOG TABLE ───
// Audit trail for stale-job sweeps (DCP-129)
db.exec(`
  CREATE TABLE IF NOT EXISTS job_sweep_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    reason TEXT NOT NULL,
    swept_at TEXT NOT NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_job_sweep_log_job_id ON job_sweep_log(job_id, swept_at DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_job_sweep_log_swept_at ON job_sweep_log(swept_at DESC)`);

// ─── JOB TEMPLATES TABLE ─── (DCP-304: renter job templates)
db.exec(`
  CREATE TABLE IF NOT EXISTS job_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    renter_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    job_type TEXT NOT NULL,
    model TEXT NOT NULL,
    system_prompt TEXT,
    max_tokens INTEGER,
    resource_spec_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (renter_id) REFERENCES renters(id) ON DELETE CASCADE
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_job_templates_renter ON job_templates(renter_id, created_at DESC)`);

// Compatibility wrapper: providers.js uses db.run/get/all (async sqlite3 style)
// better-sqlite3 uses db.prepare().run/get/all - these wrappers bridge the gap
function flatParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params.reduce((acc, p) => Array.isArray(p) ? acc.concat(p) : acc.concat([p]), []);
}

module.exports = {
  run: (sql, ...params) => db.prepare(sql).run(...flatParams(params)),
  get: (sql, ...params) => db.prepare(sql).get(...flatParams(params)),
  all: (sql, ...params) => db.prepare(sql).all(...flatParams(params)),
  prepare: (sql) => db.prepare(sql),
  close: () => db.close(),
  _db: db
};
