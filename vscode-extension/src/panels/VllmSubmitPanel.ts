import * as vscode from 'vscode';
import { dc1, VllmModel, VllmCompleteRequest } from '../api/dc1Client';
import { AuthManager } from '../auth/AuthManager';

type WebviewMessage =
  | { type: 'ready' }
  | { type: 'submit'; model: string; prompt: string; maxTokens: number; temperature: number }
  | { type: 'reloadModels' }
  | { type: 'cancel' };

export class VllmSubmitPanel {
  private static _current: VllmSubmitPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _models: VllmModel[] = [];
  private _loadError: string | null = null;

  static show(extensionUri: vscode.Uri, auth: AuthManager): void {
    if (VllmSubmitPanel._current) {
      VllmSubmitPanel._current._panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    new VllmSubmitPanel(extensionUri, auth);
  }

  private constructor(
    extensionUri: vscode.Uri,
    private readonly auth: AuthManager
  ) {
    this._panel = vscode.window.createWebviewPanel(
      'dcpVllmSubmit',
      'DCP — AI Inference',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
        retainContextWhenHidden: true,
      }
    );

    VllmSubmitPanel._current = this;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => this.handleMessage(msg),
      null,
      this._disposables
    );

    // Show loading state while fetching models
    this._panel.webview.html = this.buildHtml([], true, null);
    this.loadModels();
  }

  private async loadModels(): Promise<void> {
    try {
      const resp = await dc1.getVllmModels();
      this._models = resp.data || [];
      this._loadError = null;
    } catch (err) {
      this._models = [];
      this._loadError = err instanceof Error ? err.message : 'Could not load models from API';
    }
    this._panel.webview.html = this.buildHtml(this._models, false, this._loadError);
  }

  private async handleMessage(msg: WebviewMessage): Promise<void> {
    if (msg.type === 'cancel') {
      this._panel.dispose();
      return;
    }

    if (msg.type === 'reloadModels') {
      this._panel.webview.html = this.buildHtml(this._models, true, null);
      await this.loadModels();
      return;
    }

    if (msg.type === 'submit') {
      // Get API key: check settings first, then secrets
      let key = vscode.workspace.getConfiguration('dc1').get<string>('renterApiKey', '').trim();
      if (!key) {
        key = (await this.auth.ensureKey()) ?? '';
      }
      if (!key) {
        vscode.window.showErrorMessage('DCP: Set your renter API key in Settings → Extensions → DCP Compute → Renter API Key');
        return;
      }

      this._panel.webview.postMessage({ type: 'submitting' });

      const payload: VllmCompleteRequest = {
        model: msg.model,
        messages: [{ role: 'user', content: msg.prompt }],
        max_tokens: msg.maxTokens,
        temperature: msg.temperature,
      };

      try {
        const result = await dc1.vllmComplete(key, payload);
        const text = result.choices[0]?.message?.content ?? '';
        const jobId = result.id.replace('chatcmpl-', '');
        const costSar = (result.cost_halala / 100).toFixed(4);

        this._panel.webview.postMessage({
          type: 'success',
          text,
          jobId: result.id,
          model: result.model,
          costSar,
          usage: result.usage,
        });

        vscode.window.showInformationMessage(
          `DCP: Inference complete — ${result.usage.total_tokens} tokens — ${costSar} SAR`,
          'Watch Logs'
        ).then((action) => {
          if (action === 'Watch Logs') {
            vscode.commands.executeCommand('dc1.watchJobLogs', jobId);
          }
        });

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this._panel.webview.postMessage({ type: 'error', message: errMsg });
      }
    }
  }

  private buildHtml(models: VllmModel[], loading: boolean, loadError: string | null): string {
    const nonce = getNonce();
    const modelsJson = JSON.stringify(models);

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DCP — AI Inference</title>
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
    h1 { color: var(--amber); font-size: 17px; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.02em; }
    .subtitle { color: var(--muted); font-size: 12px; margin-bottom: 20px; }
    .form-group { margin-bottom: 14px; }
    label {
      display: block; color: var(--muted); font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; font-weight: 600;
    }
    select, input, textarea {
      width: 100%;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      padding: 8px 10px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
    }
    select:focus, input:focus, textarea:focus { border-color: var(--amber); }
    textarea { resize: vertical; min-height: 100px; font-family: var(--vscode-editor-font-family, monospace); }
    .row { display: flex; gap: 12px; }
    .row .form-group { flex: 1; }
    .model-meta {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      margin-top: 8px;
      font-size: 12px;
      color: var(--muted);
      display: none;
    }
    .model-meta.visible { display: block; }
    .model-meta span { color: var(--text); }
    .badge {
      display: inline-block; padding: 2px 7px; border-radius: 4px;
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    }
    .badge-green { background: #0d2d18; color: var(--success); border: 1px solid #103d18; }
    .badge-yellow { background: #2d1f00; color: var(--amber); border: 1px solid #3d2a00; }
    .badge-red { background: #1f0a0a; color: #ff8080; border: 1px solid #3d1010; }
    .btn-primary {
      background: var(--amber); color: var(--void); border: none;
      border-radius: 6px; padding: 10px 24px; font-size: 14px;
      font-weight: 700; cursor: pointer; width: 100%; margin-top: 8px; transition: opacity 0.15s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .alert { padding: 10px 14px; border-radius: 6px; margin-top: 14px; font-size: 12px; }
    .alert-error { background: #1f0a0a; border: 1px solid #3d1010; color: #ff8080; }
    .alert-success { background: #0a1f10; border: 1px solid #103d18; color: #60e890; }
    #resultBox {
      display: none; background: var(--surface2); border: 1px solid var(--border);
      border-radius: 8px; padding: 16px; margin-top: 16px;
    }
    #resultBox.visible { display: block; }
    .result-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--border);
    }
    .result-title { font-weight: 700; font-size: 13px; color: var(--amber); }
    .result-meta { font-size: 11px; color: var(--muted); }
    .result-text {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px; line-height: 1.7; white-space: pre-wrap; color: var(--text);
      max-height: 300px; overflow-y: auto; padding: 8px 0;
    }
    .result-footer {
      display: flex; gap: 8px; align-items: center; margin-top: 10px;
      padding-top: 10px; border-top: 1px solid var(--border); font-size: 11px; color: var(--muted);
    }
    .loading { color: var(--muted); text-align: center; padding: 30px; font-size: 13px; }
    .no-models { color: var(--muted); text-align: center; padding: 16px;
                  border: 1px dashed var(--border); border-radius: 6px; font-size: 12px; }
    .key-notice {
      background: #2d1f00; border: 1px solid #3d2a00; border-radius: 6px;
      padding: 10px 12px; margin-bottom: 16px; font-size: 12px; color: var(--amber);
    }
    .toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .btn-secondary {
      background: var(--surface2);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .btn-secondary:hover { border-color: var(--amber); color: var(--amber); }
  </style>
</head>
<body>
  <h1>⚡ DCP AI Inference</h1>
  <div class="subtitle">Run LLM inference on DCP GPU network — Saudi Arabia's compute marketplace</div>

  <div class="key-notice" id="keyNotice" style="display:none">
    ⚠️ No renter API key set. Add it in Settings → Extensions → DCP Compute → Renter API Key,
    or run <strong>DCP: Set Renter API Key</strong> from the command palette.
  </div>

  <div class="toolbar">
    <button class="btn-secondary" id="reloadBtn">Reload Models</button>
  </div>

  ${loading ? '<div class="loading">Loading available models…</div>' : ''}
  ${!loading && loadError ? `<div class="alert alert-error">Model list unavailable: ${escapeForHtml(loadError)}</div>` : ''}

  <div id="mainForm" style="display:${loading ? 'none' : 'block'}">
    <div class="form-group">
      <label>Model</label>
      ${models.length === 0
        ? '<div class="no-models">No models available. Check your API connection.</div>'
        : `<select id="modelSelect">
            ${models.map(m => `<option value="${m.model_id}" data-vram="${m.min_gpu_vram_gb}" data-price="${m.avg_price_sar_per_min}" data-providers="${m.providers_online}" data-ctx="${m.context_window}" data-status="${m.status}">${m.display_name}${m.quantization ? ' (' + m.quantization + ')' : ''}</option>`).join('')}
          </select>
          <div class="model-meta visible" id="modelMeta"></div>`
      }
    </div>

    <div class="form-group">
      <label>Prompt</label>
      <textarea id="promptInput" placeholder="Enter your prompt…" rows="5"></textarea>
    </div>

    <div class="row">
      <div class="form-group">
        <label>Max tokens</label>
        <input type="number" id="maxTokensInput" value="512" min="1" max="8192">
      </div>
      <div class="form-group">
        <label>Temperature</label>
        <input type="number" id="tempInput" value="0.7" min="0" max="2" step="0.1">
      </div>
    </div>

    <button class="btn-primary" id="submitBtn" ${models.length === 0 ? 'disabled' : ''}>
      Run Inference
    </button>
    <div id="alertBox"></div>

    <div id="resultBox">
      <div class="result-header">
        <span class="result-title">Response</span>
        <span class="result-meta" id="resultMeta"></span>
      </div>
      <div class="result-text" id="resultText"></div>
      <div class="result-footer">
        <span id="jobIdBadge"></span>
        <span id="tokensBadge"></span>
        <span id="costBadge"></span>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const MODELS = ${modelsJson};

    function updateModelMeta() {
      const sel = document.getElementById('modelSelect');
      const meta = document.getElementById('modelMeta');
      if (!sel || !meta) return;
      const opt = sel.options[sel.selectedIndex];
      if (!opt) return;
      const providers = opt.dataset.providers;
      const vram = opt.dataset.vram;
      const price = opt.dataset.price;
      const ctx = opt.dataset.ctx;
      const status = opt.dataset.status;
      const statusBadge = status === 'available'
        ? '<span class="badge badge-green">● Available</span>'
        : '<span class="badge badge-red">● No Providers</span>';
      meta.innerHTML =
        statusBadge + '&nbsp;&nbsp;' +
        '<span>' + providers + ' provider' + (providers !== '1' ? 's' : '') + ' online</span>' +
        ' &nbsp;·&nbsp; Min VRAM: <span>' + vram + ' GB</span>' +
        ' &nbsp;·&nbsp; Context: <span>' + Number(ctx).toLocaleString() + ' tokens</span>' +
        ' &nbsp;·&nbsp; ~<span>' + price + ' SAR/min</span>';
    }

    const modelSel = document.getElementById('modelSelect');
    const reloadBtn = document.getElementById('reloadBtn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'reloadModels' });
      });
    }
    if (modelSel) {
      modelSel.addEventListener('change', updateModelMeta);
      updateModelMeta();
    }

    document.getElementById('submitBtn')?.addEventListener('click', () => {
      const model = document.getElementById('modelSelect')?.value;
      const prompt = document.getElementById('promptInput').value.trim();
      const maxTokens = parseInt(document.getElementById('maxTokensInput').value) || 512;
      const temperature = parseFloat(document.getElementById('tempInput').value) ?? 0.7;

      if (!model) { showAlert('Select a model.', 'error'); return; }
      if (!prompt) { showAlert('Enter a prompt.', 'error'); return; }

      vscode.postMessage({ type: 'submit', model, prompt, maxTokens, temperature });
    });

    function showAlert(msg, type) {
      document.getElementById('alertBox').innerHTML =
        '<div class="alert alert-' + type + '">' + escapeHtml(msg) + '</div>';
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    window.addEventListener('message', e => {
      const msg = e.data;
      const btn = document.getElementById('submitBtn');
      if (msg.type === 'submitting') {
        btn.disabled = true;
        btn.textContent = 'Running inference…';
        document.getElementById('alertBox').innerHTML = '';
        document.getElementById('resultBox').classList.remove('visible');
      } else if (msg.type === 'success') {
        btn.disabled = false;
        btn.textContent = 'Run Inference';
        document.getElementById('alertBox').innerHTML = '';
        // Show result
        document.getElementById('resultText').textContent = msg.text;
        document.getElementById('resultMeta').textContent = msg.model;
        document.getElementById('jobIdBadge').innerHTML =
          '<span class="badge badge-green">✓ Completed</span> ' + msg.jobId;
        document.getElementById('tokensBadge').textContent =
          msg.usage.total_tokens + ' tokens';
        document.getElementById('costBadge').textContent = msg.costSar + ' SAR';
        document.getElementById('resultBox').classList.add('visible');
      } else if (msg.type === 'error') {
        btn.disabled = false;
        btn.textContent = 'Run Inference';
        showAlert('❌ ' + msg.message, 'error');
      } else if (msg.type === 'modelsLoaded') {
        // handled server-side by rebuilding HTML
      }
    });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    VllmSubmitPanel._current = undefined;
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

function escapeForHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
