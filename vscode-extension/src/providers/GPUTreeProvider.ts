import * as vscode from 'vscode';
import { dc1, Provider } from '../api/dc1Client';

/** A single GPU provider node in the sidebar tree */
export class GPUNode extends vscode.TreeItem {
  constructor(public readonly provider: Provider) {
    const label = provider.gpu_model || 'Unknown GPU';
    super(label, vscode.TreeItemCollapsibleState.Collapsed);

    this.contextValue = 'gpu';
    this.id = `gpu-${provider.id}`;
    this.tooltip = this.buildTooltip();

    const vramText = provider.vram_gb ? `${provider.vram_gb}GB` : '?GB';
    this.description = `${vramText} VRAM`;

    this.iconPath = provider.is_live
      ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'))
      : new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('testing.iconSkipped'));
  }

  private buildTooltip(): vscode.MarkdownString {
    const p = this.provider;
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`## ${p.gpu_model || 'GPU'}\n\n`);
    md.appendMarkdown(`| Field | Value |\n|---|---|\n`);
    md.appendMarkdown(`| Provider | ${p.name} |\n`);
    md.appendMarkdown(`| VRAM | ${p.vram_gb ?? '?'} GB |\n`);
    md.appendMarkdown(`| GPU Count | ${p.gpu_count} |\n`);
    if (p.cuda_version) { md.appendMarkdown(`| CUDA | ${p.cuda_version} |\n`); }
    if (p.compute_capability) { md.appendMarkdown(`| Compute CC | ${p.compute_capability} |\n`); }
    if (p.driver_version) { md.appendMarkdown(`| Driver | ${p.driver_version} |\n`); }
    if (p.location) { md.appendMarkdown(`| Location | ${p.location} |\n`); }
    if (p.reliability_score !== null) { md.appendMarkdown(`| Reliability | ${p.reliability_score}% |\n`); }
    md.appendMarkdown(`| Live | ${p.is_live ? '✅ Yes' : '⚠️ No'} |\n`);
    if (p.cached_models.length > 0) {
      md.appendMarkdown(`\n**Cached models:** ${p.cached_models.join(', ')}`);
    }
    return md;
  }
}

/** Child node showing a spec detail under a GPU node */
class SpecNode extends vscode.TreeItem {
  constructor(label: string, detail: string, icon = 'info') {
    super(`${label}: ${detail}`, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(icon);
    this.contextValue = 'spec';
  }
}

export class GPUTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _providers: Provider[] = [];
  private _loading = false;
  private _error: string | undefined;
  private _refreshTimer: NodeJS.Timer | undefined;

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    this.refresh();
    this.startAutoRefresh();
  }

  private startAutoRefresh(): void {
    const cfg = vscode.workspace.getConfiguration('dc1');
    if (cfg.get('autoRefreshGPUs', true)) {
      this._refreshTimer = setInterval(() => this.refresh(), 30_000);
    }
  }

  refresh(): void {
    this._loading = true;
    this._error = undefined;
    this._onDidChangeTreeData.fire();

    dc1.getAvailableProviders()
      .then(({ providers }) => {
        this._providers = providers;
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
    if (!element) {
      // Root — return provider nodes
      if (this._loading) {
        const loading = new vscode.TreeItem('Loading GPUs…');
        loading.iconPath = new vscode.ThemeIcon('loading~spin');
        return [loading];
      }
      if (this._error) {
        const err = new vscode.TreeItem(`Error: ${this._error}`);
        err.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
        return [err];
      }
      if (this._providers.length === 0) {
        const empty = new vscode.TreeItem('No GPUs online right now');
        empty.iconPath = new vscode.ThemeIcon('info');
        return [empty];
      }
      return this._providers.map((p) => new GPUNode(p));
    }

    // Children of a GPU node — spec details
    if (element instanceof GPUNode) {
      const p = element.provider;
      const items: vscode.TreeItem[] = [];
      if (p.vram_gb) { items.push(new SpecNode('VRAM', `${p.vram_gb} GB`, 'chip')); }
      if (p.gpu_count > 1) { items.push(new SpecNode('GPU Count', `${p.gpu_count}`, 'server')); }
      if (p.cuda_version) { items.push(new SpecNode('CUDA', p.cuda_version, 'versions')); }
      if (p.compute_capability) { items.push(new SpecNode('Compute CC', p.compute_capability, 'settings-gear')); }
      if (p.driver_version) { items.push(new SpecNode('Driver', p.driver_version, 'package')); }
      if (p.location) { items.push(new SpecNode('Location', p.location, 'globe')); }
      if (p.reliability_score !== null) {
        items.push(new SpecNode('Reliability', `${p.reliability_score}%`, 'pulse'));
      }
      if (p.cached_models.length > 0) {
        const modelsNode = new vscode.TreeItem('Cached Models', vscode.TreeItemCollapsibleState.None);
        modelsNode.description = p.cached_models.slice(0, 3).join(', ') + (p.cached_models.length > 3 ? '…' : '');
        modelsNode.iconPath = new vscode.ThemeIcon('database');
        items.push(modelsNode);
      }
      const submitBtn = new vscode.TreeItem('Submit Job on This GPU');
      submitBtn.iconPath = new vscode.ThemeIcon('play');
      submitBtn.command = {
        command: 'dc1.submitJobOnProvider',
        title: 'Submit Job',
        arguments: [element.provider],
      };
      items.push(submitBtn);
      return items;
    }

    return [];
  }

  /** Get the list of providers (for use in job submit panel) */
  getProviders(): Provider[] {
    return this._providers;
  }

  dispose(): void {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer as NodeJS.Timeout);
    }
    this._onDidChangeTreeData.dispose();
  }
}
