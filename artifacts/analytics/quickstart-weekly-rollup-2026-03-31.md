# Quickstart Weekly Funnel Rollup

- Input: `/paperclip/instances/default/workspaces/2e1b91e1-98e4-4425-ae30-4dfb238e06a7/work/artifacts/analytics/quickstart-events.sample.jsonl`
- Generated at (UTC): `2026-03-31T12:00:00.000Z`
- Window: `2026-03-24T12:00:00.000Z` -> `2026-03-31T12:00:00.000Z` (7 days)

## Totals

- quickstart_page_view: **10**
- quickstart_api_key_created: **6**
- quickstart_first_chat_success: **4**
- page -> API key: **60%**
- page -> first chat: **40%**
- API key -> first chat: **66.67%**

## Breakdown (locale + source)

| locale | source | page_view | api_key_created | first_chat_success | page->api_key % | page->first_chat % | api_key->first_chat % |
|---|---|---:|---:|---:|---:|---:|---:|
| en | renter_register_first_workload | 3 | 2 | 1 | 66.67 | 33.33 | 50 |
| ar | renter_register_first_workload | 3 | 2 | 1 | 66.67 | 33.33 | 50 |
| en | docs_start_quickstart | 2 | 1 | 1 | 50 | 50 | 100 |
| ar | landing_primary_cta | 1 | 1 | 1 | 100 | 100 | 100 |
| en | landing_primary_cta | 1 | 0 | 0 | 0 | 0 | 0 |

