/**
 * TreeDataProvider for the "Available GPUs" sidebar panel.
 * Shows online GPU providers grouped by GPU model.
 */

import * as vscode from 'vscode';
import { Dc1ApiClient, Provider } from '../api';

class ProviderItem extends vscode.TreeItem {
  constructor(
    public readonly provider: Provider,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(provider.gpu_model, collapsibleState);
    this.id = provider.id;
    this.description = `${provider.vram_gb}GB VRAM`;
    this.tooltip = this.buildTooltip();
    this.iconPath = new vscode.ThemeIcon(
      provider.status === 'online' ? 'server' : 'server-process',
      new vscode.ThemeColor(
        provider.status === 'online' ? 'testing.iconPassed' : 'testing.iconFailed'
      )
    );
    this.contextValue = provider.status === 'online' ? 'onlineProvider' : 'offlineProvider';
  }

  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${this.provider.gpu_model}**\n\n`);
    md.appendMarkdown(`- Status: \`${this.provider.status}\`\n`);
    md.appendMarkdown(`- VRAM: ${this.provider.vram_gb} GB\n`);
    if (this.provider.cpu_cores) {
      md.appendMarkdown(`- CPU cores: ${this.provider.cpu_cores}\n`);
    }
    if (this.provider.ram_gb) {
      md.appendMarkdown(`- RAM: ${this.provider.ram_gb} GB\n`);
    }
    if (this.provider.price_per_hour_sar !== undefined) {
      md.appendMarkdown(`- Price: ${this.provider.price_per_hour_sar.toFixed(2)} SAR/hr\n`);
    }
    if (this.provider.location) {
      md.appendMarkdown(`- Location: ${this.provider.location}\n`);
    }
    return md;
  }
}

class DetailItem extends vscode.TreeItem {
  constructor(label: string, detail: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = detail;
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

class EmptyItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

export class ProvidersTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private providers: Provider[] = [];
  private loading = false;
  private errorMessage: string | undefined;

  constructor(private getClient: () => Dc1ApiClient | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async load(): Promise<void> {
    const client = this.getClient();
    if (!client) {
      this.errorMessage = 'No API key set. Run "DCP: Set Renter API Key".';
      this.providers = [];
      this.refresh();
      return;
    }

    this.loading = true;
    this.errorMessage = undefined;
    this.refresh();

    try {
      this.providers = await client.getAvailableProviders();
      this.errorMessage = undefined;
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
      this.providers = [];
    } finally {
      this.loading = false;
      this.refresh();
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (this.loading) {
      return [new EmptyItem('Loading GPU providers...')];
    }
    if (this.errorMessage) {
      return [new EmptyItem(`Error: ${this.errorMessage}`)];
    }

    // Top level: list providers
    if (!element) {
      if (this.providers.length === 0) {
        return [new EmptyItem('No online GPU providers found.')];
      }
      return this.providers.map(
        (p) =>
          new ProviderItem(
            p,
            vscode.TreeItemCollapsibleState.Collapsed
          )
      );
    }

    // Children: provider details
    if (element instanceof ProviderItem) {
      const p = element.provider;
      const details: DetailItem[] = [
        new DetailItem('Status', p.status),
        new DetailItem('VRAM', `${p.vram_gb} GB`),
      ];
      if (p.cpu_cores) {
        details.push(new DetailItem('CPU Cores', String(p.cpu_cores)));
      }
      if (p.ram_gb) {
        details.push(new DetailItem('RAM', `${p.ram_gb} GB`));
      }
      if (p.price_per_hour_sar !== undefined) {
        details.push(new DetailItem('Price/hr', `${p.price_per_hour_sar.toFixed(2)} SAR`));
      }
      if (p.location) {
        details.push(new DetailItem('Location', p.location));
      }
      details.push(new DetailItem('Provider ID', p.id));
      return details;
    }

    return [];
  }
}
