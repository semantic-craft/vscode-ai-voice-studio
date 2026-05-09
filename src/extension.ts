import * as vscode from "vscode";
import { getOpenAIConfig } from "./config";
import { synthesizeSpeech, TTSApiError } from "./core/openai-tts";
import { getVoiceById, isVoiceAvailableForModel } from "./core/openai-voices";
import { SecretsStore } from "./secrets";
import { VoiceStudioViewProvider } from "./webview-view-provider";

class PlaybackController {
  private current: AbortController | null = null;

  begin(): AbortSignal {
    this.current?.abort();
    this.current = new AbortController();
    return this.current.signal;
  }

  abort(): void {
    this.current?.abort();
    this.current = null;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new VoiceStudioViewProvider(context.extensionUri);
  const secrets = new SecretsStore(context.secrets);
  const playback = new PlaybackController();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VoiceStudioViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  provider.setMessageHandler((msg) => {
    switch (msg.type) {
      case "requestRead":
        void readText(msg.text, "Webview");
        return;
      case "requestStop":
        playback.abort();
        return;
    }
  });

  async function readText(text: string, source: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      vscode.window.showWarningMessage("AI Voice Studio: nothing to read.");
      return;
    }

    const apiKey = await secrets.ensureOpenAIKey();
    if (!apiKey) {
      provider.postStatus("OpenAI API key not set.", "error");
      return;
    }

    const cfg = getOpenAIConfig();
    const voice = getVoiceById(cfg.voice);
    if (!voice) {
      vscode.window.showErrorMessage(`AI Voice Studio: unknown voice "${cfg.voice}".`);
      return;
    }
    if (!isVoiceAvailableForModel(voice, cfg.model)) {
      vscode.window.showErrorMessage(
        `AI Voice Studio: voice "${voice.name}" is not available for model "${cfg.model}".`,
      );
      return;
    }

    provider.reveal();
    provider.postStatus(`Synthesizing with ${voice.name}…`);

    const signal = playback.begin();
    try {
      const result = await synthesizeSpeech({
        text: trimmed,
        apiKey,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
        voice: cfg.voice,
        format: cfg.format,
        instructions: cfg.instructions,
        signal,
      });
      provider.postPlay(result.audioBase64, result.format, cfg.playbackRate, `${source} · ${voice.name}`);
    } catch (err) {
      handleError(err, provider);
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("aiVoiceStudio.quickRead", async () => {
      const text = await resolveTextToRead();
      if (!text) {
        vscode.window.showInformationMessage(
          "AI Voice Studio: select text in the editor or copy text to the clipboard first.",
        );
        return;
      }
      await readText(text, "Quick Read");
    }),
    vscode.commands.registerCommand("aiVoiceStudio.stop", () => {
      playback.abort();
      provider.postStop();
    }),
    vscode.commands.registerCommand("aiVoiceStudio.setOpenAIApiKey", async () => {
      const value = await vscode.window.showInputBox({
        title: "OpenAI API key",
        prompt: "Stored in VS Code SecretStorage. Leave empty to cancel.",
        password: true,
        ignoreFocusOut: true,
        placeHolder: "sk-...",
      });
      if (!value) return;
      await secrets.setOpenAIKey(value.trim());
      vscode.window.showInformationMessage("AI Voice Studio: OpenAI API key saved.");
    }),
    vscode.commands.registerCommand("aiVoiceStudio.clearOpenAIApiKey", async () => {
      await secrets.clearOpenAIKey();
      vscode.window.showInformationMessage("AI Voice Studio: OpenAI API key cleared.");
    }),
    vscode.commands.registerCommand("aiVoiceStudio.focusView", () => {
      vscode.commands.executeCommand("aiVoiceStudio.studio.focus");
    }),
  );
}

export function deactivate(): void {
  // no-op
}

async function resolveTextToRead(): Promise<string | undefined> {
  const editor = vscode.window.activeTextEditor;
  if (editor && !editor.selection.isEmpty) {
    return editor.document.getText(editor.selection);
  }
  try {
    const clip = await vscode.env.clipboard.readText();
    if (clip.trim()) return clip;
  } catch {
    // ignore clipboard errors
  }
  return undefined;
}

function handleError(err: unknown, provider: VoiceStudioViewProvider): void {
  if (err instanceof TTSApiError) {
    if (err.code === -7) {
      provider.postStatus("Cancelled.", "muted");
      return;
    }
    provider.postStatus(err.message, "error");
    vscode.window.showErrorMessage(`AI Voice Studio: ${err.message}`);
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  provider.postStatus(message, "error");
  vscode.window.showErrorMessage(`AI Voice Studio: ${message}`);
}
