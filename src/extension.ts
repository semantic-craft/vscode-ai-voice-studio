import * as vscode from "vscode";
import { VoiceStudioViewProvider } from "./webview-view-provider";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new VoiceStudioViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VoiceStudioViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("aiVoiceStudio.helloWorld", () => {
      vscode.window.showInformationMessage("AI Voice Studio: M0 scaffold is alive.");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("aiVoiceStudio.focusView", () => {
      vscode.commands.executeCommand("aiVoiceStudio.studio.focus");
    }),
  );
}

export function deactivate(): void {
  // no-op
}
