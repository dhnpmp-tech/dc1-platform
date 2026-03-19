# DC1 Agent Communication Log

> **Protocol**: Every agent MUST append an entry here after making changes.  
> **Format**: `## [YYYY-MM-DD HH:MM UTC] AGENT_NAME  Summary`  
> **Agents**: Claude-Cowork (VPS/deploy), Cursor (IDE/analysis), Codex (GitHub/PRs), Nexus (OpenClaw)  
> **Rule**: `git pull` before work, `git push` after logging.

---

## [2026-03-19 07:30 UTC] Frontend Developer — DCP-81: vLLM playground UI wired to live API

- **File**: `app/renter/playground/page.tsx`
- **Changes**:
  - Added `vllm_serve` as a third job type tab ("⚡ vLLM Serve") alongside LLM Inference and Image Gen
  - Added `VLLM_MODELS` list (5 models matching backend's `ALLOWED_VLLM_MODELS`)
  - Added form fields: model selector, duration (15/30/60/120 min), precision (float16/bfloat16/float32), max context length slider
  - `submitJob` now routes `vllm_serve` params correctly (`model`, `max_model_len`, `dtype`, `duration_minutes`)
  - Polling detects `endpoint_url` set + `status: running` to show "Server Ready" panel
  - Result panel shows endpoint URL with copy button + Python code example
  - Job history shows `⚡` icon and "vLLM Serve" label for these jobs, status shows "serving" when running
  - `isSubmitDisabled`: vllm_serve doesn't require prompt input
- **Breaking changes**: None — existing llm_inference and image_generation flows unchanged

---

## [2026-03-19 07:25 UTC] CEO — DCP-76/77 triage, budget governance, frontend rebuild delegation

- **Issues resolved**: DCP-76 (budget correction), DCP-77 (deployment status triage)
- **Issues created**:
  - DCP-78 → Frontend Developer: Rebuild reverted frontend pages (GPU marketplace, provider dashboard, renter templates, earnings, GPU comparison) — **high priority**
  - DCP-79 → Budget Analyst: Update cost report with corrected OPEX structure + break-even analysis — **critical**
  - DCP-80 → QA Engineer: Full page regression on dcp.sa after frontend rebuild — **high**
  - DCP-81 → Frontend Developer: vLLM playground UI integration — **high**
- **Budget decision**: No new agent hires until DCP-79 delivered. P2P/IDE/Blockchain in holding — sprint work done.
- **Bug note**: Known bugs from DCP-77 (NaN balances, undefined counts) already fixed in commits e020a8a + 78e741c
- **Strategic priority**: Phase B delivery (marketplace UI, vLLM, escrow) is the revenue path
- **Breaking changes**: None

---

## [2026-03-18 22:30 UTC] DevRel Engineer — DCP-74: TypeScript renter SDK (dc1-renter-sdk)

- **Files**: `sdk/node/` — multiple files added/updated
- **Changes**:
  - Renamed package from `@dc1/client` to `dc1-renter-sdk` (package.json)
  - Added `DC1RenterClient` flat class (`src/DC1RenterClient.ts`) with methods: `me()`, `register()`, `listProviders(filters?)`, `submitJob()`, `getJob()`, `waitForJob()`, `getJobLogs()`, `cancelJob()`, `getBalance()`, `getPaymentHistory()`
  - Added `cancel()` and `getLogs()` to `JobsResource`
  - Fixed `WalletResource.balance()` to use `/api/renters/balance` (was calling `/api/renters/me` incorrectly — doesn't accept x-renter-key header)
  - Added `me()` to `WalletResource` using correct `?key=` query param
  - Exposed `HttpClient.apiKey` as `readonly` so resources can pass it as query param when needed
  - Updated default `baseUrl` to `https://api.dcp.sa` in both `client.ts` and `DC1RenterClient.ts`
  - Updated User-Agent to `dc1-renter-sdk/0.1.0`
  - Added new types: `Balance`, `JobLog`, `RegisterResult`, `PaymentHistory`, `PaymentHistoryItem`
  - Added `examples/submit-job.ts` (full LLM job lifecycle) and `examples/list-providers.ts`
  - Updated `README.md` with full API reference for `DC1RenterClient`
- **Breaking changes**: None — `DC1Client` still exported; `wallet.balance()` now returns richer `Balance` type
- **Impact**: SDK is now publishable as `dc1-renter-sdk` on npm

---

## [2026-03-18 22:15 UTC] Blockchain Engineer — DCP-75: Wire Escrow.sol into Express.js backend

- **Files**: `backend/src/services/escrow-chain.js` (new), `backend/src/routes/jobs.js`, `backend/src/routes/admin.js`, `backend/ecosystem.config.js`
- **Changes**:
  - Created `ChainEscrowService` singleton with graceful fallback (disabled when `ESCROW_CONTRACT_ADDRESS` unset)
  - `depositAndLock` called fire-and-forget after SQLite escrow hold in `POST /api/jobs/submit`
  - `claimLock` (oracle-signed) called after successful job settlement in `POST /api/jobs/:id/result`
  - `cancelExpiredLock` called after failed job settlement in `POST /api/jobs/:id/result` and `POST /api/jobs/:id/fail`
  - Admin endpoint `GET /api/admin/escrow-chain/status` returns contract address, network, oracle address, isEnabled
  - New env var slots in `ecosystem.config.js`: `ESCROW_CONTRACT_ADDRESS`, `ESCROW_ORACLE_PRIVATE_KEY`, `BASE_RPC_URL`
- **Design**: On-chain calls never block the HTTP response; all errors are caught and logged, falling back to SQLite escrow
- **Network**: Base Sepolia testnet only — do NOT set `ESCROW_CONTRACT_ADDRESS` on mainnet
- **Breaking changes**: None — off-chain SQLite escrow path unchanged when env vars unset

## [2026-03-18 22:05 UTC] P2P Network Engineer — DCP-58: libp2p DHT prototype (Phase C)

- **Files**: `p2p/dc1-node.js` (updated), `p2p/provider-announce.js` (new), `p2p/demo.js` (new), `p2p/README.md` (new), `p2p/package.json` (updated)
- **What**: Built complete Phase C P2P provider discovery prototype
  - `dc1-node.js`: core libp2p node factory with Kademlia DHT, validators, passthrough mapper fix
  - `provider-announce.js`: daemon integration hook (subprocess or HTTP-IPC call)
  - `demo.js`: working end-to-end demo — 2 nodes, provider announces RTX 4090, renter discovers it
  - `README.md`: full architecture, phase roadmap, env vars, daemon integration guide
- **Key fixes** (libp2p 3.x vs spec):
  - Added `@libp2p/identify` and `@libp2p/ping` (required by kad-dht v16)
  - Bumped all package versions to actual latest stable (`@libp2p/noise@^1`, `@libp2p/tcp@^11`, etc.)
  - Set `peerInfoMapper: passthroughMapper` for local-mode: default `removePrivateAddressesMapper` strips 127.0.0.1, emptying routing table
  - Added `validators: { dc1: async () => {} }` + `selectors` — without this verifyRecord throws for unknown namespace
  - Added AbortController timeouts on DHT put/get (default 3-min timeout unusable in demo)
  - Fixed double-appended peer ID in multiaddrs (libp2p 3.x already includes /p2p/peerId)
- **Impact**: `node p2p/demo.js` now shows full P2P discovery — provider announces to DHT, renter discovers by peer ID, both providers found
- **Breaking changes**: None (p2p/ is excluded from tsconfig, not imported by Next.js or backend)
- **Issue**: DCP-58 (done)

## [2026-03-18 22:10 UTC] DevRel Engineer — DCP-73: Python provider SDK (dc1_provider)

- **Files**: `sdk/python/dc1_provider/__init__.py`, `client.py`, `models.py`, `exceptions.py`, `_http.py`
- **Files**: `sdk/python/examples/register.py`, `heartbeat.py`, `list_jobs.py`
- **Files**: `sdk/python/README.md` (appended provider SDK section)
- **What**: Built `dc1_provider` Python package — pip installable, stdlib-only, Python 3.9+
  - `DC1ProviderClient` with: `me()`, `register()`, `heartbeat()`, `announce()`, `get_jobs()`, `get_earnings()`, `build_resource_spec()`
  - Models: `ProviderProfile`, `ProviderJob`, `Earnings` (all SAR/halala helpers)
  - Exceptions: `DC1APIError`, `AuthError`
  - Auth: `x-provider-key` header for POST, `?key=` query param for GET (matches backend contract)
  - `build_resource_spec()` runs `nvidia-smi` + `/proc/meminfo` for GPU auto-detection
- **Breaking changes**: None — additive only alongside existing renter `dc1` package

---

## [2026-03-18 21:45 UTC] Frontend Developer — DCP-69: Add 4 missing landing page sections

- **Files**: `app/page.tsx`
- **Changes**: Added 4 sections to homepage (inserted before CTA):
  1. **Provider Setup Demo** — 4-step numbered flow with curl/PowerShell code blocks, "Start Earning in 5 Minutes" tone
  2. **Founding Rates Table** — GPU pricing table (RTX 3080/3090/4090/A100) with SAR/hr and 75% provider earnings
  3. **What You Can Run** — 6 workload cards (LLM, SD, PyTorch, Jupyter, Docker, CUDA) with icons and tags
  4. **Programmatic Integration** — curl job submission code example, OpenAPI reference, feature checklist
- **Design**: All sections use DC1 tokens (dc1-amber, dc1-surface-l1, dc1-border, dc1-text-*); pattern matches existing sections
- **JSX**: Tags balanced 138/138; build blocked by pre-existing EACCES `.next/trace` root-owned file (not code issue)
- **Issue**: DCP-69 (QA finding from DCP-43 audit vs Replit spec)
- **Breaking changes**: None — additive content only

## [2026-03-18 21:35 UTC] Frontend Developer — DCP-68: Fix landing page header nav + CTA buttons

- **Files**: `app/components/layout/Header.tsx`, `app/page.tsx`
- **Changes**:
  - Nav labels updated: `Home/For Providers/For Renters` → `Compute/Supply/Docs`
  - CTA buttons updated: `Sign In` → `Console Login`, `Get Started` → `Get Early Access`
  - Hero headline updated: `Power, Digitalized` → `Borderless GPU Compute`
  - Mobile menu CTA buttons updated to match desktop
- **Issue**: DCP-68 (QA finding from DCP-43 audit vs Replit spec)
- **Breaking changes**: None — header/nav only, no API or dashboard changes

## [2025-03-11 10:00 UTC] Claude-Cowork  Daemon consolidation

- **Commit**: `5f90e1d`  Refactored `daemon.ps1` into thin installer v2.0.0 (303159 lines)
- **Files**: `backend/installers/daemon.ps1`
- **Impact**: daemon.ps1 now only installs; all runtime logic lives in `dc1_daemon.py v3.3.0`
- **Issue**: #34 created with full architecture docs

## [2025-03-11 11:30 UTC] Claude-Cowork  Registration error fix

- **Commit**: `a53509f`  Fix duplicate email error message in provider-onboarding.html
- **Files**: `backend/public/provider-onboarding.html` (line 485)
- **Bug**: Frontend threw generic `Registration failed` instead of reading server's 409 response
- **Fix**: Now reads `response.json()` body  shows "A provider with this email already exists"
- **Tested**: Verified via direct API call  409 + correct error JSON returned

## [2025-03-12 08:00 UTC] Claude-Cowork — Phase 1: Unified Design System + Playground Integration

- **Branch**: `phase1-unified-design-system` → merged via PR #36 (squash)
- **Commit on main**: `3840a66`
- **What changed**:
  - Created unified DC1 design system: amber (#F5A524), void black (#07070E), surface hierarchy (l1/l2/l3)
  - Built reusable components: `DashboardLayout`, `StatCard`, `StatusBadge`, `Footer`
  - Added Tailwind custom classes: `dc1-amber`, `dc1-void`, `dc1-surface-l1/l2/l3`, `dc1-text-primary/secondary/muted`
  - Redesigned all pages (provider register, provider dashboard, renter dashboard, renter register, login, admin)
  - Integrated GPU Playground directly into renter dashboard as tabbed interface (Overview + Playground)
- **Files** (16 files): `tailwind.config.ts`, `app/globals.css`, `app/components/layout/DashboardLayout.tsx`, `app/components/layout/Footer.tsx`, `app/components/ui/StatCard.tsx`, `app/components/ui/StatusBadge.tsx`, all page.tsx files
- **Impact**: All pages now share consistent DC1 brand design. Playground is accessible from renter dashboard tab.

## [2025-03-12 10:00 UTC] Claude-Cowork — Phase 2: Wire Registration & Login to Real VPS API

- **Branch**: `phase2-live-registration` → merged via PR (squash)
- **Commit on main**: `3c4e285`
- **What changed**:
  - **Login page** (`app/login/page.tsx`): Complete rewrite from demo email/password to real API key auth. Supports renter (`/renters/me?key=`), provider (`/providers/me?key=`), admin (`/admin/dashboard` with `x-admin-token` header). Stores correct localStorage keys (`dc1_renter_key`, `dc1_provider_key`, `dc1_admin_token`).
  - **Provider registration** (`app/provider/register/page.tsx`): Fixed field mapping (fullName→name, gpuModel→gpu_model, operatingSystem→os). Fixed response parsing (api_key, provider_id). Fixed status polling to use `/providers/me?key=`. Fixed Windows installer URL to `/download/setup?os=windows`.
  - **Provider dashboard** (`app/provider/page.tsx`): Fetches real data from `/providers/me?key=`. Maps `total_jobs`, earnings fields. Falls back to mock if API unreachable.
  - **Renter dashboard** (`app/renter/page.tsx`): Fixed localStorage persistence on manual login.
- **API contract notes for other agents**:
  - `/providers/me` reads `req.query.key` ONLY (not header) for auth
  - `/admin/*` routes use `x-admin-token` header (not `x-admin-key`)
  - Provider response uses `total_jobs` (not `jobs_completed`), `total_earnings_halala`, `today_earnings_halala`
- **Impact**: All registration, login, and dashboard flows now hit the real VPS backend.

## [2025-03-12 12:00 UTC] Claude-Cowork — Phase 3: Building Missing Pages (IN PROGRESS)

- **Branch**: `phase3-missing-pages`
- **What's being built**: Admin dashboard (wired to real API), legal pages (terms, privacy, acceptable-use), docs pages, support, renter marketplace, renter billing, provider/dashboard redirect
- **Footer 404 audit**: 10 links in Footer.tsx and other pages pointed to non-existent routes
- **Status**: In progress

---

## [2026-03-14 05:35 UTC] Claude-Cowork — Phase 4C: Health monitoring, reconciliation, security hardening

- **Commit**: `6ea6dfd`
- **Files**: `backend/src/server.js`, `backend/src/routes/admin.js`
- **What changed**:
  - **server.js**: Added security headers middleware (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy) and input sanitization middleware (strips HTML tags + null bytes from all req.body/req.query strings)
  - **admin.js**: Added `GET /admin/health` endpoint (DB check, online providers, active/stuck jobs, recent errors, critical daemon events, pending withdrawals — returns healthy/degraded status)
  - **admin.js**: Added `GET /admin/finance/reconciliation` endpoint (split mismatches, missing billing data, provider earnings drift, renter spend drift — configurable `?days=` param up to 90)
- **Impact**: Completes Phase 4C security hardening. All admin endpoints now behind security headers + sanitized inputs. Health and reconciliation endpoints live on VPS.
- **Breaking**: None
- **Deployed**: Yes — VPS pm2 restarted, both endpoints verified working

---

## [2026-03-14 05:50 UTC] Claude-Cowork — Admin page enhancements: health banner, audit log, reconciliation

- **Commit**: `6ec2685`
- **Files**: `app/admin/fleet/page.tsx`, `app/admin/security/page.tsx`, `app/admin/finance/page.tsx`
- **What changed**:
  - **Fleet Health**: Added system health status banner — DB status, online providers, active/stuck jobs, errors, pending withdrawals
  - **Security**: Added Admin Audit Log section with paginated table from `/admin/audit`
  - **Finance**: Added Financial Reconciliation section with period selector and provider/renter drift tables from `/admin/finance/reconciliation`
- **Impact**: All admin pages now wired to live backend data
- **Breaking**: None

---

## [2026-03-14 06:15 UTC] Claude-Cowork — Complete 4B + 4C: bulk ops, CSP, webhook/Telegram alerting

- **Commit**: `386c783`
- **Files**: `backend/src/server.js`, `backend/src/routes/admin.js`, `backend/src/routes/providers.js`, `backend/src/services/notifications.js` (NEW), `app/admin/providers/page.tsx`, `app/admin/renters/page.tsx`
- **What changed**:
  - **4B Bulk Ops**: Multi-select checkboxes on providers + renters pages. Bulk suspend/unsuspend providers, bulk suspend/unsuspend/credit renters. Backend: `POST /admin/bulk/providers`, `POST /admin/bulk/renters` with audit logging
  - **4C CSP**: Added Content-Security-Policy header to server.js
  - **4C Notifications**: Created `notifications.js` service — supports generic webhooks + Telegram Bot API. Admin endpoints: `GET/POST /admin/notifications/config`, `POST /admin/notifications/test`. Config stored in `notification_config` table (auto-created). Auto-alerts fire on critical daemon events (crashes, errors)
- **Impact**: Phase 4B and 4C now fully complete. All security hardening, bulk operations, and alerting infrastructure in place.
- **Breaking**: None
- **New table**: `notification_config` (auto-created on first access)

---

## [2026-03-14 08:15 UTC] Claude-Cowork — Dashboard improvements: quick wins + high-impact features

- **Commit**: `fa94802`
- **Files**: `app/provider/page.tsx`, `app/provider/settings/page.tsx`, `app/renter/page.tsx`, `app/renter/billing/page.tsx`, `app/renter/marketplace/page.tsx`
- **What changed**:
  - **P6**: Added "This Week" earnings stat card to provider dashboard (5-col grid, wired to `week_earnings_halala`)
  - **P7**: Removed dead `generateMockData()` function from provider dashboard
  - **P1**: Added Pause/Resume GPU toggle button to provider dashboard header (POST /providers/pause and /resume)
  - **P2**: Built GPU Preferences panel in provider Settings: run mode, schedule, GPU cap, VRAM reserve, temp limit (POST /providers/preferences)
  - **R1**: Fixed currency display from "$" to "SAR" on renter dashboard stat cards
  - **R6**: Added 30s auto-refresh interval to renter dashboard
  - **R2**: Added Top-Up / Add Funds section to renter Billing page (POST /renters/topup)
  - **R3**: Wrapped Marketplace in DashboardLayout with full sidebar nav, added reliability score + cached models
- **Impact**: 8 dashboard improvements completed. Provider and renter UX significantly enhanced.
- **Breaking**: None

---

## [2026-03-14 10:30 UTC] Claude-Cowork — Phase 4: Advanced dashboard features (P8-P10, R7-R9)

- **Commit**: `3702168`
- **Files**: `app/provider/jobs/[id]/page.tsx` (NEW), `app/provider/page.tsx`, `app/provider/jobs/page.tsx`, `app/provider/settings/page.tsx`, `app/renter/jobs/[id]/page.tsx` (NEW), `app/renter/settings/page.tsx` (NEW), `app/renter/analytics/page.tsx` (NEW), `app/renter/page.tsx`, `app/renter/jobs/page.tsx`, `app/renter/marketplace/page.tsx`, `app/renter/billing/page.tsx`
- **What changed**:
  - **P8**: Provider job detail page at `/provider/jobs/[id]` — earnings breakdown (75/25 split), job parameters, error display, 10s auto-refresh
  - **P9**: 7-day earnings bar chart on Provider dashboard using `earnings-daily` API
  - **P10**: Notification preferences section in Provider settings — 6 notification types
  - **R7**: Renter settings page at `/renter/settings` — profile, account stats, API key management (show/copy/rotate)
  - **R8**: Renter analytics page at `/renter/analytics` — daily spending chart, job type breakdown, success rate, outcome stats
  - **R9**: Renter job detail page at `/renter/jobs/[id]` — output display (LLM text + image gen), performance metrics, retry button
  - Added Settings nav item to all renter sidebar navigations (6 pages updated)
  - Linked job tables to detail pages in both dashboards
- **Impact**: All planned dashboard improvement items now complete. Both dashboards feature-complete.
- **Breaking**: None
- **New pages**: 4 (`provider/jobs/[id]`, `renter/jobs/[id]`, `renter/settings`, `renter/analytics`)

---

## [2026-03-18 21:35 UTC] Blockchain Engineer — DCP-70: Escrow.sol — EVM payment escrow scaffold (Base Sepolia)

- **Files (NEW)**: `contracts/contracts/Escrow.sol`, `contracts/contracts/MockUSDC.sol`, `contracts/hardhat.config.js`, `contracts/scripts/deploy.js`, `contracts/test/Escrow.test.js`, `contracts/abis/Escrow.json`, `contracts/package.json`, `contracts/.env.example`, `contracts/.gitignore`, `contracts/README.md`
- **Files (MODIFIED)**: `tsconfig.json` (added `contracts` to excludes)
- **What changed**:
  - **Escrow.sol**: Full EVM escrow contract — `depositAndLock`, `claimLock`, `cancelExpiredLock`, `getEscrow` + `setOracle`. ECDSA oracle proof verification. 75/25 fee split. ReentrancyGuard + Ownable (OZ v5).
  - **MockUSDC.sol**: Test-only ERC20 with 6 decimals and open `mint()`.
  - **hardhat.config.js**: Hardhat toolbox, Base Sepolia (chainId 84532, RPC https://sepolia.base.org), Basescan verification.
  - **deploy.js**: Deploys Escrow, exports ABI + address to `contracts/abis/Escrow.json` for backend consumption.
  - **Escrow.test.js**: 16 tests covering all functions, edge cases, oracle signature verification, 75/25 split math.
  - **abis/Escrow.json**: Static pre-computed ABI (address populated on deploy).
  - **README.md**: Architecture docs, deploy steps, backend integration plan.
- **Impact**: DC1 on-chain payment layer foundation. Zero blockchain components → full testnet-ready escrow. Backend integration (ethers.js wiring) is a separate follow-up issue.
- **Breaking**: None — contracts/ is isolated, no changes to backend or frontend code paths.
- **Deploy command**: `cd contracts && npm install && npm run deploy:sepolia`
- **Test command**: `cd contracts && npm install && npm test`

---

## [2026-03-14 09:30 UTC] Claude-Cowork — Phase 3: Dashboard consistency & polish (P3-P5, R4-R5)

- **Commit**: `6a0cf9c`
- **Files**: `app/provider/earnings/page.tsx`, `app/provider/page.tsx`, `app/renter/page.tsx`, `app/renter/jobs/page.tsx`
- **What changed**:
  - **P3+P4**: Rewrote Provider Earnings page — now uses DashboardLayout with full sidebar nav, localStorage auth (redirects to login if no key), DC1 design tokens (replacing hardcoded hex colors), StatCard components, StatusBadge, and 60s auto-refresh. Removed query-param auth pattern.
  - **P5**: Added daemon connection status badge to Provider dashboard GPU Health section — shows Connected (green pulse, <2min), Stale (yellow, <5min), or Disconnected (red) based on `last_heartbeat`. Also shows daemon version.
  - **R4**: Consolidated duplicate Playground — removed the full embedded playground from Renter dashboard (1012→280 lines). Dashboard now has clean overview with GPU table, recent jobs, and quick action links to standalone `/renter/playground`.
  - **R5**: Added 30s auto-refresh to Renter Jobs page + subtitle with job count
- **Impact**: All dashboard pages now use consistent DashboardLayout, auth patterns, and design tokens. Renter dashboard drastically simplified.
- **Breaking**: Provider Earnings page no longer uses `?key=` query param — uses localStorage instead. Old bookmarked links with `?key=` will show login redirect.

---

## [2026-03-14 07:40 UTC] Claude-Cowork — Phase 4 Final: Headless API Migration

- **Commit**: (pending push)
- **Files**: `backend/src/server.js`
- **What changed**:
  - **Removed HTML serving**: Stripped `express.static` for public dir, removed `/provider-onboarding` route, removed `/docs` route, removed `/` HTML redirect
  - **Root route**: Now returns JSON API info (`service`, `version`, `status`, `frontend`, `docs`, `timestamp`) instead of serving `provider-onboarding.html`
  - **Health check**: Updated service name to `dc1-platform-api` with `mode: headless`
  - **CSP simplified**: Changed from full browser CSP to strict API-only CSP (`default-src 'none'; frame-ancestors 'none'`)
  - **Console logs**: Updated startup messages to reflect headless API mode
  - **Preserved**: `/installers` static serving for daemon downloads, all `/api/*` routes unchanged
- **Verified on VPS**:
  - `GET /` returns JSON API info (200)
  - `GET /api/health` returns `{ mode: "headless" }` (200)
  - `GET /admin/dashboard` works with auth (200)
  - `GET /provider-onboarding.html` returns 404
  - `GET /docs` returns 404
  - `GET /admin.html` returns 404
  - `GET /installers/daemon.sh` and `daemon.ps1` still accessible (200)
- **Impact**: VPS is now a pure headless API server. All frontend served by Next.js on Vercel (dc1st.com). Phase 4 migration plan is **COMPLETE**.
- **Breaking**: Anyone bookmarking `http://76.13.179.86:8083/provider-onboarding.html` or `/docs` directly will get 404 — they should use `dc1st.com` instead.

---

## [2026-03-14 15:15 UTC] Claude-Cowork — Wire internal dashboards to real APIs + misc improvements

- **Commit**: `cf13e53`
- **Files**: `app/intelligence/page.tsx`, `app/connections/page.tsx`, `app/security/page.tsx`, `app/docs/api/page.tsx`, `app/docs/page.tsx`, `app/docs/provider-guide/page.tsx`, `app/docs/renter-guide/page.tsx` (NEW), `app/not-found.tsx` (NEW), `app/budget/page.tsx`, `app/components/DashboardLayout.tsx`, `app/components/layout/Footer.tsx`, `app/tokens/page.tsx`
- **What changed**:
  - **I1**: Intelligence dashboard now fetches from `GET /admin/dashboard` + `GET /admin/providers` — shows real provider fleet stats, GPU distribution, provider cards with driver/compute/VRAM, and fleet activity chart. Shows LIVE/Offline badge.
  - **I2**: Connections monitor now pings real VPS API + Mission Control for live service health checks. Hardware section shows real registered providers from admin API. Agent heartbeats remain static (agent roster).
  - **I3**: Security dashboard derives events from real provider data — new registrations (<24h), failed heartbeats, extended offline, online status. Flag button wired to admin suspend endpoint.
  - **D1**: Created `/docs/renter-guide` — complete quickstart guide (account creation, browsing GPUs, first job, billing, API examples).
  - **D2**: Enhanced API docs with curl examples, error response shapes, HTTP status codes, example responses for all endpoints.
  - **P1a**: Custom 404 page with DC1 branding, 4 quick nav cards, support/docs links.
  - **P2d**: All domain references updated from `dc1-platform.vercel.app` to `dcp.sa` (Footer, docs, connections).
  - **P3**: Internal DashboardLayout nav standardized (Dashboard→Mission Control, added Budget, removed Token Usage). DC1 design tokens applied.
  - **P5**: `/tokens` now redirects to `/budget`. Budget page has Model Cost Rates section (Sonnet/Haiku/Opus/MiniMax).
- **Impact**: All 3 internal dashboards (Intelligence, Connections, Security) now wire to real VPS admin API with graceful fallback. 2 new pages created. API docs significantly improved. Domain references updated for dcp.sa launch.
- **Breaking**: None. All pages gracefully handle API offline state.

---

<!-- NEXT ENTRY GOES HERE — Append above this line -->

## [2026-03-18 18:30 UTC] Frontend Developer — DCP-47: Arabic UI + RTL support (Phase C)

- **Issue**: DCP-47 (Medium priority)
- **Files**:
  - `lib/i18n.tsx` — NEW: Language context, LanguageProvider, useLanguage hook, LangToggle component, useJobStatusLabel helper. Full EN/AR translation strings: nav, hero, foundingRates, twoPaths, capabilities (6 items), providerSteps (4 steps), apiExample, features (4 items), CTA, footer, common labels, jobStatus.
  - `app/components/providers/LanguageWrapper.tsx` — NEW: Client wrapper providing LanguageContext to the app tree
  - `app/layout.tsx` — Wrap children with LanguageWrapper, added `dir="ltr"` to `<html>`
  - `app/globals.css` — RTL CSS: `[dir='rtl'] body` Arabic fonts, `.font-arabic` utility, RTL section-heading border flip, RTL table text-right
  - `app/page.tsx` — Full landing page wired to `useLanguage()`. All sections translated. LangToggle in nav. Code blocks preserve `dir="ltr"`.
  - `app/components/layout/Footer.tsx` — Added `'use client'`, wired to `useLanguage()` for translated headings and links
  - `app/components/layout/DashboardSidebar.tsx` — RTL-aware border direction, sidebar position, LangToggle in user section + mobile topbar
  - `app/components/layout/Header.tsx` — LangToggle button in desktop nav
  - `app/login/page.tsx` — Platform badge and title use translations

### Details
- Language stored in `localStorage` key `dc1_lang`
- On switch: `document.documentElement.lang` + `.dir` updated via useEffect
- Arabic fonts already loaded (IBM Plex Sans Arabic, Tajawal) in layout.tsx
- SAR amounts use Western numerals per spec; step numbers use Eastern Arabic-Indic
- `useJobStatusLabel()` hook available for dashboard pages to translate job status strings
- **Breaking**: None

## [2026-03-18 17:35 UTC] DevOps Automator — DCP-46: VPS env var audit + deployment validation

- **Issue**: DCP-46 (High priority)
- **Files**:
  - `backend/ecosystem.config.js` — added all missing env var slots with CHANGE_ME placeholders
  - `backend/src/server.js` — added dc1st.com + www.dc1st.com to CORS ALLOWED_ORIGINS

### Audit Results

| Check | Status | Notes |
|-------|--------|-------|
| VPS API running | ✅ | v4.0.0, port 8083 |
| Admin auth | ✅ | Token works |
| DC1_HMAC_SECRET in PM2 | ❌ CRITICAL | NOT in ecosystem.config.js → daemon gets empty secret |
| MOYASAR_SECRET_KEY in PM2 | ❌ | NOT set → payments broken |
| MOYASAR_WEBHOOK_SECRET in PM2 | ❌ | NOT set → webhook verification fails |
| FRONTEND_URL in PM2 | ❌ | NOT set (using default https://dc1st.com) |
| DC1_ADMIN_TOKEN | ⚠️ | Set but DEFAULT value exposed in source — rotate needed |
| api.dcp.sa DNS → 76.13.179.86 | ❌ BLOCKED | Points to Vercel (DEPLOYMENT_NOT_FOUND). HTTPS setup cannot proceed. |
| DCP-31 payments routes live | ❌ | /api/admin/payments → 404. PM2 not reloaded since code added. |
| DCP-32 escrow routes live | ❌ | /api/admin/escrow → 404. Same. |
| DCP-33 templates routes live | ❌ | /api/templates → 404. Same. |
| dc1st.com in CORS | ❌ Fixed | Was missing — added to hardcoded list + CORS_ORIGINS in ecosystem |

### Actions taken (code-only, VPS restart needed)
1. `ecosystem.config.js` — added DC1_HMAC_SECRET, MOYASAR_SECRET_KEY, MOYASAR_WEBHOOK_SECRET, FRONTEND_URL, CORS_ORIGINS, BACKEND_URL slots
2. `server.js` — added dc1st.com to CORS allowlist

### Board action required
1. **SSH to VPS** → edit `ecosystem.config.js` → replace all `CHANGE_ME_*` with real secrets
2. **`DC1_HMAC_SECRET`** → run `openssl rand -hex 32` on VPS, paste result
3. **`MOYASAR_SECRET_KEY`** → get from Moyasar dashboard (sandbox: sk_test_..., live: sk_live_...)
4. **`MOYASAR_WEBHOOK_SECRET`** → get from Moyasar webhook config
5. **`DC1_ADMIN_TOKEN`** → rotate to a new value (current is in source control)
6. **`git pull origin main`** on VPS, then `pm2 reload ecosystem.config.js`
7. **DNS fix**: Update api.dcp.sa A record → 76.13.179.86 (currently points to Vercel). Only then run `setup-https.sh`.
8. **Notify active providers** (especially Yazan Almazyad) to re-download daemon once HMAC secret is set.

## [2026-03-18 17:30 UTC] Frontend Developer — DCP-42: Replit-matched UI (Phase 1-3)

- **Issue**: DCP-42 (Critical priority)
- **Files**:
  - `tailwind.config.ts` — added `dcp-*` color token namespace (aliases for dc1-* with same values + dcp-border-hover: amber)
  - `app/globals.css` — added `.dcp-card` and `.dcp-card-hover` utility classes with hover-to-amber border transition
  - `app/page.tsx` — full landing page rebuild with 10 sections: Nav, Hero, Terminal block, Founding Rates Table, Two Paths, Capability Cards (2×3), Provider Steps, API Code Example, Feature Highlights, Footer
  - `app/components/layout/DashboardSidebar.tsx` — hover-to-amber border-l transition on inactive nav items
  - `app/login/page.tsx` — DCP branding: amber icon + "Decentralized Compute Platform" tagline, renamed "Console Login"
  - `app/components/layout/Footer.tsx` — rebuilt with 3-column layout per spec: Infrastructure (Providers, Pricing, Status), Developers (API Docs, Provider Guide, Renter Guide), Legal (Terms, Privacy, Acceptable Use); updated brand to amber DC icon

### Changes summary
- **Phase 1**: `dcp-` prefix token aliases in tailwind; `.dcp-card`/`.dcp-card-hover` with `hover:border-dcp-amber/50` in globals.css
- **Phase 2**: Landing page fully rebuilt — dark void bg, "Borderless GPU Compute" hero, daemon install terminal block, founding rates table (RTX 3080/3090/4090/A100), Two Paths cards (Playground vs Custom Jobs), 6-capability grid, 4-step provider onboarding, curl API example block, 4-feature highlights grid, final CTA
- **Phase 3**: Sidebar hover-amber border added; login page DCP tagline; footer 3-column layout

### Breaking changes
- None — all existing API integrations, localStorage keys, and routes unchanged

## [2026-03-18 17:15 UTC] DevOps Automator — DCP-34: vLLM serverless endpoint deployment

- **Issue**: DCP-34 (High priority)
- **Files**:
  - `backend/src/db.js` — 2 new migrations: `jobs.endpoint_url TEXT`, `jobs.serve_port INTEGER`
  - `backend/src/routes/jobs.js` — `vllm_serve` job type: cost rate (20 hal/min), ALLOWED_JOB_TYPES, `generateVllmServeSpec()`, JOB_TEMPLATES entry, `result_type='endpoint'`, `POST /:job_id/endpoint-ready` route
  - `backend/installers/dc1_daemon.py` — `VRAM_REQUIREMENTS["vllm_serve"]=14336`, `_find_free_port()`, `_get_public_ip()`, `run_vllm_serve_job()`, `execute_job()` vllm_serve branch
  - `backend/installers/dc1-daemon.py` — same changes (mirror)

### Architecture
1. Renter submits `vllm_serve` job with `params.model` + `duration_minutes`
2. Backend generates JSON task_spec: `{serve_mode:true, model, max_model_len, dtype}`
3. Daemon: allocates free port (8100-8199), pulls `vllm/vllm-openai:latest`, starts detached container with `-p port:8000 --network bridge`
4. Daemon polls `http://127.0.0.1:port/health` every 5s (up to 5 min) until ready
5. Daemon POSTs `POST /api/jobs/:id/endpoint-ready` → backend stores `endpoint_url = http://provider_ip:port/v1`
6. Renter reads `GET /api/jobs/:id` → gets `endpoint_url`, calls `/v1/chat/completions` directly
7. Daemon monitors every 30s; stops+removes container when job status leaves `running`

### Cost: 20 halala/min (12 SAR/hr)
### Allowed models: TinyLlama-1.1B, Mistral-7B, Llama-3-8B, Phi-3-mini, Gemma-2B-it
### VRAM guard: 14336 MiB — providers with < 14 GB free VRAM auto-reject
### Breaking: None — all additive. Providers need daemon re-download.

---

## [2026-03-18 17:00 UTC] Backend Architect — DCP-32: Off-chain escrow hold/release system

- **Issue**: DCP-32 (High priority)
- **Files**:
  - `backend/src/db.js` — `escrow_holds` table + 4 indexes + `providers.claimable_earnings_halala` migration
  - `backend/src/routes/jobs.js` — escrow create/lock/release through job lifecycle + new `/fail` endpoint
  - `backend/src/routes/providers.js` — earnings + withdraw endpoints use `claimable_earnings_halala`
  - `backend/src/routes/admin.js` — new `GET /api/admin/escrow` endpoint

### What changed

**DB**: `escrow_holds` table — `id` (esc-{job_id}), `renter_api_key`, `provider_id`, `job_id` (UNIQUE), `amount_halala`, `status` (held|locked|released_provider|released_renter|expired), `created_at`, `expires_at`, `resolved_at`. Indexed on job_id, renter, provider, expires. Added `claimable_earnings_halala INTEGER DEFAULT 0` to providers for integer-precise earnings tracking.

**Job lifecycle escrow tracking**:
- `POST /api/jobs/submit` → creates `escrow_holds` record (status=`held`) after balance deduction. Expires at job timeout + 30min settlement buffer.
- `GET /api/jobs/assigned` (daemon pickup) → advances escrow to `locked`
- `POST /api/jobs/:id/result` (daemon success) → `released_provider`, increments `claimable_earnings_halala`; (daemon failure, no result) → `released_renter` + refunds renter balance
- `POST /api/jobs/:id/fail` (NEW explicit daemon failure endpoint) → `released_renter` + refund
- `POST /api/jobs/:id/complete` (renter-initiated) → `released_provider`, increments `claimable_earnings_halala`
- `POST /api/jobs/:id/cancel` → `released_renter`
- Timeout sweeper → `expired`

**Provider earnings**:
- `GET /api/providers/earnings` → returns `claimable_earnings_halala`, `available_halala`, `escrow.held/locked` summary. Falls back to `total_earnings * 100` for pre-escrow providers.
- `POST /api/providers/withdraw` → validates against `claimable_earnings_halala` (halala-precise, no SAR float drift)

**Admin**: `GET /api/admin/escrow?status=&provider_id=` — full hold list + summary (held/locked/released_provider/released_renter/expired totals in halala and SAR)

### Breaking changes
- None — all additive. Existing jobs and providers work without escrow records (graceful fallback to `total_earnings`).
- New `/api/jobs/:id/fail` endpoint is additive (existing daemons still use `/result`).

## [2026-03-18 16:10 UTC] DevOps Automator — DCP-33: Docker compute template library

- **Issue**: DCP-33 (Medium priority)
- **Files**:
  - `docker-templates/` (NEW dir) — 6 JSON template specs
  - `backend/src/routes/templates.js` (NEW) — `GET /api/templates`, `GET /api/templates/whitelist`, `GET /api/templates/:id`
  - `backend/src/server.js` — registered templates router at `/api/templates`
  - `backend/src/routes/jobs.js` — added `custom_container` to `ALLOWED_JOB_TYPES`, added `generateCustomContainerSpec()` + entry in `JOB_TEMPLATES`
  - `backend/installers/dc1-daemon.py` — `APPROVED_IMAGES` set, image_override JSON parsing + whitelist validation in `run_docker_job()`
  - `backend/installers/dc1_daemon.py` — same changes (mirror)
  - `app/renter/templates/page.tsx` (NEW) — template picker UI with provider selection, duration, params, submit
  - 8 renter page files — added TemplatesIcon + Templates nav item (`/renter/templates`) after Marketplace

### Templates
| ID | Name | Image | VRAM | SAR/hr |
|----|------|-------|------|--------|
| `vllm-serve` | vLLM Serve | dc1/llm-worker | 16 GB | 9.00 |
| `stable-diffusion` | Stable Diffusion | dc1/sd-worker | 4 GB | 12.00 |
| `jupyter-gpu` | Jupyter GPU Notebook | dc1/general-worker | 4 GB | 9.00 |
| `pytorch-training` | PyTorch Training | dc1/general-worker | 8 GB | 9.00 |
| `ollama` | Ollama LLM | dc1/llm-worker | 4 GB | 9.00 |
| `custom-container` | Custom Container | user-specified | 4 GB | 9.00 |

### Security
- `GET /api/templates/whitelist` — daemon-fetchable approved image list
- `APPROVED_IMAGES` set in daemon validates `image_override` field before use
- Rejected images emit `container_image_rejected` audit event, fall back to default
- Custom containers limited to 9 approved base images (dc1/* + PyTorch official + NVIDIA NGC + TF official)

### Breaking changes
- None — `custom_container` job_type is new; existing job types unchanged

## [2026-03-18 16:00 UTC] Backend Architect — DCP-31: SAR payment integration via Moyasar

- **Issue**: DCP-31 (High priority)
- **Files**:
  - `backend/src/db.js` — `payments` table + indexes, idempotent migrations for `refunded_at`/`refund_amount_halala`
  - `backend/src/routes/payments.js` — NEW: full Moyasar payment route module
  - `backend/src/server.js` — mount `/api/payments`, add payment rate limiter (10/IP/min)
  - `backend/src/routes/admin.js` — 3 new admin endpoints: payment list, revenue, refund

### What changed

**Gateway choice: Moyasar**
Chosen over Tap Payments for: Saudi-first (mada support), SAR-native currency, SAMA compliance, simpler API, good sandbox (sk_test_ keys).

**DB**: `payments` table — `payment_id` (Moyasar ID), `renter_id`, `amount_sar`, `amount_halala`, `status` (initiated/paid/failed/refunded), `source_type` (creditcard/mada/applepay), `checkout_url`, `gateway_response`, `confirmed_at`, `refunded_at`, `refund_amount_halala`. Indexed on `renter_id`, `payment_id`, `status`.

**Payment endpoints**:
- `POST /api/payments/topup` — Creates Moyasar payment (Basic auth with `MOYASAR_SECRET_KEY`), returns `checkout_url` for hosted payment. Validates 1–10,000 SAR, source type whitelist.
- `POST /api/payments/topup-sandbox` — Dev-only direct balance credit (disabled when `MOYASAR_SECRET_KEY` is set)
- `POST /api/payments/webhook` — Moyasar webhook handler: HMAC-SHA256 signature verification (`MOYASAR_WEBHOOK_SECRET`), idempotent `paid`/`failed`/`refunded` processing, credits balance on `paid`
- `GET /api/payments/verify/:paymentId` — Frontend polling after redirect: fetches live Moyasar status, auto-syncs balance if gateway reports `paid` but local is still `initiated`
- `GET /api/payments/history` — Renter's paginated payment history with totals

**Admin endpoints**:
- `GET /api/admin/payments` — All payments with renter join, filter by status/search, summary stats
- `GET /api/admin/payments/revenue` — Daily revenue breakdown, configurable `?days=` up to 365
- `POST /api/admin/payments/:paymentId/refund` — Moyasar refund API call (or manual fallback for sandbox/no-key)

### Breaking changes
- None — all additive. Existing `/api/renters/topup` (direct balance add) still works.

### Required env vars (set in PM2 ecosystem or .env)
- `MOYASAR_SECRET_KEY` — Moyasar live/test secret (e.g. `sk_live_...` or `sk_test_...`)
- `MOYASAR_WEBHOOK_SECRET` — Moyasar webhook secret for HMAC verification (defaults to `MOYASAR_SECRET_KEY` if not set)
- `FRONTEND_URL` — Frontend base URL for callback (defaults to `https://dc1st.com`)
- Set webhook URL in Moyasar dashboard to `https://api.dcp.sa/api/payments/webhook`

## [2026-03-18 14:05 UTC] Founding Engineer — DCP-27: Ocean-style resource_spec schema for GPU advertisement

- **Issue**: DCP-27 (High priority)
- **Files**:
  - `backend/src/db.js` — migration: `providers.resource_spec TEXT`
  - `backend/src/routes/providers.js` — register, heartbeat, GET /me
  - `backend/installers/dc1_daemon.py` — `build_resource_spec()` + heartbeat payload
  - `backend/installers/dc1-daemon.py` — same (mirror)
  - `app/provider/page.tsx` — Resource Advertisement card on dashboard

### What changed
- **DB**: Added `resource_spec TEXT` column to providers table via idempotent migration
- **Register** (`POST /api/providers/register`): Accepts optional `resource_spec` JSON, stores it at registration time
- **Heartbeat** (`POST /api/providers/heartbeat`): Accepts `resource_spec` from daemon, updates provider record each heartbeat
- **GET /me**: Now returns `resource_spec`, `gpu_count_reported`, `gpu_compute_capability`, `gpu_cuda_version`, `daemon_version` in provider object
- **Daemon**: Added `build_resource_spec(gpu)` function — constructs Ocean-style `{resources:[...]}` from CPU (multiprocessing), RAM (/proc/meminfo), disk (shutil), and per-GPU entries (model, VRAM GB, CUDA version, compute capability, driver) from `detect_gpu()`. Included in every heartbeat payload.
- **Frontend**: Provider dashboard shows "Resource Advertisement" card — GPU tiles (model, VRAM, CUDA, compute cap, driver) and system resource tiles (CPU cores, RAM GB, disk GB with free/allocatable). Only renders when `resource_spec` is populated by daemon.

### Schema
```json
{"resources": [
  {"id": "cpu", "total": 8, "min": 1, "max": 4},
  {"id": "ram", "total": 64.0, "min": 1, "max": 32},
  {"id": "disk", "total": 500.0, "free": 320.4, "min": 5, "max": 256},
  {"id": "gpu-nvidia-0", "type": "gpu", "total": 1, "model": "RTX 4090", "vram_gb": 24.0, "cuda_version": "12.2", "compute_capability": "8.9", "driver_version": "535.161.08"}
]}
```

### Breaking changes
- None — all new fields are additive. Existing providers get `resource_spec` populated on next daemon heartbeat.
- Providers must have daemon running to populate `resource_spec`; card is hidden until populated.

## [2026-03-18 11:51 UTC] DevOps Automator — DCP-16, DCP-17: NVIDIA CT install fix + container isolation docs

### DCP-16: NVIDIA Container Toolkit + Docker GPU passthrough
- **Files**: `backend/installers/dc1-setup-unix.sh`, `app/docs/provider-guide/page.tsx`
- **What changed**:
  - Fixed NVIDIA CT repo URL in setup script from deprecated distribution-specific path to `stable/deb/nvidia-container-toolkit.list` (fixes Ubuntu 24.04 installs)
  - Improved detection: checks `nvidia-ctk --version` binary in addition to `docker info` grep
  - Added `dnf` package manager support (RHEL/Rocky/Fedora)
  - Verification step now prints GPU name detected inside container
  - Expanded provider-guide Requirements section: hardware specs (CUDA 6.0+, VRAM minimums), full Linux software stack (driver >= 450.x, Docker 20.10+, NVIDIA CT), Windows requirements, new Job Execution Security section, expanded troubleshooting
- **Note**: Core GPU passthrough (`--gpus all` in `run_docker_job()`, NVIDIA CT check in `check_docker()`) was already implemented in prior heartbeats.

### DCP-17: Container network isolation
- **Files**: No code changes needed — already fully implemented in DCP-8 + DCP-21
- **Verified in `run_docker_job()`**: `--network none`, `--security-opt no-new-privileges:true`, `--read-only`, `--cap-drop all`, `--pids-limit 256`, custom seccomp profile
- **Optional bridge network**: Deferred — all current job types are single-container workloads

## [2026-03-18 11:45 UTC] Security Engineer — DCP-21: Container security hardening

- **Issue**: DCP-21 (High priority)
- **Files**: `backend/installers/dc1-daemon.py`, `backend/installers/dc1_daemon.py`
- **What changed**:
  - **`--cpus 4`**: Hard CPU core limit per container (was unlimited)
  - **`--memory-swap 16g`**: Set equal to `--memory` to disable swap headroom
  - **`--pids-limit 256`**: Fork-bomb protection (prevents unbounded process spawning)
  - **`--read-only`**: Root filesystem now immutable; writable areas via tmpfs only
  - **`--tmpfs /tmp:rw,noexec,nosuid,size=1g`** and **`/var/tmp`**: Writable tmp with noexec,nosuid
  - **`--cap-drop all`**: Drops all Linux capabilities (CUDA uses device files, not caps)
  - **`_ensure_seccomp_profile()`**: Writes `/tmp/dc1-gpu-seccomp.json` once at startup. Blacklist policy (default ALLOW) blocking 34 dangerous syscalls: kernel module loading, ptrace, clock manipulation, mount/pivot_root, kexec, perf_event_open, keyring, NUMA
  - **`--security-opt seccomp={path}`**: Custom seccomp attached when writable
  - **Audit events**: `container_start`, `container_complete`, `container_timeout`, `container_error` via `report_event()` → `daemon_events` table
  - **VRAM leak detection**: `container_vram_leak` warning if residual VRAM after container exit > 512 MiB
  - Added `CONTAINER_*` constants for tunable limits
- **Breaking**: Worker images must support read-only root FS. Images writing outside `/tmp`/`/var/tmp` will fail. Re-test all worker images with `--read-only` before production rollout. Providers must re-download daemon.

---

## [2026-03-18 11:38 UTC] Frontend Developer — DCP-22: GPU utilization dashboard

### New pages
- **`app/provider/gpu/page.tsx`** — Provider GPU metrics dashboard
  - SVG area/line charts (no external charting lib): GPU util %, VRAM %, temperature, power draw
  - Time range selector: 1h / 24h / 7d — uses `since` + `limit` query params on `GET /api/providers/me/gpu-metrics`
  - Multi-GPU per-card breakdown with GPU index tabs (reads `all_gpus[]` from DCP-19)
  - Period summary table: avg util, peak temp, peak power, sample count
  - Auto-refresh every 30s with live indicator
- **`app/renter/gpu-comparison/page.tsx`** — Renter provider comparison
  - Grid + table views of online providers from `GET /api/providers/available` (DCP-20)
  - Spec pills: VRAM, GPU count, CUDA, compute capability, location
  - Reliability / uptime progress bars
  - Side-by-side comparison table (select 2–4 providers)
  - Sort: Most VRAM / Reliability / Experience / Cheapest; filter by GPU model
  - Pricing: LLM + image SAR/min from `cost_rates_halala_per_min`

### Nav updates
- Added **GPU Metrics** nav item (`/provider/gpu`) to all 5 provider pages: dashboard, jobs, earnings, job detail, settings
- Added **GPU Compare** nav item (`/renter/gpu-comparison`) to renter sidebar

### Breaking changes
- None

## [2026-03-18 11:12 UTC] Backend Architect — DCP-18, DCP-19, DCP-20: Job execution engine, GPU metrics, GPU spec reporting

### DCP-18: Job execution engine
- **Files**: `backend/src/db.js`, `backend/src/routes/jobs.js`, `backend/installers/dc1_daemon.py`, `backend/installers/dc1-daemon.py`
- **DB migrations**: `jobs.priority` (1=high/2=normal/3=low), `jobs.retry_count`, `jobs.max_retries`, `job_logs` table
- **Priority queue**: `promoteNextQueuedJob()` now orders by `priority ASC, created_at ASC`
- **Status lifecycle**: `pending → assigned → pulling → running → completed/failed`. `/api/jobs/assigned` now sets `assigned`; progress endpoint advances to `pulling`/`running`
- **Retry logic**: result handler handles `transient: true` flag — resets to `pending` if `retry_count < max_retries` (default 2 retries)
- **New endpoints**: `POST /api/jobs/:id/logs` (daemon streams log lines), `GET /api/jobs/:id/logs` (renter/admin reads logs)
- **Daemon**: Docker pull failures return `transient: True`; reports `pulling` phase before pull; posts logs via `post_job_logs()` after execution
- **Breaking**: `/api/jobs/assigned` now returns `status: "assigned"` instead of `"running"` — daemons advance to `running` via progress endpoint

### DCP-19: GPU metrics per container
- **Files**: `backend/src/db.js`, `backend/src/routes/providers.js`, both daemon files
- **Multi-GPU**: `detect_gpu()` now iterates all GPU rows (was GPU 0 only), includes `all_gpus[]` array
- **Container metrics**: `collect_container_gpu_metrics(container_name)` — `nvidia-smi pmon` per-PID attribution; included in Docker job result
- **DB migrations**: `heartbeat_log.gpu_metrics_json`, `heartbeat_log.gpu_count`
- **New endpoint**: `GET /api/providers/:id/gpu-metrics` — time-series GPU metric history, multi-GPU aware, auth by provider key or admin

### DCP-20: Provider GPU spec reporting
- **Files**: `backend/src/db.js`, `backend/src/routes/providers.js`, `backend/src/routes/renters.js`, both daemon files
- **Daemon**: `_get_cuda_version()` parses CUDA version from nvidia-smi; `detect_gpu()` adds `compute_cap` query; heartbeat includes `compute_capability`, `cuda_version`
- **DB migrations**: `providers.gpu_compute_capability`, `providers.gpu_cuda_version`, `providers.gpu_count_reported`, `providers.gpu_spec_json`
- **Heartbeat handler**: stores spec fields on provider record on each heartbeat
- **New endpoint**: `GET /api/providers/available` — rich marketplace endpoint with full GPU spec (VRAM, CUDA, compute cap, driver, gpu_count, cost_rates, is_live)
- **Enhanced**: `GET /api/renters/available-providers` now includes compute_capability, cuda_version, gpu_count, is_live

## [2026-03-17 23:41 UTC] DevOps Automator — DCP-8, DCP-12, DCP-13

### DCP-8: Docker container isolation for job execution
- **Files**: `backend/installers/dc1_daemon.py`, `backend/installers/dc1-daemon.py`, `backend/docker/Dockerfile.general-worker` (NEW), `backend/docker/build-images.sh`
- **What changed**:
  - `run_docker_job()` in both daemons: added `--network none` (no internet inside container), `--name dc1-job-{job_id}` (reliable timeout kill), `--security-opt no-new-privileges:true`, `:ro` read-only volume mount, `shutil.rmtree` cleanup in `finally`
  - Updated image map from GHCR paths to local `dc1/sd-worker`, `dc1/llm-worker`, `dc1/general-worker`
  - Added `job_id` param through `execute_job` → `run_docker_job` for unique container naming
  - Created `Dockerfile.general-worker` (extends base-worker with scipy/matplotlib/pandas/sklearn/opencv)
  - Updated `build-images.sh` to build all 4 images (added step 4: `dc1/general-worker`)
- **Breaking**: Providers with Docker available now run jobs in isolated containers with no network access. `--network none` means job scripts cannot reach the internet.

### DCP-12: Hardcoded URLs → environment variables
- **Files**: `next.config.js`, `lib/api.ts`, `backend/src/server.js`, `.env.example`
- **What changed**:
  - `next.config.js`: proxy rewrite now uses `process.env.BACKEND_URL` (fallback: VPS IP)
  - `lib/api.ts`: `VPS_DIRECT`/`MC_DIRECT` read from `NEXT_PUBLIC_DC1_API`/`NEXT_PUBLIC_MC_URL`
  - `backend/src/server.js`: CORS origins no longer hardcode `76.13.179.86`; added `CORS_ORIGINS` env var for injecting extra allowed origins
  - `.env.example`: comprehensive documentation of all env vars including `DC1_HMAC_SECRET`, `CORS_ORIGINS`
- **Action required**: Set `BACKEND_URL=https://api.dcp.sa` in Vercel project settings once HTTPS is live

### DCP-13: HTTPS with nginx reverse proxy
- **Files**: `infra/nginx/dc1-api.conf` (NEW), `infra/nginx/setup-https.sh` (NEW), `backend/installers/daemon.ps1`, `backend/installers/daemon.sh`, `backend/installers/dc1-setup-helper.ps1`
- **What changed**:
  - `infra/nginx/dc1-api.conf`: nginx site config — HTTP→HTTPS redirect, port 443 http2, Let's Encrypt SSL (`api.dcp.sa`), Mozilla Intermediate TLS, HSTS, 60MB upload limit, 900s proxy timeout, WebSocket headers
  - `infra/nginx/setup-https.sh`: one-shot setup script — installs nginx+certbot, ACME webroot challenge, obtains cert, deploys config, sets up auto-renewal (systemd timer / cron fallback), opens ufw
  - Installer script defaults updated: `http://76.13.179.86:8083` → `https://api.dcp.sa`
- **Pre-requisite**: DNS `api.dcp.sa → 76.13.179.86` must be propagated before running setup-https.sh
- **Action required by Claude-Cowork**: Once DNS is live, run: `sudo bash infra/nginx/setup-https.sh api.dcp.sa admin@dcp.sa` on VPS

## [2026-03-17 23:26 UTC] Security Engineer — DCP-3: task_spec RCE fix + DCP-4: rate limit audit

- **Issues**: DCP-3 (Critical RCE), DCP-4 (Rate Limiting)
- **Files**: `backend/installers/dc1-daemon.py`, `backend/installers/dc1_daemon.py`, `backend/src/routes/jobs.js`, `backend/src/routes/providers.js`, `backend/src/server.js`
- **What changed**:
  - **DCP-3 (RCE)**: Daemon claimed HMAC verification but never implemented it. Added `HMAC_SECRET = "{{HMAC_SECRET}}"` constant to both daemon files, implemented `verify_task_spec_hmac()` using `hmac.compare_digest()`, added HMAC guard in `poll_and_execute()` that rejects and reports jobs with missing/invalid signatures
  - **DCP-3**: Backend now injects `HMAC_SECRET` into daemon at download time (`providers.js`)
  - **DCP-3**: Blocked raw Python `task_spec` from renter submissions (400 error with guidance). Removed raw-Python passthrough from template dispatch
  - **DCP-3**: Added job type whitelist (`ALLOWED_JOB_TYPES`) to reject unknown types at submission
  - **DCP-3**: Added provider key auth + job ownership check to `/api/jobs/verify-hmac`. Added `/api/jobs/verify-hmac-local` for legacy daemon fallback
  - **DCP-3**: Removed `DC1_ADMIN_TOKEN` from HMAC_SECRET fallback (secrets must not share roles); added startup warning if `DC1_HMAC_SECRET` not set
  - **DCP-4**: Existing limits were already in place (provider register, heartbeat, job submit, admin, general catch-all). Added missing specific limiters for `/api/renters/register` (5/IP/hour) and `/api/renters/topup` (10/IP/minute)
- **Breaking**: Providers must re-download daemon to get HMAC_SECRET injected. Existing deployed daemons will reject all jobs until re-downloaded. `DC1_HMAC_SECRET` must be set as env var before PM2 restart.
- **Action required by Claude-Cowork**: (1) Set `DC1_HMAC_SECRET=$(openssl rand -hex 32)` in VPS env (pm2 ecosystem config or .env). (2) Restart `dc1-provider-onboarding` with PM2. (3) Notify providers to re-download daemon.

## [2026-03-13 12:00 UTC] Claude-Cowork — Add Withdrawals nav to admin pages

- **Commit**: `3e128e0`
- **Files**: 10 admin page files updated (app/admin/page.tsx, fleet/page.tsx, jobs/page.tsx, providers/page.tsx, renters/page.tsx, security/page.tsx, finance/page.tsx, jobs/[id]/page.tsx, providers/[id]/page.tsx, renters/[id]/page.tsx)
- **What changed**:
  - Added WalletIcon SVG component definition to all 10 admin pages
  - Added Withdrawals nav item `{ label: 'Withdrawals', href: '/admin/withdrawals', icon: <WalletIcon /> }` positioned after Finance and before Security in navItems arrays
  - All pages now have consistent navigation with link to /admin/withdrawals
- **Impact**: Admin pages now display Withdrawals navigation link with wallet icon

## [2026-03-14 18:30 UTC] Claude-Cowork — Browser testing all dashboard features + nav fix

- **Commit**: `d985e88`
- **Files**: `app/renter/jobs/[id]/page.tsx`
- **What changed**:
  - Added GearIcon SVG and Settings nav item to renter job detail page sidebar (was missing from Phase 4 commit)
- **Testing completed** (all on dc1-platform.vercel.app):
  - Provider Dashboard: daemon status badge, 7-day earnings chart, pause/resume, stats — PASS
  - Provider Earnings: DashboardLayout, 4 tabs (Earnings/Job History/Daemon/Withdrawals), daily chart — PASS
  - Provider Jobs: job list with detail links — PASS
  - Provider Job Detail (/provider/jobs/59): job info, earnings breakdown (75/25 split) — PASS
  - Provider Settings: profile, API key mgmt, GPU prefs, notification preferences — PASS
  - Renter Dashboard: clean overview, no embedded playground, stats, GPU table, recent jobs — PASS
  - Renter Jobs: detail links, auto-refresh — PASS
  - Renter Job Detail (/renter/jobs/38): job info, error display, retry button — PASS
  - Renter Settings: profile, account summary, API key show/copy/rotate — PASS
  - Renter Analytics: stats, daily spending chart, job type breakdown, job outcomes — PASS
  - Renter Marketplace: filter, GPU listing, Settings nav — PASS
  - Renter Billing: add funds UI, Settings nav — PASS
  - Renter Playground: standalone auth (sessionStorage), LLM/image gen, model selector — PASS
- **Issue found**: dc1st.com is NOT connected to dc1-platform Vercel project (no domains configured). dc1st.com points to a separate landing page. App URL is dc1-platform.vercel.app
- **Impact**: Minor nav consistency fix; all dashboard features from improvement plan verified working

## [2026-03-14 12:00 UTC] Claude-Cowork — Phase 2+3: Job & Agent pages wired to real APIs

- **Commit**: `4c040ea`
- **Files changed**:
  - `app/jobs/page.tsx` — Rewrote to fetch from real `/api/dc1/jobs/active` + admin dashboard, DashboardLayout, split-view with sidebar job list + detail panel, 15s auto-refresh, cost in SAR, timeline
  - `app/jobs/submit/page.tsx` — Fixed import path from relative to `@/components/jobs/JobSubmitForm`
  - `app/agents/[id]/page.tsx` — Added Mission Control API integration: fetches live tasks per agent from MC `/api/tasks`, renders "Live Tasks" table with status badges, 30s auto-refresh, MC online/offline indicator
  - `app/agents/page.tsx` — Added aggregate stats row (Total Agents, Active Now, Tasks Done, Completion %)
  - `app/monitor/page.tsx` — Rewrote to ping real VPS API + Mission Control endpoints for health status, shows live platform stats
- **Breaking changes**: None
- **Impact**: Job tracker, agent detail, agent list, and system monitor now use real VPS/MC APIs instead of mock/non-existent endpoints

## [2026-03-15 10:00 UTC] Claude-Cowork — Security fix + support form + provider consolidation

- **Commit**: `f53d7a7`
- **Files changed**:
  - `app/intelligence/page.tsx` — Removed hardcoded admin token, uses `localStorage.getItem('dc1_admin_token')` + 401 redirect
  - `app/security/page.tsx` — Same admin token fix + 401 handling on flag action
  - `app/connections/page.tsx` — Same admin token fix
  - `app/jobs/page.tsx` — Same admin token fix
  - `app/monitor/page.tsx` — Same admin token fix
  - `app/support/page.tsx` — Added contact form (name, email, category, message) with API fallback to mailto
  - `app/provider-onboarding/page.tsx` — Replaced 469-line duplicate wizard with redirect to `/provider/register`
- **Breaking changes**: Internal MC pages now require admin login (localStorage token) — no more anonymous access via hardcoded token
- **Security**: Removed hardcoded admin token `9ca7c...` from 5 client-side files. This was a critical exposure risk.
- **Impact**: All internal pages now use proper auth flow; support page has working contact form; provider registration consolidated to single entry point

## [2026-03-15 11:00 UTC] Claude-Cowork — Add Analytics to renter nav + shared API utility

- **Commit**: `1948bb1`
- **Files changed**:
  - `lib/api.ts` — NEW: shared API utility (getApiBase, getMcBase, getMcToken, getAdminToken, getProviderKey, getRenterKey)
  - `app/renter/page.tsx` — Added Analytics nav item with ChartIcon
  - `app/renter/marketplace/page.tsx` — Same
  - `app/renter/jobs/page.tsx` — Same
  - `app/renter/jobs/[id]/page.tsx` — Same
  - `app/renter/settings/page.tsx` — Same
  - `app/renter/billing/page.tsx` — Same (inline SVG variant)
  - `app/renter/analytics/page.tsx` — Added Analytics to its own nav
- **Breaking changes**: None
- **Impact**: Analytics page now accessible from renter sidebar navigation across all renter pages; shared API utility created for future consolidation


## [2026-03-18 21:10 UTC] QA-Engineer (Paperclip Agent)  DCP-40 + DCP-41 test suites + DCP-43 QA audit

### DCP-41 — Container security tests (COMPLETE)
- **File**: `backend/tests/security/container-isolation.test.js` (NEW)
- **Tests**: 42 total — 28 passing, 14 skipped (live Docker tests auto-skip when Docker unavailable)
- **Coverage**: Static analysis of dc1-daemon.py security flags (--network none, --read-only, --cap-drop all, seccomp, VRAM leak), live container isolation tests, image whitelist enforcement
- **Breaking changes**: None

### DCP-40 — Job pipeline integration tests (COMPLETE)
- **File**: `backend/tests/integration/job-pipeline-routes.test.js` (NEW)
- **Tests**: 45 total — 45 passing
- **Coverage**: Job submission (auth/validation/RCE guard/balance), priority queue, assign→complete lifecycle, transient retry, HMAC verification, escrow lifecycle (held→locked→released_provider/renter), vLLM serve, custom_container, billing accuracy (75/25 split), queue endpoint
- **Key fix**: Pure-JS InMemoryDB mock to bypass better-sqlite3 native module incompatibility on Node.js v24. Critical bug: WHERE clause `pi` counter must reset per-row in filter callback (was shared across rows causing undefined params for 2nd+ rows)
- **Breaking changes**: None

### DCP-43 — QA visual validation of Replit-matched UI (COMPLETE)
- **Files**: No code changes — audit only
- **Findings**: 8/10 checklist items pass. Two critical gaps vs https://dc-1-platform.replit.app/:
  1. Header nav labels wrong (need Compute/Supply/Docs + Console Login/Get Early Access)
  2. Landing page missing 4 sections (Provider Setup Demo, Founding Rates Table, What You Can Run, Programmatic Integration)
- **Recommended child issues**: Update header nav, add missing landing sections, update hero headline to "Borderless GPU Compute"
- **Breaking changes**: None

## [2026-03-19 07:26 UTC] Codex — DCP-80 QA regression sweep on dcp.sa

- **Commit**: `N/A (Paperclip container: no git commands)` — Completed live page smoke validation across required routes
- **Files**: `AGENT_LOG.md`
- **Impact**:
  - Verified HTTP 200 responses for all required routes: `/`, `/login`, `/provider/register`, `/provider`, `/provider/settings`, `/provider/jobs/1`, `/renter/register`, `/renter`, `/renter/marketplace`, `/renter/templates`, `/renter/billing`, `/renter/analytics`, `/admin`, `/admin/providers`, `/admin/renters`, `/admin/jobs`, `/admin/fleet`
  - Local `next build` check is currently blocked by environment permissions: `EACCES: permission denied, open '.next/trace'`
  - Live homepage still contains old headline string `Power, Digitalized` (expected `Borderless GPU Compute` per prior rebuild task), indicating landing content may not be fully updated on `dcp.sa`
  - `NaN` and `0/0` strings were not found in route HTML payloads during this heartbeat
  - Browser console-error validation and Vercel deployment-log verification remain blocked in this container context
