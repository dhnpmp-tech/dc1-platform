# Daily Growth KPI Export

- Generated at (UTC): `2026-03-31T16:55:37.108Z`
- Input: `/paperclip/instances/default/workspaces/fe54d572-3cb6-408c-8e95-e3da583c5663/worktree-dcp-265/artifacts/analytics/growth-kpi-events.sample.jsonl`
- Target UTC day: `2026-03-30`

## KPI Table (Totals)

| utc_day | templates_cta_impressions | templates_cta_clicks | templates_cta_ctr_pct | renter_register_starts | quickstart_opens | first_request_completion_proxy |
|---|---:|---:|---:|---:|---:|---:|
| 2026-03-30 | 5 | 4 | 80 | 4 | 5 | 2 |

## Breakdown (locale + source)

| locale | source | templates_cta_ctr_pct | renter_register_starts | quickstart_opens | first_request_completion_proxy |
|---|---|---:|---:|---:|---:|
| en | campaign_week1 | 66.67 | 2 | 3 | 1 |
| ar | campaign_week1 | 100 | 2 | 2 | 1 |

## Event Mapping

- templates CTA impressions: `template_catalog_viewed, templates_page_view, landing_page_view`
- templates CTA clicks: `landing_primary_cta_clicked, developer_flow_landing_cta_click, role_path_cta_clicked`
- register starts: `developer_flow_register_submit, renter_register_submit`
- quickstart opens: `quickstart_page_view, renter_register_quickstart_opened`
- first-request completion proxy: `quickstart_first_chat_success`

