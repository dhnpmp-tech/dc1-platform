/**
 * Manages DC1 API key storage using VS Code SecretStorage.
 * Keys are encrypted at rest and never written to disk in plaintext.
 */

import * as vscode from 'vscode';

const SECRET_KEY = 'dc1.renterApiKey';

export class AuthStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async getApiKey(): Promise<string | undefined> {
    return this.secrets.get(SECRET_KEY);
  }

  async setApiKey(key: string): Promise<void> {
    await this.secrets.store(SECRET_KEY, key);
  }

  async clearApiKey(): Promise<void> {
    await this.secrets.delete(SECRET_KEY);
  }

  async requireApiKey(): Promise<string | undefined> {
    const key = await this.getApiKey();
    if (key) {
      return key;
    }

    const input = await vscode.window.showInputBox({
      prompt: 'Enter your DC1 Renter API Key',
      placeHolder: 'renter_xxxxxxxxxxxx',
      password: true,
      ignoreFocusOut: true,
      validateInput: (v) => (v.trim().length > 0 ? undefined : 'API key cannot be empty'),
    });

    if (!input) {
      return undefined;
    }

    const trimmed = input.trim();
    await this.setApiKey(trimmed);
    vscode.window.showInformationMessage('DC1: API key saved securely.');
    return trimmed;
  }
}
