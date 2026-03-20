import * as vscode from 'vscode';

type WebviewMessage =
  | { type: 'ready' }
  | { type: 'save'; apiBase: string; renterApiKey: string }
  | { type: 'openSecrets' };

export class SettingsPanel {
  private static _current: SettingsPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  static show(extensionUri: vscode.Uri): void {
    if (SettingsPanel._current) {
      SettingsPanel._current._panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    new SettingsPanel(extensionUri);
  }

  private constructor(extensionUri: vscode.Uri) {
    this._panel = vscode.window.createWebviewPanel(
      'dcpSettings',
      'DCP — Settings',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
        retainContextWhenHidden: true,
      }
    );

    SettingsPanel._current = this;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => this.handleMessage(msg),
      null,
      this._disposables
    );

    this._panel.webview.html = this.buildHtml();
  }

  private async handleMessage(msg: WebviewMessage): Promise<void> {
    if (msg.type === 'save') {
      const config = vscode.workspace.getConfiguration('dc1');
      const apiBase = msg.apiBase.trim() || 'https://api.dcp.sa';
      const renterApiKey = msg.renterApiKey.trim();

      await config.update('apiBase', apiBase, vscode.ConfigurationTarget.Global);
      if (renterApiKey && !renterApiKey.includes('*')) {
        await config.update('renterApiKey', renterApiKey, vscode.ConfigurationTarget.Global);
      }

      this._panel.webview.postMessage({ type: 'saved' });
      vscode.window.showInformationMessage('DCP: Settings saved.');
    }

    if (msg.type === 'openSecrets') {
      // Trigger the key prompt to store in VS Code secret storage instead
      vscode.commands.executeCommand('dc1.setup');
    }
  }

  private buildHtml(): string {
    const config = vscode.workspace.getConfiguration('dc1');
    const apiBase = config.get<string>('apiBase', 'https://api.dcp.sa');
    const rawKey = config.get<string>('renterApiKey', '');
    const maskedKey = rawKey.length > 0
      ? rawKey.slice(0, 4) + '•'.repeat(Math.max(0, rawKey.length - 8)) + rawKey.slice(-4)
      : '';
    const nonce = getNonce();

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DCP — Settings</title>
  <style>
    :root {
      --amber: #F5A524;
      --void: #07070E;
      --surface: #111118;
      --surface2: #1a1a24;
      --text: #e8e8f0;
      --muted: #888898;
      --border: #2a2a3a;
      --success: #22c55e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--surface);
      color: var(--text);
      font-family: var(--vscode-font-family, 'Inter', sans-serif);
      font-size: 13px;
      padding: 24px;
      line-height: 1.6;
    }
    h1 { color: var(--amber); font-size: 17px; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: var(--muted); font-size: 12px; margin-bottom: 24px; }
    .section {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--muted); margin-bottom: 14px;
    }
    .form-group { margin-bottom: 14px; }
    .form-group:last-child { margin-bottom: 0; }
    label {
      display: block; color: var(--muted); font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; font-weight: 600;
    }
    input {
      width: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      padding: 8px 10px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
    }
    input:focus { border-color: var(--amber); }
    .hint { color: var(--muted); font-size: 11px; margin-top: 4px; }
    .btn-primary {
      background: var(--amber); color: var(--void); border: none;
      border-radius: 6px; padding: 9px 20px; font-size: 13px;
      font-weight: 700; cursor: pointer; transition: opacity 0.15s;
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-secondary {
      background: transparent; color: var(--muted); border: 1px solid var(--border);
      border-radius: 6px; padding: 9px 20px; font-size: 13px;
      font-weight: 600; cursor: pointer; transition: border-color 0.15s;
    }
    .btn-secondary:hover { border-color: var(--amber); color: var(--text); }
    .actions { display: flex; gap: 10px; margin-top: 16px; }
    .alert { padding: 10px 14px; border-radius: 6px; margin-top: 14px; font-size: 12px; }
    .alert-success { background: #0a1f10; border: 1px solid #103d18; color: #60e890; }
    .secret-notice {
      background: #1a1400; border: 1px solid #3d2a00; border-radius: 6px;
      padding: 10px 14px; font-size: 12px; color: var(--amber); margin-top: 10px;
    }
    .key-row { display: flex; gap: 8px; align-items: flex-start; }
    .key-row input { flex: 1; }
    .eye-btn {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 6px; padding: 8px 10px; cursor: pointer; color: var(--muted);
      font-size: 13px; transition: border-color 0.15s; flex-shrink: 0; margin-top: 0;
    }
    .eye-btn:hover { border-color: var(--amber); color: var(--text); }
  </style>
</head>
<body>
  <h1>⚙ DCP Settings</h1>
  <div class="subtitle">Configure your DCP API connection and authentication.</div>

  <div class="section">
    <div class="section-title">API Connection</div>
    <div class="form-group">
      <label>API Base URL</label>
      <input type="url" id="apiBaseInput" value="${escapeAttr(apiBase)}" placeholder="https://api.dcp.sa">
      <div class="hint">Default: https://api.dcp.sa — change only if using a self-hosted instance.</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Renter API Key</div>
    <div class="form-group">
      <label>API Key (stored in VS Code settings)</label>
      <div class="key-row">
        <input type="password" id="renterKeyInput" value="${escapeAttr(rawKey)}" placeholder="dcp_renter_…">
        <button class="eye-btn" id="toggleVisibility" title="Toggle visibility">👁</button>
      </div>
      <div class="hint">
        ${rawKey ? `Current key: <code>${maskedKey}</code> — enter a new value to replace.` : 'No key set. Enter your key from dcp.sa/renter/register.'}
      </div>
    </div>
    <div class="secret-notice">
      🔒 For stronger security, use <strong>DCP: Set Renter API Key</strong> (command palette)
      to store your key in VS Code's encrypted secret storage instead.
      <br><br>
      <button class="btn-secondary" id="useSecretsBtn" style="margin-top:6px">Open Secure Key Prompt</button>
    </div>
  </div>

  <div class="actions">
    <button class="btn-primary" id="saveBtn">Save Settings</button>
  </div>

  <div id="alertBox"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById('saveBtn').addEventListener('click', () => {
      const apiBase = document.getElementById('apiBaseInput').value.trim();
      const renterApiKey = document.getElementById('renterKeyInput').value.trim();
      document.getElementById('saveBtn').disabled = true;
      document.getElementById('saveBtn').textContent = 'Saving…';
      vscode.postMessage({ type: 'save', apiBase, renterApiKey });
    });

    document.getElementById('useSecretsBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'openSecrets' });
    });

    document.getElementById('toggleVisibility').addEventListener('click', () => {
      const input = document.getElementById('renterKeyInput');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    window.addEventListener('message', e => {
      const msg = e.data;
      if (msg.type === 'saved') {
        const btn = document.getElementById('saveBtn');
        btn.disabled = false;
        btn.textContent = 'Save Settings';
        document.getElementById('alertBox').innerHTML =
          '<div class="alert alert-success">✓ Settings saved successfully.</div>';
        setTimeout(() => { document.getElementById('alertBox').innerHTML = ''; }, 3000);
      }
    });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    SettingsPanel._current = undefined;
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

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
