# Changelog

## [0.1.0] — 2026-03-19

### Initial Release

- **GPU Sidebar** — Browse online GPU providers by model, VRAM, and price in the Activity Bar
- **Job Submission Panel** — Submit container jobs via a GUI panel (Ctrl+Shift+G / Cmd+Shift+G)
- **My Jobs View** — Track submitted job status and details in the sidebar
- **Wallet View** — SAR balance at a glance in the sidebar
- **Job Status Bar** — Live job polling indicator in the VS Code status bar
- **Secure Auth** — Renter API key stored in VS Code SecretStorage (encrypted, never on disk)
- **Output Channel** — Job logs streamed to the DC1 GPU Compute output channel
- **HTTPS Enforcement** — All API calls require HTTPS; insecure URLs are rejected
- All calls target the DC1 REST API at `dcp.sa` via the Next.js proxy
