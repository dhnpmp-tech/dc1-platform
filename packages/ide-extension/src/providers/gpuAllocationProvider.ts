import * as vscode from 'vscode';
import { ProviderAPI, GPU } from '../api';

class GPUItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
    this.description = description;
  }
}

export class GPUAllocationProvider implements vscode.TreeDataProvider<GPUItem> {
  private onDidChangeTreeData: vscode.EventEmitter<GPUItem | undefined | null | void> =
    new vscode.EventEmitter<GPUItem | undefined | null | void>();
  readonly onDidChangeTreeDataEvent: vscode.Event<GPUItem | undefined | null | void> =
    this.onDidChangeTreeData.event;

  private providerAPI: ProviderAPI;
  private gpus: GPU[] = [];

  constructor(providerAPI: ProviderAPI) {
    this.providerAPI = providerAPI;
    this.loadGPUs();
  }

  private async loadGPUs(): Promise<void> {
    try {
      this.gpus = await this.providerAPI.getAvailableGPUs();
      this.refresh();
    } catch {
      this.gpus = [];
    }
  }

  getTreeItem(element: GPUItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: GPUItem): Promise<GPUItem[]> {
    if (element) {
      return [];
    }

    if (this.gpus.length === 0) {
      return [new GPUItem('No GPUs detected', 'Check node connection')];
    }

    return this.gpus.map(gpu => {
      const statusIcon = this.getStatusIcon(gpu.status);
      const description = `${gpu.vram_gb}GB | ${gpu.allocated_percent}% allocated | ${gpu.temperature_c}°C`;
      const item = new GPUItem(`${statusIcon} ${gpu.name}`, description);
      item.contextValue = gpu.status;
      item.id = gpu.id;
      return item;
    });
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'available':
        return '$(circle-filled)';
      case 'in_use':
        return '$(debug)';
      case 'error':
        return '$(error)';
      default:
        return '$(question)';
    }
  }

  refresh(): void {
    this.onDidChangeTreeData.fire();
  }
}
