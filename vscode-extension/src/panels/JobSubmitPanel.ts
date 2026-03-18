import * as vscode from 'vscode';
import { dc1, Provider, JOB_TYPES, SubmitJobRequest } from '../api/dc1Client';
import { AuthManager } from '../auth/AuthManager';

type WebviewMessage =
  | { type: 'submit'; payload: SubmitJobRequest }
  | { type: 'cancel' }
  | { type: 'ready' };

export class JobSubmitPanel {
  private static _current: JobSubmitPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  static show(
    extensionUri: vscode.Uri,
    auth: AuthManager,
    providers: Provider[],
    preselectedProvider?: Provider
  ): void {
    if (JobSubmitPanel._current) {
      JobSubmitPanel._current._panel.reveal(vscode.ViewColumn.Beside);
      JobSubmitPanel._current.updateProviders(providers, preselectedProvider);
      return;
    }
    new JobSubmitPanel(extensionUri, auth, providers, preselectedProvider);
  }

  private constructor(
    extensionUri: vscode.Uri,
    private readonly auth: AuthManager,
    private providers: Provider[],
    private preselected?: Provider
  ) {
    this._panel = vscode.window.createWebviewPanel(
      'dc1JobSubmit',
      'DC1 — Submit GPU Job',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
        retainContextWhenHidden: true,
      }
    );

