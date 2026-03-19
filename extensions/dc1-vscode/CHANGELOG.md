# Changelog

All notable changes to the DCP GPU Compute extension are documented here.

## [1.0.1] — 2026-03-19

### Sprint 10 — Live Polling + Cancel

- **Live job polling** — `My Jobs` view now auto-refreshes every 5s while jobs are running (DCP-210)
- **Cancel running job** — Right-click a running job to cancel it via `DELETE /jobs/{id}` (DCP-210)
- **TypeScript fix** — TS7053 compile error on `Content-Length` header assignment resolved (DCP-237)

## [1.0.0] — 2026-03-19

### First Marketplace Release

- **GPU Sidebar** — Browse live GPU providers (model, VRAM, price) in the Activity Bar
- **Job Submission Panel** — Submit containerized workloads via GUI (`Ctrl+Shift+G` / `Cmd+Shift+G`)
- **vLLM Serve** — Launch a remote vLLM inference session (`Ctrl+Shift+V` / `Cmd+Shift+V`)
- **Inference Panel** — Send prompts to a running vLLM session directly from VS Code
- **My Jobs View** — Track submitted jobs and their live status in the sidebar
- **Wallet Panel** — SAR balance visible in the DCP sidebar without opening a browser
- **Job Status Bar** — Live polling indicator shows current job state and elapsed time
- **Output Channel** — Job logs streamed to the DCP GPU Compute output channel
- **Secure Auth** — Renter API key stored in VS Code SecretStorage (encrypted, never written to disk)
- **HTTPS Enforcement** — All API calls require HTTPS; non-secure URLs are rejected at startup
- Targets DCP REST API at `dcp.sa` via the Next.js proxy (`/api/dc1/*`)

## [0.1.0] — 2026-03-19

### Initial Development Build

- Internal preview — GPU Sidebar, Job Submission, My Jobs View, Wallet View
- Status bar job polling, output channel log streaming
- API key stored in VS Code SecretStorage
