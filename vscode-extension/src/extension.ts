import * as vscode from 'vscode';
import { AuthManager } from './auth/AuthManager';
import { dc1, isAuthError, isRetryableError } from './api/dc1Client';
import { GPUTreeProvider } from './providers/GPUTreeProvider';
import { JobsTreeProvider } from './providers/JobsTreeProvider';
import { ProviderStatusTreeProvider } from './providers/ProviderStatusTreeProvider';
import { TemplatesCatalogProvider, TemplateNode } from './providers/TemplatesCatalogProvider';
import { ModelsCatalogProvider, ModelNode } from './providers/ModelsCatalogProvider';
import { JobNode } from './providers/JobsTreeProvider';
import { GPUNode } from './providers/GPUTreeProvider';
import { JobSubmitPanel } from './panels/JobSubmitPanel';
import { VllmSubmitPanel } from './panels/VllmSubmitPanel';
import { WalletPanel } from './panels/WalletPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { ModelStatusPanel } from './panels/ModelStatusPanel';
import { ProviderEarningsPanel } from './panels/ProviderEarningsPanel';
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
  const templatesCatalogProvider = new TemplatesCatalogProvider();
  const modelsCatalogProvider = new ModelsCatalogProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('dc1.availableGPUs', gpuProvider),
    vscode.window.registerTreeDataProvider('dc1.myJobs', jobsProvider),
    vscode.window.registerTreeDataProvider('dc1.providerStatus', providerStatusProvider),
    vscode.window.registerTreeDataProvider('dc1.templatesCatalog', templatesCatalogProvider),
    vscode.window.registerTreeDataProvider('dc1.modelsCatalog', modelsCatalogProvider),
    gpuProvider,
    jobsProvider,
    providerStatusProvider,
    templatesCatalogProvider,
    modelsCatalogProvider
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
    updateProviderEarningsBar();
  });

  // ── Provider earnings status bar ────────────────────────────────────
  const providerEarningsBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  providerEarningsBar.command = 'dc1.providerEarnings';
  context.subscriptions.push(providerEarningsBar);

  function updateProviderEarningsBar(): void {
    if (auth.isProviderAuthenticated) {
      providerEarningsBar.text = '$(trending-up) DCP Earnings';
      providerEarningsBar.tooltip = 'View provider earnings & pricing comparison';
      providerEarningsBar.show();
    } else {
      providerEarningsBar.hide();
    }
  }

  updateProviderEarningsBar();

  // ── Renter budget status bar ──────────────────────────────────────
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'dc1.openBillingPage';
  statusBarItem.tooltip = 'DCP Wallet Balance — click to view billing';
  context.subscriptions.push(statusBarItem);

  async function updateStatusBar(): Promise<void> {
    const key = auth.apiKey;
    if (!key) {
      statusBarItem.text = '$(circuit-board) DCP: Ready';
      statusBarItem.tooltip = 'DCP Compute — click to view billing';
      statusBarItem.show();
      return;
    }
    try {
      const info = await dc1.getRenterInfo(key);
      const sar = (info.balance_halala / 100).toFixed(2);
      const jobs = await dc1.getMyJobs(key);
      const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending' || j.status === 'queued');
      if (activeJobs.length > 0) {
        statusBarItem.text = `$(loading~spin) DCP: ${activeJobs.length} job${activeJobs.length > 1 ? 's' : ''} running`;
      } else {
        statusBarItem.text = `$(circuit-board) DCP: Ready`;
      }
      statusBarItem.tooltip = `DCP Wallet: ${sar} SAR — ${info.total_jobs} total jobs — click to view billing`;
      statusBarItem.show();
    } catch {
      statusBarItem.text = '$(circuit-board) DCP: Ready';
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
      const ch = vscode.window.createOutputChannel(`DCP Job Logs - ${jobId}`);
      context.subscriptions.push(ch);
      jobChannels.set(jobId, ch);
    }
    return jobChannels.get(jobId)!;
  }

  // ── Log streaming state ───────────────────────────────────────────
  let activeStreamDispose: (() => void) | null = null;
  let activeStreamJobId: string | null = null;

  const logStreamStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  logStreamStatusBar.command = 'dc1.stopLogStream';
  logStreamStatusBar.tooltip = 'DCP: Log stream active — click to stop';
  context.subscriptions.push(logStreamStatusBar);

  function startLogStream(key: string, jobId: string): void {
    // Stop any existing stream first
    if (activeStreamDispose) {
      activeStreamDispose();
      activeStreamDispose = null;
      activeStreamJobId = null;
    }

    const ch = getOrCreateJobChannel(jobId);
    ch.show(true);
    ch.appendLine(`${'─'.repeat(60)}`);
    ch.appendLine(`DCP: Streaming logs for job #${jobId}`);
    ch.appendLine(`${'─'.repeat(60)}`);

    logStreamStatusBar.text = `$(loading~spin) DCP: Streaming #${jobId}`;
    logStreamStatusBar.show();

    activeStreamJobId = jobId;
    activeStreamDispose = dc1.streamJobLogs(
      key,
      jobId,
      (line) => ch.appendLine(line),
      () => {
        // Stream ended
        dc1.getJobOutput(key, jobId).then((output) => {
          const icon = output.status === 'completed' ? '✅' : '❌';
          ch.appendLine(`\n${icon} Job ${output.status}.`);
          if (output.result) { ch.appendLine(output.result); }
        }).catch(() => {
          ch.appendLine('Could not fetch final output.');
        });
        logStreamStatusBar.text = `$(check) DCP: Job #${jobId} complete`;
        setTimeout(() => logStreamStatusBar.hide(), 5000);
        activeStreamDispose = null;
        activeStreamJobId = null;
        jobsProvider.refresh();
        updateStatusBar();
      },
      (err) => {
        ch.appendLine(`Stream error: ${err.message}`);
        logStreamStatusBar.hide();
        activeStreamDispose = null;
        activeStreamJobId = null;
      }
    );
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

  // dc1.refreshTemplates
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.refreshTemplates', () => {
      templatesCatalogProvider.refresh();
    })
  );

  // dc1.refreshModels
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.refreshModels', () => {
      modelsCatalogProvider.refresh();
    })
  );

  // dc1.deployTemplate — one-click deploy a template
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.deployTemplate', async (node: TemplateNode) => {
      if (!node || !(node instanceof TemplateNode)) {
        vscode.window.showErrorMessage('Invalid template selected');
        return;
      }

      const key = await auth.ensureKey();
      if (!key) { return; }

      // Show quick pick for GPU tier or duration
      const durationResult = await vscode.window.showInputBox({
        prompt: 'Enter deployment duration in minutes',
        value: '60',
        validateInput: (val) => {
          const num = Number(val);
          return isNaN(num) || num <= 0 ? 'Please enter a positive number' : '';
        }
      });

      if (!durationResult) { return; }

      const durationMinutes = Number(durationResult);
      const providers = gpuProvider.getProviders();

      // Quick pick a provider or auto-select first available
      if (providers.length === 0) {
        vscode.window.showErrorMessage('No providers available for deployment');
        return;
      }

      const provider = providers[0];
      const containerSpec = {
        image_type: node.template.image,
        vram_required_mb: node.template.min_vram_gb * 1024,
        gpu_count: 1 as const,
      };

      try {
        const job = await dc1.submitJob(key, {
          provider_id: provider.id,
          job_type: node.template.job_type,
          duration_minutes: durationMinutes,
          container_spec: containerSpec,
          params: node.template.params,
        });

        vscode.window.showInformationMessage(`Template deployed! Job ID: ${job.job_id}`);
        jobsProvider.refresh();
        updateStatusBar();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to deploy template: ${message}`);
      }
    })
  );

  // dc1.startArabicRagSession — one-click deploy of Arabic RAG bundle
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.startArabicRagSession', async () => {
      const key = await auth.ensureKey();
      if (!key) { return; }

      // Find or create the Arabic RAG template reference
      const templates = templatesCatalogProvider.getTemplates();
      const arabicRagTemplate = templates.find(t => t.id === 'arabic-rag-complete');

      if (!arabicRagTemplate) {
        vscode.window.showErrorMessage('Arabic RAG template not available');
        return;
      }

      // Ask for duration
      const durationResult = await vscode.window.showInputBox({
        prompt: 'Enter deployment duration in minutes',
        value: '120',
        validateInput: (val) => {
          const num = Number(val);
          return isNaN(num) || num <= 0 ? 'Please enter a positive number' : '';
        }
      });

      if (!durationResult) { return; }

      const durationMinutes = Number(durationResult);
      const providers = gpuProvider.getProviders();

      if (providers.length === 0) {
        vscode.window.showErrorMessage('No providers available for deployment');
        return;
      }

      const provider = providers[0];
      const containerSpec = {
        image_type: arabicRagTemplate.image,
        vram_required_mb: arabicRagTemplate.min_vram_gb * 1024,
        gpu_count: 1 as const,
      };

      try {
        vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Deploying Arabic RAG…' },
          async () => {
            const job = await dc1.submitJob(key, {
              provider_id: provider.id,
              job_type: arabicRagTemplate.job_type,
              duration_minutes: durationMinutes,
              container_spec: containerSpec,
              params: arabicRagTemplate.params,
            });

            const outputChannel = vscode.window.createOutputChannel('DCP Arabic RAG');
            outputChannel.show();
            outputChannel.appendLine(`Arabic RAG deployment started!`);
            outputChannel.appendLine(`Job ID: ${job.job_id}`);
            outputChannel.appendLine(`Status: ${job.status}`);
            outputChannel.appendLine(`Cost: ${job.cost_halala / 100} SAR`);
            outputChannel.appendLine('');
            outputChannel.appendLine('The RAG endpoint will be available once the job completes.');
            outputChannel.appendLine('Check the "My Jobs" view to monitor deployment progress.');

            jobsProvider.refresh();
            updateStatusBar();
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to deploy Arabic RAG: ${message}`);
      }
    })
  );

  // dc1.submitJob — open vLLM inference panel (model selector → POST /api/vllm/complete)
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.submitJob', async () => {
      // Check for API key — show guidance if missing
      const storedKey = await auth.getStoredRenterKey();
      if (!storedKey && !auth.isAuthenticated) {
        const action = await vscode.window.showWarningMessage(
          'DCP: Set your renter API key to submit inference jobs.',
          'Set Key in Settings',
          'Set Key via Command'
        );
        if (action === 'Set Key in Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'dc1.renterApiKey');
          return;
        } else if (action === 'Set Key via Command') {
          await auth.promptAndSave();
        } else {
          return;
        }
      }
      VllmSubmitPanel.show(context.extensionUri, auth);
    })
  );

  // dc1.submitContainerJob — open container-based job submit panel (advanced)
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.submitContainerJob', async () => {
      const key = await auth.ensureKey();
      if (!key) { return; }
      const providers = gpuProvider.getProviders();
      let registryImages: string[] = [];
      try {
        const reg = await dc1.getContainerRegistry();
        registryImages = reg.images;
      } catch { /* use empty fallback */ }
      JobSubmitPanel.show(context.extensionUri, auth, providers, undefined, registryImages);
    })
  );

  // dc1.submitJobOnProvider — pre-select a GPU from tree context menu
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.submitJobOnProvider', async (providerOrNode: Provider | GPUNode) => {
      const key = await auth.ensureKey();
      if (!key) { return; }
      const provider = providerOrNode instanceof GPUNode ? providerOrNode.provider : providerOrNode;
      const providers = gpuProvider.getProviders();
      let registryImages: string[] = [];
      try {
        const reg = await dc1.getContainerRegistry();
        registryImages = reg.images;
      } catch { /* use empty fallback */ }
      JobSubmitPanel.show(context.extensionUri, auth, providers, provider, registryImages);
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
            if (isAuthError(err)) {
              auth.handleRenterAuthError(err, 'streaming logs').then((newKey) => {
                if (newKey) {
                  ch.appendLine('Authentication refreshed. Restart "View Job Logs" to reconnect stream.');
                }
              });
            }
            if (!sseConnected) {
              // SSE not available — fall back to polling
              const retryNote = isRetryableError(err) ? ' after automatic retries' : '';
              ch.appendLine(`Log stream unavailable${retryNote} (${err.message}). Falling back to polling…`);
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

  // dc1.streamLogs — start live log stream for a job id
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.streamLogs', async (jobIdArg?: string) => {
      const key = await auth.ensureKey();
      if (!key) { return; }

      let jobId = jobIdArg;
      if (!jobId) {
        jobId = await vscode.window.showInputBox({
          prompt: 'Enter Job ID to stream logs for',
          placeHolder: 'e.g. abc123',
        });
      }
      if (!jobId) { return; }

      startLogStream(key, jobId.trim());
    })
  );

  // dc1.watchJobLogs — stream logs for a job ID to a named output channel
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.watchJobLogs', async (jobIdArg?: string) => {
      let streamKey = auth.apiKey
        || await auth.getStoredRenterKey()
        || await auth.ensureKey();
      if (!streamKey) { return; }

      let jobId = jobIdArg;
      if (!jobId) {
        jobId = await vscode.window.showInputBox({
          title: 'DCP: Watch Job Logs',
          prompt: 'Enter the Job ID to stream logs for',
          placeHolder: 'e.g. job-1234567890-abc123',
          ignoreFocusOut: true,
        });
      }
      if (!jobId) { return; }

      const id = jobId.trim();
      const ch = vscode.window.createOutputChannel(`DCP Job ${id}`);
      context.subscriptions.push(ch);
      ch.show(true);
      ch.appendLine(`${'─'.repeat(60)}`);
      ch.appendLine(`DCP: Streaming logs for job ${id}`);
      ch.appendLine(`${'─'.repeat(60)}`);

      let receivedStreamData = false;
      let pollTimer: NodeJS.Timeout | undefined;
      const stopPolling = (): void => {
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = undefined;
        }
      };
      const startPollingFallback = (): void => {
        const intervalMs = vscode.workspace.getConfiguration('dc1').get('pollIntervalSeconds', 10) * 1000;
        ch.appendLine(`Falling back to status polling every ${intervalMs / 1000}s...`);
        pollTimer = setInterval(async () => {
          try {
            const output = await dc1.getJobOutput(streamKey!, id);
            if (output.progress_phase) {
              ch.appendLine(`Phase: ${output.progress_phase}`);
            }
            if (output.status === 'completed' || output.status === 'failed' || output.status === 'cancelled') {
              stopPolling();
              if (output.result) {
                ch.appendLine('\n--- RESULT ---');
                ch.appendLine(output.result);
              }
              const icon = output.status === 'completed' ? '✅' : '❌';
              ch.appendLine(`\n${icon} Job ${output.status}.`);
              jobsProvider.refresh();
              updateStatusBar();
            }
          } catch (pollErr) {
            stopPolling();
            const msg = pollErr instanceof Error ? pollErr.message : String(pollErr);
            ch.appendLine(`Polling stopped: ${msg}`);
          }
        }, intervalMs);
      };

      const dispose = dc1.streamJobLogs(
        streamKey,
        id,
        (line) => {
          receivedStreamData = true;
          ch.appendLine(line);
        },
        () => {
          stopPolling();
          ch.appendLine('\n--- Stream closed ---');
          dc1.getJobOutput(streamKey!, id).then((output) => {
            const icon = output.status === 'completed' ? '✅' : '❌';
            ch.appendLine(`${icon} Job ${output.status}.`);
            if (output.result) { ch.appendLine(output.result); }
          }).catch(() => {
            ch.appendLine('Could not fetch final output.');
          });
          jobsProvider.refresh();
          updateStatusBar();
        },
        (err) => {
          if (isAuthError(err)) {
            auth.handleRenterAuthError(err, 'watching job logs').then((newKey) => {
              if (newKey) {
                streamKey = newKey;
                ch.appendLine('Authentication refreshed. Streaming can continue with the updated key.');
              }
            });
          }
          if (!receivedStreamData) {
            if (isRetryableError(err)) {
              ch.appendLine(`Stream unavailable after automatic retries: ${err.message}`);
            } else {
              ch.appendLine(`Stream unavailable: ${err.message}`);
            }
            startPollingFallback();
            return;
          }
          ch.appendLine(`Stream error: ${err.message}`);
        }
      );

      context.subscriptions.push({
        dispose: () => {
          stopPolling();
          dispose();
        }
      });
    })
  );

  // dc1.stopLogStream — stop the active log stream
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.stopLogStream', () => {
      if (!activeStreamDispose) {
        vscode.window.showInformationMessage('DCP: No active log stream.');
        return;
      }
      activeStreamDispose();
      activeStreamDispose = null;
      const stoppedId = activeStreamJobId;
      activeStreamJobId = null;
      logStreamStatusBar.hide();
      if (stoppedId) {
        vscode.window.showInformationMessage(`DCP: Stopped log stream for job #${stoppedId}.`);
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

  // dc1.showSettings — settings webview (apiBase + renterApiKey)
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.showSettings', () => {
      SettingsPanel.show(context.extensionUri);
    })
  );

  // dc1.modelStatus — model cache status table
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.modelStatus', () => {
      ModelStatusPanel.show(context.extensionUri);
    })
  );

  // dc1.providerEarnings — provider earnings dashboard with pricing comparison
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.providerEarnings', async () => {
      const key = await auth.getStoredProviderKey();
      if (!key && !auth.isProviderAuthenticated) {
        const action = await vscode.window.showWarningMessage(
          'DCP: Set your provider API key to view earnings.',
          'Set Key in Settings',
          'Set Key via Command'
        );
        if (action === 'Set Key in Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'dc1.providerApiKey');
          return;
        } else if (action === 'Set Key via Command') {
          await auth.promptAndSaveProvider();
        } else {
          return;
        }
      }
      ProviderEarningsPanel.show(context.extensionUri, auth);
    })
  );

  context.subscriptions.push(auth);
  updateStatusBar();
}

export function deactivate(): void {
  // Nothing extra — subscriptions cleaned up by VS Code
}
