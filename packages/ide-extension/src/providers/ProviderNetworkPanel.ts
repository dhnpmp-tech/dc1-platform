import * as vscode from 'vscode';
import { ProviderAPI, ProviderStatus } from '../api';

/**
 * Provider Network Status tree view panel
 * Displays real-time provider status, GPU availability, and metrics
 */
export class ProviderNetworkPanel implements vscode.TreeDataProvider<ProviderNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ProviderNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private providerAPI: ProviderAPI;
  private providers: ProviderStatus[] = [];
  private pollingInterval: NodeJS.Timer | null = null;
  private lastUpdate: number = 0;
  private cacheInterval: number = 3000; // ms

  constructor(providerAPI: ProviderAPI) {
    this.providerAPI = providerAPI;
  }

  /**
   * Start polling for provider updates
   */
  startPolling(): void {
    if (this.pollingInterval) {
      return; // Already polling
    }
    this.pollingInterval = setInterval(() => this.refresh(), this.cacheInterval);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Refresh provider list
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ProviderNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ProviderNode): Promise<ProviderNode[]> {
    if (!element) {
      // Root level: show overview + provider list
      try {
        const now = Date.now();
        if (now - this.lastUpdate > this.cacheInterval) {
          this.providers = await this.providerAPI.getActiveProviders?.() || [];
          this.lastUpdate = now;
        }

        return this.buildProviderList();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return [
          new ProviderNode(
            'Error loading providers',
            message,
            vscode.TreeItemCollapsibleState.None
          )
        ];
      }
    }

    return [];
  }

  /**
   * Build tree view items from provider list
   */
  private buildProviderList(): ProviderNode[] {
    if (this.providers.length === 0) {
      return [
        new ProviderNode(
          'No providers available',
          'Waiting for providers to come online',
          vscode.TreeItemCollapsibleState.None
        )
      ];
    }

    // Group providers by status
    const items: ProviderNode[] = [];

    // Add network overview
    items.push(
      new ProviderNode(
        `Network Overview — ${this.providers.length} Online`,
        '',
        vscode.TreeItemCollapsibleState.Expanded
      )
    );

    // Add individual providers
    this.providers.forEach(provider => {
      const label = `${provider.name || `Provider ${provider.id.slice(0, 8)}`}`;
      const description = `${provider.gpu_count}x ${provider.gpu_model} — $${provider.cost_per_hour_sar}/hr`;
      items.push(
        new ProviderNode(
          label,
          description,
          vscode.TreeItemCollapsibleState.Collapsed,
          provider.id
        )
      );
    });

    return items;
  }

  /**
   * Get provider details for expanded tree node
   */
  async getProviderDetails(providerId: string): Promise<ProviderNode[]> {
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider) {
      return [];
    }

    return [
      new ProviderNode('GPU Model', provider.gpu_model, vscode.TreeItemCollapsibleState.None),
      new ProviderNode('GPU Count', provider.gpu_count.toString(), vscode.TreeItemCollapsibleState.None),
      new ProviderNode('VRAM per GPU', `${provider.vram_mb}MB`, vscode.TreeItemCollapsibleState.None),
      new ProviderNode('Cost', `$${provider.cost_per_hour_sar}/hr`, vscode.TreeItemCollapsibleState.None),
      new ProviderNode('Jobs Completed', provider.jobs_completed.toString(), vscode.TreeItemCollapsibleState.None),
      new ProviderNode('Status', provider.online ? 'Online' : 'Offline', vscode.TreeItemCollapsibleState.None),
    ];
  }

  dispose(): void {
    this.stopPolling();
    this._onDidChangeTreeData.dispose();
  }
}

/**
 * Tree node for provider network status display
 */
export class ProviderNode extends vscode.TreeItem {
  providerId?: string;

  constructor(
    label: string,
    description: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    providerId?: string
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.providerId = providerId;
    this.iconPath = this.getIconForStatus(label);
  }

  private getIconForStatus(label: string): vscode.ThemeIcon | undefined {
    if (label.includes('Online')) {
      return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
    } else if (label.includes('Offline')) {
      return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.red'));
    }
    return new vscode.ThemeIcon('server');
  }
}
