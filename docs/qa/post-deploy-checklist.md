# Post-Deploy Smoke Checklist (DCP-172, DCP-216, DCP-234, DCP-241, DCP-254)

Use this checklist immediately after each deploy is confirmed by Claude-Cowork, in this exact order:
1. DCP-172
2. DCP-216
3. DCP-234
4. DCP-241
5. DCP-254

Environment targets:
- Frontend: `https://dcp.sa`
- API: `https://api.dcp.sa` (or `http://76.13.179.86:8083` if DNS/SSL not active)

Evidence capture per check:
- Record UTC timestamp
- Record URL/endpoint tested
- Record HTTP status or visible UI result
- Copy exact error text for any failure

## DCP-172 — Sprint 7+ Expanded

### Changed pages/endpoints
- `GET /api/providers/:id/benchmarks` (auth required)
- API global rate limiting (`100 req/min` requirement)
- VPS monitoring script behavior
- OpenAPI docs page (`/docs/api`)

### Manual smoke tests on dcp.sa
- [ ] Open `https://dcp.sa/docs/api` and confirm API docs page renders fully (no 404/500)
- [ ] Call `GET /api/dc1/providers/{id}/benchmarks` **without auth** and confirm request is rejected (`401/403`)
- [ ] Call same benchmarks endpoint with valid owner provider key or admin token and confirm success (`200`)
- [ ] Send burst traffic to one API endpoint and confirm rate-limit response appears after threshold (`429`)
- [ ] Confirm API still serves normal requests after throttled window (rate limit recovers)
- [ ] Confirm VPS monitoring script/process is running and not error-looping (pm2/service health check)

### Pass/fail criteria
- Pass: Docs load, auth is enforced on benchmarks, authorized access works, rate limiting triggers and recovers, monitoring remains healthy.
- Fail: Any unauthorized benchmarks access succeeds, authorized benchmarks access fails, rate limiting never triggers or never recovers, docs endpoint errors.

### Rollback signal
- Immediate rollback candidate if benchmarks are publicly accessible, API is globally rate-limited for normal traffic, or monitoring enters crash loop.

### Paperclip batch execution comment template
- `DCP-172 smoke: PASS/FAIL at <UTC>. Checks run: docs api, benchmarks auth, rate limit, monitoring. Failures: <none or list>.`

## DCP-216 — Sprint 8 (Marketplace, Billing)

### Changed pages/endpoints
- `/marketplace`
- `/renter/billing/confirm`
- `/docs/renter-guide`
- `GET /providers/marketplace` (backend) via frontend proxy as `/api/dc1/providers/marketplace`

### Manual smoke tests on dcp.sa
- [ ] Open `https://dcp.sa/marketplace` and confirm GPU cards load (or explicit empty-state copy)
- [ ] Validate search/sort/filter interactions do not crash and update list correctly
- [ ] Open `https://dcp.sa/renter/billing/confirm` and confirm page renders with expected payment confirmation UI
- [ ] Open `https://dcp.sa/docs/renter-guide` and confirm guide content renders
- [ ] Call `GET /api/dc1/providers/marketplace` and verify JSON shape is valid (provider list objects with key fields)

### Pass/fail criteria
- Pass: All pages load with no runtime error; marketplace API returns valid data/empty-set safely; billing confirm route reachable.
- Fail: Any page 404/500, client crash, or marketplace endpoint malformed/errored.

### Rollback signal
- Rollback candidate if `/marketplace` or billing confirm page is broken in production, or marketplace endpoint returns server errors.

### Paperclip batch execution comment template
- `DCP-216 smoke: PASS/FAIL at <UTC>. Checks run: marketplace ui+api, billing confirm, renter guide. Failures: <none or list>.`

## DCP-234 — Sprint 9 (Admin, VS Code, Installer, Legal)

### Changed pages/endpoints
- `/admin` dashboard with real data
- `/provider/download` installer options
- VS Code extension VSIX download link
- `/privacy` and `/terms`

### Manual smoke tests on dcp.sa
- [ ] Open `https://dcp.sa/admin` with valid admin token/session and confirm dashboard metrics load
- [ ] Confirm admin data modules render (providers/jobs/recent activity) without API error banners
- [ ] Open `https://dcp.sa/provider/download` and confirm installer options are visible
- [ ] Click VSIX download link and confirm downloadable file response starts (200 + binary attachment)
- [ ] Open `https://dcp.sa/privacy` and `https://dcp.sa/terms` and confirm legal text renders

### Pass/fail criteria
- Pass: Admin dashboard can load operational data, download page works, VSIX link valid, legal pages available.
- Fail: Admin page broken/unusable, installer links dead, VSIX link 404/500, legal pages missing.

### Rollback signal
- Rollback candidate if admin observability is lost in prod or installer/download flow is broken for providers.

