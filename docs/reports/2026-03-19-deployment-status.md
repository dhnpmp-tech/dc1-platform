# DCP Platform — Deployment Status
**Date:** 2026-03-19
**Frontend:** dcp.sa (Vercel, auto-deploys from main branch) — **current commit: 32807ee**
**Backend:** 76.13.179.86:8083 (PM2 on VPS) — **running ~2026-03-14 code, NOT current**

---

## Frontend (dcp.sa) — All Pages Live ✅

All 40 pages are deployed and accessible. Vercel auto-deploys on every push to main.

### Landing / Auth
| Page | URL | Status | Notes |
|------|-----|--------|-------|
| Landing | / | ✅ Live | "Borderless GPU Compute" hero, 4 content sections, pricing table |
| Login | /login | ✅ Live | All 3 roles (renter/provider/admin API key auth) |
| Provider Register | /provider/register | ✅ Live | Wired to POST /api/providers/register |
| Renter Register | /renter/register | ✅ Live | Wired to POST /api/renters/register |
| Provider Onboarding | /provider-onboarding | ✅ Live | Redirects to /provider/register |

### Provider Dashboard
| Page | URL | Status | Notes |
|------|-----|--------|-------|
| Dashboard | /provider | ✅ Live | Stats, 7-day earnings chart, daemon status, pause/resume |
| Jobs | /provider/jobs | ✅ Live | Job list with status badges, 30s refresh |
| Job Detail | /provider/jobs/[id] | ✅ Live | Earnings breakdown (75/25), job params, auto-refresh |
| Earnings | /provider/earnings | ✅ Live | DashboardLayout, 4 tabs, daily chart |
| GPU Metrics | /provider/gpu | ✅ Live | SVG charts: util/VRAM/temp/power, multi-GPU tabs |
| Settings | /provider/settings | ✅ Live | Profile, API key mgmt, GPU preferences, notification prefs |

### Renter Dashboard
| Page | URL | Status | Notes |
|------|-----|--------|-------|
| Dashboard | /renter | ✅ Live | Balance, jobs, 30s refresh |
| Jobs | /renter/jobs | ✅ Live | Job list, 30s refresh |
| Job Detail | /renter/jobs/[id] | ✅ Live | Output display (LLM/image), retry button |
| Marketplace | /renter/marketplace | ✅ Live | GPU filter/search, provider cards, reliability scores |
| GPU Comparison | /renter/gpu-comparison | ✅ Live | Side-by-side spec table, sort/filter |
| Templates | /renter/templates | ✅ Live | Docker template picker wired to /api/templates |
| Billing | /renter/billing | ✅ Live | Balance, top-up via Moyasar (UI ready; payments need DCP-84) |
| Analytics | /renter/analytics | ✅ Live | Daily spending chart, job type breakdown, success rate |
| Settings | /renter/settings | ✅ Live | Profile, API key show/copy/rotate |
| Playground | /renter/playground | ✅ Live | LLM Inference / Image Gen / **vLLM Serve** tabs with endpoint display |

### Admin Dashboard
| Page | URL | Status | Notes |
|------|-----|--------|-------|
| Dashboard | /admin | ✅ Live | Fleet health banner, revenue stats |
| Providers | /admin/providers | ✅ Live | Provider list, bulk suspend/unsuspend |
| Provider Detail | /admin/providers/[id] | ✅ Live | Full provider profile |
| Renters | /admin/renters | ✅ Live | Renter list, bulk ops |
| Renter Detail | /admin/renters/[id] | ✅ Live | Full renter profile |
| Jobs | /admin/jobs | ✅ Live | Job control center |
| Job Detail | /admin/jobs/[id] | ✅ Live | Job detail with logs |
| Fleet Health | /admin/fleet | ✅ Live | System health banner (DB, online providers, stuck jobs) |
| Security | /admin/security | ✅ Live | Audit log, events |
| Finance | /admin/finance | ✅ Live | Revenue, reconciliation |
| Withdrawals | /admin/withdrawals | ✅ Live | Provider withdrawal requests |

