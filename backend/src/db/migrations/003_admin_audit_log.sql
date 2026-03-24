-- Migration 003: Admin audit log (DCP-768)
-- Immutable record of every admin action for accountability and forensics.
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS).
--
-- Column names match the inline INSERTs already in routes/admin.js
-- (action, target_type, target_id, details, timestamp).
-- admin_user_id defaults to 'system' for back-compat with existing inserts.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id   TEXT    NOT NULL DEFAULT 'system',
  action          TEXT    NOT NULL,
  target_type     TEXT,
  target_id       TEXT,
  details         TEXT,
  timestamp       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin  ON admin_audit_log(admin_user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_type, target_id, timestamp DESC);