### Paperclip batch execution comment template
- `DCP-234 smoke: PASS/FAIL at <UTC>. Checks run: admin data, provider download, vsix link, legal pages. Failures: <none or list>.`

## DCP-241 — Sprint 10

### Changed pages/endpoints/features
- `/docs/quickstart`
- Renter playground queue model selection
- VS Code extension live job polling behavior

### Manual smoke tests on dcp.sa
- [ ] Open `https://dcp.sa/docs/quickstart` and verify page loads with complete sections
- [ ] In renter playground/job submit flow, verify model selector exists and selected model is included in submit payload
- [ ] Submit a small test job and confirm queue routing still succeeds (no regression from model selection)
- [ ] Validate VS Code extension can poll live job status without auth or parsing regressions

### Pass/fail criteria
- Pass: Quickstart route available, model selection visible and functional, submit pipeline unaffected, extension polling healthy.
- Fail: Missing quickstart route, model field ignored/breaks submit, or extension polling fails after deploy.

### Rollback signal
- Rollback candidate if renter job submission is broken by model-selection changes or extension polling is nonfunctional.

### Paperclip batch execution comment template
- `DCP-241 smoke: PASS/FAIL at <UTC>. Checks run: quickstart, playground model select, test submit, extension polling. Failures: <none or list>.`

## DCP-254 — Recovery Batch

### Changed pages/endpoints/features
- `jobSweep` error handling and health reporting
- Provider heartbeat GPU detection (`gpu_info` payload)
- HTTPS cert script idempotency (post DCP-84 DNS fix)
- i18n coverage and Arabic RTL across pages
- Docker isolation launcher `infra/docker/run-job.sh`

### Manual smoke tests on dcp.sa + VPS
- [ ] Check API health endpoint and confirm sweep metrics/error fields are present and sane
- [ ] Review PM2 logs after deploy and verify no new `jobSweep` crash loop/errors
- [ ] Trigger/observe provider heartbeat and verify backend receives/persists `gpu_info`
- [ ] Re-run HTTPS setup script on VPS and confirm idempotent behavior (no duplicate cron/jobs, no fatal errors)
- [ ] Validate key pages in Arabic mode show RTL layout correctly (`/marketplace`, `/renter/billing`, `/admin`, docs pages)
- [ ] Confirm `infra/docker/run-job.sh` exists on host and can execute an isolated test container path without privilege regressions

### Pass/fail criteria
- Pass: No jobSweep crash behavior, heartbeat contains GPU diagnostics, HTTPS setup safely reruns, Arabic RTL rendering is correct, docker isolation script operates.
- Fail: jobSweep crashes, missing `gpu_info`, cert script breaks on re-run, major RTL regressions, or job isolation script unusable.

### Rollback signal
- Immediate rollback candidate for backend stability regressions (jobSweep crashes), heartbeat data loss, or container isolation/security regression.

### Paperclip batch execution comment template
- `DCP-254 smoke: PASS/FAIL at <UTC>. Checks run: jobSweep health+logs, gpu_info heartbeat, https idempotency, i18n RTL, docker isolation. Failures: <none or list>.`

## Execution Tracking Table

| Batch | Deploy Confirmed (UTC) | Smoke Start (UTC) | Smoke End (UTC) | Result | Paperclip Comment Posted |
|---|---|---|---|---|---|
| DCP-172 |  |  |  |  |  |
| DCP-216 |  |  |  |  |  |
| DCP-234 |  |  |  |  |  |
| DCP-241 |  |  |  |  |  |
| DCP-254 |  |  |  |  |  |

## Stop-the-Line Rule

If any rollback signal is hit:
1. Stop remaining smoke checks for later batches.
2. Post a FAIL comment on the current batch issue with exact failing check + timestamp.
3. Notify Claude-Cowork immediately with endpoint/page + repro steps + logs/status code.

## Auth Path Regression Check (DCP-497)

### Scope
- `/login` renter sign-in
- `/jobs/submit` (`components/jobs/JobSubmitForm.tsx`)
- `/renter/playground`

### Manual checks
- [ ] Log in at `https://dcp.sa/login?role=renter` using renter email/API key flow and confirm success redirect.
- [ ] Open `https://dcp.sa/jobs/submit` in the same browser session and confirm the form shows logged-in renter state (no `Authentication Required` gate).
- [ ] Open `https://dcp.sa/renter/playground` and confirm renter session is recognized without re-entering API key.
- [ ] Click logout from submit flow and confirm session is cleared (auth gate returns on refresh).

### Pass/fail criteria
- Pass: Login once on `/login` is honored in submit and playground flows; logout clears both flows.
- Fail: Any flow asks for renter key again immediately after successful login, or logout leaves stale auth state.
