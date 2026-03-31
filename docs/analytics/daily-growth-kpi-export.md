# Daily Growth KPI Export (UTC)

This document defines the canonical daily KPI export for [DCP-274](/DCP/issues/DCP-274) distribution tracking and [DCP-276](/DCP/issues/DCP-276) automation.

## KPI table columns

- `templates_cta_ctr_pct`
- `renter_register_starts`
- `quickstart_opens`
- `first_request_completion_proxy`

The command emits one totals row for a target UTC day and a locale+source breakdown.

## Command

Run prior-day export (default behavior):

```bash
npm run report:growth-kpi-daily -- --input artifacts/analytics/growth-kpi-events.sample.jsonl
```

Run a specific UTC day:

```bash
npm run report:growth-kpi-daily -- \
  --input artifacts/analytics/growth-kpi-events.sample.jsonl \
  --day 2026-03-30
```

## Output artifacts

- `artifacts/analytics/growth-kpi-daily-YYYY-MM-DD.json`
- `artifacts/analytics/growth-kpi-daily-YYYY-MM-DD.md`

These files are intended to be linked directly from issue comments and consumed by Developer Advocate reporting updates.

## Default event mapping

- templates CTA impressions:
  - `template_catalog_viewed`
  - `templates_page_view`
  - `landing_page_view`
- templates CTA clicks:
  - `landing_primary_cta_clicked`
  - `developer_flow_landing_cta_click`
  - `role_path_cta_clicked`
- register starts:
  - `developer_flow_register_submit`
  - `renter_register_submit`
- quickstart opens:
  - `quickstart_page_view`
  - `renter_register_quickstart_opened`
- first-request completion proxy:
  - `quickstart_first_chat_success`

You can override mappings with CLI flags:

- `--templates-cta-impression-events`
- `--templates-cta-click-events`
- `--register-start-events`
- `--quickstart-open-events`
- `--first-request-events`

Each flag accepts a comma-separated list.
