/**
 * Status bar item showing active job status + elapsed time.
 */

import * as vscode from 'vscode';
import { Dc1ApiClient, Job } from './api';

export class JobStatusBar {
  private readonly item: vscode.StatusBarItem;
  private pollingTimer: NodeJS.Timeout | undefined;
  private activeJobId: string | undefined;
  private startTime: number | undefined;

  constructor(private getClient: () => Dc1ApiClient | undefined) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.item.command = 'dc1.jobStatus';
  }

  trackJob(jobId: string): void {
    this.activeJobId = jobId;
    this.startTime = Date.now();
    this.startPolling();
    this.update('queued');
    this.item.show();
  }

  private startPolling(): void {
    this.stopPolling();
    const cfg = vscode.workspace.getConfiguration('dc1');
    const interval = cfg.get<number>('pollingIntervalMs', 5000);

    this.pollingTimer = setInterval(async () => {
      await this.poll();
    }, interval);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  private async poll(): Promise<void> {
    const client = this.getClient();
    if (!client || !this.activeJobId) {
      return;
    }
    try {
      const job = await client.getJobById(this.activeJobId);
      this.update(job.status);
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        this.stopPolling();
        // Keep visible for 30s then hide
        setTimeout(() => {
          if (job.status === 'completed') {
            this.item.hide();
          }
        }, 30_000);
      }
    } catch {
      // Ignore transient errors
    }
  }

  private update(status: Job['status']): void {
    const elapsed = this.startTime
      ? Math.floor((Date.now() - this.startTime) / 1000)
      : 0;
    const elapsedStr = elapsed > 0 ? ` ${this.formatElapsed(elapsed)}` : '';

    const icons: Record<Job['status'], string> = {
      queued: '$(clock)',
      running: '$(loading~spin)',
      completed: '$(check)',
      failed: '$(error)',
      cancelled: '$(circle-slash)',
    };

    this.item.text = `${icons[status] ?? '$(pulse)'} DC1: ${status}${elapsedStr}`;
    this.item.tooltip = `DC1 Job ${this.activeJobId} — ${status}`;

    if (status === 'completed') {
      this.item.color = new vscode.ThemeColor('testing.iconPassed');
    } else if (status === 'failed') {
      this.item.color = new vscode.ThemeColor('testing.iconFailed');
    } else {
      this.item.color = new vscode.ThemeColor('statusBar.foreground');
    }
  }

  private formatElapsed(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m${s}s`;
  }

  async showLatestJobStatus(outputChannel: vscode.OutputChannel): Promise<void> {
    const client = this.getClient();
    if (!client) {
      vscode.window.showWarningMessage('DC1: No API key set.');
      return;
    }
    if (!this.activeJobId) {
      vscode.window.showInformationMessage('DC1: No active job being tracked.');
      return;
    }
    try {
      const job = await client.getJobById(this.activeJobId);
      outputChannel.clear();
      outputChannel.appendLine(`=== DC1 Job Status ===`);
      outputChannel.appendLine(`Job ID:    ${job.id}`);
      outputChannel.appendLine(`Status:    ${job.status}`);
      outputChannel.appendLine(`Image:     ${job.container_image}`);
      outputChannel.appendLine(`Created:   ${job.created_at}`);
      if (job.started_at) {
        outputChannel.appendLine(`Started:   ${job.started_at}`);
      }
      if (job.completed_at) {
        outputChannel.appendLine(`Completed: ${job.completed_at}`);
      }
      if (job.duration_seconds !== undefined) {
        outputChannel.appendLine(`Duration:  ${job.duration_seconds}s`);
      }
      if (job.cost_halala !== undefined) {
        outputChannel.appendLine(`Cost:      ${(job.cost_halala / 100).toFixed(2)} SAR`);
      }

      if (job.status === 'completed' || job.status === 'running') {
        outputChannel.appendLine(`\n=== Job Output ===`);
        try {
          const out = await client.getJobOutput(job.id);
          outputChannel.appendLine(out || '(no output)');
        } catch {
          outputChannel.appendLine('(could not fetch output)');
        }
      }

      if (job.error) {
        outputChannel.appendLine(`\n=== Error ===`);
        outputChannel.appendLine(job.error);
      }

      outputChannel.show(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`DC1: Failed to fetch job status — ${msg}`);
    }
  }

  dispose(): void {
    this.stopPolling();
    this.item.dispose();
  }
}
