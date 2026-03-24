-- Migration 002: Provider activation system (DCP-753)
-- Adds provider_benchmarks table and available_gpu_tiers column to providers.
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS, ALTER TABLE is guarded in app code).

-- provider_benchmarks: stores GPU benchmark submissions from providers
CREATE TABLE IF NOT EXISTS provider_benchmarks (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    provider_id     TEXT NOT NULL,
    gpu_model       TEXT NOT NULL,
    vram_gb         REAL NOT NULL,
    tflops          REAL NOT NULL,
    bandwidth_gbps  REAL,
    tokens_per_sec  REAL,
    tier            TEXT NOT NULL CHECK (tier IN ('A', 'B', 'C')),
    submitted_at    TEXT NOT NULL,
    FOREIGN KEY (provider_id) REFERENCES providers(id)
);

CREATE INDEX IF NOT EXISTS idx_provider_benchmarks_provider_id
    ON provider_benchmarks (provider_id, submitted_at DESC);

-- available_gpu_tiers: JSON array of tiers this provider qualifies for (e.g. ["B","C"])
-- Added via ALTER TABLE in app code (ensureAvailableGpuTiersColumn) to handle existing DBs.
-- The migration here is a no-op comment since SQLite ALTER TABLE IF NOT EXISTS is unsupported.
-- The column is created at runtime by the activation code the first time it is needed.

-- Provider status lifecycle (informational):
-- registered -> benchmarking (implicit, set by benchmark-submit endpoint)
-- benchmarking -> active (set by /activate after benchmark passes minimum requirements)
-- active -> inactive/suspended (set by health monitoring / admin action)
