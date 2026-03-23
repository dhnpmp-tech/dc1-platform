# DCP Provider CLI — VS Code Extension

Manage your DCP provider node directly from VS Code. Monitor node health, configure workspace settings, track earnings, and manage GPU allocation — all without leaving your editor.

---

## Features

| Feature | Description |
|---------|-------------|
| **Node Status Sidebar** | Real-time provider node status, CPU/memory usage, active jobs |
| **Node Management** | Start, stop, and restart your provider node with one command |
| **GPU Allocation** | View available GPUs and adjust allocation percentages on the fly |
| **Earnings Tracking** | Monitor total earnings, monthly breakdown, and pending payouts |
| **Workspace Configuration** | Initialize and manage provider settings in a dedicated `.dcp/` folder |
| **Status Bar Indicator** | Live node status in the VS Code status bar with quick status checks |
| **Node Logs** | Stream provider node logs directly to the DCP output channel |
| **Health Monitoring** | Automatic background health checks with configurable polling interval |

---

## Requirements

- **VS Code** 1.85.0 or later
- A **DCP provider account** — register at [dcp.sa](https://dcp.sa)
- Your **provider API key** from the DCP dashboard
- A **running DCP provider node** on your local network (default: `http://localhost:8080`)

---

## Getting Started

### 1. Install the Extension

Install from the VS Code Marketplace or directly from a `.vsix` file.

### 2. Configure Your Workspace

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run **DCP Provider: Configure Workspace**
3. Enter your provider ID and API key when prompted
4. Select a configuration option:
   - **Basic Setup** — Auto-configure with defaults
   - **Advanced Configuration** — Edit `~/.dcp/provider.json` manually
   - **View Current Config** — Display current settings

The extension will create a `.dcp/` folder in your workspace to store configuration.

### 3. Connect to Your Node

Update the node API URL in VS Code settings (default: `http://localhost:8080`):

```json
{
  "dcp-provider.nodeApiUrl": "http://localhost:8080"
}
```

### 4. Monitor Your Node

- Click the **DCP Provider** icon in the Activity Bar
- View node status, active jobs, CPU/memory, and uptime
- Use status bar indicator for quick health checks

---

## Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| `DCP Provider: Start Node` | `Ctrl+Shift+Alt+S` | Start the provider node |
| `DCP Provider: Stop Node` | `Ctrl+Shift+Alt+X` | Stop the provider node |
| `DCP Provider: Restart Node` | — | Restart the node (graceful reload) |
| `DCP Provider: Show Node Status` | — | Display detailed node status in output channel |
| `DCP Provider: Configure Workspace` | — | Initialize or edit provider workspace settings |
| `DCP Provider: View Earnings` | — | Show total earnings, monthly breakdown, pending payouts |
| `DCP Provider: Allocate GPU` | — | Adjust GPU allocation percentage |
| `DCP Provider: View Node Logs` | — | Stream provider node logs to output channel |

---

## Sidebar Views

### Node Status
- Real-time provider node status (online/offline/error)
- CPU and memory usage
- Active job count
- Total jobs completed
- Node uptime
- Software version

### GPU Allocation
- List of available GPUs (with VRAM, temperature, status)
- Current allocation percentage for each GPU
- Quick-access GPU allocation adjustment

### Earnings
- Total earnings (SAR)
- This month's earnings
- Pending payouts
- Last payment date

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `dcp-provider.nodeApiUrl` | `http://localhost:8080` | Local provider node API URL |
| `dcp-provider.workspaceRoot` | `${workspaceFolder}/.dcp` | Provider workspace folder location |
| `dcp-provider.enableStatusBar` | `true` | Show node status in status bar |
| `dcp-provider.healthCheckIntervalMs` | `5000` | Background health check interval (ms) |

---

## Workspace Configuration File

The extension creates a `provider.json` file in your `.dcp/` workspace folder:

```json
{
  "provider_id": "provider-abc123",
  "api_key": "sk_provider_...",
  "node_api_url": "http://localhost:8080",
  "gpu_allocation": {
    "gpu-0": 100,
    "gpu-1": 50
  },
  "created_at": "2026-03-23T00:00:00.000Z",
  "updated_at": "2026-03-23T12:00:00.000Z"
}
```

**Note:** API keys are also stored securely in VS Code's SecretStorage (never written to disk).

---

## Node API Endpoints

This extension communicates with your local DCP provider node via these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/provider/status` | GET | Node health and resource usage |
| `/api/provider/start` | POST | Start the node |
| `/api/provider/stop` | POST | Stop the node |
| `/api/provider/restart` | POST | Restart the node |
| `/api/provider/gpus` | GET | List GPUs and allocation |
| `/api/provider/gpus/allocate` | POST | Update GPU allocation |
| `/api/provider/earnings` | GET | Get earnings summary |
| `/api/provider/logs` | GET | Stream node logs |

---

## Building from Source

```bash
cd packages/ide-extension

# Install dependencies
npm ci

# Development build (watch mode)
npm run watch

# Production build
npm run package

# Create .vsix package for distribution
vsce package
```

Requires Node.js 18+ and `@vscode/vsce`.

---

## Troubleshooting

**Q: Node status shows "Offline"**
- Verify your provider node is running and accessible at the configured API URL
- Check `dcp-provider.nodeApiUrl` in VS Code settings
- Ensure no firewall rules are blocking the connection

**Q: Configuration file not found**
- Run **DCP Provider: Configure Workspace** to initialize the workspace
- Check that the `.dcp/` folder exists in your workspace root

**Q: Can't allocate GPU**
- Ensure the node is online
- Verify the GPU ID is correct
- Check that allocation percentage is between 0-100

**Q: API key not being saved**
- VS Code SecretStorage must be available (usually handled automatically)
- Try re-entering your credentials via **Configure Workspace**
- Check VS Code logs for security/storage errors

---

## Development Notes

- The extension uses VS Code's **SecretStorage** API for secure API key storage
- Background health checks run at configurable intervals (default: 5s)
- All API calls include proper error handling and user feedback
- Tree views auto-refresh on command completion

---

## License

MIT — DCP Platform © 2026 dhnpmp-tech