    JobSubmitPanel._current = this;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => this.handleMessage(msg),
      null,
      this._disposables
    );

    this._panel.webview.html = this.buildHtml(providers, preselected);
  }

  updateProviders(providers: Provider[], preselected?: Provider): void {
    this.providers = providers;
    this.preselected = preselected;
    this._panel.webview.html = this.buildHtml(providers, preselected);
  }

  private async handleMessage(msg: WebviewMessage): Promise<void> {
    if (msg.type === 'cancel') {
      this._panel.dispose();
      return;
    }

    if (msg.type === 'submit') {
      const key = await this.auth.ensureKey();
      if (!key) { return; }

      const payload = msg.payload;

      // Post message back to webview: submitting
      this._panel.webview.postMessage({ type: 'submitting' });

      try {
        const result = await dc1.submitJob(key, payload);
        this._panel.webview.postMessage({
          type: 'success',
          jobId: result.job_id,
          costSar: (result.cost_halala / 100).toFixed(2),
          status: result.status,
        });

        vscode.window.showInformationMessage(
          `DC1: Job submitted! ID: ${result.job_id} | Cost: ${(result.cost_halala / 100).toFixed(2)} SAR`,
          'View Jobs'
        ).then((action) => {
          if (action === 'View Jobs') {
            vscode.commands.executeCommand('dc1.refreshJobs');
          }
        });

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this._panel.webview.postMessage({ type: 'error', message: errMsg });
      }
    }
  }

  private buildHtml(providers: Provider[], preselected?: Provider): string {
    const providersJson = JSON.stringify(providers);
    const jobTypesJson = JSON.stringify(JOB_TYPES);
    const preselectedId = preselected?.id ?? '';
    const nonce = getNonce();

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DC1 — Submit GPU Job</title>
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
      line-height: 1.5;
    }
    h1 {
      color: var(--amber);
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 6px;
      letter-spacing: -0.02em;
    }
    .subtitle { color: var(--muted); font-size: 12px; margin-bottom: 20px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; color: var(--muted); font-size: 11px; text-transform: uppercase;
            letter-spacing: 0.08em; margin-bottom: 6px; font-weight: 600; }
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
    .gpu-card {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .gpu-card.selected { border-color: var(--amber); background: #1e1a10; }
    .gpu-card:hover { border-color: #444458; }
    .gpu-name { font-weight: 600; font-size: 13px; }
    .gpu-meta { color: var(--muted); font-size: 11px; margin-top: 3px; }
    .live-dot {
      display: inline-block; width: 7px; height: 7px; border-radius: 50%;
      background: var(--success); margin-right: 5px; vertical-align: middle;
    }
    .row { display: flex; gap: 12px; }
    .row .form-group { flex: 1; }
    .job-type-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .jt-btn {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px 10px;
      cursor: pointer;
      color: var(--text);
      font-size: 12px;
      text-align: center;
      transition: all 0.15s;
    }
    .jt-btn.selected { border-color: var(--amber); color: var(--amber); background: #1e1a10; }
    .jt-btn:hover { border-color: #444458; }
    .params-row { display: flex; gap: 8px; }
    .params-row input { flex: 1; }
    textarea { resize: vertical; min-height: 80px; font-family: var(--vscode-editor-font-family, monospace); }
    .btn-primary {
      background: var(--amber);
      color: var(--void);
      border: none;
      border-radius: 6px;
      padding: 10px 24px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      margin-top: 8px;
      transition: opacity 0.15s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .alert { padding: 10px 14px; border-radius: 6px; margin-top: 14px; font-size: 12px; }
    .alert-error { background: #1f0a0a; border: 1px solid #3d1010; color: #ff8080; }
    .alert-success { background: #0a1f10; border: 1px solid #103d18; color: #60e890; }
    .cost-preview { color: var(--amber); font-size: 12px; margin-top: 4px; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase;
                     letter-spacing: 0.1em; color: var(--muted); margin-bottom: 10px; }
    #noProviders { color: var(--muted); font-size: 12px; padding: 12px;
                   border: 1px dashed var(--border); border-radius: 6px; text-align: center; }
  </style>
</head>
<body>
  <h1>⚡ Submit GPU Job</h1>
  <div class="subtitle">DC1 Compute — Saudi Arabia's GPU Marketplace</div>

  <div class="form-group">
    <div class="section-title">1 · Select Provider GPU</div>
    <div id="providerList"></div>
    <div id="noProviders" style="display:none">No GPUs online. Refresh the sidebar to check again.</div>
  </div>

  <div class="form-group">
    <div class="section-title">2 · Job Type</div>
    <div class="job-type-grid" id="jobTypeGrid"></div>
  </div>

  <div class="form-group" id="promptGroup">
    <label>Prompt / Task</label>
    <textarea id="promptInput" placeholder="Enter your prompt or task description…" rows="3"></textarea>
  </div>

  <div class="form-group" id="modelGroup">
    <label>Model</label>
    <input type="text" id="modelInput" value="meta-llama/Llama-3.1-8B-Instruct"
           placeholder="e.g. meta-llama/Llama-3.1-8B-Instruct">
  </div>

  <div class="row">
    <div class="form-group">
      <label>Duration (minutes)</label>
      <input type="number" id="durationInput" value="10" min="1" max="1440">
      <div class="cost-preview" id="costPreview">Estimated cost: calculating…</div>
    </div>
    <div class="form-group">
      <label>Min VRAM (GB)</label>
      <input type="number" id="vramInput" value="" min="1" max="80" placeholder="Any">
    </div>
    <div class="form-group">
      <label>Priority</label>
      <select id="priorityInput">
        <option value="2" selected>Normal</option>
        <option value="1">High</option>
        <option value="3">Low</option>
      </select>
    </div>
  </div>

  <button class="btn-primary" id="submitBtn" disabled>Submit Job</button>
  <div id="alertBox"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const PROVIDERS = ${providersJson};
    const JOB_TYPES = ${jobTypesJson};
    const PRESELECTED_ID = '${preselectedId}';

    // Cost rates from backend (halala/minute)
    const COST_RATES = {
      'llm_inference': 5,
      'llm-inference': 5,
      'image_generation': 8,
      'rendering': 6,
      'training': 10,
      'benchmark': 3,
      'custom_container': 5,
      'vllm_serve': 7,
      'default': 5
    };

    let selectedProviderId = PRESELECTED_ID || (PROVIDERS[0]?.id ?? '');
    let selectedJobType = 'llm_inference';

    // Render providers
    const list = document.getElementById('providerList');
    const noProv = document.getElementById('noProviders');
    if (PROVIDERS.length === 0) {
      list.style.display = 'none';
      noProv.style.display = 'block';
    } else {
      PROVIDERS.forEach(p => {
        const card = document.createElement('div');
        card.className = 'gpu-card' + (p.id === selectedProviderId ? ' selected' : '');
        card.dataset.id = p.id;
        const vram = p.vram_gb ? p.vram_gb + 'GB' : '?GB';
        const count = p.gpu_count > 1 ? ' × ' + p.gpu_count : '';
        const live = p.is_live ? '<span class="live-dot"></span>' : '⚠️ ';
        card.innerHTML =
          '<div class="gpu-name">' + live + (p.gpu_model || 'Unknown GPU') + count + '</div>' +
          '<div class="gpu-meta">' + vram + ' VRAM' +
          (p.location ? ' · ' + p.location : '') +
          (p.reliability_score !== null ? ' · ' + p.reliability_score + '% reliability' : '') + '</div>';
        card.addEventListener('click', () => {
          document.querySelectorAll('.gpu-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          selectedProviderId = p.id;
          updateSubmitState();
        });
        list.appendChild(card);
      });
    }

    // Render job types
    const grid = document.getElementById('jobTypeGrid');
    JOB_TYPES.forEach(jt => {
      const btn = document.createElement('div');
      btn.className = 'jt-btn' + (jt.value === selectedJobType ? ' selected' : '');
      btn.textContent = jt.label;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.jt-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedJobType = jt.value;
        updateParamVisibility();
        updateCostPreview();
        updateSubmitState();
      });
      grid.appendChild(btn);
    });

    function updateParamVisibility() {
      const needsPrompt = ['llm_inference', 'llm-inference', 'image_generation', 'vllm_serve'].includes(selectedJobType);
      document.getElementById('promptGroup').style.display = needsPrompt ? '' : 'none';
      document.getElementById('modelGroup').style.display = needsPrompt ? '' : 'none';
    }

    function updateCostPreview() {
      const mins = parseInt(document.getElementById('durationInput').value) || 10;
      const rate = COST_RATES[selectedJobType] || COST_RATES['default'];
      const halala = rate * mins;
      document.getElementById('costPreview').textContent =
        'Estimated cost: ' + (halala / 100).toFixed(2) + ' SAR (' + halala + ' halala)';
    }

    function updateSubmitState() {
      const btn = document.getElementById('submitBtn');
      btn.disabled = !selectedProviderId || PROVIDERS.length === 0;
    }

    document.getElementById('durationInput').addEventListener('input', updateCostPreview);

    document.getElementById('submitBtn').addEventListener('click', () => {
      const duration = parseInt(document.getElementById('durationInput').value);
      const vram = parseInt(document.getElementById('vramInput').value) || undefined;
      const priority = parseInt(document.getElementById('priorityInput').value);
      const prompt = document.getElementById('promptInput').value.trim();
      const model = document.getElementById('modelInput').value.trim();

      if (!duration || duration <= 0) {
        showAlert('Please enter a valid duration.', 'error');
        return;
      }

      const payload = {
        provider_id: selectedProviderId,
        job_type: selectedJobType,
        duration_minutes: duration,
        priority,
        ...(vram ? { gpu_requirements: { min_vram_gb: vram } } : {}),
        ...(prompt || model ? { params: {
          ...(prompt ? { prompt } : {}),
          ...(model ? { model } : {})
        }} : {})
      };

      vscode.postMessage({ type: 'submit', payload });
    });

    function showAlert(msg, type) {
      const box = document.getElementById('alertBox');
      box.innerHTML = '<div class="alert alert-' + type + '">' + escapeHtml(msg) + '</div>';
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    window.addEventListener('message', e => {
      const msg = e.data;
      const btn = document.getElementById('submitBtn');
      if (msg.type === 'submitting') {
        btn.disabled = true;
        btn.textContent = 'Submitting…';
        document.getElementById('alertBox').innerHTML = '';
      } else if (msg.type === 'success') {
        btn.disabled = false;
        btn.textContent = 'Submit Job';
        showAlert('✅ Job submitted! ID: ' + msg.jobId + ' · Cost: ' + msg.costSar + ' SAR · Status: ' + msg.status, 'success');
      } else if (msg.type === 'error') {
        btn.disabled = false;
        btn.textContent = 'Submit Job';
        showAlert('❌ ' + msg.message, 'error');
      }
    });

    // Init
    updateParamVisibility();
    updateCostPreview();
    updateSubmitState();
  </script>
</body>
</html>`;
  }

  dispose(): void {
    JobSubmitPanel._current = undefined;
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
