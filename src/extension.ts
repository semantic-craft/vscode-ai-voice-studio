import * as vscode from "vscode";
import {
  getConfig,
  setQwenEndpoint,
  setQwenInstructions,
  setQwenLanguageType,
  setQwenModel,
  setQwenVoice,
  type AppConfig,
} from "./config";
import { runPlaybackSession } from "./core/playback-session";
import { synthesizeQwen, type QwenSynthesizeArgs } from "./core/qwen-tts";
import { QWEN_CATALOG } from "./core/qwen-voices";
import {
  TTSApiError,
  getVoiceById,
  getVoicesForModel,
  isVoiceAvailableForModel,
  type SynthesizeContext,
} from "./core/types";
import { chunkText } from "./core/text-chunker";
import { SecretsStore } from "./secrets";
import { VoiceStudioViewProvider } from "./webview-view-provider";

class PlaybackController {
  private current: AbortController | null = null;
  private sessionCounter = 0;

  begin(): { signal: AbortSignal; sessionId: number } {
    this.current?.abort();
    this.current = new AbortController();
    this.sessionCounter += 1;
    return { signal: this.current.signal, sessionId: this.sessionCounter };
  }

  abort(): void {
    this.current?.abort();
    this.current = null;
  }

  isCurrent(sessionId: number): boolean {
    return this.current !== null && this.sessionCounter === sessionId;
  }

  complete(sessionId: number): void {
    if (this.isCurrent(sessionId)) {
      this.current = null;
    }
  }
}

type StatusBarMode =
  | { kind: "idle" }
  | { kind: "synth" }
  | { kind: "playing"; index: number; total: number }
  | { kind: "error" };

