import * as vscode from 'vscode';
import { dc1, isAuthError } from '../api/dc1Client';

const RENTER_SECRET_KEY = 'dc1.renterApiKey';
const PROVIDER_SECRET_KEY = 'dc1.providerKey';
const RENTER_SETTING_KEY = 'renterApiKey';

export class AuthManager {
  // ── Renter key ────────────────────────────────────────────────────
  private _apiKey: string | undefined;
  private readonly _onDidChangeKey = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeKey = this._onDidChangeKey.event;

  // ── Provider key ──────────────────────────────────────────────────
  private _providerKey: string | undefined;
  private readonly _onDidChangeProviderKey = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeProviderKey = this._onDidChangeProviderKey.event;

  constructor(private readonly secrets: vscode.SecretStorage) {}

  async load(): Promise<void> {
    this._apiKey = await this.getStoredRenterKey();
    this._providerKey = await this.secrets.get(PROVIDER_SECRET_KEY);
  }

  // ── Renter key accessors ──────────────────────────────────────────

  get apiKey(): string | undefined {
    return this._apiKey;
  }

  get isAuthenticated(): boolean {
    return !!this._apiKey;
  }

  async setApiKey(key: string): Promise<void> {
    await this.secrets.store(RENTER_SECRET_KEY, key);
    this._apiKey = key;
    this._onDidChangeKey.fire(key);
  }

  async clearApiKey(): Promise<void> {
    await this.secrets.delete(RENTER_SECRET_KEY);
    this._apiKey = undefined;
    this._onDidChangeKey.fire(undefined);
  }

  /**
   * Resolve renter key from secure storage, with one-way migration from workspace settings.
   * Settings key fallback is retained only for backward compatibility.
   */
  async getStoredRenterKey(): Promise<string | undefined> {
    if (this._apiKey?.trim()) {
      return this._apiKey.trim();
    }

    const secretKey = (await this.secrets.get(RENTER_SECRET_KEY))?.trim();
    if (secretKey) {
      this._apiKey = secretKey;
      return secretKey;
    }

    const settings = vscode.workspace.getConfiguration('dc1');
    const settingsKey = settings.get<string>(RENTER_SETTING_KEY, '').trim();
    if (!settingsKey) {
      return undefined;
    }

    await this.secrets.store(RENTER_SECRET_KEY, settingsKey);
    this._apiKey = settingsKey;
    this._onDidChangeKey.fire(settingsKey);
    await settings.update(RENTER_SETTING_KEY, '', vscode.ConfigurationTarget.Global);
    return settingsKey;
  }

  /**
   * Prompt user for their DC1 renter API key, validate it, then store it.
   * Returns true if the key was saved successfully.
   */
  async promptAndSave(): Promise<boolean> {
    const current = this._apiKey;
    const input = await vscode.window.showInputBox({
      title: 'DC1 Compute — Set Renter API Key',
      prompt: 'Enter your DC1 Renter API key (from dcp.sa/renter/register)',
      value: current,
      password: true,
      placeHolder: 'rk_xxxxxxxxxxxxxxxx',
      ignoreFocusOut: true,
      validateInput: (v) => (v.trim().length < 10 ? 'API key looks too short' : undefined),
    });

    if (!input) {
      return false;
    }

    const key = input.trim();

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'DC1: Validating renter API key…', cancellable: false },
      async () => {
        try {
          const info = await dc1.getRenterInfo(key);
          await this.setApiKey(key);
          vscode.window.showInformationMessage(
            `DC1: Authenticated as ${info.name} (balance: ${(info.balance_halala / 100).toFixed(2)} SAR)`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`DC1: Invalid renter API key — ${msg}`);
          throw err;
        }
      }
    );

    return this.isAuthenticated;
  }

  /** Ensure renter key is set; prompt if not. Returns the key or undefined. */
  async ensureKey(): Promise<string | undefined> {
    const existing = await this.getStoredRenterKey();
    if (existing) {
      return existing;
    }
    const saved = await this.promptAndSave();
    return saved ? this._apiKey : undefined;
  }

  /** Handle expired/invalid renter auth and prompt for re-authentication. */
  async handleRenterAuthError(err: unknown, action: string): Promise<string | undefined> {
    if (!isAuthError(err)) {
      return this._apiKey;
    }

    await this.clearApiKey();
    const next = await vscode.window.showWarningMessage(
      `DCP: Authentication failed while ${action}. Re-enter renter API key?`,
      'Re-authenticate',
      'Open Settings'
    );

    if (next === 'Open Settings') {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'dc1.renterApiKey');
      return undefined;
    }

    if (next === 'Re-authenticate') {
      const saved = await this.promptAndSave();
      return saved ? this._apiKey : undefined;
    }

    return undefined;
  }

  // ── Provider key accessors ────────────────────────────────────────

  get providerKey(): string | undefined {
    return this._providerKey;
  }

  get providerApiKey(): string | undefined {
    return this._providerKey;
  }

  get isProviderAuthenticated(): boolean {
    return !!this._providerKey;
  }

  async getStoredProviderKey(): Promise<string | undefined> {
    if (this._providerKey?.trim()) {
      return this._providerKey.trim();
    }
    const secretKey = (await this.secrets.get(PROVIDER_SECRET_KEY))?.trim();
    if (secretKey) {
      this._providerKey = secretKey;
      return secretKey;
    }
    return undefined;
  }

  async setProviderKey(key: string): Promise<void> {
    await this.secrets.store(PROVIDER_SECRET_KEY, key);
    this._providerKey = key;
    this._onDidChangeProviderKey.fire(key);
  }

  async clearProviderKey(): Promise<void> {
    await this.secrets.delete(PROVIDER_SECRET_KEY);
    this._providerKey = undefined;
    this._onDidChangeProviderKey.fire(undefined);
  }

  /**
   * Prompt user for their DC1 provider API key, validate it, then store it.
   * Returns true if the key was saved successfully.
   */
  async promptAndSaveProvider(): Promise<boolean> {
    const current = this._providerKey;
    const input = await vscode.window.showInputBox({
      title: 'DC1 Compute — Set Provider API Key',
      prompt: 'Enter your DC1 Provider API key (from dcp.sa/provider/register)',
      value: current,
      password: true,
      placeHolder: 'pk_xxxxxxxxxxxxxxxx',
      ignoreFocusOut: true,
      validateInput: (v) => (v.trim().length < 10 ? 'API key looks too short' : undefined),
    });

    if (!input) {
      return false;
    }

    const key = input.trim();

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'DC1: Validating provider API key…', cancellable: false },
      async () => {
        try {
          const info = await dc1.getProviderInfo(key);
          await this.setProviderKey(key);
          const earningsSar = (info.total_earnings_halala / 100).toFixed(2);
          vscode.window.showInformationMessage(
            `DC1: Connected as provider ${info.name} — ${info.gpu_model} — ${earningsSar} SAR earned`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`DC1: Invalid provider API key — ${msg}`);
          throw err;
        }
      }
    );

    return this.isProviderAuthenticated;
  }

  dispose(): void {
    this._onDidChangeKey.dispose();
    this._onDidChangeProviderKey.dispose();
  }
}
