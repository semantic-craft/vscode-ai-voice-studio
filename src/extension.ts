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
  setProvider,
  setProviderModel,
  setProviderVoice,
  setQwenEndpoint,
  setQwenInstructions,
  setQwenLanguageType,
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
  getVoicesForModel,
  type ProviderCatalog,
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
    void postActiveKeyStatus();
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
        handleError(err, provider);
      });
  };

  async function promptAndStoreKey(target?: ProviderId): Promise<void> {
    const choice = target ?? (await pickProvider("Set API key for…"));
    if (!choice) return;
    const value = await vscode.window.showInputBox({
      title: `${PROVIDER_LABELS[choice]} API key`,
      prompt: "Stored in VS Code SecretStorage. Leave empty to cancel.",
      password: true,
      ignoreFocusOut: true,
      validateInput: (input) => (input.trim().length === 0 ? "API key cannot be empty." : null),
    });
    const trimmed = value?.trim();
    if (!trimmed) return;
    await secrets.set(choice, trimmed);
    vscode.window.showInformationMessage(`AI Voice Studio: ${PROVIDER_LABELS[choice]} API key saved.`);
    provider.postStatus(`✓ ${PROVIDER_LABELS[choice]} API key saved.`, "success");
    void postActiveKeyStatus();
  }

  async function postActiveKeyStatus(): Promise<void> {
    if (!provider.isReady()) return;
    const active = getConfig().provider;
    const hasKey = !!(await secrets.get(active));
    provider.postKeyStatus(active, hasKey);
  }

  provider.setMessageHandler((msg) => {
    switch (msg.type) {
      case "ready":
        refreshConfig();
        return;
      case "requestRead":
        void readText(msg.text, "Webview");
        return;
      case "requestStop":
        playback.abort();
        statusBar.set({ kind: "idle" });
        return;
      case "requestSetKey":
        void promptAndStoreKey(msg.provider);
        return;
      case "providerChanged":
        queueConfigUpdate(() => setProvider(msg.provider), true);
        return;
      case "voiceChanged":
        queueConfigUpdate(() => setProviderVoice(msg.provider, msg.voice));
        return;
      case "modelChanged":
        queueConfigUpdate(() => applyModelChange(msg.provider, msg.model, msg.voice), true);
        return;
      case "mimoStyleTagsChanged":
        queueConfigUpdate(() => setMiMoOpeningStyleTags(msg.tags));
        return;
      case "mimoAudioEventTagsChanged":
        queueConfigUpdate(() => setMiMoAudioEventTags(msg.tags));
        return;
      case "mimoStylePromptChanged":
        queueConfigUpdate(() => setMiMoStylePrompt(msg.text));
        return;
      case "mimoVoiceCloneSampleSet":
        queueConfigUpdate(
          () =>
            setMiMoVoiceCloneSample(context.globalState, {
              dataUrl: msg.dataUrl,
              mime: msg.mime,
              fileName: msg.fileName,
              sizeBytes: msg.sizeBytes,
              storedAt: Date.now(),
            }),
          true,
        );
        return;
      case "mimoVoiceCloneSampleClear":
        queueConfigUpdate(() => setMiMoVoiceCloneSample(context.globalState, undefined), true);
        return;
      case "mimoPresetSave":
        queueConfigUpdate(() => applyPresetSave(msg.preset), true);
        return;
      case "mimoPresetApply":
        queueConfigUpdate(() => applyPresetByName(msg.name), true);
        return;
      case "mimoPresetDelete":
        queueConfigUpdate(() => applyPresetDelete(msg.name), true);
        return;
      case "geminiStylePreambleChanged":
        queueConfigUpdate(() => setGeminiStylePreamble(msg.text));
        return;
      case "geminiInsertAudioTag":
        // Pure UI signal — handled inside the webview, no extension state change.
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
        vscode.window.showWarningMessage("AI Voice Studio: nothing to read.");
        return;
      }
      await configUpdateChain;

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
      await provider.reveal();
      if (!(await provider.waitUntilReady())) {
        const message = "AI Voice Studio: sidebar is still loading. Try again in a moment.";
        provider.postStatus(message, "warn");
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
      provider.postSessionStart(currentSessionId, chunks.length);
      statusBar.set({ kind: "synth" });
      provider.postStatus(
        chunks.length === 1
          ? `Synthesizing with ${PROVIDER_LABELS[cfg.provider]} · ${voiceLabel}…`
          : `Synthesizing ${chunks.length} chunks with ${PROVIDER_LABELS[cfg.provider]} · ${voiceLabel}…`,
      );

      const isQwenStreaming = args.provider === "qwen";
      let streamingChunkIndex = 0;
      const result = await runPlaybackSession(
        chunks,
        (chunkText, chunkSignal) => {
          if (isQwenStreaming && args.provider === "qwen") {
            // Stream sub-chunks straight to the webview as PCM segments arrive.
            const total = chunks.length;
            const myIndex = streamingChunkIndex++;
            const label =
              total > 1
                ? `${source} · ${voiceLabel} · ${myIndex + 1}/${total}`
                : `${source} · ${voiceLabel}`;
            return synthesize(
              { text: chunkText, signal: chunkSignal },
              {
                ...args,
                onSubChunk: (audioBase64, isLast) => {
                  if (!playback.isCurrent(currentSessionId)) return;
                  provider.postSubChunk(
                    currentSessionId,
                    audioBase64,
                    "pcm",
                    cfg.playbackRate,
                    isLast,
                    label,
                  );
                },
              },
            );
          }
          return synthesize({ text: chunkText, signal: chunkSignal }, args);
        },
        ({ index, total, result: out }) => {
          if (!playback.isCurrent(currentSessionId)) return;
          const label =
            total > 1
              ? `${source} · ${voiceLabel} · ${index + 1}/${total}`
              : `${source} · ${voiceLabel}`;
          if (isQwenStreaming) {
            // Streaming already pushed audio to the webview via postSubChunk;
            // here we only mark the chunk boundary so the progress bar advances
            // when the trailing sub-chunk has been queued.
            provider.postChunkBoundary(currentSessionId, index, total, label);
          } else {
            provider.postPlay(currentSessionId, index, total, out.audioBase64, out.format, cfg.playbackRate, label);
          }
          statusBar.set({ kind: "playing", index: index + 1, total });
        },
        signal,
      );
      if (!playback.isCurrent(currentSessionId)) return;
      provider.postSessionEnd(currentSessionId, result.cancelled);
      playback.complete(currentSessionId);
      statusBar.set({ kind: "idle" });
    } catch (err) {
      if (sessionId !== undefined) {
        if (!playback.isCurrent(sessionId)) return;
        playback.abort();
        provider.postSessionEnd(sessionId, true);
      }
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
    vscode.commands.registerCommand("aiVoiceStudio.setApiKey", () => promptAndStoreKey()),
    vscode.commands.registerCommand("aiVoiceStudio.clearApiKey", async () => {
      const choice = await pickProvider("Clear API key for…");
      if (!choice) return;
      await secrets.clear(choice);
      vscode.window.showInformationMessage(`AI Voice Studio: ${PROVIDER_LABELS[choice]} API key cleared.`);
      void postActiveKeyStatus();
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

async function applyModelChange(provider: ProviderId, model: string, voice: string | undefined): Promise<void> {
  await setProviderModel(provider, model);
  if (voice?.trim()) {
    await setProviderVoice(provider, voice.trim());
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

function buildProviderArgs(
  cfg: AppConfig,
  apiKey: string,
  context: vscode.ExtensionContext,
): ProviderArgs | undefined {
  const catalog = CATALOGS[cfg.provider];
  switch (cfg.provider) {
    case "mimo": {
      const voice = resolveVoiceId(catalog, cfg.mimo.voice, cfg.mimo.model);
      if (!voice) return undefined;
      const cloneRecord = getMiMoVoiceCloneSample(context.globalState);
      const voiceCloneSample = cloneRecord
        ? { dataUrl: cloneRecord.dataUrl, sizeBytes: cloneRecord.sizeBytes }
        : undefined;
      return {
        provider: "mimo",
        apiKey,
        baseUrl: cfg.mimo.baseUrl,
        model: cfg.mimo.model,
        voice,
        format: cfg.mimo.format,
        stylePrompt: cfg.mimo.stylePrompt || undefined,
        openingStyleTags: cfg.mimo.openingStyleTags.length ? cfg.mimo.openingStyleTags : undefined,
        audioEventTags: cfg.mimo.audioEventTags.length ? cfg.mimo.audioEventTags : undefined,
        voiceCloneSample,
      };
    }
    case "gemini": {
      const voice = resolveVoiceId(catalog, cfg.gemini.voice, cfg.gemini.model);
      if (!voice) return undefined;
      return {
        provider: "gemini",
        apiKey,
        baseUrl: cfg.gemini.baseUrl,
        model: cfg.gemini.model,
        voice,
        format: "wav",
        stylePreamble: cfg.gemini.stylePreamble || undefined,
      };
    }
    case "qwen": {
      const voice = resolveVoiceId(catalog, cfg.qwen.voice, cfg.qwen.model);
      if (!voice) return undefined;
      return {
        provider: "qwen",
        apiKey,
        endpoint: cfg.qwen.endpoint,
        model: cfg.qwen.model,
        voice,
        languageType: cfg.qwen.languageType,
        instructions: cfg.qwen.instructions || undefined,
      };
    }
  }
}

function resolveVoiceId(catalog: ProviderCatalog, voiceId: string, model: string): string | undefined {
  const voice = getVoiceById(catalog, voiceId);
  if (voice && isVoiceAvailableForModel(voice, model)) return voice.id;
  return getVoicesForModel(catalog, model)[0]?.id;
}

function describeVoice(cfg: AppConfig): string {
  const catalog = CATALOGS[cfg.provider];
  const { voiceId, model } = pickVoiceAndModel(cfg);
  const resolved = resolveVoiceId(catalog, voiceId, model);
  const voice = resolved ? getVoiceById(catalog, resolved) : undefined;
  return voice?.name ?? resolved ?? voiceId;
}

function pickVoiceAndModel(cfg: AppConfig): { voiceId: string; model: string } {
  switch (cfg.provider) {
    case "mimo":
      return { voiceId: cfg.mimo.voice, model: cfg.mimo.model };
    case "gemini":
      return { voiceId: cfg.gemini.voice, model: cfg.gemini.model };
    case "qwen":
      return { voiceId: cfg.qwen.voice, model: cfg.qwen.model };
  }
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
