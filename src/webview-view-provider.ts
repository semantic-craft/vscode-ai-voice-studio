import * as vscode from "vscode";

export class VoiceStudioViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "aiVoiceStudio.studio";

  private view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message?.type) {
        case "ping":
          webviewView.webview.postMessage({ type: "pong", at: Date.now() });
          return;
        case "log":
          // M0: surface webview-side console messages while we wire things up.
          console.log("[aiVoiceStudio webview]", message.payload);
          return;
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = makeNonce();
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
      `media-src ${webview.cspSource} data:`,
    ].join("; ");

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Voice Studio</title>
  <style>
    :root {
      color-scheme: light dark;
    }
    body {
      margin: 0;
      padding: 12px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: transparent;
      line-height: 1.4;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 1.05em;
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-size: 0.85em;
      margin-left: 6px;
    }
    p {
      margin: 8px 0;
      color: var(--vscode-descriptionForeground);
    }
    button {
      margin-top: 8px;
      padding: 4px 10px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
      border-radius: 2px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .status {
      margin-top: 12px;
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <h1>AI Voice Studio<span class="badge">M0</span></h1>
  <p>Scaffold is alive. Next milestones wire up the providers (MiniMax, MiMo, OpenAI), audio playback, and controls.</p>
  <p>Run <code>AI Voice Studio: Hello World</code> from the Command Palette to confirm the extension host is happy.</p>
  <button id="ping">Ping extension host</button>
  <div class="status" id="status">Idle.</div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const statusEl = document.getElementById("status");

    document.getElementById("ping").addEventListener("click", () => {
      statusEl.textContent = "Pinging…";
      vscode.postMessage({ type: "ping" });
    });

    window.addEventListener("message", (event) => {
      const msg = event.data;
      if (msg?.type === "pong") {
        const delta = Date.now() - msg.at;
        statusEl.textContent = "Pong received (" + Math.abs(delta) + " ms drift).";
      }
    });

    vscode.postMessage({ type: "log", payload: "M0 webview ready" });
  </script>
</body>
</html>`;
  }
}

function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
