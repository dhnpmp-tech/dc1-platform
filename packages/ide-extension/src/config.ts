import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ProviderConfig {
  provider_id: string;
  api_key: string;
  node_api_url: string;
  gpu_allocation: {
    [gpuId: string]: number;
  };
  created_at: string;
  updated_at: string;
}

export class WorkspaceConfig {
  private configDir: string;
  private configFile: string;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    const cfg = vscode.workspace.getConfiguration('dcp-provider');
    const workspaceRoot = cfg.get<string>('workspaceRoot', '${workspaceFolder}/.dcp');

    this.configDir = this.expandVariables(workspaceRoot);
    this.configFile = path.join(this.configDir, 'provider.json');
  }

  private expandVariables(input: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return input.replace('${workspaceFolder}', '.');
    }
    return input.replace('${workspaceFolder}', workspaceFolders[0].uri.fsPath);
  }

  async initializeWorkspace(): Promise<void> {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    if (!fs.existsSync(this.configFile)) {
      const providerId = await vscode.window.showInputBox({
        prompt: 'Enter your provider ID',
        placeHolder: 'provider-123456',
      });

      if (!providerId) {
        throw new Error('Provider ID is required');
      }

      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your provider API key',
        placeHolder: 'sk_provider_...',
        password: true,
      });

      if (!apiKey) {
        throw new Error('API key is required');
      }

      const nodeApiUrl = await vscode.window.showInputBox({
        prompt: 'Enter node API URL',
        value: 'http://localhost:8080',
      });

      const config: ProviderConfig = {
        provider_id: providerId,
        api_key: apiKey,
        node_api_url: nodeApiUrl || 'http://localhost:8080',
        gpu_allocation: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));

      // Store API key in secure storage
      await this.context.secrets.store('dcp-provider-api-key', apiKey);
    }
  }

  async getConfig(): Promise<ProviderConfig> {
    if (!fs.existsSync(this.configFile)) {
      throw new Error('Provider configuration not found. Run "DCP Provider: Configure Workspace" first.');
    }

    const data = fs.readFileSync(this.configFile, 'utf-8');
    const config = JSON.parse(data) as ProviderConfig;

    // Retrieve API key from secure storage if not in file
    if (!config.api_key) {
      const storedKey = await this.context.secrets.get('dcp-provider-api-key');
      if (storedKey) {
        config.api_key = storedKey;
      }
    }

    return config;
  }

  async updateConfig(updates: Partial<ProviderConfig>): Promise<void> {
    const config = await this.getConfig();
    const updated = {
      ...config,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    fs.writeFileSync(this.configFile, JSON.stringify(updated, null, 2));
  }

  async openConfigFile(): Promise<boolean> {
    if (!fs.existsSync(this.configFile)) {
      vscode.window.showErrorMessage('Configuration file not found');
      return false;
    }

    const uri = vscode.Uri.file(this.configFile);
    await vscode.window.showTextDocument(uri);
    return true;
  }

  getConfigDir(): string {
    return this.configDir;
  }

  getConfigFile(): string {
    return this.configFile;
  }

  hasConfig(): boolean {
    return fs.existsSync(this.configFile);
  }
}
