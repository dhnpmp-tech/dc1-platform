# DCP Production Readiness Roadmap
## CEO Briefing — April 2, 2026
*Authored by Hermes (AI CTO assistant) — For immediate Paperclip agent execution*

---

## Situation Summary

The codebase is more complete than it appears. The daemon, tray apps, and installer scripts exist and work. The gap is **packaging + surfacing** — none of the ready pieces are discoverable by providers. The critical path to OpenRouter by Apr 10 is: **1 GPU online → 1 inference served → submit**.

---

## What's Ready RIGHT NOW (don't rebuild these)

| Component | Status | Location |
|---|---|---|
| Provider daemon v3.4.0 | ✅ Complete | `backend/installers/dc1-daemon.py` |
| Linux tray app | ✅ Complete | `backend/installers/dcp_tray_linux.py` |
| Windows tray app | ✅ Complete | `backend/installers/dcp_tray_windows.py` |
| Windows .ps1 installer | ✅ Complete | `backend/installers/dc1-setup-windows.ps1` |
| Linux/Mac bash installer | ✅ Complete | `backend/installers/dc1-setup-unix.sh` |
| One-liner install endpoint | ✅ Complete | `GET /api/providers/download/setup?key=KEY` |
| Tray download endpoints | ✅ Complete | `GET /api/providers/download/tray-windows` + `/tray-linux` |
| vLLM configs (all GPU tiers) | ✅ Complete | `infra/vllm-configs/` |
| vLLM model whitelist (expanded) | ✅ Done today | daemon v3.4.0 — 22 models incl. Arabic |
| Arabic models in configs | ✅ Complete | ALLaM-7B, ALLaM-7B-AWQ, Jais-13B configs |
| WireGuard VPN server | ✅ Live | VPS port 51820 |
| OpenAI-compatible API | ✅ Live | api.dcp.sa |

---

## Gap Analysis vs. Competitors

### What RunPod/Vast.ai have that we don't (yet)

1. **Provider discovery page** — `/providers` showing live GPU marketplace. We have the backend but no front-end browse page.
2. **One-liner on the homepage** — `curl -fsSL https://dcp.sa/install | bash` with your key. The endpoint exists (`/api/providers/download/setup?key=KEY`), it's just not shown anywhere.
3. **Tray app in the provider dashboard** — We have the tray apps built, they're not linked from the UI.
4. **Model catalog browseable by renters** — `/models` exists in API, needs frontend page.
5. **Live GPU utilization** — provider dashboard doesn't show real-time job/VRAM stats.

### What we have that RunPod/Vast.ai/Akash don't

- **Arabic-first model support** (ALLaM-7B, Jais-13B) — ZERO competition on OpenRouter
- **Saudi data residency** (PDPL compliance) — OCI charges 18× more for this
- **WireGuard home provider support** — Vast.ai requires port forwarding; we tunnel

---

## GATE 0 — This Week (Assign to Backend-Dev + Frontend agents)

### Task 1: Surface the one-liner on provider dashboard [30 min]
**File:** `app/provider/page.tsx` or `app/provider-onboarding/page.tsx`
**Change:** Add a code block showing:
```bash
# Linux / Mac
curl -fsSL "https://api.dcp.sa/api/providers/download/setup?key=YOUR_KEY" | bash

# Windows (PowerShell)
irm "https://api.dcp.sa/api/providers/download/setup?key=YOUR_KEY&os=windows" | iex
```
The endpoint already works — this is purely a UI addition.

### Task 2: Add tray app download buttons to provider dashboard [30 min]
**Endpoints already live:**
- `GET /api/providers/download/tray-windows?key=KEY` → `dcp_tray_windows.py`
- `GET /api/providers/download/tray-linux?key=KEY` → `dcp_tray_linux.py`

**Change:** Add two download buttons to provider settings page. Label: "Download System Monitor (Windows)" and "Download System Monitor (Linux)".

### Task 3: Update provider setup docs [20 min]
**File:** `docs/provider-setup.md`
**Change:** Add the one-liner, WireGuard note for home providers, and tray app section.

---

## GATE 1 — Apr 10 Target (CEO + CTO to action)

### P0: Get one GPU serving inference
- Any GPU (dev machine, Tareq's PC, anything with CUDA)
- Install daemon v3.4.0
- Register WireGuard peer on VPS
- Register `vllm_endpoint_url` in DB
- Test: `curl https://api.dcp.sa/v1/chat/completions -H "Authorization: Bearer KEY" -d '{"model":"SDAIA/ALLaM-7B-Instruct-AWQ","messages":[{"role":"user","content":"مرحبا"}]}'`

### P1: ALLaM-7B live on OpenRouter
- Submit OpenRouter application with working endpoint
- Arabic model = zero competition = instant top ranking
- Free tier: 100K tokens/day, 30 days

---

## GATE 2 — April-May (Paperclip agent sprint)

### Provider Dashboard Improvements
1. **Live job feed** — show current job_id, type, progress (daemon already reports phase: pulling/loading/generating)
2. **Earnings widget** — SAR earned today / this week / total (endpoint exists: `/api/providers/earnings`)
3. **GPU stats card** — VRAM used/free, utilization%, temperature (daemon heartbeat already sends this)
4. **Uptime badge** — % online in last 7 days

### Model Catalog for Renters
1. `/models` page listing all available models with GPU requirements
2. Show which models are live now vs. available-on-demand
3. Arabic models featured prominently

### Infrastructure Hardening
1. Enable swap on VPS (5 commands, prevents OOM crashes at 13+ concurrent agents)
2. Add monitoring: alert if provider goes offline > 5 min
3. Provider health dashboard for Peter/admin

---

## GATE 3 — May+ (Research + Future)

### TurboQuant / Advanced Quantization
- **TurboQuant** (Google Research, arXiv:2504.19874) — KV cache quantization to 3.5 bits
- Practical unlock: 13B models on 12GB GPUs (currently needs 14GB+)
- Track vLLM for native TurboQuant support (not yet merged)
- **Immediate alternative today:** `--kv-cache-dtype fp8` in vLLM — free ~20-30% VRAM, already in daemon for AWQ models

### Model Expansion
- ALLaM-13B when weights are public
- Jais-30B on NVLink nodes
- AceGPT-13B (Arabic, academic license)
- Qwen2.5-72B-AWQ on NVLink

---

## Agent Assignments (Paperclip)

| Task | Agent | Priority | Est. |
|---|---|---|---|
| Surface one-liner on provider dashboard | Frontend-Dev | P0 | 30 min |
| Add tray app download buttons | Frontend-Dev | P0 | 30 min |
| Update provider docs | Backend-Dev | P0 | 20 min |
| PR + deploy | Backend-Dev | P0 | 30 min |
| Model catalog frontend page | Frontend-Dev | P1 | 2 hrs |
| Live GPU stats in provider dashboard | Frontend-Dev | P1 | 2 hrs |
| Provider availability alerts | Backend-Dev | P1 | 1 hr |
| VPS swap setup | Backend-Dev | P0-infra | 5 min |

---

*Generated by Hermes — April 2, 2026*
*Branch: `hermes/gate0-daemon-models` — daemon v3.4.0 committed*
