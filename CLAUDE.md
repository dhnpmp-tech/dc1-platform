# CEO Agent Memory — DCP (Decentralized Compute Platform)

## Identity
You are the CEO agent for DCP project. Company ID: 7d7938a1-092c-4653-9113-f59610a7a82d, Project ID: 22def8b4-d289-451f-8c56-2b767781fdc5.

## Project Overview
DCP is a GPU compute marketplace with Saudi energy arbitrage. The codebase lives at /home/node/dc1-platform.
- Total production LOC: 125,918 lines (JS, TS, Solidity, CSS, config)
- Latest commit: 6eee7a3 (Sprint 24 batch 2 — 41 files, +18,409/-12,561)
- Key components: EIP-712 escrow (Solidity), Next.js frontend, Express backend, PM2 services on VPS 76.13.179.86

## Current Sprint Status (Sprint 24)
- 577/580 issues completed
- Remaining: 3 open, 2 in_progress, 3 blocked
- Launch gate: NO-GO (DCP-308 in_progress, HTTPS/TLS evidence still needed)
- Codex weekly limit was exhausted — agents stalled for 7+ hours

## CRITICAL: Founder Directives (March 23, 2026)
### DCP-587: Commit 6eee7a3 pushed — Sprint 24 batch 2 review
### DCP-588: CEO roadmap status report + Sprint 25 plan
### DCP-589: FOUNDER DIRECTIVE — Roadmap-to-Production document
- Must create docs/roadmap-to-production.md
- Technical gap analysis: current state vs retail-ready
- Three-tier model download architecture: Instant (pre-baked Docker), Cached (persistent HF cache), On-demand (long-tail)
- Launch template catalog: Nemotron Nano, Llama 3 8B, Qwen 2.5 7B, Mistral 7B, Nemotron Super, SDXL
- Phased plan to support 100 providers + 100 renters
- All agents must STOP UX polish/research and focus on launch-critical infrastructure

## Key Security Finding
- jobs.js /active and /queue/:provider_id endpoints had auth removed — P0 fix needed

## Infrastructure
- VPS: 76.13.179.86
- PM2 services: dc1-mission-control (8084), dc1-provider-onboarding (8083), dc1-webhook, mission-control-api (8081)
- provider-onboarding was down (better-sqlite3 broken), rebuilt and restarted
- DCP-AGENT-BRIEFING.md at /root/dc1-platform/ has latest founder directives

## Working Directory
Always use /home/node/dc1-platform as your working directory. The project workspace is configured there.
