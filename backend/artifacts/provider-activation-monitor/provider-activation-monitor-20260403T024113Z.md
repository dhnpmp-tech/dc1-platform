# Provider Activation Monitor

- generated_at: 2026-04-03T02:41:13.641Z
- pass: true

## Checks

- http_status_200: PASS — received status 200
- windows_last_24h_present: PASS — response.windows.last_24h must exist
- windows_last_7d_present: PASS — response.windows.last_7d must exist
- last_24h:online_within_24h_present: PASS — stage_counts.online_within_24h is required
- last_24h:blocker_taxonomy_array: PASS — blocker_taxonomy must be an array
- last_24h:admission_rejection_counts_array: PASS — admission_rejection_counts must be an array
- last_24h:no_synthetic_placeholders: PASS
- last_24h:empty_window_has_no_placeholder_rows: PASS — empty windows must not inject synthetic blocker/admission rows
- last_7d:online_within_24h_present: PASS — stage_counts.online_within_24h is required
- last_7d:blocker_taxonomy_array: PASS — blocker_taxonomy must be an array
- last_7d:admission_rejection_counts_array: PASS — admission_rejection_counts must be an array
- last_7d:no_synthetic_placeholders: PASS
- last_7d:empty_window_has_no_placeholder_rows: PASS — empty windows must not inject synthetic blocker/admission rows

## Windows

### last_24h

- sample_size: 0
- stage_counts: `{"registered":0,"installer_downloaded":0,"first_heartbeat":0,"online_within_24h":0}`
- blocker_taxonomy_count: 0
- admission_rejection_counts: 0

### last_7d

- sample_size: 0
- stage_counts: `{"registered":0,"installer_downloaded":0,"first_heartbeat":0,"online_within_24h":0}`
- blocker_taxonomy_count: 0
- admission_rejection_counts: 0

