import * as vscode from 'vscode';
import { dc1, Model } from '../api/dc1Client';

/** Arabic models category */
class ArabicModelsNode extends vscode.TreeItem {
  constructor(count: number) {
    super(`🌍 Arabic Models (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'model-category';
    this.id = 'models-arabic';
    this.iconPath = new vscode.ThemeIcon('globe');
  }
}

/** Non-Arabic models category */
class OtherModelsNode extends vscode.TreeItem {
  constructor(count: number) {
    super(`🤖 Other Models (${count})`, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'model-category';
    this.id = 'models-other';
    this.iconPath = new vscode.ThemeIcon('symbol-method');
  }
}

/** Individual model node */
export class ModelNode extends vscode.TreeItem {
  constructor(public readonly model: Model) {
    const prefix = model.is_arabic ? '🌍' : '🤖';
    const label = `${prefix} ${model.display_name}`;
    super(label, vscode.TreeItemCollapsibleState.None);

    this.contextValue = 'model';
    this.id = `model-${model.model_id}`;
    this.tooltip = this.buildTooltip();

    // Show availability and price
    const availability = model.status === 'available' ? `✅ ${model.providers_online} providers` : '❌ No providers';
    const priceText = `${(model.avg_price_sar_per_min * 60).toFixed(2)} SAR/hr`;
    this.description = `${model.vram_gb}GB • ${priceText} • ${availability}`;
  }

  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`# ${this.model.display_name}\n\n`);
    md.appendMarkdown(`**Model ID:** \`${this.model.model_id}\`\n\n`);
    md.appendMarkdown(`| Property | Value |\n|---|---|\n`);
    if (this.model.family) {
      md.appendMarkdown(`| Family | ${this.model.family} |\n`);
    }
    md.appendMarkdown(`| VRAM | ${this.model.vram_gb} GB |\n`);
    md.appendMarkdown(`| Status | ${this.model.status === 'available' ? '✅ Available' : '❌ No Providers'} |\n`);
    md.appendMarkdown(`| Providers Online | ${this.model.providers_online} |\n`);
    md.appendMarkdown(`| Price | ${(this.model.avg_price_sar_per_min * 60).toFixed(2)} SAR/hour |\n`);
    md.appendMarkdown(`| Arabic | ${this.model.is_arabic ? '✅ Yes' : '❌ No'} |\n`);
    md.isTrusted = true;
    return md;
  }
}

/** Error node */
class ErrorNode extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('error');
    this.contextValue = 'error';
  }
}

/** Loading node */
class LoadingNode extends vscode.TreeItem {
  constructor() {
    super('Loading models…', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('loading~spin');
  }
}

export class ModelsCatalogProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _models: Model[] = [];
  private _loading = false;
  private _error: string | undefined;
  private _refreshTimer: NodeJS.Timeout | undefined;

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    this.refresh();
    this.startAutoRefresh();
  }

  private startAutoRefresh(): void {
    const cfg = vscode.workspace.getConfiguration('dc1');
    if (cfg.get('autoRefreshModels', true)) {
      this._refreshTimer = setInterval(() => this.refresh(), 5 * 60_000); // 5 minutes
    }
  }

  refresh(): void {
    this._loading = true;
    this._error = undefined;
    this._onDidChangeTreeData.fire();

    dc1.getModels()
      .then(({ models }) => {
        this._models = models;
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
      // Root — return Arabic and Other categories
      if (this._loading) {
        return [new LoadingNode()];
      }

      if (this._error) {
        return [new ErrorNode(`Failed to load models: ${this._error}`)];
      }

      if (this._models.length === 0) {
        return [new ErrorNode('No models available')];
      }

      const arabicModels = this._models.filter(m => m.is_arabic);
      const otherModels = this._models.filter(m => !m.is_arabic);

      const result: vscode.TreeItem[] = [];
      if (arabicModels.length > 0) {
        result.push(new ArabicModelsNode(arabicModels.length));
      }
      if (otherModels.length > 0) {
        result.push(new OtherModelsNode(otherModels.length));
      }

      return result;
    }

    // Category node — return models in that category
    if (element instanceof ArabicModelsNode) {
      return this._models
        .filter(m => m.is_arabic)
        .map(m => new ModelNode(m));
    }

    if (element instanceof OtherModelsNode) {
      return this._models
        .filter(m => !m.is_arabic)
        .map(m => new ModelNode(m));
    }

    return [];
  }

  dispose(): void {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
    }
  }

  getModels(): Model[] {
    return this._models;
  }
}
