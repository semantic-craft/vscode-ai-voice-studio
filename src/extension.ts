import * as vscode from "vscode";
import {
  getConfig,
  setMiMoOpeningStyleTags,
  setProvider,
  setProviderModel,
  setProviderVoice,
  type AppConfig,
} from "./config";
import {
  PROVIDER_IDS,
  PROVIDER_LABELS,
  TTSApiError,
  isProviderId,
  isVoiceAvailableForModel,
  getVoiceById,
  type ProviderId,
} from "./core/providers";
import { CATALOGS, synthesize, type ProviderArgs } from "./core/synthesize";
import { chunkText } from "./core/text-chunker";
import { runPlaybackSession } from "./core/playback-session";
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
      case "providerChanged":
        void setProvider(msg.provider).then(() => provider.postConfig(getConfig()));
        return;
      case "voiceChanged":
        void setProviderVoice(msg.provider, msg.voice);
        return;
      case "modelChanged":
        void setProviderModel(msg.provider, msg.model).then(() => provider.postConfig(getConfig()));
        return;
      case "mimoStyleTagsChanged":
        void setMiMoOpeningStyleTags(msg.tags);
        return;
    }
  });

  async function readText(text: string, source: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      vscode.window.showWarningMessage("AI Voice Studio: nothing to read.");
      return;
    }

    const cfg = getConfig();
    const apiKey = await secrets.ensure(cfg.provider);
    if (!apiKey) {
      provider.postStatus(`${PROVIDER_LABELS[cfg.provider]} API key not set.`, "error");
      return;
    }

    const args = buildProviderArgs(cfg, apiKey);
    if (!args) {
      provider.postStatus(`Invalid voice/model for ${PROVIDER_LABELS[cfg.provider]}.`, "error");
      return;
    }

    const voiceLabel = describeVoice(cfg);
    provider.reveal();

    const chunks = chunkText(trimmed, { maxChars: cfg.chunkSize });
    if (chunks.length === 0) return;

    const { signal, sessionId } = playback.begin();
    provider.postSessionStart(sessionId, chunks.length);
    provider.postStatus(
      chunks.length === 1
        ? `Synthesizing with ${PROVIDER_LABELS[cfg.provider]} · ${voiceLabel}…`
        : `Synthesizing ${chunks.length} chunks with ${PROVIDER_LABELS[cfg.provider]} · ${voiceLabel}…`,
    );

    try {
      const result = await runPlaybackSession(
        chunks,
        (chunkText, chunkSignal) => synthesize({ text: chunkText, signal: chunkSignal }, args),
        ({ index, total, result: out }) => {
          const label =
            total > 1
              ? `${source} · ${voiceLabel} · ${index + 1}/${total}`
              : `${source} · ${voiceLabel}`;
          provider.postPlay(sessionId, index, total, out.audioBase64, out.format, cfg.playbackRate, label);
        },
        signal,
      );
      provider.postSessionEnd(sessionId, result.cancelled);
    } catch (err) {
      provider.postSessionEnd(sessionId, true);
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
    vscode.commands.registerCommand("aiVoiceStudio.setApiKey", async () => {
      const choice = await pickProvider("Set API key for…");
      if (!choice) return;
      const value = await vscode.window.showInputBox({
        title: `${PROVIDER_LABELS[choice]} API key`,
        prompt: "Stored in VS Code SecretStorage. Leave empty to cancel.",
        password: true,
        ignoreFocusOut: true,
      });
      if (!value) return;
      await secrets.set(choice, value.trim());
      vscode.window.showInformationMessage(`AI Voice Studio: ${PROVIDER_LABELS[choice]} API key saved.`);
    }),
    vscode.commands.registerCommand("aiVoiceStudio.clearApiKey", async () => {
      const choice = await pickProvider("Clear API key for…");
      if (!choice) return;
      await secrets.clear(choice);
      vscode.window.showInformationMessage(`AI Voice Studio: ${PROVIDER_LABELS[choice]} API key cleared.`);
    }),
    vscode.commands.registerCommand("aiVoiceStudio.focusView", () => {
      vscode.commands.executeCommand("aiVoiceStudio.studio.focus");
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("aiVoiceStudio") && provider.isReady()) {
        provider.postConfig(getConfig());
      }
    }),
  );
}

export function deactivate(): void {
  // no-op
}

async function pickProvider(title: string): Promise<ProviderId | undefined> {
  const items = PROVIDER_IDS.map((id) => ({ label: PROVIDER_LABELS[id], id }));
  const picked = await vscode.window.showQuickPick(items, { title, ignoreFocusOut: true });
  return picked && isProviderId(picked.id) ? picked.id : undefined;
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

function buildProviderArgs(cfg: AppConfig, apiKey: string): ProviderArgs | undefined {
  const catalog = CATALOGS[cfg.provider];
  switch (cfg.provider) {
    case "openai": {
      const voice = getVoiceById(catalog, cfg.openai.voice);
      if (!voice || !isVoiceAvailableForModel(voice, cfg.openai.model)) return undefined;
      return {
        provider: "openai",
        apiKey,
        baseUrl: cfg.openai.baseUrl,
        model: cfg.openai.model,
        voice: cfg.openai.voice,
        format: cfg.openai.format,
        instructions: cfg.openai.instructions,
      };
    }
    case "minimax": {
      const voice = getVoiceById(catalog, cfg.minimax.voice);
      if (!voice || !isVoiceAvailableForModel(voice, cfg.minimax.model)) return undefined;
      return {
        provider: "minimax",
        apiKey,
        region: cfg.minimax.region,
        model: cfg.minimax.model,
        voice: cfg.minimax.voice,
        format: cfg.minimax.format,
        speed: cfg.minimax.speed,
        sampleRate: cfg.minimax.sampleRate,
        bitrate: cfg.minimax.bitrate,
        languageBoost: cfg.minimax.languageBoost || undefined,
      };
    }
    case "mimo": {
      const voice = getVoiceById(catalog, cfg.mimo.voice);
      if (!voice || !isVoiceAvailableForModel(voice, cfg.mimo.model)) return undefined;
      return {
        provider: "mimo",
        apiKey,
        baseUrl: cfg.mimo.baseUrl,
        model: cfg.mimo.model,
        voice: cfg.mimo.voice,
        format: cfg.mimo.format,
        stylePrompt: cfg.mimo.stylePrompt || undefined,
        openingStyleTags: cfg.mimo.openingStyleTags.length ? cfg.mimo.openingStyleTags : undefined,
        audioEventTags: cfg.mimo.audioEventTags.length ? cfg.mimo.audioEventTags : undefined,
      };
    }
  }
}

function describeVoice(cfg: AppConfig): string {
  const catalog = CATALOGS[cfg.provider];
  const voiceId =
    cfg.provider === "openai" ? cfg.openai.voice : cfg.provider === "minimax" ? cfg.minimax.voice : cfg.mimo.voice;
  const voice = getVoiceById(catalog, voiceId);
  return voice?.name ?? voiceId;
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
