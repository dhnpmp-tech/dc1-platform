import * as vscode from 'vscode';
import { ProviderAPI, NodeStatus } from '../api';
import { WorkspaceConfig } from '../config';

class StatusItem extends vscode.TreeItem {
  constructor(
    label: string,
    value: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
    this.description = value;
    this.iconPath = new vscode.ThemeIcon('circle-filled');
  }
}

export class NodeStatusProvider implements vscode.TreeDataProvider<StatusItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<StatusItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private providerAPI: ProviderAPI;
  private config: WorkspaceConfig;
  private lastStatus: NodeStatus | null = null;

  constructor(providerAPI: ProviderAPI, config: WorkspaceConfig) {
    this.providerAPI = providerAPI;
    this.config = config;
  }

  getTreeItem(element: StatusItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: StatusItem): Promise<StatusItem[]> {
    if (element) {
      return [];
    }

    try {
      const status = await this.providerAPI.getNodeStatus();
      this.lastStatus = status;

      return [
        new StatusItem('Status', status.status.toUpperCase()),
        new StatusItem('Active Jobs', status.active_jobs.toString()),
        new StatusItem('Total Completed', status.total_jobs_completed.toString()),
        new StatusItem('Uptime', this.formatUptime(status.uptime_seconds)),
        new StatusItem('CPU Usage', `${status.cpu_usage_percent}%`),
        new StatusItem('Memory Usage', `${status.memory_usage_percent}% (${status.memory_used_gb}/${status.memory_total_gb}GB)`),
        new StatusItem('Version', status.version),
      ];
    } catch (error) {
      return [
        new StatusItem('Status', 'OFFLINE'),
        new StatusItem('Error', error instanceof Error ? error.message : 'Unknown error'),
      ];
    }
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else {
      return `${mins}m`;
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
