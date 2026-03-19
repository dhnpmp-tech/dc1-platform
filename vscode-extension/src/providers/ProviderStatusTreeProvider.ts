import * as vscode from 'vscode';
import { dc1, ProviderInfo } from '../api/dc1Client';
import { AuthManager } from '../auth/AuthManager';

/** A single status row in the DC1 Provider sidebar */
class StatusItem extends vscode.TreeItem {
  constructor(label: string, value: string, icon: string, color?: string) {
    super(`${label}: ${value}`, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(
      icon,
      color ? new vscode.ThemeColor(color) : undefined
    );
    this.contextValue = 'statusItem';
  }
}

/** Formats a heartbeat timestamp as a human-readable "X min ago" string */
function timeAgo(isoString: string | null): string {
  if (!isoString) { return 'never'; }
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) { return `${diffSec}s ago`; }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) { return `${diffMin}m ago`; }
  return `${Math.floor(diffMin / 60)}h ago`;
}

export class ProviderStatusTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _info: ProviderInfo | undefined;
  private _loading = false;
  private _error: string | undefined;
  private _refreshTimer: NodeJS.Timer | undefined;

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly auth: AuthManager) {
    // Refresh when provider key changes
    auth.onDidChangeProviderKey(() => {
      this._info = undefined;
      this._error = undefined;
      this.refresh();
    });

    this.refresh();
    this.startAutoRefresh();
  }

  private startAutoRefresh(): void {
    // Auto-refresh every 60s
    this._refreshTimer = setInterval(() => {
      if (this.auth.isProviderAuthenticated) {
        this.refresh();
      }
    }, 60_000);
  }

  refresh(): void {
    const key = this.auth.providerKey;
    if (!key) {
      this._info = undefined;
      this._error = undefined;
      this._onDidChangeTreeData.fire();
      return;
    }

    this._loading = true;
    this._error = undefined;
    this._onDidChangeTreeData.fire();

    dc1.getProviderInfo(key)
      .then((info) => {
        this._info = info;
        this._loading = false;
        this._onDidChangeTreeData.fire();
      })
      .catch((err) => {
        this._loading = false;
        this._error = err instanceof Error ? err.message : String(err);
        this._onDidChangeTreeData.fire();
      });
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
    if (element) { return []; }

    if (!this.auth.isProviderAuthenticated) {
      const node = new vscode.TreeItem('Set your DC1 Provider API key');
      node.iconPath = new vscode.ThemeIcon('key');
      node.command = { command: 'dc1.setProviderKey', title: 'Set Provider API Key' };
      return [node];
    }

    if (this._loading) {
      const node = new vscode.TreeItem('Loading provider status…');
      node.iconPath = new vscode.ThemeIcon('loading~spin');
      return [node];
    }

    if (this._error) {
      const items: vscode.TreeItem[] = [];
      const errNode = new vscode.TreeItem('VPS offline — last known data');
      errNode.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
      items.push(errNode);
      // If we have cached data, still show it
      if (this._info) {
        items.push(...this.buildStatusItems(this._info));
      }
      return items;
    }

    if (!this._info) {
      const node = new vscode.TreeItem('No provider data yet');
      node.iconPath = new vscode.ThemeIcon('info');
      return [node];
    }

    return this.buildStatusItems(this._info);
  }

  private buildStatusItems(info: ProviderInfo): vscode.TreeItem[] {
    const items: vscode.TreeItem[] = [];

    // Online status
    const onlineLabel = info.is_live ? '🟢 Online' : '🔴 Offline';
    const onlineIcon = info.is_live ? 'circle-filled' : 'circle-outline';
    const onlineColor = info.is_live ? 'testing.iconPassed' : 'testing.iconFailed';
    const onlineNode = new vscode.TreeItem(onlineLabel, vscode.TreeItemCollapsibleState.None);
    onlineNode.iconPath = new vscode.ThemeIcon(onlineIcon, new vscode.ThemeColor(onlineColor));
    onlineNode.contextValue = 'statusItem';
    items.push(onlineNode);

    // GPU Model
    items.push(new StatusItem('GPU', info.gpu_model || 'Unknown', 'chip'));

    // VRAM
    const vramLabel = info.vram_gb != null ? `${info.vram_gb} GB` : 'Unknown';
    items.push(new StatusItem('VRAM', vramLabel, 'database'));

    // Jobs Completed
    items.push(new StatusItem('Jobs Completed', String(info.total_jobs), 'check-all'));

    // Earnings
    const totalSar = (info.total_earnings_halala / 100).toFixed(2);
    const todaySar = (info.today_earnings_halala / 100).toFixed(2);
    items.push(new StatusItem('Earnings (total)', `${totalSar} SAR`, 'credit-card'));
    items.push(new StatusItem('Earnings (today)', `${todaySar} SAR`, 'trending-up'));

    // Last Heartbeat
    items.push(new StatusItem('Last Heartbeat', timeAgo(info.last_heartbeat), 'pulse'));

    return items;
  }

  /** Returns last known provider info (may be stale) */
  getProviderInfo(): ProviderInfo | undefined {
    return this._info;
  }

  dispose(): void {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer as NodeJS.Timeout);
    }
    this._onDidChangeTreeData.dispose();
  }
}