class StatusBar {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "aiVoiceStudio.focusView";
    this.set({ kind: "idle" });
    this.item.show();
  }

  set(mode: StatusBarMode): void {
    switch (mode.kind) {
      case "idle":
        this.item.text = "$(unmute) Qwen TTS";
        this.item.tooltip = "Qwen TTS Studio - click to open the sidebar.";
        break;
      case "synth":
        this.item.text = "$(loading~spin) Synthesizing...";
        this.item.tooltip = "Qwen TTS Studio - synthesizing audio.";
        break;
      case "playing":
        this.item.text =
          mode.total > 1
            ? `$(record) Qwen ${mode.index}/${mode.total}`
            : "$(record) Qwen";
        this.item.tooltip = "Qwen TTS Studio - playing.";
        break;
      case "error":
        this.item.text = "$(error) Qwen TTS";
        this.item.tooltip = "Qwen TTS Studio - last action failed.";
        break;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}

type QwenPlaybackArgs = Omit<QwenSynthesizeArgs, keyof SynthesizeContext>;

export function activate(context: vscode.ExtensionContext): void {
  const viewProvider = new VoiceStudioViewProvider(context.extensionUri);
  const secrets = new SecretsStore(context.secrets);
  const playback = new PlaybackController();
  const statusBar = new StatusBar();

  context.subscriptions.push(
    statusBar,
    vscode.window.registerWebviewViewProvider(VoiceStudioViewProvider.viewType, viewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  const refreshConfig = (): void => {
    if (!viewProvider.isReady()) return;
    viewProvider.postConfig(getConfig());
  };
  let configUpdateChain: Promise<void> = Promise.resolve();
  const queueConfigUpdate = (update: () => Promise<void>, shouldRefresh = false): void => {
    configUpdateChain = configUpdateChain
      .then(update)
      .then(() => {
        if (shouldRefresh) refreshConfig();
      })
      .catch((err) => {
        statusBar.set({ kind: "error" });
        handleError(err, viewProvider);
      });
  };

  viewProvider.setMessageHandler((msg) => {
    switch (msg.type) {
      case "ready":
        refreshConfig();
        return;
      case "requestRead":
        void readText(msg.text, "Sidebar");
        return;
      case "requestStop":
        playback.abort();
        viewProvider.postStop();
        statusBar.set({ kind: "idle" });
        return;
      case "requestSetKey":
        void vscode.commands.executeCommand("aiVoiceStudio.setApiKey");
        return;
      case "voiceChanged":
        queueConfigUpdate(() => setQwenVoice(msg.voice));
        return;
      case "modelChanged":
        queueConfigUpdate(() => applyModelChange(msg.model, msg.voice), true);
        return;
      case "qwenEndpointChanged":
        queueConfigUpdate(() => setQwenEndpoint(msg.endpoint));
        return;
      case "qwenLanguageTypeChanged":
        queueConfigUpdate(() => setQwenLanguageType(msg.languageType));
        return;
      case "qwenInstructionsChanged":
        queueConfigUpdate(() => setQwenInstructions(msg.text));
        return;
    }
  });

  async function readText(text: string, source: string): Promise<void> {
    let sessionId: number | undefined;
    try {
      const trimmed = text.trim();
      if (!trimmed) {
        vscode.window.showWarningMessage("Qwen TTS Studio: nothing to read.");
        return;
      }
      await configUpdateChain;

      const cfg = getConfig();
      const apiKey = await secrets.ensure();
      if (!apiKey) {
        viewProvider.postStatus("DashScope API key not set.", "error", { id: "requestSetKey", label: "Set API Key" });
        statusBar.set({ kind: "error" });
        return;
      }

      const args = buildQwenArgs(cfg, apiKey);
      if (!args) {
        viewProvider.postStatus("Invalid Qwen voice/model selection.", "error");
        statusBar.set({ kind: "error" });
        return;
      }

      const voiceLabel = describeVoice(cfg);
      await viewProvider.reveal();
      if (!(await viewProvider.waitUntilReady())) {
        const message = "Qwen TTS Studio: sidebar is still loading. Try again in a moment.";
        viewProvider.postStatus(message, "warn");
        void vscode.window.showWarningMessage(message);
        statusBar.set({ kind: "idle" });
        return;
      }

      const chunks = chunkText(trimmed, { maxChars: cfg.chunkSize });
      if (chunks.length === 0) return;

      const session = playback.begin();
      const signal = session.signal;
      const currentSessionId = session.sessionId;
      sessionId = currentSessionId;
      viewProvider.postSessionStart(currentSessionId, chunks.length);
      statusBar.set({ kind: "synth" });
      viewProvider.postStatus(
        chunks.length === 1
          ? `Synthesizing with Qwen-TTS - ${voiceLabel}...`
          : `Synthesizing ${chunks.length} chunks with Qwen-TTS - ${voiceLabel}...`,
      );

      const result = await runPlaybackSession(
        chunks,
        (chunk, chunkSignal) => synthesizeQwen({ text: chunk, signal: chunkSignal, ...args }),
        ({ index, total, result: out }) => {
          if (!playback.isCurrent(currentSessionId)) return;
          const label =
            total > 1
              ? `${source} - ${voiceLabel} - ${index + 1}/${total}`
              : `${source} - ${voiceLabel}`;
          viewProvider.postPlay(currentSessionId, index, total, out.audioBase64, out.format, cfg.playbackRate, label);
          statusBar.set({ kind: "playing", index: index + 1, total });
        },
        signal,
      );

      if (!playback.isCurrent(currentSessionId)) return;
      viewProvider.postSessionEnd(currentSessionId, result.cancelled);
      playback.complete(currentSessionId);
      statusBar.set({ kind: "idle" });
    } catch (err) {
      if (sessionId !== undefined) {
        if (!playback.isCurrent(sessionId)) return;
        playback.abort();
        viewProvider.postSessionEnd(sessionId, true);
      }
      statusBar.set({ kind: "error" });
      handleError(err, viewProvider);
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("aiVoiceStudio.quickRead", async () => {
      const text = await resolveTextToRead();
      if (!text) {
        vscode.window.showInformationMessage(
          "Qwen TTS Studio: select text in the editor or copy text to the clipboard first.",
        );
        return;
      }
      await readText(text, "Quick Read");
    }),
    vscode.commands.registerCommand("aiVoiceStudio.stop", () => {
      playback.abort();
      viewProvider.postStop();
      statusBar.set({ kind: "idle" });
    }),
    vscode.commands.registerCommand("aiVoiceStudio.setApiKey", async () => {
      const value = await vscode.window.showInputBox({
        title: "DashScope API key",
        prompt: "Stored in VS Code SecretStorage. Leave empty to cancel.",
        password: true,
        ignoreFocusOut: true,
        placeHolder: "DASHSCOPE_API_KEY / sk-...",
        validateInput: (input) => (input.trim().length === 0 ? "API key cannot be empty." : null),
      });
      const trimmed = value?.trim();
      if (!trimmed) return;
      await secrets.set(trimmed);
      vscode.window.showInformationMessage("Qwen TTS Studio: DashScope API key saved.");
      if (viewProvider.isReady()) {
        viewProvider.postStatus("DashScope API key saved.", "info");
      }
    }),
    vscode.commands.registerCommand("aiVoiceStudio.clearApiKey", async () => {
      await secrets.clear();
      vscode.window.showInformationMessage("Qwen TTS Studio: DashScope API key cleared.");
    }),
    vscode.commands.registerCommand("aiVoiceStudio.focusView", () => {
      vscode.commands.executeCommand("aiVoiceStudio.studio.focus");
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("aiVoiceStudio")) {
        refreshConfig();
      }
    }),
  );
}

export function deactivate(): void {
  // no-op
}

async function applyModelChange(model: string, voice: string | undefined): Promise<void> {
  await setQwenModel(model);
  if (voice?.trim()) {
    await setQwenVoice(voice.trim());
  }
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

function buildQwenArgs(cfg: AppConfig, apiKey: string): QwenPlaybackArgs | undefined {
  const voice = resolveVoiceId(cfg.qwen.voice, cfg.qwen.model);
  if (!voice) return undefined;
  return {
    apiKey,
    endpoint: cfg.qwen.endpoint,
    model: cfg.qwen.model,
    voice,
    languageType: cfg.qwen.languageType,
    instructions: cfg.qwen.instructions,
  };
}

function resolveVoiceId(voiceId: string, model: string): string | undefined {
  const voice = getVoiceById(QWEN_CATALOG, voiceId);
  if (voice && isVoiceAvailableForModel(voice, model)) return voice.id;
  return getVoicesForModel(QWEN_CATALOG, model)[0]?.id;
}

function describeVoice(cfg: AppConfig): string {
  const resolved = resolveVoiceId(cfg.qwen.voice, cfg.qwen.model);
  const voice = resolved ? getVoiceById(QWEN_CATALOG, resolved) : undefined;
  return voice?.name ?? resolved ?? cfg.qwen.voice;
}

function handleError(err: unknown, viewProvider: VoiceStudioViewProvider): void {
  if (err instanceof TTSApiError) {
    if (err.code === -7) {
      viewProvider.postStatus("Cancelled.", "muted");
      return;
    }
    viewProvider.postStatus(err.message, "error");
    vscode.window.showErrorMessage(`Qwen TTS Studio: ${err.message}`);
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  viewProvider.postStatus(message, "error");
  vscode.window.showErrorMessage(`Qwen TTS Studio: ${message}`);
}
