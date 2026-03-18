# DC1 GPU Compute — VS Code Extension

Submit GPU compute jobs to **DC1** — Saudi Arabia's first decentralized GPU marketplace — directly from VS Code or Cursor.

## Features

- **⚡ GPU Sidebar** — Live tree view of available NVIDIA GPUs (model, VRAM, location, reliability score, cached models)
- **🚀 Job Submission Panel** — Rich webview to select GPU, job type, model, prompt, duration, and VRAM requirements
- **📋 My Jobs** — Tree view of your submitted jobs with live status icons; click to stream output
- **💳 Wallet Panel** — View SAR balance, account info, and top-up
- **📊 Status Bar** — Live balance display in the bottom bar, click to open wallet
- **🔑 Secure Auth** — API key stored in VS Code SecretStorage (never in settings.json)
- **📺 Log Streaming** — Job output streams to DC1 Job Logs output channel with auto-polling

## Job Types

| Type | Description |
|------|-------------|
| `llm_inference` | Run LLM inference (prompt → text) |
| `image_generation` | Stable Diffusion / image gen |
| `vllm_serve` | Deploy a vLLM endpoint |
| `training` | Fine-tuning / training run |
| `rendering` | 3D / video rendering |
| `benchmark` | GPU benchmark |
| `custom_container` | Custom Docker container |

## Getting Started

1. Install the extension (`.vsix`) via *Extensions → Install from VSIX*
2. Run **DC1: Set API Key** from the Command Palette (`Ctrl+Shift+P`)
   - Get your key from [dc1st.com/renter/register](https://dc1st.com/renter/register)
3. Open the **DC1** sidebar (lightning bolt icon in activity bar)
4. Click **Submit GPU Job** or right-click a GPU → **Submit Job on This GPU**

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `dc1.apiBase` | `http://76.13.179.86:8083` | DC1 API base URL |
| `dc1.pollIntervalSeconds` | `10` | Job status polling interval |
| `dc1.autoRefreshGPUs` | `true` | Auto-refresh GPU list every 30s |

## Architecture

```
vscode-extension/
├── src/
│   ├── extension.ts           # Entry point, command registration
│   ├── api/dc1Client.ts       # DC1 REST API client (Node http/https)
│   ├── auth/AuthManager.ts    # SecretStorage key management
│   ├── providers/
│   │   ├── GPUTreeProvider.ts # TreeDataProvider — available GPUs
│   │   └── JobsTreeProvider.ts # TreeDataProvider — my jobs
│   └── panels/
│       ├── JobSubmitPanel.ts  # WebviewPanel — job submission form
│       └── WalletPanel.ts     # WebviewPanel — wallet & billing
├── media/dc1-icon.svg
├── package.json               # Extension manifest
├── webpack.config.js
└── tsconfig.json
```

## Building

```bash
cd vscode-extension
npm install
npm run compile    # dev build
npm run package    # production .vsix
```

## Publishing

```bash
npm install -g @vscode/vsce
vsce package
vsce publish
```

## API Reference

Base: `http://76.13.179.86:8083` (or `https://api.dc1st.com` when live)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/renters/available-providers` | none | Online GPUs |
| `GET /api/renters/me?key=` | `key` param | Balance, jobs |
| `POST /api/jobs/submit` | `x-renter-key` header | Submit job |
| `GET /api/jobs/:id/output` | `x-renter-key` header | Job output/status |
| `POST /api/jobs/:id/cancel` | `x-renter-key` header | Cancel job |
| `POST /api/renters/topup` | `x-renter-key` header | Add balance |

## License

MIT — DC1 Platform © 2026
