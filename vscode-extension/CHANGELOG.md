# DCP GPU Compute — Changelog

## [0.3.0] — 2026-03-20

### Added
- **Budget Widget**: Status bar now shows renter's remaining balance as `DCP: XX.XX SAR` (bottom-right). Refreshes every 60 seconds or after a job completes. Clicking opens the DCP billing page in the browser.
- **Job Log Streaming**: After job submission, each job gets its own VS Code output channel named `DCP Job #<id>`. Live logs are streamed via SSE (`GET /api/jobs/:id/logs/stream`) and displayed in real-time. Falls back to polling automatically if the SSE endpoint is not yet available.

### Changed
- Extension renamed from `dc1-compute` → `dcp-compute` and branding updated throughout.
- Status bar budget widget click now opens `https://dcp.sa/renter/billing` instead of the wallet webview panel.
- Per-job output channels replace the previous shared `DCP Job Logs` channel — each job's output is isolated and persists for the session.
- API base config description updated to reference `https://api.dcp.sa`.

---

## [0.2.0] — 2026-03-01

### Added
- Provider status sidebar (ProviderStatusTreeProvider) — GPU model, earnings, heartbeat status.
- Wallet & Billing webview panel (WalletPanel) — balance, top-up, job history.
- Job cancellation command (`dc1.cancelJob`) with confirmation dialog.
- `dc1.submitJobOnProvider` context-menu command from GPU tree item.

---

## [0.1.0] — 2026-02-14

### Initial release
- Available GPUs sidebar (TreeDataProvider) with live refresh.
- My Jobs sidebar with status badges.
- Job submission webview panel (GPU model, VRAM, duration, job type, container image).
- API key auth stored in VS Code Secrets Store.
- Provider status bar item showing connection state.
- Basic job output polling.
