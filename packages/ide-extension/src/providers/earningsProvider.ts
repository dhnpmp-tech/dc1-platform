import * as vscode from 'vscode';
import { ProviderAPI, Earnings } from '../api';

class EarningItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon('credit-card');
  }
}

export class EarningsProvider implements vscode.TreeDataProvider<EarningItem> {
  private onDidChangeTreeData: vscode.EventEmitter<EarningItem | undefined | null | void> =
    new vscode.EventEmitter<EarningItem | undefined | null | void>();
  readonly onDidChangeTreeDataEvent: vscode.Event<EarningItem | undefined | null | void> =
    this.onDidChangeTreeData.event;

  private providerAPI: ProviderAPI;
  private earnings: Earnings | null = null;

  constructor(providerAPI: ProviderAPI) {
    this.providerAPI = providerAPI;
  }

  getTreeItem(element: EarningItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: EarningItem): Promise<EarningItem[]> {
    if (element) {
      return [];
    }

    try {
      this.earnings = await this.providerAPI.getEarnings();

      return [
        new EarningItem('Total Earned', `SAR ${this.earnings.total_earned.toFixed(2)}`),
        new EarningItem('This Month', `SAR ${this.earnings.this_month.toFixed(2)}`),
        new EarningItem('Pending Payout', `SAR ${this.earnings.pending.toFixed(2)}`),
        new EarningItem('Last Payment', this.earnings.last_payment_date || 'N/A'),
      ];
    } catch (error) {
      return [
        new EarningItem('Error', error instanceof Error ? error.message : 'Failed to load earnings'),
      ];
    }
  }

  refresh(): void {
    this.onDidChangeTreeData.fire();
  }
}
