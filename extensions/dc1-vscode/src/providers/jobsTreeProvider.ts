/**
 * TreeDataProvider for the "My Jobs" sidebar panel.
 */

import * as vscode from 'vscode';
import { Dc1ApiClient, Job } from '../api';

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

class JobItem extends vscode.TreeItem {
  constructor(public readonly job: Job) {
    super(job.container_image, vscode.TreeItemCollapsibleState.Collapsed);
    this.id = job.id;
    this.description = job.status;
    this.iconPath = statusIcon(job.status);
    this.tooltip = `Job ${job.id}\nStatus: ${job.status}\nImage: ${job.container_image}`;
    this.contextValue = `job_${job.status}`;
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

export class JobsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private jobs: Job[] = [];
  private loading = false;
  private errorMessage: string | undefined;

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
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : String(err);
      this.jobs = [];
    } finally {
      this.loading = false;
      this.refresh();
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
        return [new EmptyItem('No jobs yet. Submit one with DC1: Submit GPU Job.')];
      }
      // Show newest first
      return [...this.jobs]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
      }
      if (j.completed_at) {
        details.push(new DetailItem('Completed', new Date(j.completed_at).toLocaleString()));
      }
      if (j.duration_seconds !== undefined) {
        details.push(new DetailItem('Duration', `${j.duration_seconds}s`));
      }
      if (j.cost_halala !== undefined) {
        details.push(new DetailItem('Cost', `${(j.cost_halala / 100).toFixed(2)} SAR`));
      }
      if (j.provider_id) {
        details.push(new DetailItem('Provider', j.provider_id));
      }
      return details;
    }

    return [];
  }
}
