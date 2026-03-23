import * as vscode from 'vscode';
import { dc1, DockerTemplate } from '../api/dc1Client';

/** Template category grouping */
class CategoryNode extends vscode.TreeItem {
  constructor(label: string, public readonly category: string) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'template-category';
    this.id = `category-${category}`;
    this.iconPath = this.getCategoryIcon();
  }

  private getCategoryIcon(): vscode.ThemeIcon {
    const iconMap: Record<string, string> = {
      'llm': 'symbol-method',
      'embedding': 'circle-filled',
      'image': 'device-camera',
      'notebook': 'notebook',
      'training': 'play',
      'inference': 'zap',
    };
    return new vscode.ThemeIcon(iconMap[this.category] || 'folder');
  }
}

/** Individual template node */
export class TemplateNode extends vscode.TreeItem {
  constructor(public readonly template: DockerTemplate) {
    const label = template.icon ? `${template.icon} ${template.name}` : template.name;
    super(label, vscode.TreeItemCollapsibleState.None);

    this.contextValue = 'template';
    this.id = `template-${template.id}`;
    this.tooltip = this.buildTooltip();

    // Show min VRAM and price
    const vramText = `${template.min_vram_gb}GB`;
    const priceText = `${template.estimated_price_sar_per_hour.toFixed(2)} SAR/hr`;
    this.description = `${vramText} VRAM • ${priceText}`;
  }

  private buildTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`# ${this.template.name}\n\n`);
    md.appendMarkdown(`${this.template.description}\n\n`);
    md.appendMarkdown(`**Specs:**\n\n`);
    md.appendMarkdown(`| Property | Value |\n|---|---|\n`);
    md.appendMarkdown(`| Min VRAM | ${this.template.min_vram_gb} GB |\n`);
    md.appendMarkdown(`| Estimated Price | ${this.template.estimated_price_sar_per_hour.toFixed(2)} SAR/hr |\n`);
    md.appendMarkdown(`| Difficulty | ${this.template.difficulty || 'N/A'} |\n`);
    if (this.template.tier) {
      md.appendMarkdown(`| Tier | ${this.template.tier} |\n`);
    }
    md.appendMarkdown(`| Tags | ${(this.template.tags || []).join(', ') || 'None'} |\n`);
    md.isTrusted = true;
    return md;
  }
}

/** Error node displayed when fetch fails */
class ErrorNode extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('error');
    this.contextValue = 'error';
  }
}

/** Loading node displayed while fetching */
class LoadingNode extends vscode.TreeItem {
  constructor() {
    super('Loading templates…', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('loading~spin');
  }
}

export class TemplatesCatalogProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _templates: DockerTemplate[] = [];
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
    if (cfg.get('autoRefreshTemplates', true)) {
      this._refreshTimer = setInterval(() => this.refresh(), 5 * 60_000); // 5 minutes
    }
  }

  refresh(): void {
    this._loading = true;
    this._error = undefined;
    this._onDidChangeTreeData.fire();

    dc1.getDockerTemplates()
      .then(({ templates }) => {
        this._templates = templates.sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));
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
      // Root — return categories or error/loading
      if (this._loading) {
        return [new LoadingNode()];
      }

      if (this._error) {
        return [new ErrorNode(`Failed to load templates: ${this._error}`)];
      }

      if (this._templates.length === 0) {
        return [new ErrorNode('No templates available')];
      }

      // Group templates by primary tag
      const categories = new Map<string, DockerTemplate[]>();
      for (const template of this._templates) {
        const category = template.tags?.[0] || 'other';
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        categories.get(category)!.push(template);
      }

      // Return category nodes in order
      return Array.from(categories.entries())
        .map(([cat, _]) => new CategoryNode(
          this.getCategoryLabel(cat),
          cat
        ))
        .sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));
    }

    // Category node — return templates in that category
    if (element instanceof CategoryNode) {
      return this._templates
        .filter(t => (t.tags?.[0] || 'other') === element.category)
        .map(t => new TemplateNode(t));
    }

    return [];
  }

  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      'llm': '🤖 Large Language Models',
      'embedding': '🌍 Embeddings',
      'image': '🖼️ Image Generation',
      'notebook': '📓 Notebooks',
      'training': '🎓 Training',
      'inference': '⚡ Inference',
      'other': '📦 Other',
    };
    return labels[category] || `📦 ${category}`;
  }

  dispose(): void {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
    }
  }

  getTemplates(): DockerTemplate[] {
    return this._templates;
  }
}
