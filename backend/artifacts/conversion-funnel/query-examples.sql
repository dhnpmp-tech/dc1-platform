-- DCP-357 baseline funnel report queries
-- Table: conversion_funnel_events

-- 1) Stage counts by journey (distinct actors)
SELECT
  journey,
  stage,
  COUNT(DISTINCT actor_key) AS actors
FROM conversion_funnel_events
WHERE occurred_at >= datetime('now', '-30 day')
GROUP BY journey, stage
ORDER BY journey, stage;

-- 2) Register -> first_action -> first_success conversion by journey
WITH stage_counts AS (
  SELECT
    journey,
    SUM(CASE WHEN stage = 'register' THEN 1 ELSE 0 END) AS register_events,
    SUM(CASE WHEN stage = 'first_action' THEN 1 ELSE 0 END) AS first_action_events,
    SUM(CASE WHEN stage = 'first_success' THEN 1 ELSE 0 END) AS first_success_events
  FROM (
    SELECT DISTINCT journey, stage, actor_key
    FROM conversion_funnel_events
    WHERE actor_key IS NOT NULL
      AND occurred_at >= datetime('now', '-30 day')
  )
  GROUP BY journey
)
SELECT
  journey,
  register_events,
  first_action_events,
  first_success_events,
  CASE WHEN register_events > 0 THEN ROUND((first_action_events * 100.0) / register_events, 2) ELSE 0 END AS register_to_first_action_pct,
  CASE WHEN register_events > 0 THEN ROUND((first_success_events * 100.0) / register_events, 2) ELSE 0 END AS register_to_first_success_pct
FROM stage_counts
ORDER BY journey;

-- 3) Locale/source segmentation for EN/AR operations
SELECT
  journey,
  stage,
  locale,
  source_surface,
  COUNT(*) AS events
FROM conversion_funnel_events
WHERE occurred_at >= datetime('now', '-30 day')
GROUP BY journey, stage, locale, source_surface
ORDER BY journey, stage, events DESC;

-- 4) Attribution completeness
SELECT
  journey,
  COUNT(*) AS total_events,
  SUM(CASE WHEN source_surface IS NOT NULL AND source_surface != 'unknown' THEN 1 ELSE 0 END) AS with_source_surface,
  SUM(CASE WHEN locale IN ('en', 'ar') THEN 1 ELSE 0 END) AS with_en_ar_locale,
  SUM(CASE WHEN utm_source IS NOT NULL OR referrer_host IS NOT NULL THEN 1 ELSE 0 END) AS with_attribution_context
FROM conversion_funnel_events
WHERE occurred_at >= datetime('now', '-30 day')
GROUP BY journey
ORDER BY journey;
