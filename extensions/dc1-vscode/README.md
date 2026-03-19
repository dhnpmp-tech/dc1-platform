# DCP GPU Compute — VS Code Extension

Submit GPU jobs on **DCP** (dcp.sa) — Saudi Arabia's first decentralized GPU compute marketplace — without leaving VS Code. Browse live GPU providers, launch container workloads, run vLLM inference sessions, and monitor your wallet, all from the Activity Bar.

---

## Screenshots

> _TODO: Replace ASCII mockups below with actual screenshots before Marketplace submission (`images/screenshots/`)._

**GPU Providers Sidebar**
```
┌─ DCP GPU Compute ──────────────────────┐
│ AVAILABLE GPUS                  ↻  ▶  🚀 │
│ ┌──────────────────────────────────┐    │
│ │ ● RTX 4090          24 GB VRAM   │    │
│ │   provider-abc  ·  SAR 0.80/hr   │    │
│ ├──────────────────────────────────┤    │
│ │ ● A100              80 GB VRAM   │    │
│ │   provider-xyz  ·  SAR 2.50/hr   │    │
│ └──────────────────────────────────┘    │
│ MY JOBS                                  │
│   job-f3a1  ● RUNNING   0:04:22          │
│   job-c9b2  ✓ DONE      0:02:10          │
│ WALLET                                   │
│   Balance: SAR 48.50                     │
└──────────────────────────────────────────┘
```

**Job Submission Panel**
```
┌─ DCP: Submit GPU Job ──────────────────────────┐
│  Container Image                                 │
│  [ pytorch/pytorch:2.1-cuda12.1              ▼ ] │
│  Command                                         │
│  [ python train.py --epochs 10                 ] │
│  Provider                                        │
│  [ RTX 4090 — 24 GB — SAR 0.80/hr            ▼ ] │
│  Max Duration (seconds)                          │
│  [ 3600                                        ] │
│                                                  │
│              [ Submit Job ]                      │
└──────────────────────────────────────────────────┘
```

**vLLM Inference Panel**
```
┌─ DCP: vLLM Inference ──────────────────────────┐
│  Model: meta-llama/Llama-3-8B-Instruct           │
│  Status: ● RUNNING on provider-xyz               │
│  ──────────────────────────────────────────────  │
│  > What is quantum computing?                    │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ Quantum computing harnesses the           │   │
│  │ principles of quantum mechanics to        │   │
│  │ process information using qubits...       │   │
│  └──────────────────────────────────────────┘   │
│  [ Enter your prompt here…                     ] │
│                        [ Send ]                  │
└──────────────────────────────────────────────────┘
```

---

## Features

| Feature | Description |
|---------|-------------|
| **GPU Sidebar** | Browse live GPU providers — model, VRAM, status — in the Activity Bar |
| **Job Submission** | Submit containerized workloads via a GUI panel (`Ctrl+Shift+G`) |
| **vLLM Serve** | Launch a vLLM inference session on remote GPU (`Ctrl+Shift+V`) |
| **Inference Panel** | Send prompts to your running vLLM session from inside VS Code |
| **My Jobs View** | Track all submitted jobs and their status in the sidebar |
| **Wallet Panel** | SAR balance at a glance — no browser required |
| **Status Bar** | Live job polling indicator shows elapsed time and current state |
| **Output Channel** | Job logs streamed to the **DCP GPU Compute** output channel |
| **Secure Auth** | API key stored in VS Code SecretStorage — encrypted, never on disk |

---

## Requirements

- **VS Code** 1.85.0 or later
- A **DCP account** — register free at [dcp.sa](https://dcp.sa)
- Your **Renter API key** from the DCP dashboard

---

## Getting Started

1. **Install the extension** — from the VS Code Marketplace or a `.vsix` file
2. **Open the DCP sidebar** — click the GPU chip icon in the Activity Bar
3. **Set your API key** — run `DCP: Set Renter API Key` from the Command Palette (`Ctrl+Shift+P`)
4. **Browse GPUs** — available providers appear automatically in the sidebar
5. **Submit a job** — press `Ctrl+Shift+G` (`Cmd+Shift+G` on Mac), or click **Submit Job** in the sidebar
6. **Start a vLLM session** — press `Ctrl+Shift+V` (`Cmd+Shift+V` on Mac) to launch remote inference

---

## Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| `DCP: Set Renter API Key` | — | Store your DCP API key in VS Code SecretStorage |
| `DCP: Clear API Key` | — | Remove the stored key and sign out |
| `DCP: List Available GPUs` | — | Refresh the GPU providers sidebar |
| `DCP: Submit GPU Job` | `Ctrl+Shift+G` | Open the job submission panel |
| `DCP: Show Job Status` | — | Show the latest job output in the output channel |
| `DCP: Open Wallet / Balance` | — | Focus the wallet panel in the sidebar |
| `DCP: Start vLLM Serve Session` | `Ctrl+Shift+V` | Launch a vLLM inference server on a remote DCP GPU |
| `DCP: Open Inference Panel` | — | Open the prompt/response panel for the active vLLM session |

---

## Job Submission Panel

Select text in your editor (e.g. a Python training command), then press `Ctrl+Shift+G`. The selected text pre-fills the **Command** field.

Configure your job:

- **Container Image** — any Docker image (`pytorch/pytorch`, `vllm/vllm-openai`, `tensorflow/tensorflow`, etc.)
- **Command** — shell command to run inside the container
- **Provider** — pick a specific GPU or let DCP auto-assign
- **Max Duration** — safety cap in seconds

---

## vLLM Serve Workflow

1. Press `Ctrl+Shift+V` — the **Start vLLM Serve** panel opens
2. Choose a model (e.g. `meta-llama/Llama-3-8B-Instruct`) and a GPU provider
3. DCP submits the `vllm serve` container job — the status bar tracks startup
4. Once ready, run **DCP: Open Inference Panel** to send prompts directly from VS Code
5. The **Output Channel** streams live `vllm` logs

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `dc1.apiBaseUrl` | `https://dcp.sa` | DCP API endpoint (override for staging) |
| `dc1.pollingIntervalMs` | `5000` | Job status polling interval in milliseconds |

---

## Building from Source

```bash
cd extensions/dc1-vscode
npm ci               # install pinned dependencies (local dev only — do NOT run on VPS)
npm run compile      # development build
npm run package      # production webpack bundle
vsce package         # create dc1-gpu-1.0.0.vsix
```

Requires Node.js 18+ and `@vscode/vsce`.

---

## API

This extension calls the DCP REST API at `dcp.sa/api/dc1/*`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/renters/available-providers` | GET | List online GPU providers |
| `/jobs/submit` | POST | Submit a container job |
| `/jobs/:id` | GET | Poll job status |
| `/jobs/:id/output` | GET | Fetch job logs |
| `/renters/me` | GET | Wallet balance |

Auth: `x-renter-key` request header.

---

## License

MIT — DCP Platform © 2026 dhnpmp-tech
