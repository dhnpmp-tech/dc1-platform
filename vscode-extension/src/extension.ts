import * as vscode from 'vscode';
import { AuthManager } from './auth/AuthManager';
import { dc1 } from './api/dc1Client';
import { GPUTreeProvider } from './providers/GPUTreeProvider';
import { JobsTreeProvider } from './providers/JobsTreeProvider';
import { ProviderStatusTreeProvider } from './providers/ProviderStatusTreeProvider';
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
    // Provider status bar is always shown (connected or not)
    updateProviderStatusBar();
    if (auth.isProviderAuthenticated) {
      providerStatusProvider.refresh();
    }
  });

  // ── Tree providers ────────────────────────────────────────────────
  const gpuProvider = new GPUTreeProvider();
  const jobsProvider = new JobsTreeProvider(auth);
  const providerStatusProvider = new ProviderStatusTreeProvider(auth);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('dc1.availableGPUs', gpuProvider),
    vscode.window.registerTreeDataProvider('dc1.myJobs', jobsProvider),
    vscode.window.registerTreeDataProvider('dc1.providerStatus', providerStatusProvider),
    gpuProvider,
    jobsProvider,
    providerStatusProvider
  );

  // ── Provider status bar ───────────────────────────────────────────
  const providerStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
  providerStatusBar.command = 'dc1.setProviderKey';
  providerStatusBar.tooltip = 'DCP Provider — click to configure API key';
  context.subscriptions.push(providerStatusBar);

  function updateProviderStatusBar(): void {
    if (auth.isProviderAuthenticated) {
      providerStatusBar.text = '$(server) DCP Provider ✅';
      providerStatusBar.tooltip = 'DCP Provider connected — click to change key';
    } else {
      providerStatusBar.text = '$(server) DCP Provider ❌';
      providerStatusBar.tooltip = 'DCP Provider — not configured. Click to set API key.';
    }
    providerStatusBar.show();
  }

  updateProviderStatusBar();
  auth.onDidChangeProviderKey(() => {
    updateProviderStatusBar();
    providerStatusProvider.refresh();
  });

  // ── Renter budget status bar ──────────────────────────────────────
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'dc1.openBillingPage';
  statusBarItem.tooltip = 'DCP Wallet Balance — click to view billing';
  context.subscriptions.push(statusBarItem);

  async function updateStatusBar(): Promise<void> {
    const key = auth.apiKey;
    if (!key) {
      statusBarItem.text = 'DCP: — SAR';
      statusBarItem.show();
      return;
    }
    try {
      const info = await dc1.getRenterInfo(key);
      const sar = (info.balance_halala / 100).toFixed(2);
      statusBarItem.text = `DCP: ${sar} SAR`;
      statusBarItem.tooltip = `DCP Wallet: ${sar} SAR — click to view billing`;
      statusBarItem.show();
    } catch {
      statusBarItem.text = 'DCP: — SAR';
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

  // Per-job output channels (keyed by job_id)
  const jobChannels = new Map<string, vscode.OutputChannel>();

  function getOrCreateJobChannel(jobId: string): vscode.OutputChannel {
    if (!jobChannels.has(jobId)) {
      const ch = vscode.window.createOutputChannel(`DCP Job #${jobId}`);
      context.subscriptions.push(ch);
      jobChannels.set(jobId, ch);
    }
    return jobChannels.get(jobId)!;
  }

  // ── Commands ──────────────────────────────────────────────────────

  // dc1.setProviderKey — set/update provider API key
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.setProviderKey', async () => {
      await auth.promptAndSaveProvider();
      updateProviderStatusBar();
      providerStatusProvider.refresh();
    })
  );

  // dc1.clearProviderKey
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.clearProviderKey', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear DCP Provider API key?',
        { modal: true },
        'Clear'
      );
      if (confirm !== 'Clear') { return; }
      await auth.clearProviderKey();
      updateProviderStatusBar();
      vscode.window.showInformationMessage('DCP: Provider API key cleared.');
    })
  );

  // dc1.refreshProviderStatus
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.refreshProviderStatus', () => {
      providerStatusProvider.refresh();
    })
  );

  // dc1.setup — set/update renter API key
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

  // dc1.openBillingPage — open DCP billing page in browser
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.openBillingPage', () => {
      vscode.env.openExternal(vscode.Uri.parse('https://dcp.sa/renter/billing'));
    })
  );

  // dc1.viewJobLogs — stream job logs to per-job output channel
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.viewJobLogs', async (jobOrNode: Job | JobNode) => {
      const key = await auth.ensureKey();
      if (!key) { return; }

      const job = jobOrNode instanceof JobNode ? jobOrNode.job : jobOrNode;
      const jobId = job.job_id;

      const ch = getOrCreateJobChannel(jobId);
      ch.show(true);
      ch.appendLine(`${'─'.repeat(60)}`);
      ch.appendLine(`DCP Job #${jobId}  |  Type: ${job.job_type}  |  Status: ${job.status}`);
      ch.appendLine(`${'─'.repeat(60)}`);

      if (job.status === 'completed') {
        try {
          const output = await dc1.getJobOutput(key, jobId);
          if (output.result) {
            ch.appendLine(output.result);
          } else {
            ch.appendLine(`Status: ${output.status}`);
            if (output.message) { ch.appendLine(output.message); }
          }
        } catch (err) {
          ch.appendLine(`Error fetching output: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }

      if (job.status === 'running' || job.status === 'pending' || job.status === 'queued') {
        ch.appendLine(`Job is ${job.status}. Attempting live log stream…`);

        // Capture narrowed key for use in closures
        const streamKey = key;

        // Try SSE streaming first; fall back to polling if stream errors immediately
        let sseConnected = false;
        let sseDispose: (() => void) | null = null;

        sseDispose = dc1.streamJobLogs(
          streamKey,
          jobId,
          (line) => {
            sseConnected = true;
            ch.appendLine(line);
          },
          () => {
            // Stream ended — fetch final output
            ch.appendLine('\n--- Stream closed. Fetching final output… ---');
            dc1.getJobOutput(streamKey, jobId).then((output) => {
              if (output.result) {
                ch.appendLine(output.result);
              }
              const icon = output.status === 'completed' ? '✅' : '❌';
              ch.appendLine(`\n${icon} Job ${output.status}.`);
              jobsProvider.refresh();
              updateStatusBar();
            }).catch(() => {
              ch.appendLine('Could not fetch final output.');
            });
          },
          (err) => {
            if (!sseConnected) {
              // SSE not available — fall back to polling
              ch.appendLine(`Log stream unavailable (${err.message}). Falling back to polling…`);
              startPolling();
            } else {
              ch.appendLine(`Stream error: ${err.message}`);
            }
          }
        );

        context.subscriptions.push({ dispose: () => sseDispose?.() });

        function startPolling(): void {
          const pollInterval = setInterval(async () => {
            try {
              const output = await dc1.getJobOutput(streamKey, jobId);
              if (output.status === 'completed') {
                clearInterval(pollInterval);
                if (output.result) {
                  ch.appendLine('\n--- RESULT ---');
                  ch.appendLine(output.result);
                }
                ch.appendLine('\n✅ Job completed.');
                jobsProvider.refresh();
                updateStatusBar();
              } else if (output.status === 'failed' || output.status === 'cancelled') {
                clearInterval(pollInterval);
                ch.appendLine(`\n❌ Job ${output.status}: ${output.message ?? ''}`);
                jobsProvider.refresh();
              } else {
                if (output.progress_phase) {
                  ch.appendLine(`Phase: ${output.progress_phase}`);
                }
              }
            } catch {
              clearInterval(pollInterval);
              ch.appendLine('Polling stopped due to error.');
            }
          }, vscode.workspace.getConfiguration('dc1').get('pollIntervalSeconds', 10) * 1000);
          context.subscriptions.push({ dispose: () => clearInterval(pollInterval) });
        }

        return;
      }

      ch.appendLine(`Job status: ${job.status}. No logs available.`);
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
        vscode.window.showInformationMessage(`DCP: Job ${job.job_id} cancelled.`);
        jobsProvider.refresh();
      } catch (err) {
        vscode.window.showErrorMessage(`DCP: Cancel failed — ${err instanceof Error ? err.message : String(err)}`);
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
