/**
 * TreeDataProvider for the "Wallet" sidebar panel.
 */

import * as vscode from 'vscode';
import { Dc1ApiClient, WalletInfo } from '../api';

class WalletItem extends vscode.TreeItem {
  constructor(label: string, value: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = value;
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

class EmptyItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

export class WalletTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private wallet: WalletInfo | undefined;
  private loading = false;
  private errorMessage: string | undefined;

  constructor(private getClient: () => Dc1ApiClient | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async load(): Promise<void> {
    const client = this.getClient();
    if (!client) {
      this.errorMessage = 'No API key set.';
      this.wallet = undefined;
      this.refresh();
      return;
    }

    this.loading = true;
    this.errorMessage = undefined;
    this.refresh();

    try {
      this.wallet = await client.getWallet();
      this.errorMessage = undefined;
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
      this.wallet = undefined;
    } finally {
      this.loading = false;
      this.refresh();
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(_element?: vscode.TreeItem): vscode.TreeItem[] {
    if (this.loading) {
      return [new EmptyItem('Loading wallet...')];
    }
    if (this.errorMessage) {
      return [new EmptyItem(`Error: ${this.errorMessage}`)];
    }
    if (!this.wallet) {
      return [new EmptyItem('No wallet data.')];
    }

    const w = this.wallet;
    return [
      new WalletItem('Balance', `${w.balance_sar.toFixed(2)} SAR`, 'credit-card'),
      new WalletItem(
        'Balance (halala)',
        `${w.balance_halala} ℏ`,
        'symbol-numeric'
      ),
      new WalletItem(
        'Total Spent',
        `${(w.total_spent_halala / 100).toFixed(2)} SAR`,
        'graph'
      ),
    ];
  }
}
