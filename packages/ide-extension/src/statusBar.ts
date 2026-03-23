import * as vscode from 'vscode';
import { ProviderAPI, NodeStatus } from './api';
import { WorkspaceConfig } from './config';

export class NodeStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private providerAPI: ProviderAPI;
  private config: WorkspaceConfig;
  private lastStatus: NodeStatus | null = null;

  constructor(providerAPI: ProviderAPI, config: WorkspaceConfig) {
    this.providerAPI = providerAPI;
    this.config = config;

    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );

    this.statusBarItem.command = 'dcp-provider.nodeStatus';
    this.statusBarItem.tooltip = 'Click to show node status';

    this.updateInitial();
    this.statusBarItem.show();
  }

  private async updateInitial() {
    try {
      const status = await this.providerAPI.getNodeStatus();
      this.updateStatus(status);
    } catch {
      this.statusBarItem.text = '$(server-process) DCP: Offline';
      this.statusBarItem.color = 'rgba(255, 100, 100, 1)';
    }
  }

  updateStatus(status: NodeStatus): void {
    this.lastStatus = status;

    const statusIcon = this.getStatusIcon(status.status);
    const statusText = this.getStatusText(status);

    this.statusBarItem.text = `${statusIcon} DCP: ${statusText}`;
    this.statusBarItem.color = this.getStatusColor(status.status);
    this.statusBarItem.tooltip = this.getTooltip(status);
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'online':
        return '$(server)';
      case 'offline':
        return '$(server-process)';
      case 'starting':
        return '$(loading)';
      case 'stopping':
        return '$(loading)';
      case 'error':
        return '$(error)';
      default:
        return '$(question)';
    }
  }

  private getStatusText(status: NodeStatus): string {
    const activeJobs = status.active_jobs > 0 ? ` [${status.active_jobs} jobs]` : '';
    return `${status.status.toUpperCase()}${activeJobs}`;
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'online':
        return '#4ec9b0';
      case 'offline':
        return '#d4d4d4';
      case 'starting':
      case 'stopping':
        return '#dcdcaa';
      case 'error':
        return '#f48771';
      default:
        return '#ffffff';
    }
  }

  private getTooltip(status: NodeStatus): vscode.MarkdownString {
    const md = new vscode.MarkdownString('', true);
    md.appendMarkdown(`**Node Status**\n\n`);
    md.appendMarkdown(`- Status: ${status.status.toUpperCase()}\n`);
    md.appendMarkdown(`- Active Jobs: ${status.active_jobs}\n`);
    md.appendMarkdown(`- Total Completed: ${status.total_jobs_completed}\n`);
    md.appendMarkdown(`- Uptime: ${this.formatUptime(status.uptime_seconds)}\n`);
    md.appendMarkdown(`- CPU: ${status.cpu_usage_percent}%\n`);
    md.appendMarkdown(`- Memory: ${status.memory_usage_percent}% (${status.memory_used_gb}/${status.memory_total_gb}GB)\n`);
    md.appendMarkdown(`\n_Click to view full status_`);
    return md;
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else {
      return `${mins}m`;
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
