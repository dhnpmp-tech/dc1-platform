/**
 * Webview panel for vLLM serve session — model selector dropdown, provider, duration.
 * Fetches available models from GET /api/providers/models on open.
 */

import * as vscode from 'vscode';
import { Dc1ApiClient } from './api';

export class ServePanel {
  static currentPanel: ServePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static async show(
    context: vscode.ExtensionContext,
    getClient: () => Dc1ApiClient | undefined,
    onServeStarted?: (modelId: string) => void
  ): Promise<void> {
    if (ServePanel.currentPanel) {
      ServePanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'dc1.servePanel',
      'DCP: vLLM Serve Session',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [context.extensionUri],
      }
    );

    ServePanel.currentPanel = new ServePanel(panel, getClient, onServeStarted);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly getClient: () => Dc1ApiClient | undefined,
    private readonly onServeStarted?: (modelId: string) => void
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'loadModels':
            await this.loadModels();
            break;
          case 'submit':
            await this.handleSubmit(message.data);
            break;
        }
      },
      null,
      this.disposables
    );

    this.loadModels();
  }

  private async loadModels(): Promise<void> {
    const client = this.getClient();
    if (!client) {
      this.panel.webview.postMessage({ command: 'modelsLoaded', models: [], fallback: true });
      return;
    }
    try {
      const models = await client.getAvailableModels();
      this.panel.webview.postMessage({ command: 'modelsLoaded', models, fallback: false });
    } catch {
      this.panel.webview.postMessage({ command: 'modelsLoaded', models: [], fallback: true });
    }
  }

  private async handleSubmit(data: {
    model_id: string;
    provider_id: string;
    max_duration_seconds: number;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) {
      this.panel.webview.postMessage({
        command: 'error',
        message: 'No API key configured. Run "DCP: Set Renter API Key" first.',
      });
      return;
    }

    try {
      this.panel.webview.postMessage({ command: 'submitting' });
      const job = await client.submitJob({
        container_image: 'vllm/vllm-openai:latest',
        command: `python -m vllm.entrypoints.openai.api_server --model ${data.model_id}`,
        provider_id: data.provider_id || undefined,
        max_duration_seconds: data.max_duration_seconds || undefined,
      });
      this.panel.webview.postMessage({ command: 'submitted', job });
      this.onServeStarted?.(data.model_id);
      vscode.window.showInformationMessage(
        `DCP: Serve session started! Model: ${data.model_id} — Job ID: ${job.id}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.panel.webview.postMessage({ command: 'error', message: msg });
    }
  }

  private getHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DCP: vLLM Serve Session</title>
  <style>
    :root { --dc1-amber: #F5A524; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
      max-width: 600px;
    }
    h2 { color: var(--dc1-amber); margin-bottom: 4px; font-size: 1.1em; }
    label { display: block; margin-top: 12px; font-size: 0.85em; opacity: 0.7; }
    input, select {
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
    .hint { font-size: 0.75em; opacity: 0.55; margin-top: 3px; min-height: 1em; }
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
  <h2>Start vLLM Serve Session</h2>
  <p style="font-size:0.8em;opacity:0.6;margin-top:2px;">Powered by DCP — dcp.sa</p>

  <form id="serveForm">
    <div id="modelWrapper">
      <label for="model_id">Model</label>
      <select id="model_id" required disabled>
        <option value="" disabled selected>Loading models…</option>
      </select>
      <div id="modelHint" class="hint"></div>
    </div>

    <div class="field-row">
      <div>
        <label for="provider_id">Provider (optional)</label>
        <select id="provider_id">
          <option value="">Any available</option>
        </select>
      </div>
      <div>
        <label for="duration">Max Duration (seconds)</label>
        <input id="duration" type="number" min="300" max="86400" value="3600" placeholder="3600" />
      </div>
    </div>

    <button type="submit" id="submitBtn" disabled>Start Serving</button>
  </form>

  <div id="status"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const modelHints = {};

    function showStatus(msg, type) {
      const el = document.getElementById('status');
      el.textContent = msg;
      el.className = type;
      el.style.display = 'block';
    }

    function updateModelHint(modelId) {
      const count = modelHints[modelId];
      document.getElementById('modelHint').textContent =
        count != null ? count + ' provider' + (count !== 1 ? 's' : '') + ' available' : '';
    }

    window.addEventListener('message', (event) => {
      const msg = event.data;

      if (msg.command === 'modelsLoaded') {
        const wrapper = document.getElementById('modelWrapper');
        const existingSel = document.getElementById('model_id');

        if (msg.fallback || !msg.models || msg.models.length === 0) {
          // Replace select with text input for manual entry
          const input = document.createElement('input');
          input.id = 'model_id';
          input.type = 'text';
          input.required = true;
          input.placeholder = 'e.g. meta-llama/Llama-3-8b-instruct';
          existingSel.replaceWith(input);
          document.getElementById('modelHint').textContent = 'Could not load models — enter model ID manually';
        } else {
          existingSel.innerHTML = '';
          const placeholder = document.createElement('option');
          placeholder.value = '';
          placeholder.disabled = true;
          placeholder.selected = true;
          placeholder.textContent = 'Select a model…';
          existingSel.appendChild(placeholder);

          msg.models.forEach(m => {
            modelHints[m.model_id] = m.providers_count;
            const opt = document.createElement('option');
            opt.value = m.model_id;
            opt.textContent = m.display_name || m.model_id;
            existingSel.appendChild(opt);
          });

          existingSel.disabled = false;
          existingSel.addEventListener('change', (e) => updateModelHint(e.target.value));
        }
        document.getElementById('submitBtn').disabled = false;

      } else if (msg.command === 'submitting') {
        document.getElementById('submitBtn').disabled = true;
        showStatus('Starting serve session…', 'info');

      } else if (msg.command === 'submitted') {
        document.getElementById('submitBtn').disabled = false;
        showStatus('Serve session started! Job ID: ' + msg.job.id, 'success');

      } else if (msg.command === 'error') {
        document.getElementById('submitBtn').disabled = false;
        showStatus('Error: ' + msg.message, 'error');
      }
    });

    document.getElementById('serveForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const modelEl = document.getElementById('model_id');
      vscode.postMessage({
        command: 'submit',
        data: {
          model_id: modelEl.value.trim(),
          provider_id: document.getElementById('provider_id').value,
          max_duration_seconds: parseInt(document.getElementById('duration').value, 10) || 3600,
        }
      });
    });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    ServePanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
