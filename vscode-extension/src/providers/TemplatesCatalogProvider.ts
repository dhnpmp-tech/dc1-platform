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
    md.appendMarkdown(`| Difficulty | ${this.template.difficulty || 'N/A'} |\n`);
    if (this.template.tier) {
      md.appendMarkdown(`| Tier | ${this.template.tier} |\n`);
    }
    md.appendMarkdown(`| Tags | ${(this.template.tags || []).join(', ') || 'None'} |\n`);

    // Add pricing information with estimated comparison
    md.appendMarkdown(`\n## 💰 Pricing\n\n`);
    const dcpPrice = this.template.estimated_price_sar_per_hour;
    md.appendMarkdown(`**DCP:** ${dcpPrice.toFixed(2)} SAR/hour\n\n`);

    // Estimate competitive pricing based on VRAM tier
    const estimatedCompetitorPrice = this.estimateCompetitorPrice(this.template.min_vram_gb);
    if (estimatedCompetitorPrice > dcpPrice) {
      const savingsPercent = ((estimatedCompetitorPrice - dcpPrice) / estimatedCompetitorPrice * 100).toFixed(0);
      md.appendMarkdown(`**Estimated vs Vast.ai:** ~${savingsPercent}% savings\n`);
      md.appendMarkdown(`*(Actual pricing depends on model and provider)*\n`);
    }

    md.isTrusted = true;
    return md;
  }

  private estimateCompetitorPrice(minVramGb: number): number {
    // Estimate based on VRAM tier from backend COMPETITOR_PRICING_BY_VRAM_TIER
    if (minVramGb >= 80) return 120.00;      // H100 class
    if (minVramGb >= 40) return 36.00;       // A100/A40 class
    if (minVramGb >= 24) return 10.00;       // RTX 4090 class
    if (minVramGb >= 16) return 10.00;       // RTX 4080 class
    return 6.00;                              // entry tier
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
  private _refreshTimer: NodeJS.Timeout | undefined;
  private _searchFilter = '';
  private _minVramFilter: number | null = null;

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    this.refresh();
    this.startAutoRefresh();
  }

  /** Set search filter text (fuzzy search on name/description) */
  setSearchFilter(text: string): void {
    this._searchFilter = text.toLowerCase();
    this._onDidChangeTreeData.fire();
  }

  /** Set minimum VRAM filter */
  setMinVramFilter(minVram: number | null): void {
    this._minVramFilter = minVram;
    this._onDidChangeTreeData.fire();
  }

  /** Clear all filters */
  clearFilters(): void {
    this._searchFilter = '';
    this._minVramFilter = null;
    this._onDidChangeTreeData.fire();
  }

  private getFilteredTemplates(): DockerTemplate[] {
    return this._templates.filter(t => {
      // Search filter (fuzzy match on name and description)
      if (this._searchFilter) {
        const searchText = `${t.name} ${t.description}`.toLowerCase();
        if (!this.fuzzyMatch(searchText, this._searchFilter)) {
          return false;
        }
      }

      // VRAM filter
      if (this._minVramFilter !== null && t.min_vram_gb < this._minVramFilter) {
        return false;
      }

      return true;
    });
  }

  private fuzzyMatch(text: string, pattern: string): boolean {
    let patternIdx = 0;
    for (let i = 0; i < text.length && patternIdx < pattern.length; i++) {
      if (text[i] === pattern[patternIdx]) {
        patternIdx++;
      }
    }
    return patternIdx === pattern.length;
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

      const filtered = this.getFilteredTemplates();
      if (filtered.length === 0) {
        if (this._templates.length === 0) {
          return [new ErrorNode('No templates available')];
        }
        return [new ErrorNode('No templates match your filters')];
      }

      // Group filtered templates by primary tag
      const categories = new Map<string, DockerTemplate[]>();
      for (const template of filtered) {
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
      return this.getFilteredTemplates()
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
