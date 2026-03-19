/**
 * TreeDataProvider for the "My Jobs" sidebar panel.
 * Polls running jobs every 10 seconds and updates the tree live.
 */

import * as vscode from 'vscode';
import { Dc1ApiClient, Job } from '../api';

const LIVE_POLL_INTERVAL_MS = 10_000;

function formatElapsed(startedAt: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (elapsed < 60) {
    return `${elapsed}s`;
  }
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}m${s}s`;
}

function shortImage(containerImage: string): string {
  // "vllm/vllm-openai:latest" → "vllm-openai"
  const name = containerImage.split('/').pop() ?? containerImage;
  return name.split(':')[0];
}

function statusIcon(status: Job['status']): vscode.ThemeIcon {
  switch (status) {
    case 'running':
      return new vscode.ThemeIcon('loading~spin', new vscode.ThemeColor('charts.blue'));
    case 'completed':
      return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
    case 'failed':
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
    case 'cancelled':
      return new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground'));
    default:
      return new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.yellow'));
  }
}

export class JobItem extends vscode.TreeItem {
  constructor(public readonly job: Job) {
    const shortId = job.id.length > 8 ? job.id.slice(0, 8) : job.id;
    const model = shortImage(job.container_image);
    super(`#${shortId} · ${model}`, vscode.TreeItemCollapsibleState.Collapsed);
    this.id = job.id;
    this.iconPath = statusIcon(job.status);
    this.contextValue = `job_${job.status}`;

    if (job.status === 'running' && job.started_at) {
      const elapsed = formatElapsed(job.started_at);
      this.description = `running · ${elapsed}`;
      this.tooltip = `Job ${job.id}\nStatus: running\nElapsed: ${elapsed}\nImage: ${job.container_image}`;
    } else {
      this.description = job.status;
      this.tooltip = `Job ${job.id}\nStatus: ${job.status}\nImage: ${job.container_image}`;
    }
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

export class JobsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private jobs: Job[] = [];
  private loading = false;
  private errorMessage: string | undefined;
  private pollingTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private getClient: () => Dc1ApiClient | undefined) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async load(): Promise<void> {
    const client = this.getClient();
    if (!client) {
      this.errorMessage = 'No API key set.';
      this.jobs = [];
      this.refresh();
      return;
    }

    this.loading = true;
    this.errorMessage = undefined;
    this.refresh();

    try {
      this.jobs = await client.getMyJobs();
      this.errorMessage = undefined;
      // Auto-start live polling if any jobs are running
      if (this.jobs.some((j) => j.status === 'running' || j.status === 'queued')) {
        this.startLivePolling();
      }
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
      this.jobs = [];
    } finally {
      this.loading = false;
      this.refresh();
    }
  }

  /** Start 10s live polling for in-progress jobs. Safe to call multiple times. */
  startLivePolling(): void {
    if (this.pollingTimer !== undefined) {
      return;
    }
    this.pollingTimer = setInterval(() => {
      void this.pollRunningJobs();
    }, LIVE_POLL_INTERVAL_MS);
  }

  /** Stop live polling. */
  stopLivePolling(): void {
    if (this.pollingTimer !== undefined) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  private async pollRunningJobs(): Promise<void> {
    const client = this.getClient();
    if (!client) {
      this.stopLivePolling();
      return;
    }
    try {
      const inProgress = await client.getInProgressJobs();

      if (inProgress.length === 0) {
        // All jobs finished — stop polling and do a full reload to get final states
        this.stopLivePolling();
        await this.load();
        return;
      }

      // Merge updated in-progress states into the full jobs list
      const inProgressById = new Map(inProgress.map((j) => [j.id, j]));
      this.jobs = this.jobs.map((j) => inProgressById.get(j.id) ?? j);
      // Add any new in-progress jobs not yet in local list
      for (const j of inProgress) {
        if (!this.jobs.find((existing) => existing.id === j.id)) {
          this.jobs.unshift(j);
        }
      }

      this.refresh();
    } catch {
      // Ignore transient polling errors
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (this.loading) {
      return [new EmptyItem('Loading jobs...')];
    }
    if (this.errorMessage) {
      return [new EmptyItem(`Error: ${this.errorMessage}`)];
    }

    if (!element) {
      if (this.jobs.length === 0) {
        return [new EmptyItem('No jobs yet. Submit one with DCP: Submit GPU Job.')];
      }
      // Show newest first; running jobs always at top
      return [...this.jobs]
        .sort((a, b) => {
          const aRunning = a.status === 'running' || a.status === 'queued' ? 0 : 1;
          const bRunning = b.status === 'running' || b.status === 'queued' ? 0 : 1;
          if (aRunning !== bRunning) {
            return aRunning - bRunning;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        })
        .map((j) => new JobItem(j));
    }

    if (element instanceof JobItem) {
      const j = element.job;
      const details: DetailItem[] = [
        new DetailItem('Job ID', j.id),
        new DetailItem('Status', j.status),
        new DetailItem('Image', j.container_image),
        new DetailItem('Created', new Date(j.created_at).toLocaleString()),
      ];
      if (j.started_at) {
        details.push(new DetailItem('Started', new Date(j.started_at).toLocaleString()));
        if (j.status === 'running') {
          details.push(new DetailItem('Elapsed', formatElapsed(j.started_at)));
        }
      }
      if (j.completed_at) {
        details.push(new DetailItem('Completed', new Date(j.completed_at).toLocaleString()));
      }
      if (j.duration_seconds !== undefined) {
        details.push(new DetailItem('Duration', `${j.duration_seconds}s`));
      }
      if (j.cost_halala !== undefined) {
        details.push(new DetailItem('Cost', `${(j.cost_halala / 100).toFixed(2)} SAR`));
      } else if (j.status === 'running') {
        details.push(new DetailItem('Cost', 'Calculating…'));
      }
      if (j.provider_id) {
        details.push(new DetailItem('Provider', j.provider_id));
      }
      return details;
    }

    return [];
  }

  dispose(): void {
    this.stopLivePolling();
    this._onDidChangeTreeData.dispose();
  }
}
