# DC1 GPU Compute — VS Code Extension

Submit GPU jobs on **DC1** (dcp.sa) — Saudi Arabia's decentralized GPU marketplace — without leaving VS Code.

## Features

| Feature | Description |
|---------|-------------|
| **GPU Sidebar** | Browse online GPU providers by model, VRAM, price |
| **Job Submission** | Submit container jobs via a GUI panel (Ctrl+Shift+G) |
| **Job Tracking** | Status bar shows live job status + elapsed time |
| **Output Viewer** | Job logs appear in the DC1 output channel |
| **Wallet Panel** | SAR balance at a glance in the sidebar |
| **Secure Auth** | API key stored in VS Code SecretStorage (encrypted) |

## Quick Start

1. Install the extension (VSIX or Marketplace)
2. Open the DC1 sidebar (GPU chip icon in activity bar)
3. Run **DC1: Set Renter API Key** — paste your key from dcp.sa
4. Click **Submit Job** or press `Ctrl+Shift+G` (`Cmd+Shift+G` on Mac)

## Commands

| Command | Description |
|---------|-------------|
| `DC1: Set Renter API Key` | Store your API key securely |
| `DC1: Clear API Key` | Remove stored key |
| `DC1: List Available GPUs` | Refresh provider sidebar |
| `DC1: Submit GPU Job` | Open job submission panel |
| `DC1: Show Job Status` | Show latest job output in panel |
| `DC1: Open Wallet / Balance` | View SAR wallet balance |

## Job Submission Panel

Select text in your editor (e.g. a Python training script command), then press `Ctrl+Shift+G`. The selected text pre-fills the **Command** field. Choose:

- **Container Image** — any Docker image (PyTorch, TensorFlow, vLLM, etc.)
- **Command** — shell command to run inside the container
- **Provider** — pick a specific GPU or let DC1 assign one
- **Max Duration** — safety cap (seconds)

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `dc1.apiBaseUrl` | `https://dcp.sa` | API endpoint |
| `dc1.pollingIntervalMs` | `5000` | Job status poll interval |

## Building from Source

```bash
cd extensions/dc1-vscode
npm install
npm run compile      # development build
npm run package      # production VSIX
```

Requires Node.js 18+ and `vsce` (`npm install -g @vscode/vsce`).

## Publishing

```bash
vsce package          # creates dc1-gpu-0.1.0.vsix
vsce publish          # publish to VS Code Marketplace
```

## API

This extension calls the DC1 REST API via the Next.js proxy at `dcp.sa/api/dc1/*`:

- `GET /renters/available-providers` — list online GPUs
- `POST /jobs/submit` — submit a job
- `GET /jobs/:id` — poll job status
- `GET /jobs/:id/output` — fetch job output
- `GET /renters/me` — wallet balance

Auth: `x-renter-key` header.

## License

MIT — DC1 Platform © 2026
