import * as vscode from 'vscode';
import { dc1, Job } from '../api/dc1Client';
import { AuthManager } from '../auth/AuthManager';

const STATUS_ICONS: Record<string, { icon: string; color?: string }> = {
  completed: { icon: 'check', color: 'testing.iconPassed' },
  running:   { icon: 'sync~spin', color: 'charts.blue' },
  pending:   { icon: 'clock', color: 'charts.yellow' },
  queued:    { icon: 'list-ordered', color: 'charts.yellow' },
  failed:    { icon: 'error', color: 'testing.iconFailed' },
  cancelled: { icon: 'circle-slash', color: 'disabledForeground' },
};

export class JobNode extends vscode.TreeItem {
  constructor(public readonly job: Job) {
    const label = `${job.job_type.replace(/_/g, ' ')} — ${job.job_id.slice(0, 8)}`;
    super(label, vscode.TreeItemCollapsibleState.None);

    const iconCfg = STATUS_ICONS[job.status] ?? { icon: 'question', color: undefined };
    this.iconPath = new vscode.ThemeIcon(
      iconCfg.icon,
      iconCfg.color ? new vscode.ThemeColor(iconCfg.color) : undefined
    );

    this.description = job.status;
    this.contextValue = job.status === 'running' || job.status === 'pending' ? 'job_running' : 'job';
    this.id = `job-${job.job_id}`;
    this.tooltip = this.buildTooltip();

    // Click to view logs
    this.command = {
      command: 'dc1.viewJobLogs',
      title: 'View Job Logs',
      arguments: [job],
    };
  }

  private buildTooltip(): vscode.MarkdownString {
    const j = this.job;
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Job ${j.job_id}**\n\n`);
    md.appendMarkdown(`- Type: \`${j.job_type}\`\n`);
    md.appendMarkdown(`- Status: **${j.status}**\n`);
    if (j.progress_phase) { md.appendMarkdown(`- Phase: ${j.progress_phase}\n`); }
    if (j.submitted_at) { md.appendMarkdown(`- Submitted: ${new Date(j.submitted_at).toLocaleString()}\n`); }
    if (j.started_at) { md.appendMarkdown(`- Started: ${new Date(j.started_at).toLocaleString()}\n`); }
    if (j.completed_at) { md.appendMarkdown(`- Completed: ${new Date(j.completed_at).toLocaleString()}\n`); }
    if (j.cost_halala || j.actual_cost_halala) {
      const halala = j.actual_cost_halala || j.cost_halala || 0;
      md.appendMarkdown(`- Cost: ${(halala / 100).toFixed(2)} SAR\n`);
    }
    return md;
  }
}

export class JobsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _jobs: Job[] = [];
  private _loading = false;
  private _error: string | undefined;
  private _pollTimer: NodeJS.Timer | undefined;

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly auth: AuthManager) {
    auth.onDidChangeKey(() => {
      this._jobs = [];
      this.refresh();
    });
    this.refresh();
    this.startPolling();
  }

  private startPolling(): void {
    const cfg = vscode.workspace.getConfiguration('dc1');
    const interval = cfg.get('pollIntervalSeconds', 10) * 1000;
    this._pollTimer = setInterval(() => {
      if (this.auth.isAuthenticated) {
        this.refresh();
      }
    }, interval);
  }

  refresh(): void {
    const key = this.auth.apiKey;
    if (!key) {
      this._jobs = [];
      this._onDidChangeTreeData.fire();
      return;
    }

    this._loading = true;
    this._error = undefined;
    this._onDidChangeTreeData.fire();

    dc1.getMyJobs(key)
      .then((jobs) => {
        this._jobs = jobs;
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

    if (!this.auth.isAuthenticated) {
      const node = new vscode.TreeItem('Set API key to see your jobs');
      node.iconPath = new vscode.ThemeIcon('key');
      node.command = { command: 'dc1.setup', title: 'Set API Key' };
      return [node];
    }

    if (this._loading) {
      const node = new vscode.TreeItem('Loading jobs…');
      node.iconPath = new vscode.ThemeIcon('loading~spin');
      return [node];
    }

    if (this._error) {
      const node = new vscode.TreeItem(`Error: ${this._error}`);
      node.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
      return [node];
    }

    if (this._jobs.length === 0) {
      const node = new vscode.TreeItem('No jobs yet — submit one!');
      node.iconPath = new vscode.ThemeIcon('info');
      return [node];
    }

    return this._jobs.map((j) => new JobNode(j));
  }

  getJobs(): Job[] {
    return this._jobs;
  }

  dispose(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer as NodeJS.Timeout);
    }
    this._onDidChangeTreeData.dispose();
  }
}