### Docs / Legal / Support
| Page | URL | Status | Notes |
|------|-----|--------|-------|
| Docs Index | /docs | ✅ Live | |
| API Reference | /docs/api | ✅ Live | Full endpoint docs with curl examples |
| Provider Guide | /docs/provider-guide | ✅ Live | Setup guide with daemon install |
| Renter Guide | /docs/renter-guide | ✅ Live | Quickstart, job submission, billing |
| Support | /support | ✅ Live | Contact form with mailto fallback |
| Terms | /terms | ✅ Live | |
| Privacy | /privacy | ✅ Live | |
| Acceptable Use | /acceptable-use | ✅ Live | |

---

## Backend (VPS 76.13.179.86:8083) — Stale Code ⚠️

The VPS is running code from ~2026-03-14. The following Phase B routes are coded in main but **NOT yet running** on the VPS.

**Fix: Board needs to SSH to VPS and run `git pull && pm2 reload` (DCP-87 — ~30 seconds)**

### Routes in main but NOT running on VPS
| Route | Feature | Added In |
|-------|---------|----------|
| POST /api/payments/topup | Moyasar SAR payment initiation | DCP-31 |
| POST /api/payments/webhook | Moyasar webhook (HMAC-verified) | DCP-31 |
| GET /api/payments/verify/:id | Payment status polling | DCP-31 |
| GET /api/payments/history | Renter payment history | DCP-31 |
| GET /api/admin/payments | Admin payment list | DCP-31 |
| GET /api/admin/escrow | Off-chain escrow view | DCP-32 |
| GET /api/templates | Docker compute templates | DCP-33 |
| GET /api/templates/:id | Template detail | DCP-33 |
| POST /api/jobs/:id/endpoint-ready | vLLM endpoint registration | DCP-34 |
| GET /api/admin/escrow-chain/status | On-chain escrow status | DCP-75 |

### Routes running on VPS ✅
| Route | Feature |
|-------|---------|
| POST /api/providers/register | Provider registration |
| POST /api/providers/heartbeat | Daemon heartbeat |
| GET /api/providers/me | Provider dashboard data |
| GET /api/providers/available | GPU marketplace listing |
| GET /api/providers/:id/gpu-metrics | GPU utilization history |
| POST /api/renters/register | Renter registration |
| GET /api/renters/me | Renter dashboard data |
| POST /api/jobs/submit | Job submission (escrow, HMAC) |
| GET /api/jobs/assigned | Daemon job pickup |
| POST /api/jobs/:id/result | Job completion |
| POST /api/jobs/:id/fail | Job failure |
| POST /api/jobs/:id/logs | Log streaming |
| GET /api/jobs/:id/logs | Log reading |
| GET /api/admin/dashboard | Admin overview |
| GET /api/admin/health | System health |
| GET /api/admin/finance/reconciliation | Financial reconciliation |
| GET /api/health | API health check |

---

## SDK Status
| SDK | Package | Status | Location |
|-----|---------|--------|----------|
| Node.js Renter | dc1-renter-sdk | ✅ Ready to publish | sdk/node/ |
| Python Provider | dc1 (pip install dc1) | ✅ Ready to publish | sdk/python/ |
| Both | — | ❌ Not published | Blocked on DCP-85 (board: npm/PyPI tokens) |

---

## Smart Contracts
| Contract | Network | Status |
|----------|---------|--------|
| Escrow.sol | Base Sepolia testnet | ✅ Coded + tested (16 tests) | Needs DCP-88 deploy |
| Escrow.sol | Base mainnet | ❌ Not deployed (correct — testnet only) |

---

## What's Needed for Full Phase B Launch

1. **Board: DCP-87** — `git pull && pm2 reload` on VPS (30 seconds) → deploys Moyasar, escrow, templates, vLLM routes
2. **Board: DCP-84** — Set MOYASAR_SECRET_KEY, rotate admin token, fix api.dcp.sa A record
3. **Board: DCP-85** — npm + PyPI tokens → DevRel publishes SDKs
4. **QA: DCP-89 follow-up** — Run sandbox Moyasar payment end-to-end once DCP-87+84 done
5. **Optional: DCP-88** — Deploy Escrow.sol to testnet (needs test ETH + deployer wallet)
