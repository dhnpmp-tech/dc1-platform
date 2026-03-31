# Quickstart First-Request Funnel Telemetry (EN/AR)

This document defines the canonical quickstart conversion events for the renter first-request path.

## Funnel events

1. `quickstart_page_view`
- Fired when `/docs/quickstart` is viewed.
- Instrumented in `app/docs/quickstart/page.tsx`.

2. `quickstart_api_key_created`
- Fired when renter registration succeeds and an API key is issued.
- Instrumented in `app/renter/register/page.tsx`.

3. `quickstart_first_chat_success`
- Fired when the first successful text response is returned from playground job output polling.
- Instrumented in `app/renter/playground/page.tsx`.

## Required dimensions

- `locale`: `en` or `ar` from `useLanguage()`.
- `source`: attribution source from URL query (`?source=`), default `direct`.

## Event payload fields

### `quickstart_page_view`
- `event`
- `surface` = `docs_quickstart`
- `page` = `quickstart`
- `locale`
- `source`

### `quickstart_api_key_created`
- `event`
- `source_page` = `renter_register`
- `surface` = `registration_form`
- `step` = `api_key_created`
- `locale`
- `source`
- `renter_id`
- `api_key_prefix` (first 11 chars only; no full key)

### `quickstart_first_chat_success`
- `event`
- `locale`
- `source`
- `job_id`
- `provider_id`
- `model`
- `job_type`

## Weekly rollup command

Use local exported analytics events (JSON or JSONL) and generate a 7-day report:

```bash
npm run report:quickstart-funnel -- --input artifacts/analytics/quickstart-events.sample.jsonl
```

Output artifacts:

- `artifacts/analytics/quickstart-weekly-rollup-YYYY-MM-DD.json`
- `artifacts/analytics/quickstart-weekly-rollup-YYYY-MM-DD.md`

## Rollup metric definitions

- `page_to_api_key_rate_pct` = `quickstart_api_key_created / quickstart_page_view`
- `page_to_first_chat_rate_pct` = `quickstart_first_chat_success / quickstart_page_view`
- `api_key_to_first_chat_rate_pct` = `quickstart_first_chat_success / quickstart_api_key_created`

All rollups are segmented by `locale` + `source` and deduplicated by session/user identifier where available.
