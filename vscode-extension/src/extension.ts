import * as vscode from 'vscode';
import { AuthManager } from './auth/AuthManager';
import { dc1 } from './api/dc1Client';
import { GPUTreeProvider } from './providers/GPUTreeProvider';
import { JobsTreeProvider } from './providers/JobsTreeProvider';
import { JobNode } from './providers/JobsTreeProvider';
import { GPUNode } from './providers/GPUTreeProvider';
import { JobSubmitPanel } from './panels/JobSubmitPanel';
import { WalletPanel } from './panels/WalletPanel';
import { Provider, Job } from './api/dc1Client';

export function activate(context: vscode.ExtensionContext): void {
  // ── Auth ──────────────────────────────────────────────────────────
  const auth = new AuthManager(context.secrets);
  auth.load().then(() => {
    if (auth.isAuthenticated) {
      jobsProvider.refresh();
      updateStatusBar();
    }
  });

  // ── Tree providers ────────────────────────────────────────────────
  const gpuProvider = new GPUTreeProvider();
  const jobsProvider = new JobsTreeProvider(auth);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('dc1.availableGPUs', gpuProvider),
    vscode.window.registerTreeDataProvider('dc1.myJobs', jobsProvider),
    gpuProvider,
    jobsProvider
  );

  // ── Status bar ────────────────────────────────────────────────────
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'dc1.openWallet';
  statusBarItem.tooltip = 'DC1 Wallet Balance — click to open';
  context.subscriptions.push(statusBarItem);

  async function updateStatusBar(): Promise<void> {
    const key = auth.apiKey;
    if (!key) {
      statusBarItem.text = '$(credit-card) DC1 — Not connected';
      statusBarItem.show();
      return;
    }
    try {
      const info = await dc1.getRenterInfo(key);
      const sar = (info.balance_halala / 100).toFixed(2);
      statusBarItem.text = `$(credit-card) DC1 ${sar} SAR`;
      statusBarItem.show();
    } catch {
      statusBarItem.text = '$(credit-card) DC1';
      statusBarItem.show();
    }
  }

  // Refresh status bar every 60s
  const statusBarTimer = setInterval(() => {
    if (auth.isAuthenticated) { updateStatusBar(); }
  }, 60_000);
  context.subscriptions.push({ dispose: () => clearInterval(statusBarTimer) });

  // Update status bar when key changes
  auth.onDidChangeKey(() => updateStatusBar());
  statusBarItem.show();

  // Output channel for job logs
  const outputChannel = vscode.window.createOutputChannel('DC1 Job Logs', { log: true });
  context.subscriptions.push(outputChannel);

  // ── Commands ──────────────────────────────────────────────────────

  // dc1.setup — set/update API key
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.setup', async () => {
      await auth.promptAndSave();
      await updateStatusBar();
      jobsProvider.refresh();
    })
  );

  // dc1.refreshGPUs
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.refreshGPUs', () => {
      gpuProvider.refresh();
    })
  );

  // dc1.refreshJobs
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.refreshJobs', () => {
      jobsProvider.refresh();
      updateStatusBar();
    })
  );

  // dc1.submitJob — open job submit panel with all available GPUs
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.submitJob', async () => {
      const key = await auth.ensureKey();
      if (!key) { return; }
      const providers = gpuProvider.getProviders();
      JobSubmitPanel.show(context.extensionUri, auth, providers);
    })
  );

  // dc1.submitJobOnProvider — pre-select a GPU from tree context menu
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.submitJobOnProvider', async (providerOrNode: Provider | GPUNode) => {
      const key = await auth.ensureKey();
      if (!key) { return; }
      const provider = providerOrNode instanceof GPUNode ? providerOrNode.provider : providerOrNode;
      const providers = gpuProvider.getProviders();
      JobSubmitPanel.show(context.extensionUri, auth, providers, provider);
    })
  );

  // dc1.viewJobLogs — stream job logs to output channel
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.viewJobLogs', async (jobOrNode: Job | JobNode) => {
      const key = await auth.ensureKey();
      if (!key) { return; }

      const job = jobOrNode instanceof JobNode ? jobOrNode.job : jobOrNode;
      const jobId = job.job_id;

      outputChannel.show(true);
      outputChannel.appendLine(`\n${'─'.repeat(60)}`);
      outputChannel.appendLine(`DC1 Job: ${jobId}  |  Type: ${job.job_type}  |  Status: ${job.status}`);
      outputChannel.appendLine(`${'─'.repeat(60)}`);

      if (job.status === 'completed') {
        // Fetch output
        try {
          const output = await dc1.getJobOutput(key, jobId);
          if (output.result) {
            outputChannel.appendLine(output.result);
          } else {
            outputChannel.appendLine(`Status: ${output.status}`);
            if (output.message) { outputChannel.appendLine(output.message); }
          }
        } catch (err) {
          outputChannel.appendLine(`Error fetching output: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }

      // For running jobs, poll logs
      if (job.status === 'running' || job.status === 'pending' || job.status === 'queued') {
        outputChannel.appendLine(`Job is ${job.status}. Polling for output…`);

        const pollInterval = setInterval(async () => {
          try {
            const output = await dc1.getJobOutput(key, jobId);
            if (output.status === 'completed') {
              clearInterval(pollInterval);
              if (output.result) {
                outputChannel.appendLine('\n--- RESULT ---');
                outputChannel.appendLine(output.result);
              }
              outputChannel.appendLine('\n✅ Job completed.');
              jobsProvider.refresh();
              updateStatusBar();
            } else if (output.status === 'failed' || output.status === 'cancelled') {
              clearInterval(pollInterval);
              outputChannel.appendLine(`\n❌ Job ${output.status}: ${output.message ?? ''}`);
              jobsProvider.refresh();
            } else {
              if (output.progress_phase) {
                outputChannel.appendLine(`Phase: ${output.progress_phase}`);
              }
            }
          } catch {
            clearInterval(pollInterval);
            outputChannel.appendLine('Polling stopped due to error.');
          }
        }, vscode.workspace.getConfiguration('dc1').get('pollIntervalSeconds', 10) * 1000);

        context.subscriptions.push({ dispose: () => clearInterval(pollInterval) });
        return;
      }

      outputChannel.appendLine(`Job status: ${job.status}. No logs available.`);
    })
  );

  // dc1.cancelJob
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.cancelJob', async (jobOrNode: Job | JobNode) => {
      const key = await auth.ensureKey();
      if (!key) { return; }

      const job = jobOrNode instanceof JobNode ? jobOrNode.job : jobOrNode;
      const confirm = await vscode.window.showWarningMessage(
        `Cancel job ${job.job_id}? This may still incur partial charges.`,
        { modal: true },
        'Cancel Job'
      );
      if (confirm !== 'Cancel Job') { return; }

      try {
        await dc1.cancelJob(key, job.job_id);
        vscode.window.showInformationMessage(`DC1: Job ${job.job_id} cancelled.`);
        jobsProvider.refresh();
      } catch (err) {
        vscode.window.showErrorMessage(`DC1: Cancel failed — ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  // dc1.openWallet
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.openWallet', async () => {
      const key = await auth.ensureKey();
      if (!key) { return; }
      WalletPanel.show(context.extensionUri, auth);
    })
  );

  context.subscriptions.push(auth);
  updateStatusBar();
}

export function deactivate(): void {
  // Nothing extra — subscriptions cleaned up by VS Code
}
