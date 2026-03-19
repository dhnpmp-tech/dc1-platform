/**
 * DCP GPU Compute VS Code Extension
 * Entry point — registers all commands, views, and providers.
 */

import * as vscode from 'vscode';
import { AuthStore } from './authStore';
import { Dc1ApiClient } from './api';
import { ProvidersTreeProvider } from './providers/providersTreeProvider';
import { JobsTreeProvider, JobItem } from './providers/jobsTreeProvider';
import { WalletTreeProvider } from './providers/walletTreeProvider';
import { JobSubmitPanel } from './jobPanel';
import { ServePanel } from './servePanel';
import { JobStatusBar } from './statusBar';

let client: Dc1ApiClient | undefined;

function getClient(): Dc1ApiClient | undefined {
  return client;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const auth = new AuthStore(context.secrets);

  // Initialize client from stored key (if any)
  const storedKey = await auth.getApiKey();
  if (storedKey) {
    client = new Dc1ApiClient(storedKey);
  }

  // Output channel
  const outputChannel = vscode.window.createOutputChannel('DCP GPU Compute');
  context.subscriptions.push(outputChannel);

  // Tree providers
  const providersProvider = new ProvidersTreeProvider(getClient);
  const jobsProvider = new JobsTreeProvider(getClient);
  const walletProvider = new WalletTreeProvider(getClient);

  // Status bar
  const statusBar = new JobStatusBar(getClient);
  context.subscriptions.push({ dispose: () => statusBar.dispose() });
  context.subscriptions.push({ dispose: () => jobsProvider.dispose() });

  // Register tree views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('dc1.providersView', providersProvider),
    vscode.window.registerTreeDataProvider('dc1.jobsView', jobsProvider),
    vscode.window.registerTreeDataProvider('dc1.walletView', walletProvider)
  );

  // ── Commands ──────────────────────────────────────────────────────────────

  // dc1.setApiKey
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your DCP Renter API Key',
        placeHolder: 'renter_xxxxxxxxxxxx',
        password: true,
        ignoreFocusOut: true,
        validateInput: (v) => (v.trim().length > 0 ? undefined : 'API key cannot be empty'),
      });
      if (!key) {
        return;
      }
      const trimmed = key.trim();
      await auth.setApiKey(trimmed);
      client = new Dc1ApiClient(trimmed);
      vscode.window.showInformationMessage('DCP: API key saved securely.');
      // Refresh all views
      providersProvider.load();
      jobsProvider.load(); // load() auto-starts live polling if jobs are running
      walletProvider.load();
    })
  );

  // dc1.clearApiKey
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.clearApiKey', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear DCP API key?',
        { modal: true },
        'Clear'
      );
      if (confirm !== 'Clear') {
        return;
      }
      await auth.clearApiKey();
      client = undefined;
      vscode.window.showInformationMessage('DCP: API key cleared.');
      providersProvider.refresh();
      jobsProvider.refresh();
      walletProvider.refresh();
    })
  );

  // dc1.listGPUs
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.listGPUs', async () => {
      const key = await auth.requireApiKey();
      if (!key) {
        return;
      }
      if (!client) {
        client = new Dc1ApiClient(key);
      }
      await providersProvider.load();
      // Focus sidebar view
      await vscode.commands.executeCommand('dc1.providersView.focus');
    })
  );

  // dc1.refreshProviders
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.refreshProviders', async () => {
      await providersProvider.load();
      await jobsProvider.load();
      await walletProvider.load();
    })
  );

  // dc1.submitJob
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.submitJob', async () => {
      const key = await auth.requireApiKey();
      if (!key) {
        return;
      }
      if (!client) {
        client = new Dc1ApiClient(key);
      }

      // Grab selected text to pre-fill command field
      const editor = vscode.window.activeTextEditor;
      const selectedText = editor?.document.getText(editor.selection);

      await JobSubmitPanel.show(context, getClient, selectedText);
    })
  );

  // dc1.jobStatus
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.jobStatus', async () => {
      const key = await auth.requireApiKey();
      if (!key) {
        return;
      }
      if (!client) {
        client = new Dc1ApiClient(key);
      }
      await statusBar.showLatestJobStatus(outputChannel);
    })
  );

  // dc1.startServe
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.startServe', async () => {
      const key = await auth.requireApiKey();
      if (!key) {
        return;
      }
      if (!client) {
        client = new Dc1ApiClient(key);
      }
      await ServePanel.show(context, getClient, (modelId) => {
        statusBar.trackServe(modelId);
      });
    })
  );

  // dc1.queryServe — placeholder until inference panel is built
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.queryServe', async () => {
      vscode.window.showInformationMessage('DCP: Inference panel coming soon.');
    })
  );

  // dc1.refreshJobs
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.refreshJobs', async () => {
      await jobsProvider.load();
    })
  );

  // dc1.cancelJob — triggered from tree item context menu (job_running)
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.cancelJob', async (item: JobItem) => {
      if (!(item instanceof JobItem)) {
        return;
      }
      const confirm = await vscode.window.showWarningMessage(
        `Cancel job #${item.job.id.slice(0, 8)}?`,
        { modal: true },
        'Cancel Job'
      );
      if (confirm !== 'Cancel Job') {
        return;
      }
      const apiClient = getClient();
      if (!apiClient) {
        vscode.window.showWarningMessage('DCP: No API key set.');
        return;
      }
      try {
        await apiClient.cancelJob(item.job.id);
        vscode.window.showInformationMessage(`DCP: Job #${item.job.id.slice(0, 8)} cancelled.`);
        await jobsProvider.load();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`DCP: Failed to cancel job — ${msg}`);
      }
    })
  );

  // dc1.openWallet
  context.subscriptions.push(
    vscode.commands.registerCommand('dc1.openWallet', async () => {
      const key = await auth.requireApiKey();
      if (!key) {
        return;
      }
      if (!client) {
        client = new Dc1ApiClient(key);
      }
      await walletProvider.load();
      await vscode.commands.executeCommand('dc1.walletView.focus');
    })
  );

  // Auto-load data if key is already set
  if (client) {
    providersProvider.load();
    jobsProvider.load();
    walletProvider.load();
  }

  outputChannel.appendLine('DCP GPU Compute extension activated.');
  outputChannel.appendLine(`API URL: ${vscode.workspace.getConfiguration('dc1').get('apiBaseUrl')}`);
  outputChannel.appendLine(client ? 'API key: set' : 'API key: not set — run "DCP: Set Renter API Key"');
}

export function deactivate(): void {
  client = undefined;
}
