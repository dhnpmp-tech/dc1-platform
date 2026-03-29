-- OpenRouter Reliability Metrics Extraction Template
-- Usage: run against the production/app SQLite database that contains the jobs table.
-- Purpose: provide 24h/72h success rates, latency p50/p95/p99, and error-class breakdown.

-- 24h / 72h success-rate windows
WITH windows AS (
  SELECT '24h' AS window_name, datetime('now', '-24 hours') AS window_start
  UNION ALL
  SELECT '72h' AS window_name, datetime('now', '-72 hours') AS window_start
),
window_jobs AS (
  SELECT
    w.window_name,
    j.status
  FROM windows w
  JOIN jobs j ON datetime(j.submitted_at) >= w.window_start
  WHERE j.job_type = 'vllm'
)
SELECT
  window_name,
  COUNT(*) AS total_requests,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS successful_requests,
  ROUND(
    100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0),
    2
  ) AS success_rate_pct
FROM window_jobs
GROUP BY window_name
ORDER BY window_name;

-- Latency sample (seconds) derived from started_at -> completed_at for completed jobs
WITH latency AS (
  SELECT
    model,
    (julianday(completed_at) - julianday(started_at)) * 86400.0 AS latency_seconds
  FROM jobs
  WHERE job_type = 'vllm'
    AND status = 'completed'
    AND started_at IS NOT NULL
    AND completed_at IS NOT NULL
    AND datetime(submitted_at) >= datetime('now', '-72 hours')
)
SELECT
  model,
  COUNT(*) AS sample_count,
  ROUND(MIN(latency_seconds), 3) AS min_s,
  ROUND(AVG(latency_seconds), 3) AS avg_s,
  ROUND(MAX(latency_seconds), 3) AS max_s
FROM latency
GROUP BY model
ORDER BY sample_count DESC;

-- Error-class breakdown for 72h window
WITH err AS (
  SELECT
    LOWER(COALESCE(status, 'unknown')) AS status_norm,
    LOWER(COALESCE(notes, '')) AS notes_norm,
    LOWER(COALESCE(logs_jsonl, '')) AS logs_norm
  FROM jobs
  WHERE job_type = 'vllm'
    AND datetime(submitted_at) >= datetime('now', '-72 hours')
    AND status IN ('failed', 'cancelled', 'permanently_failed', 'timed_out')
)
SELECT
  CASE
    WHEN status_norm = 'timed_out' THEN 'timeout'
    WHEN notes_norm LIKE '%provider%' OR logs_norm LIKE '%provider%' THEN 'provider_upstream'
    WHEN notes_norm LIKE '%capacity%' OR logs_norm LIKE '%capacity%' THEN 'capacity_unavailable'
    ELSE 'other_failure'
  END AS error_class,
  COUNT(*) AS count
FROM err
GROUP BY error_class
ORDER BY count DESC;
