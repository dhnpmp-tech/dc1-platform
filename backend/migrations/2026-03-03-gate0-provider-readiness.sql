ALTER TABLE providers ADD COLUMN readiness_status TEXT DEFAULT 'not_ready';
ALTER TABLE providers ADD COLUMN readiness_details TEXT;
ALTER TABLE providers ADD COLUMN daemon_version TEXT;
ALTER TABLE providers ADD COLUMN current_job_id INTEGER;

ALTER TABLE jobs ADD COLUMN assigned_at TEXT;
ALTER TABLE jobs ADD COLUMN picked_up_at TEXT;
ALTER TABLE jobs ADD COLUMN task_spec TEXT;
ALTER TABLE jobs ADD COLUMN result TEXT;
ALTER TABLE jobs ADD COLUMN error TEXT;
