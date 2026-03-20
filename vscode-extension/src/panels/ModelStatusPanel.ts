import * as vscode from 'vscode';
import { dc1, VllmModel } from '../api/dc1Client';

export class ModelStatusPanel {
  private static _current: ModelStatusPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  static show(extensionUri: vscode.Uri): void {
    if (ModelStatusPanel._current) {
      ModelStatusPanel._current._panel.reveal(vscode.ViewColumn.Beside);
      ModelStatusPanel._current.reload();
      return;
    }
    new ModelStatusPanel(extensionUri);
  }

  private constructor(extensionUri: vscode.Uri) {
    this._panel = vscode.window.createWebviewPanel(
      'dcpModelStatus',
      'DCP — Model Cache Status',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
        retainContextWhenHidden: true,
      }
    );

    ModelStatusPanel._current = this;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg: { type: string }) => {
        if (msg.type === 'refresh') { this.reload(); }
      },
      null,
      this._disposables
    );

    this._panel.webview.html = this.buildHtml([], true);
    this.reload();
  }

  private async reload(): Promise<void> {
    try {
      const resp = await dc1.getVllmModels();
      this._panel.webview.html = this.buildHtml(resp.data || [], false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._panel.webview.html = this.buildHtml([], false, msg);
    }
  }

  private buildTableHtml(models: VllmModel[]): string {
    if (models.length === 0) {
      return '<div class="empty-state">No models available. Check your API connection.</div>';
    }

    const available = models.filter(m => m.status === 'available').length;
    const totalProviders = models.reduce((sum, m) => sum + m.providers_online, 0);

    const statsHtml = `
      <div class="summary-row">
        <div class="stat-card">
          <div class="stat-label">Total Models</div>
          <div class="stat-value amber">${models.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Available</div>
          <div class="stat-value">${available}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Providers Online</div>
          <div class="stat-value">${totalProviders}</div>
        </div>
      </div>`;

    const rowsHtml = models.map((m) => {
      const statusBadge = m.status === 'available'
        ? '<span class="badge badge-green">● Available</span>'
        : '<span class="badge badge-red">● Offline</span>';

      // Estimate cold start based on VRAM footprint (heuristic)
      let coldStartLabel: string;
      let coldStartClass: string;
      if (m.status !== 'available') {
        coldStartLabel = 'N/A';
        coldStartClass = '';
      } else if (m.vram_gb <= 8) {
        coldStartLabel = '~20s';
        coldStartClass = 'cold-fast';
      } else if (m.vram_gb <= 16) {
        coldStartLabel = '~45s';
        coldStartClass = 'cold-medium';
      } else if (m.vram_gb <= 40) {
        coldStartLabel = '~90s';
        coldStartClass = 'cold-medium';
      } else {
        coldStartLabel = '~3min';
        coldStartClass = 'cold-slow';
      }

      const quant = m.quantization
        ? ` <span class="badge badge-yellow">${esc(m.quantization)}</span>`
        : '';

      return `<tr>
        <td>
          <div class="model-name">${esc(m.display_name)}${quant}</div>
          <div class="model-id">${esc(m.model_id)}</div>
        </td>
        <td>${statusBadge}</td>
        <td>${m.providers_online}</td>
        <td>${m.min_gpu_vram_gb} GB</td>
        <td>${Number(m.context_window).toLocaleString()}</td>
        <td class="${coldStartClass}">${coldStartLabel}</td>
        <td>${m.avg_price_sar_per_min} SAR/min</td>
      </tr>`;
    }).join('');

    return statsHtml + `
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Status</th>
            <th>Providers</th>
            <th>Min VRAM</th>
            <th>Context</th>
            <th>Est. Cold Start</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>`;
  }

  private buildHtml(models: VllmModel[], loading: boolean, errorMsg?: string): string {
    const nonce = getNonce();
    const fetchedAt = new Date().toLocaleTimeString();
    const tableHtml = (!loading && !errorMsg) ? this.buildTableHtml(models) : '';

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DCP — Model Cache Status</title>
  <style>
    :root {
      --amber: #F5A524;
      --void: #07070E;
      --surface: #111118;
      --surface2: #1a1a24;
      --text: #e8e8f0;
      --muted: #888898;
      --border: #2a2a3a;
      --error: #ff4a4a;
      --success: #22c55e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--surface);
      color: var(--text);
      font-family: var(--vscode-font-family, 'Inter', sans-serif);
      font-size: 13px;
      padding: 20px;
      line-height: 1.6;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
    h1 { color: var(--amber); font-size: 17px; font-weight: 700; }
    .subtitle { color: var(--muted); font-size: 12px; margin-top: 2px; }
    .refresh-btn {
      background: transparent; border: 1px solid var(--border);
      border-radius: 6px; padding: 6px 14px; color: var(--muted);
      font-size: 12px; font-weight: 600; cursor: pointer; transition: border-color 0.15s;
      white-space: nowrap;
    }
    .refresh-btn:hover { border-color: var(--amber); color: var(--text); }
    .refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .summary-row { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
    .stat-card {
      background: var(--surface2); border: 1px solid var(--border);
      border-radius: 8px; padding: 12px 16px; flex: 1; min-width: 130px;
    }
    .stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; }
    .stat-value { font-size: 22px; font-weight: 700; color: var(--text); margin-top: 2px; }
    .stat-value.amber { color: var(--amber); }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      text-align: left; padding: 8px 10px;
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em;
      color: var(--muted); font-weight: 700;
      border-bottom: 1px solid var(--border); white-space: nowrap;
    }
    tbody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
    tbody tr:hover { background: var(--surface2); }
    tbody tr:last-child { border-bottom: none; }
    td { padding: 10px 10px; font-size: 12px; vertical-align: middle; }
    .model-name { font-weight: 600; color: var(--text); }
    .model-id { font-size: 11px; color: var(--muted); margin-top: 1px; font-family: monospace; }
    .badge {
      display: inline-block; padding: 2px 7px; border-radius: 4px;
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      white-space: nowrap;
    }
    .badge-green { background: #0d2d18; color: var(--success); border: 1px solid #103d18; }
    .badge-yellow { background: #2d1f00; color: var(--amber); border: 1px solid #3d2a00; }
    .badge-red { background: #1f0a0a; color: #ff8080; border: 1px solid #3d1010; }
    .cold-fast { color: var(--success); font-weight: 600; }
    .cold-medium { color: var(--amber); font-weight: 600; }
    .cold-slow { color: #ff8080; font-weight: 600; }
    .loading { text-align: center; padding: 40px; color: var(--muted); }
    .error-box {
      background: #1f0a0a; border: 1px solid #3d1010; border-radius: 6px;
      padding: 12px 16px; color: #ff8080; font-size: 12px; margin-top: 10px;
    }
    .empty-state {
      text-align: center; padding: 40px; color: var(--muted);
      border: 1px dashed var(--border); border-radius: 8px;
    }
    .fetched-at { font-size: 11px; color: var(--muted); margin-top: 14px; text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📦 Model Cache Status</h1>
      <div class="subtitle">Available vLLM models on the DCP GPU network</div>
    </div>
    <button class="refresh-btn" id="refreshBtn" ${loading ? 'disabled' : ''}>↻ Refresh</button>
  </div>

  ${loading ? '<div class="loading">Loading model registry…</div>' : ''}
  ${errorMsg ? `<div class="error-box">⚠ Failed to load models: ${esc(errorMsg)}</div>` : ''}

  ${tableHtml}

  ${!loading ? `<div class="fetched-at">Updated at ${fetchedAt}</div>` : ''}

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('refreshBtn').addEventListener('click', () => {
      document.getElementById('refreshBtn').disabled = true;
      document.getElementById('refreshBtn').textContent = '↻ Refreshing…';
      vscode.postMessage({ type: 'refresh' });
    });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    ModelStatusPanel._current = undefined;
    this._panel.dispose();
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
