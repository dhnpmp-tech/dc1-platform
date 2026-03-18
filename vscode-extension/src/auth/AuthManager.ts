import * as vscode from 'vscode';
import { dc1 } from '../api/dc1Client';

const SECRET_KEY = 'dc1.renterApiKey';

export class AuthManager {
  private _apiKey: string | undefined;
  private readonly _onDidChangeKey = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeKey = this._onDidChangeKey.event;

  constructor(private readonly secrets: vscode.SecretStorage) {}

  async load(): Promise<void> {
    this._apiKey = await this.secrets.get(SECRET_KEY);
  }

  get apiKey(): string | undefined {
    return this._apiKey;
  }

  get isAuthenticated(): boolean {
    return !!this._apiKey;
  }

  async setApiKey(key: string): Promise<void> {
    await this.secrets.store(SECRET_KEY, key);
    this._apiKey = key;
    this._onDidChangeKey.fire(key);
  }

  async clearApiKey(): Promise<void> {
    await this.secrets.delete(SECRET_KEY);
    this._apiKey = undefined;
    this._onDidChangeKey.fire(undefined);
  }

  /**
   * Prompt user for their DC1 renter API key, validate it, then store it.
   * Returns true if the key was saved successfully.
   */
  async promptAndSave(): Promise<boolean> {
    const current = this._apiKey;
    const input = await vscode.window.showInputBox({
      title: 'DC1 Compute — Set API Key',
      prompt: 'Enter your DC1 Renter API key (from dc1st.com/renter/register)',
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

    // Validate by hitting /renters/me
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'DC1: Validating API key…', cancellable: false },
      async () => {
        try {
          const info = await dc1.getRenterInfo(key);
          await this.setApiKey(key);
          vscode.window.showInformationMessage(
            `DC1: Authenticated as ${info.name} (balance: ${(info.balance_halala / 100).toFixed(2)} SAR)`
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`DC1: Invalid API key — ${msg}`);
          throw err;
        }
      }
    );

    return this.isAuthenticated;
  }

  /** Ensure key is set; prompt if not. Returns the key or undefined. */
  async ensureKey(): Promise<string | undefined> {
    if (this._apiKey) {
      return this._apiKey;
    }
    const saved = await this.promptAndSave();
    return saved ? this._apiKey : undefined;
  }

  dispose(): void {
    this._onDidChangeKey.dispose();
  }
}
