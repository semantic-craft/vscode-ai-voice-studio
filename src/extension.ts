import * as vscode from "vscode";
import {
  getConfig,
  getMiMoVoiceCloneSample,
  setGeminiStylePreamble,
  setMiMoAudioEventTags,
  setMiMoOpeningStyleTags,
  setMiMoStylePresets,
  setMiMoStylePrompt,
  setMiMoVoiceCloneSample,
  setMiniMaxChannel,
  setMiniMaxEmotion,
  setMiniMaxLanguageBoost,
  setMiniMaxPitch,
  setMiniMaxPronunciationDict,
  setMiniMaxRegion,
  setMiniMaxSpeed,
  setMiniMaxVol,
  setOpenAIInstructions,
  setProvider,
  setProviderModel,
  setProviderVoice,
  type AppConfig,
  type MiMoStylePreset,
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
        this.item.text = "$(unmute) Voice Studio";
        this.item.tooltip = "AI Voice Studio — click to open the sidebar.";
        break;
      case "synth":
        this.item.text = "$(loading~spin) Synthesizing…";
        this.item.tooltip = "AI Voice Studio — synthesizing audio.";
        break;
      case "playing":
        this.item.text =
          mode.total > 1
            ? `$(record) Voice ${mode.index}/${mode.total}`
            : "$(record) Voice";
        this.item.tooltip = "AI Voice Studio — playing.";
        break;
      case "error":
        this.item.text = "$(error) Voice Studio";
        this.item.tooltip = "AI Voice Studio — last action failed.";
        break;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new VoiceStudioViewProvider(context.extensionUri);
  const secrets = new SecretsStore(context.secrets);
  const playback = new PlaybackController();
  const statusBar = new StatusBar();

  context.subscriptions.push(
    statusBar,
    vscode.window.registerWebviewViewProvider(VoiceStudioViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  const refreshConfig = (): void => {
    if (!provider.isReady()) return;
    provider.postConfig(getConfig(), getMiMoVoiceCloneSample(context.globalState));
  };

  provider.setMessageHandler((msg) => {
    switch (msg.type) {
      case "requestRead":
        void readText(msg.text, "Webview");
        return;
      case "requestStop":
        playback.abort();
        statusBar.set({ kind: "idle" });
        return;
      case "requestSetKey":
        void vscode.commands.executeCommand("aiVoiceStudio.setApiKey");
        return;
      case "providerChanged":
        void setProvider(msg.provider).then(refreshConfig);
        return;
      case "voiceChanged":
        void setProviderVoice(msg.provider, msg.voice);
        return;
      case "modelChanged":
        void setProviderModel(msg.provider, msg.model).then(refreshConfig);
        return;
      case "mimoStyleTagsChanged":
        void setMiMoOpeningStyleTags(msg.tags);
        return;
      case "mimoAudioEventTagsChanged":
        void setMiMoAudioEventTags(msg.tags);
        return;
      case "mimoStylePromptChanged":
        void setMiMoStylePrompt(msg.text);
        return;
      case "mimoVoiceCloneSampleSet":
        void setMiMoVoiceCloneSample(context.globalState, {
          dataUrl: msg.dataUrl,
          mime: msg.mime,
          fileName: msg.fileName,
          sizeBytes: msg.sizeBytes,
          storedAt: Date.now(),
        }).then(refreshConfig);
        return;
      case "mimoVoiceCloneSampleClear":
        void setMiMoVoiceCloneSample(context.globalState, undefined).then(refreshConfig);
        return;
      case "mimoPresetSave":
        void applyPresetSave(msg.preset).then(refreshConfig);
        return;
      case "mimoPresetApply":
        void applyPresetByName(msg.name).then(refreshConfig);
        return;
      case "mimoPresetDelete":
        void applyPresetDelete(msg.name).then(refreshConfig);
        return;
      case "geminiStylePreambleChanged":
        void setGeminiStylePreamble(msg.text);
        return;
      case "geminiInsertAudioTag":
        // Pure UI signal — handled inside the webview, no extension state change.
        return;
      case "openaiInstructionsChanged":
        void setOpenAIInstructions(msg.text);
        return;
      case "minimaxSpeedChanged":
        void setMiniMaxSpeed(msg.speed);
        return;
      case "minimaxRegionChanged":
        void setMiniMaxRegion(msg.region);
        return;
      case "minimaxLanguageBoostChanged":
        void setMiniMaxLanguageBoost(msg.text);
        return;
      case "minimaxVolChanged":
        void setMiniMaxVol(msg.vol);
        return;
      case "minimaxPitchChanged":
        void setMiniMaxPitch(msg.pitch);
        return;
      case "minimaxEmotionChanged":
        void setMiniMaxEmotion(msg.emotion);
        return;
      case "minimaxChannelChanged":
        void setMiniMaxChannel(msg.channel);
        return;
      case "minimaxPronunciationDictChanged":
        void setMiniMaxPronunciationDict(msg.entries);
        return;
      case "minimaxInsertSpeechTag":
        // Pure UI signal — handled inside the webview, no extension state change.
        return;
      case "minimaxInsertPause":
        // Pure UI signal — handled inside the webview, no extension state change.
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
      provider.postStatus(
        `${PROVIDER_LABELS[cfg.provider]} API key not set.`,
        "error",
        { id: "requestSetKey", label: "Set API Key" },
      );
      statusBar.set({ kind: "error" });
      return;
    }

    const args = buildProviderArgs(cfg, apiKey, context);
    if (!args) {
      provider.postStatus(`Invalid voice/model for ${PROVIDER_LABELS[cfg.provider]}.`, "error");
      statusBar.set({ kind: "error" });
      return;
    }

    const voiceLabel = describeVoice(cfg);
    provider.reveal();

    const chunks = chunkText(trimmed, { maxChars: cfg.chunkSize });
    if (chunks.length === 0) return;

    const { signal, sessionId } = playback.begin();
    provider.postSessionStart(sessionId, chunks.length);
    statusBar.set({ kind: "synth" });
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
          statusBar.set({ kind: "playing", index: index + 1, total });
        },
        signal,
      );
      provider.postSessionEnd(sessionId, result.cancelled);
      statusBar.set({ kind: "idle" });
    } catch (err) {
      provider.postSessionEnd(sessionId, true);
      statusBar.set({ kind: "error" });
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
      statusBar.set({ kind: "idle" });
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
      if (provider.isReady()) {
        provider.postStatus(`${PROVIDER_LABELS[choice]} API key saved.`, "info");
      }
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
      if (event.affectsConfiguration("aiVoiceStudio")) {
        refreshConfig();
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

function buildProviderArgs(
  cfg: AppConfig,
  apiKey: string,
  context: vscode.ExtensionContext,
): ProviderArgs | undefined {
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
        vol: cfg.minimax.vol,
        pitch: cfg.minimax.pitch,
        emotion: cfg.minimax.emotion,
        channel: cfg.minimax.channel,
        sampleRate: cfg.minimax.sampleRate,
        bitrate: cfg.minimax.bitrate,
        languageBoost: cfg.minimax.languageBoost || undefined,
        pronunciationDict: cfg.minimax.pronunciationDict.length ? cfg.minimax.pronunciationDict : undefined,
      };
    }
    case "mimo": {
      const voice = getVoiceById(catalog, cfg.mimo.voice);
      if (!voice || !isVoiceAvailableForModel(voice, cfg.mimo.model)) return undefined;
      const cloneRecord = getMiMoVoiceCloneSample(context.globalState);
      const voiceCloneSample = cloneRecord
        ? { dataUrl: cloneRecord.dataUrl, sizeBytes: cloneRecord.sizeBytes }
        : undefined;
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
        voiceCloneSample,
      };
    }
    case "gemini": {
      const voice = getVoiceById(catalog, cfg.gemini.voice);
      if (!voice || !isVoiceAvailableForModel(voice, cfg.gemini.model)) return undefined;
      return {
        provider: "gemini",
        apiKey,
        baseUrl: cfg.gemini.baseUrl,
        model: cfg.gemini.model,
        voice: cfg.gemini.voice,
        format: "wav",
        stylePreamble: cfg.gemini.stylePreamble || undefined,
      };
    }
  }
}

