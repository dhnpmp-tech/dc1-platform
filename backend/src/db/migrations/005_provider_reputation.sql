-- Migration 005: Provider Reputation Scoring System (DCP-867)
-- Adds columns for tracking provider performance metrics and calculating reputation scores.
-- Safe to run multiple times (ALTER TABLE IF NOT EXISTS pattern).

-- Add reputation scoring columns to providers table
-- Note: These columns are added via app code if they don't exist (see providerReputation.js)
-- This migration documents the schema and provides a migration path for fresh deployments.

-- Provider reputation scoring metrics
-- reputation_score (0-100): weighted average of uptime, completion rate, and throughput
-- uptime_pct (0-100): percentage of time provider was available (inverse of failure rate)
-- job_completion_rate (0-100): percentage of assigned jobs successfully completed
-- avg_tokens_per_sec: average inference throughput (tokens per second)
-- updated_at: timestamp of last reputation score update

-- Sample ALTER statements for PostgreSQL (if using Supabase):
-- ALTER TABLE providers ADD COLUMN IF NOT EXISTS reputation_score REAL DEFAULT 50;
-- ALTER TABLE providers ADD COLUMN IF NOT EXISTS uptime_pct REAL;
-- ALTER TABLE providers ADD COLUMN IF NOT EXISTS job_completion_rate REAL;
-- ALTER TABLE providers ADD COLUMN IF NOT EXISTS avg_tokens_per_sec REAL;
-- ALTER TABLE providers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- For SQLite (local development):
-- PRAGMA table_info(providers); -- Check existing columns
-- ALTER TABLE providers ADD COLUMN reputation_score REAL DEFAULT 50;
-- ALTER TABLE providers ADD COLUMN uptime_pct REAL;
-- ALTER TABLE providers ADD COLUMN job_completion_rate REAL;
-- ALTER TABLE providers ADD COLUMN avg_tokens_per_sec REAL;
-- ALTER TABLE providers ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Note: The actual column creation is handled by the application at runtime
-- via the providerReputation.js service which calls db.query() with ALTER TABLE.
-- This migration file documents the schema additions for reference and CI/CD pipelines.

-- Index for efficient reputation-based queries
-- CREATE INDEX IF NOT EXISTS idx_providers_reputation_score ON providers(reputation_score DESC);
-- CREATE INDEX IF NOT EXISTS idx_providers_updated_at ON providers(updated_at DESC);
