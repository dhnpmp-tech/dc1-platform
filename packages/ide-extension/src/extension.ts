import * as vscode from 'vscode';
import { NodeStatusBar } from './statusBar';
import { NodeStatusProvider } from './providers/nodeStatusProvider';
import { GPUAllocationProvider } from './providers/gpuAllocationProvider';
import { EarningsProvider } from './providers/earningsProvider';
import { ProviderAPI } from './api';
import { WorkspaceConfig } from './config';

let statusBar: NodeStatusBar | undefined;
let providerAPI: ProviderAPI;
let workspaceConfig: WorkspaceConfig;
let nodeStatusProvider: NodeStatusProvider;
let gpuAllocationProvider: GPUAllocationProvider;
let earningsProvider: EarningsProvider;

export async function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('DCP Provider');
  outputChannel.appendLine('DCP Provider extension activated');

  // Initialize configuration and API
  workspaceConfig = new WorkspaceConfig(context);
  providerAPI = new ProviderAPI(workspaceConfig);

  // Register tree view providers
  nodeStatusProvider = new NodeStatusProvider(providerAPI, workspaceConfig);
  gpuAllocationProvider = new GPUAllocationProvider(providerAPI);
  earningsProvider = new EarningsProvider(providerAPI);

  vscode.window.registerTreeDataProvider('dcp-provider.nodeView', nodeStatusProvider);
  vscode.window.registerTreeDataProvider('dcp-provider.gpuView', gpuAllocationProvider);
  vscode.window.registerTreeDataProvider('dcp-provider.earningsView', earningsProvider);

  // Initialize status bar
  statusBar = new NodeStatusBar(providerAPI, workspaceConfig);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('dcp-provider.startNode', () => handleStartNode(providerAPI, nodeStatusProvider, outputChannel)),
    vscode.commands.registerCommand('dcp-provider.stopNode', () => handleStopNode(providerAPI, nodeStatusProvider, outputChannel)),
    vscode.commands.registerCommand('dcp-provider.restartNode', () => handleRestartNode(providerAPI, nodeStatusProvider, outputChannel)),
    vscode.commands.registerCommand('dcp-provider.nodeStatus', () => handleNodeStatus(providerAPI, outputChannel)),
    vscode.commands.registerCommand('dcp-provider.configureWorkspace', () => handleConfigureWorkspace(workspaceConfig, context, outputChannel)),
    vscode.commands.registerCommand('dcp-provider.viewEarnings', () => handleViewEarnings(providerAPI, outputChannel)),
    vscode.commands.registerCommand('dcp-provider.allocateGPU', () => handleAllocateGPU(providerAPI, outputChannel)),
    vscode.commands.registerCommand('dcp-provider.viewLogs', () => handleViewLogs(providerAPI, outputChannel))
  );

  // Start health check polling
  const config = vscode.workspace.getConfiguration('dcp-provider');
  const healthCheckInterval = config.get<number>('healthCheckIntervalMs', 5000);

  const healthCheckTimer = setInterval(async () => {
    try {
      const status = await providerAPI.getNodeStatus();
      if (statusBar) {
        statusBar.updateStatus(status);
      }
      nodeStatusProvider.refresh();
      earningsProvider.refresh();
    } catch (error) {
      // Silently handle polling errors
    }
  }, healthCheckInterval);

  context.subscriptions.push(
    new vscode.Disposable(() => clearInterval(healthCheckTimer)),
    statusBar
  );
}

async function handleStartNode(
  providerAPI: ProviderAPI,
  nodeStatusProvider: NodeStatusProvider,
  outputChannel: vscode.OutputChannel
) {
  try {
    outputChannel.appendLine('Starting provider node...');
    await providerAPI.startNode();
    outputChannel.appendLine('✓ Provider node started successfully');
    nodeStatusProvider.refresh();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    outputChannel.appendLine(`✗ Failed to start node: ${message}`);
    vscode.window.showErrorMessage(`Failed to start provider node: ${message}`);
  }
}

async function handleStopNode(
  providerAPI: ProviderAPI,
  nodeStatusProvider: NodeStatusProvider,
  outputChannel: vscode.OutputChannel
) {
  const confirmed = await vscode.window.showWarningMessage(
    'Stop provider node? Active jobs will be cancelled.',
    'Yes', 'Cancel'
  );
  if (confirmed !== 'Yes') { return; }

  try {
    outputChannel.appendLine('Stopping provider node...');
    await providerAPI.stopNode();
    outputChannel.appendLine('✓ Provider node stopped');
    nodeStatusProvider.refresh();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    outputChannel.appendLine(`✗ Failed to stop node: ${message}`);
    vscode.window.showErrorMessage(`Failed to stop provider node: ${message}`);
  }
}