function describeVoice(cfg: AppConfig): string {
  const catalog = CATALOGS[cfg.provider];
  const voiceId =
    cfg.provider === "openai"
      ? cfg.openai.voice
      : cfg.provider === "minimax"
        ? cfg.minimax.voice
        : cfg.provider === "mimo"
          ? cfg.mimo.voice
          : cfg.gemini.voice;
  const voice = getVoiceById(catalog, voiceId);
  return voice?.name ?? voiceId;
}

async function applyPresetSave(preset: MiMoStylePreset): Promise<void> {
  const cfg = getConfig();
  const filtered = cfg.mimo.stylePresets.filter((p) => p.name !== preset.name);
  filtered.push({
    name: preset.name,
    stylePrompt: preset.stylePrompt ?? "",
    openingStyleTags: Array.isArray(preset.openingStyleTags) ? preset.openingStyleTags : [],
    audioEventTags: Array.isArray(preset.audioEventTags) ? preset.audioEventTags : [],
  });
  await setMiMoStylePresets(filtered);
}

async function applyPresetApply(preset: MiMoStylePreset): Promise<void> {
  await Promise.all([
    setMiMoStylePrompt(preset.stylePrompt ?? ""),
    setMiMoOpeningStyleTags(preset.openingStyleTags ?? []),
    setMiMoAudioEventTags(preset.audioEventTags ?? []),
  ]);
}

async function applyPresetByName(name: string): Promise<void> {
  const cfg = getConfig();
  const found = cfg.mimo.stylePresets.find((p) => p.name === name);
  if (!found) return;
  await applyPresetApply(found);
}

async function applyPresetDelete(name: string): Promise<void> {
  const cfg = getConfig();
  const filtered = cfg.mimo.stylePresets.filter((p) => p.name !== name);
  if (filtered.length === cfg.mimo.stylePresets.length) return;
  await setMiMoStylePresets(filtered);
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
