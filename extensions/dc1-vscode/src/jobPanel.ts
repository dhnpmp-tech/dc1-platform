/**
 * Webview panel for job submission — GPU model, container image, command, duration.
 */

import * as vscode from 'vscode';
import { Dc1ApiClient, Provider } from './api';

export class JobSubmitPanel {
  static currentPanel: JobSubmitPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static async show(
    context: vscode.ExtensionContext,
    getClient: () => Dc1ApiClient | undefined,
    selectedText?: string
  ): Promise<void> {
    if (JobSubmitPanel.currentPanel) {
      JobSubmitPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'dc1.jobSubmit',
      'DC1: Submit GPU Job',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri],
      }
    );

    JobSubmitPanel.currentPanel = new JobSubmitPanel(panel, getClient, selectedText);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly getClient: () => Dc1ApiClient | undefined,
    private readonly selectedText?: string
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'submit':
            await this.handleSubmit(message.data);
            break;
          case 'loadProviders':
            await this.loadProviders();
            break;
        }
      },
      null,
      this.disposables
    );

    // Auto-load providers
    this.loadProviders();
  }

  private async loadProviders(): Promise<void> {
    const client = this.getClient();
    if (!client) {
      this.panel.webview.postMessage({ command: 'providersLoaded', providers: [] });
      return;
    }
    try {
      const providers = await client.getAvailableProviders();
      this.panel.webview.postMessage({ command: 'providersLoaded', providers });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.panel.webview.postMessage({ command: 'error', message: msg });
    }
  }

  private async handleSubmit(data: {
    container_image: string;
    command: string;
    provider_id: string;
    max_duration_seconds: number;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) {
      this.panel.webview.postMessage({
        command: 'error',
        message: 'No API key configured. Run "DC1: Set Renter API Key" first.',
      });
      return;
    }

    try {
      this.panel.webview.postMessage({ command: 'submitting' });
      const job = await client.submitJob({
        container_image: data.container_image,
        command: data.command || undefined,
        provider_id: data.provider_id || undefined,
        max_duration_seconds: data.max_duration_seconds || undefined,
      });
      this.panel.webview.postMessage({ command: 'submitted', job });
      vscode.window.showInformationMessage(
        `DC1: Job submitted! ID: ${job.id} — Status: ${job.status}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.panel.webview.postMessage({ command: 'error', message: msg });
    }
  }

  private getHtml(): string {
    const prefilledCommand = this.selectedText
      ? this.selectedText.trim().replace(/"/g, '&quot;')
      : '';

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DC1: Submit GPU Job</title>
  <style>
    :root {
      --dc1-amber: #F5A524;
      --dc1-void: #07070E;
    }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
      max-width: 600px;
    }
    h2 { color: var(--dc1-amber); margin-bottom: 4px; font-size: 1.1em; }
    label { display: block; margin-top: 12px; font-size: 0.85em; opacity: 0.7; }
    input, select, textarea {
      width: 100%;
      box-sizing: border-box;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #444);
      border-radius: 4px;
      padding: 6px 8px;
      font-family: inherit;
      font-size: 0.9em;
      margin-top: 4px;
    }
    textarea { resize: vertical; min-height: 80px; font-family: var(--vscode-editor-font-family); }
    button {
      margin-top: 16px;
      background: var(--dc1-amber);
      color: #000;
      border: none;
      border-radius: 4px;
      padding: 8px 18px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.9em;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #status {
      margin-top: 12px;
      padding: 10px;
      border-radius: 4px;
      font-size: 0.85em;
      display: none;
    }
    .success { background: #1a2e1a; border: 1px solid #2e7d32; color: #81c784; }
    .error   { background: #2e1a1a; border: 1px solid #7d2e2e; color: #ef9a9a; }
    .info    { background: #1a1e2e; border: 1px solid #2e3d7d; color: #90caf9; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  </style>
</head>
<body>
  <h2>Submit GPU Job</h2>
  <p style="font-size:0.8em;opacity:0.6;margin-top:2px;">Powered by DC1 — dcp.sa</p>

  <form id="jobForm">
    <label for="container_image">Container Image *</label>
    <input id="container_image" type="text" required
      placeholder="e.g. pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime"
      value="pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime" />

    <label for="command">Command (optional)</label>
    <textarea id="command" placeholder="e.g. python train.py --epochs 10">${prefilledCommand}</textarea>

    <div class="field-row">
      <div>
        <label for="provider_id">Provider (optional)</label>
        <select id="provider_id">
          <option value="">Any available</option>
        </select>
      </div>
      <div>
        <label for="duration">Max Duration (seconds)</label>
        <input id="duration" type="number" min="60" max="86400" value="3600"
          placeholder="3600" />
      </div>
    </div>

    <button type="submit" id="submitBtn">Submit Job</button>
  </form>

  <div id="status"></div>

  <script>
    const vscode = acquireVsCodeApi();

    function showStatus(msg, type) {
      const el = document.getElementById('status');
      el.textContent = msg;
      el.className = type;
      el.style.display = 'block';
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'providersLoaded') {
        const sel = document.getElementById('provider_id');
        msg.providers.forEach(p => {
          if (p.status !== 'online') return;
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = \`\${p.gpu_model} — \${p.vram_gb}GB VRAM\${p.price_per_hour_sar ? ' — ' + p.price_per_hour_sar.toFixed(2) + ' SAR/hr' : ''}\`;
          sel.appendChild(opt);
        });
      } else if (msg.command === 'submitting') {
        document.getElementById('submitBtn').disabled = true;
        showStatus('Submitting job...', 'info');
      } else if (msg.command === 'submitted') {
        document.getElementById('submitBtn').disabled = false;
        showStatus(\`Job submitted! ID: \${msg.job.id} — Status: \${msg.job.status}\`, 'success');
      } else if (msg.command === 'error') {
        document.getElementById('submitBtn').disabled = false;
        showStatus(\`Error: \${msg.message}\`, 'error');
      }
    });

    document.getElementById('jobForm').addEventListener('submit', (e) => {
      e.preventDefault();
      vscode.postMessage({
        command: 'submit',
        data: {
          container_image: document.getElementById('container_image').value.trim(),
          command: document.getElementById('command').value.trim(),
          provider_id: document.getElementById('provider_id').value,
          max_duration_seconds: parseInt(document.getElementById('duration').value, 10) || 3600,
        }
      });
    });

    // Load providers on startup
    vscode.postMessage({ command: 'loadProviders' });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    JobSubmitPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
