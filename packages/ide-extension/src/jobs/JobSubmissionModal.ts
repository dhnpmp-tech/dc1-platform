import * as vscode from 'vscode';

/**
 * Job Submission Modal
 * Allows renters to submit compute jobs directly from VS Code
 *
 * Flow:
 * 1. Select model/template
 * 2. Select provider
 * 3. Upload script
 * 4. Review cost estimate
 * 5. Submit job
 * 6. Monitor status
 */
export class JobSubmissionModal {
  private panel: vscode.WebviewPanel | undefined;
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Show job submission modal
   */
  async show(extensionUri: vscode.Uri): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'dcpJobSubmission',
      'DCP Job Submission',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    this.panel.webview.html = this.getWebviewContent();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(message => {
      this.handleMessage(message);
    });
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'selectTemplate':
        // TODO: Implement template selection
        break;
      case 'selectProvider':
        // TODO: Implement provider selection
        break;
      case 'submitJob':
        // TODO: Implement job submission
        break;
      case 'log':
        this.outputChannel.appendLine(message.text);
        break;
    }
  }

  /**
   * Get HTML content for webview
   */
  private getWebviewContent(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DCP Job Submission</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
          }
          h1 {
            font-size: 18px;
            margin-bottom: 20px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
          }
          select, input, textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 13px;
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .cost-estimate {
            background-color: var(--vscode-editor-lineHighlightBackground);
            padding: 12px;
            border-radius: 4px;
            margin: 20px 0;
          }
          .loading {
            display: none;
            text-align: center;
            color: var(--vscode-descriptionForeground);
          }
          .loading.active {
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Submit a Job</h1>

          <div class="form-group">
            <label for="template">Select Model/Template</label>
            <select id="template">
              <option value="">Loading templates...</option>
            </select>
          </div>

          <div class="form-group">
            <label for="provider">Select Provider</label>
            <select id="provider">
              <option value="">Loading providers...</option>
            </select>
          </div>

          <div class="form-group">
            <label for="script">Script Content</label>
            <textarea id="script" rows="8" placeholder="Paste your script here or select from file..."></textarea>
          </div>

          <div class="cost-estimate">
            <strong>Estimated Cost:</strong>
            <div id="costBreakdown">Loading...</div>
          </div>

          <button id="submitBtn">Submit Job</button>

          <div class="loading" id="loading">
            <p>Submitting job...</p>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();

          // Initialize form
          document.getElementById('submitBtn').addEventListener('click', submitJob);

          function submitJob() {
            const template = document.getElementById('template').value;
            const provider = document.getElementById('provider').value;
            const script = document.getElementById('script').value;

            if (!template || !provider || !script) {
              vscode.postMessage({
                command: 'log',
                text: 'Please fill in all fields'
              });
              return;
            }

            document.getElementById('loading').classList.add('active');

            vscode.postMessage({
              command: 'submitJob',
              template,
              provider,
              script
            });
          }
        </script>
      </body>
      </html>
    `;
  }

  dispose(): void {
    this.panel?.dispose();
  }
}