async function handleRestartNode(
  providerAPI: ProviderAPI,
  nodeStatusProvider: NodeStatusProvider,
  outputChannel: vscode.OutputChannel
) {
  try {
    outputChannel.appendLine('Restarting provider node...');
    await providerAPI.restartNode();
    outputChannel.appendLine('✓ Provider node restarted successfully');
    nodeStatusProvider.refresh();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    outputChannel.appendLine(`✗ Failed to restart node: ${message}`);
    vscode.window.showErrorMessage(`Failed to restart provider node: ${message}`);
  }
}

async function handleNodeStatus(
  providerAPI: ProviderAPI,
  outputChannel: vscode.OutputChannel
) {
  try {
    const status = await providerAPI.getNodeStatus();
    outputChannel.appendLine('\n=== Provider Node Status ===');
    outputChannel.appendLine(`Status: ${status.status}`);
    outputChannel.appendLine(`Uptime: ${status.uptime_seconds}s`);
    outputChannel.appendLine(`Total Jobs: ${status.total_jobs_completed}`);
    outputChannel.appendLine(`Active Jobs: ${status.active_jobs}`);
    outputChannel.appendLine(`CPU Usage: ${status.cpu_usage_percent}%`);
    outputChannel.appendLine(`Memory Usage: ${status.memory_usage_percent}%`);
    outputChannel.show();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to fetch node status: ${message}`);
  }
}

async function handleConfigureWorkspace(
  workspaceConfig: WorkspaceConfig,
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
) {
  const options = ['Basic Setup', 'Advanced Configuration', 'View Current Config'];
  const choice = await vscode.window.showQuickPick(options, {
    placeHolder: 'Select configuration option'
  });

  if (!choice) { return; }

  if (choice === 'Basic Setup') {
    try {
      await workspaceConfig.initializeWorkspace();
      outputChannel.appendLine('✓ Workspace configured successfully');
      vscode.window.showInformationMessage('Provider workspace configured');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Configuration failed: ${message}`);
    }
  } else if (choice === 'Advanced Configuration') {
    const configFile = await workspaceConfig.openConfigFile();
    if (configFile) {
      vscode.window.showInformationMessage('Edit the configuration file and save to apply changes');
    }
  } else if (choice === 'View Current Config') {
    const config = await workspaceConfig.getConfig();
    outputChannel.appendLine('\n=== DCP Provider Configuration ===');
    outputChannel.appendLine(JSON.stringify(config, null, 2));
    outputChannel.show();
  }
}

async function handleViewEarnings(
  providerAPI: ProviderAPI,
  outputChannel: vscode.OutputChannel
) {
  try {
    const earnings = await providerAPI.getEarnings();
    outputChannel.appendLine('\n=== Provider Earnings ===');
    outputChannel.appendLine(`Total Earned: SAR ${earnings.total_earned.toFixed(2)}`);
    outputChannel.appendLine(`This Month: SAR ${earnings.this_month.toFixed(2)}`);
    outputChannel.appendLine(`Pending: SAR ${earnings.pending.toFixed(2)}`);
    outputChannel.appendLine(`Last Payment: ${earnings.last_payment_date || 'N/A'}`);
    outputChannel.show();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to fetch earnings: ${message}`);
  }
}

async function handleAllocateGPU(
  providerAPI: ProviderAPI,
  outputChannel: vscode.OutputChannel
) {
  try {
    const gpus = await providerAPI.getAvailableGPUs();
    const gpuLabels = gpus.map(g => `${g.name} (${g.vram_gb}GB) - ${g.status}`);
    const selected = await vscode.window.showQuickPick(gpuLabels, {
      placeHolder: 'Select GPU to allocate'
    });

    if (!selected) { return; }

    const selectedGPU = gpus[gpuLabels.indexOf(selected)];
    const percentage = await vscode.window.showInputBox({
      prompt: 'Allocation percentage (0-100)',
      value: '100',
      validateInput: (v) => {
        const num = parseInt(v);
        return (num >= 0 && num <= 100) ? '' : 'Enter a value between 0 and 100';
      }
    });

    if (!percentage) { return; }

    await providerAPI.allocateGPU(selectedGPU.id, parseInt(percentage));
    outputChannel.appendLine(`✓ GPU allocation updated: ${selectedGPU.name} @ ${percentage}%`);
    vscode.window.showInformationMessage(`GPU allocation updated`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to allocate GPU: ${message}`);
  }
}

async function handleViewLogs(
  providerAPI: ProviderAPI,
  outputChannel: vscode.OutputChannel
) {
  try {
    const logs = await providerAPI.getNodeLogs(100);
    outputChannel.appendLine('\n=== Provider Node Logs ===');
    logs.forEach(log => {
      outputChannel.appendLine(`[${log.timestamp}] ${log.level}: ${log.message}`);
    });
    outputChannel.show();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`Failed to fetch logs: ${message}`);
  }
}

export function deactivate() {
  statusBar?.dispose();
}
