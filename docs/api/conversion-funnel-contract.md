# Conversion Funnel Contract (DCP-357)

Canonical cross-journey funnel stages:

1. `view`
2. `register`
3. `first_action`
4. `first_success`

Journeys:

- `provider`
- `renter`

## Event Storage

All stage transitions are persisted in SQLite table `conversion_funnel_events`.

Key columns:

- `journey`, `stage`
- `actor_type`, `actor_id`, `actor_key`
- `locale`, `locale_raw`, `language`, `country_code`
- `source_surface`, `source_channel`
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- `referrer`, `referrer_host`, `referrer_path`
- `request_path`, `request_method`
- `success`, `metadata_json`

Deduplication:

- Per-actor stage dedupe is enforced via `dedupe_key` (`journey:actor_type:actor_id:stage`).
- Register flows infer a synthetic `view` event (`metadata_json.synthetic=true`) when a direct view event is not observed yet.

## Current Emission Points

Provider journey:

- `register`: `POST /api/providers/register`
- `first_action`: `POST /api/providers/heartbeat` (first heartbeat observed)
- `first_success`:
  - `POST /api/providers/:id/benchmark-submit` (activation succeeds)
  - `POST /api/providers/:id/activate` (activation succeeds)
  - `POST /api/providers/activate` (self-activation succeeds)

Renter journey:

- `register`: `POST /api/renters/register`
- `first_action`: `POST /api/jobs/submit` (first deployment start)
- `first_success`: `POST /api/jobs/:job_id/result` (first deployment completion)

## Reporting API

`GET /api/admin/analytics/conversion-funnel?since_days=30&journey=all`

Response includes:

- stage counts and conversion percentages per journey
- attribution completeness percentages
- locale/source-surface segmentation rows

## EN/AR + Attribution Contract

- Locale normalization:
  - `ar-*` -> `ar`
  - `en-*` -> `en`
  - otherwise -> raw locale token
- Source segmentation:
  - `source_surface` from body/query/header/path hint
  - `source_channel` from body/query/header/utm medium
- Attribution completeness:
  - event counts with `source_surface`, supported locale (`en|ar`), and campaign/referrer context
