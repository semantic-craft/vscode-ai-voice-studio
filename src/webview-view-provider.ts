import * as vscode from "vscode";
import {
  getConfig,
  setPlaybackRate,
  type AppConfig,
  type MiMoStylePreset,
  type MiMoVoiceCloneSampleRecord,
} from "./config";
import { CATALOGS } from "./core/synthesize";
import { PROVIDER_IDS, PROVIDER_LABELS, type ProviderId } from "./core/providers";
import {
  AUDIO_EVENT_GROUPS,
  DIRECTOR_TEMPLATE,
  STYLE_TAG_GROUPS,
  VOICE_CLONE_PLACEHOLDER,
  VOICE_DESIGN_PLACEHOLDER,
  VOICE_DESIGN_TEMPLATE,
} from "./core/mimo-voices";
import { AUDIO_TAG_PRESETS as GEMINI_AUDIO_TAGS } from "./core/gemini-voices";
import {
  EMOTION_OPTIONS as MINIMAX_EMOTION_OPTIONS,
  LANGUAGE_BOOST_PRESETS as MINIMAX_LANGUAGE_BOOSTS,
  SPEECH_TAG_PRESETS as MINIMAX_SPEECH_TAGS,
  TAG_CAPABLE_MODELS as MINIMAX_TAG_CAPABLE_MODELS,
  type MiniMaxEmotion,
  type MiniMaxFormat,
  type MiniMaxRegion,
} from "./core/minimax-voices";
import { LANGUAGE_TYPES as QWEN_LANGUAGE_TYPES, type QwenEndpoint, type QwenLanguageType } from "./core/qwen-voices";

type IncomingMessage =
  | { type: "ready" }
  | { type: "log"; payload: unknown }
  | { type: "requestRead"; text: string }
  | { type: "requestStop" }
  | { type: "requestSetKey" }
  | { type: "rateChanged"; rate: number }
  | { type: "providerChanged"; provider: ProviderId }
  | { type: "voiceChanged"; provider: ProviderId; voice: string }
  | { type: "modelChanged"; provider: ProviderId; model: string; voice?: string }
  | { type: "mimoStyleTagsChanged"; tags: string[] }
  | { type: "mimoAudioEventTagsChanged"; tags: string[] }
  | { type: "mimoStylePromptChanged"; text: string }
  | { type: "mimoVoiceCloneSampleSet"; dataUrl: string; mime: string; fileName: string; sizeBytes: number }
  | { type: "mimoVoiceCloneSampleClear" }
  | { type: "mimoPresetSave"; preset: MiMoStylePreset }
  | { type: "mimoPresetApply"; name: string }
  | { type: "mimoPresetDelete"; name: string }
  | { type: "geminiStylePreambleChanged"; text: string }
  | { type: "geminiInsertAudioTag"; tag: string }
  | { type: "qwenEndpointChanged"; endpoint: QwenEndpoint }
  | { type: "qwenLanguageTypeChanged"; languageType: QwenLanguageType }
  | { type: "qwenInstructionsChanged"; text: string }
  | { type: "minimaxRegionChanged"; region: MiniMaxRegion }
  | { type: "minimaxFormatChanged"; format: MiniMaxFormat }
  | { type: "minimaxEmotionChanged"; emotion: MiniMaxEmotion }
  | { type: "minimaxLanguageBoostChanged"; boost: string }
  | { type: "minimaxSpeedChanged"; speed: number }
  | { type: "minimaxVolChanged"; vol: number }
  | { type: "minimaxPitchChanged"; pitch: number };

export type StudioMessageHandler = (msg: IncomingMessage) => void;

export type StatusTone = "info" | "error" | "muted" | "success" | "warn";

export class VoiceStudioViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "aiVoiceStudio.studio";

  private view?: vscode.WebviewView;
  private handler?: StudioMessageHandler;
  private webviewReady = false;
  private readyWaiters: Array<(ready: boolean) => void> = [];

  constructor(private readonly extensionUri: vscode.Uri) {}

  setMessageHandler(handler: StudioMessageHandler): void {
    this.handler = handler;
  }

  isReady(): boolean {
    return this.view !== undefined && this.webviewReady;
  }

  postPlay(
    sessionId: number,
    chunkIndex: number,
    totalChunks: number,
    audioBase64: string,
    format: string,
    playbackRate: number,
    label?: string,
  ): void {
    this.view?.webview.postMessage({
      type: "play",
      sessionId,
      chunkIndex,
      totalChunks,
      audioBase64,
      format,
      playbackRate,
      label,
    });
  }

  postSubChunk(
    sessionId: number,
    audioBase64: string,
    format: string,
    playbackRate: number,
    isLast: boolean,
    label?: string,
  ): void {
    this.view?.webview.postMessage({
      type: "playSubChunk",
      sessionId,
      audioBase64,
      format,
      playbackRate,
      isLast,
      label,
    });
  }

  postChunkBoundary(sessionId: number, chunkIndex: number, totalChunks: number, label: string): void {
    this.view?.webview.postMessage({
      type: "chunkBoundary",
      sessionId,
      chunkIndex,
      totalChunks,
      label,
    });
  }

  postSessionStart(sessionId: number, totalChunks: number): void {
    this.view?.webview.postMessage({ type: "sessionStart", sessionId, totalChunks });
  }

  postSessionEnd(sessionId: number, cancelled: boolean): void {
    this.view?.webview.postMessage({ type: "sessionEnd", sessionId, cancelled });
  }

  postStop(): void {
    this.view?.webview.postMessage({ type: "stop" });
  }

  postStatus(status: string, tone: StatusTone = "info", action?: { label: string; id: string }): void {
    this.view?.webview.postMessage({ type: "status", status, tone, action });
  }

  postConfig(cfg: AppConfig, cloneSample?: MiMoVoiceCloneSampleRecord): void {
    this.view?.webview.postMessage({
      type: "config",
      config: serializeConfig(cfg, cloneSample),
    });
  }

  async reveal(): Promise<void> {
    if (this.view) {
      this.view.show?.(true);
      return;
    }
    await vscode.commands.executeCommand("aiVoiceStudio.studio.focus");
  }

  async waitUntilReady(timeoutMs = 3000): Promise<boolean> {
    if (this.isReady()) return true;
    return new Promise((resolve) => {
      const complete = (ready: boolean): void => {
        clearTimeout(timer);
        const index = this.readyWaiters.indexOf(complete);
        if (index >= 0) this.readyWaiters.splice(index, 1);
        resolve(ready);
      };
      const timer = setTimeout(() => complete(this.isReady()), timeoutMs);
      this.readyWaiters.push(complete);
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    this.webviewReady = false;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: IncomingMessage) => {
      if (!message) return;
      if (message.type === "log") {
        console.log("[aiVoiceStudio webview]", message.payload);
        return;
      }
      if (message.type === "ready") {
        this.markReady();
        this.handler?.(message);
        return;
      }
      if (message.type === "rateChanged") {
        void setPlaybackRate(message.rate).catch((err) => {
          this.postStatus(err instanceof Error ? err.message : String(err), "error");
        });
        return;
      }
      this.handler?.(message);
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
      this.webviewReady = false;
      this.flushReadyWaiters(false);
    });
  }

  private markReady(): void {
    this.webviewReady = true;
    this.flushReadyWaiters(true);
  }

  private flushReadyWaiters(ready: boolean): void {
    const waiters = this.readyWaiters.splice(0);
    for (const resolve of waiters) resolve(ready);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = makeNonce();
    const cfg = getConfig();
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `img-src ${webview.cspSource} data:`,
      `media-src ${webview.cspSource} data: blob:`,
    ].join("; ");

    const initialConfigJson = JSON.stringify(serializeConfig(cfg));
    const catalogsJson = JSON.stringify(serializeCatalogs());
    const styleGroupsJson = JSON.stringify(STYLE_TAG_GROUPS);
    const eventGroupsJson = JSON.stringify(AUDIO_EVENT_GROUPS);
    const directorTemplate = JSON.stringify(DIRECTOR_TEMPLATE);
    const voiceDesignTemplate = JSON.stringify(VOICE_DESIGN_TEMPLATE);
    const designPlaceholder = JSON.stringify(VOICE_DESIGN_PLACEHOLDER);
    const clonePlaceholder = JSON.stringify(VOICE_CLONE_PLACEHOLDER);
    const geminiAudioTagsJson = JSON.stringify(GEMINI_AUDIO_TAGS);
    const qwenLanguageTypesJson = JSON.stringify(QWEN_LANGUAGE_TYPES);
    const providerGlyphsJson = JSON.stringify({
      mimo: "✿",
      minimax: "✦",
      gemini: "✧",
      qwen: "❀",
    } satisfies Record<ProviderId, string>);
    const minimaxEmotionsJson = JSON.stringify(MINIMAX_EMOTION_OPTIONS);
    const minimaxLanguageBoostsJson = JSON.stringify(MINIMAX_LANGUAGE_BOOSTS);
    const minimaxSpeechTagsJson = JSON.stringify(MINIMAX_SPEECH_TAGS);
    const minimaxTagCapableJson = JSON.stringify(MINIMAX_TAG_CAPABLE_MODELS);

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
      --gap: 8px;
      --gap-sm: 4px;
      --radius: 4px;
      --radius-pill: 999px;
      --border: var(--vscode-dropdown-border, var(--vscode-widget-border, rgba(128,128,128,0.3)));
      --tone-info: var(--vscode-charts-blue, var(--vscode-focusBorder, #0098ff));
      --tone-success: var(--vscode-charts-green, #4caf50);
      --tone-warn: var(--vscode-charts-orange, #f5a623);
      --tone-error: var(--vscode-errorForeground, #f48771);
      --tone-muted: var(--vscode-descriptionForeground, rgba(204,204,204,0.7));
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: transparent;
      line-height: 1.45;
    }

    /* ---------- header ---------- */
    .topbar {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
    }
    .topbar h1 {
      margin: 0;
      font-size: 1em;
      font-weight: 600;
      letter-spacing: 0.2px;
    }
    .topbar .spacer { flex: 1; }
    .topbar .key-btn {
      font-size: 0.92em;
      font-weight: 600;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: none;
      border-radius: var(--radius);
      padding: 4px 12px;
      cursor: pointer;
      white-space: nowrap;
    }
    .topbar .key-btn:hover { background: var(--vscode-button-hoverBackground); }

    .provider-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
      margin-bottom: 10px;
    }
    .provider-strip button {
      padding: 6px 4px;
      font-size: 0.85em;
      font-weight: 500;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: transparent;
      color: var(--vscode-foreground);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      line-height: 1.1;
    }
    .provider-strip button .glyph {
      font-size: 1.05em;
      opacity: 0.85;
    }
    .provider-strip button[data-active="true"] {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
    }
    .provider-strip button:not([data-active="true"]):hover {
      background: var(--vscode-list-hoverBackground);
    }

    /* ---------- generic rows / inputs ---------- */
    .row { display: flex; align-items: center; gap: var(--gap); margin: 6px 0; }
    .row.stack { align-items: stretch; flex-direction: column; gap: var(--gap-sm); }
    label {
      flex: 0 0 60px;
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }
    .row.stack > label { flex: 0 0 auto; }
    select, input[type="text"], input[type="number"], input[type="range"], textarea, button {
      font-family: inherit;
      font-size: inherit;
    }
    select, input[type="text"], input[type="number"] {
      flex: 1;
      padding: 3px 6px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--border);
      border-radius: 2px;
      min-width: 0;
    }
    input[type="range"] { flex: 1; accent-color: var(--vscode-button-background); }
    .rate-value {
      flex: 0 0 42px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: var(--vscode-descriptionForeground);
    }
    textarea {
      width: 100%;
      box-sizing: border-box;
      min-height: 96px;
      resize: vertical;
      padding: 6px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--border));
      border-radius: 2px;
      margin: 4px 0;
    }
    textarea.compact { min-height: 56px; }
    textarea.tight { min-height: 48px; }
    .button-row { display: flex; gap: 6px; }
    button {
      padding: 5px 10px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 2px;
      cursor: pointer;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button.tiny { padding: 2px 6px; font-size: 0.82em; flex: 0 0 auto; line-height: 1.2; }
    button.icon {
      flex: 0 0 auto;
      padding: 3px 8px;
      font-variant-emoji: text;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ---------- collapsible sections (details cards) ---------- */
    details.card {
      margin: 8px 0;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 0 8px;
      background: var(--vscode-textBlockQuote-background, transparent);
    }
    details.card[open] { padding-bottom: 8px; }
    details.card > summary {
      cursor: pointer;
      padding: 6px 0;
      font-size: 0.88em;
      font-weight: 500;
      color: var(--vscode-foreground);
      list-style: none;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    details.card > summary::-webkit-details-marker { display: none; }
    details.card > summary::before {
      content: "▸";
      font-size: 0.7em;
      opacity: 0.8;
    }
    details.card[open] > summary::before { content: "▾"; }
    details.card > summary .meta {
      margin-left: auto;
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
      font-weight: normal;
    }

    /* ---------- tag chips ---------- */
    details.tag-group {
      margin: 4px 0;
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 0 6px;
      background: var(--vscode-textBlockQuote-background, transparent);
    }
    details.tag-group[open] { padding-bottom: 6px; }
    details.tag-group > summary {
      cursor: pointer;
      padding: 4px 0;
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      list-style: none;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    details.tag-group > summary::-webkit-details-marker { display: none; }
    details.tag-group > summary::before {
      content: "▸";
      font-size: 0.7em;
      transition: transform 120ms ease;
    }
    details.tag-group[open] > summary::before { content: "▾"; }
    details.tag-group .group-count {
      margin-left: auto;
      font-size: 0.78em;
      opacity: 0.7;
      font-variant-numeric: tabular-nums;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 2px 0;
    }
    .chip {
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border);
      background: transparent;
      color: var(--vscode-foreground);
      font-size: 0.85em;
      cursor: pointer;
      flex: 0 0 auto;
    }
    .chip[data-active="true"] {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
    }
    .chip.custom { font-style: italic; }
    .chip.custom::after {
      content: " ✕";
      opacity: 0.6;
      margin-left: 2px;
    }
    .chip.audio-tag {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.82em;
    }
    .custom-tag-row {
      display: flex;
      gap: 4px;
      margin-top: 4px;
    }
    .custom-tag-row input[type="text"] { flex: 1; }
    .group-hint {
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
      opacity: 0.85;
      margin: 2px 0 4px;
    }

    /* ---------- voice clone uploader panel ---------- */
    .panel {
      margin: 6px 0;
      padding: 8px;
      border: 1px dashed var(--border);
      border-radius: 3px;
      background: var(--vscode-textBlockQuote-background, transparent);
    }
    .panel-title {
      font-size: 0.86em;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .panel-hint {
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
    }
    .clone-status {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      margin: 4px 0;
    }
    .clone-status[data-loaded="true"] { color: var(--vscode-foreground); }

    /* ---------- composer ---------- */
    .composer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
    }
    .composer textarea {
      min-height: 110px;
    }
    .primary-row {
      display: flex;
      gap: 6px;
      margin-top: 6px;
    }
    .primary-row .primary-btn {
      flex: 1;
      padding: 8px 10px;
      font-weight: 500;
      letter-spacing: 0.2px;
    }
    .primary-row .primary-btn[data-state="synth"] {
      background: var(--vscode-button-background);
      cursor: progress;
    }
    .primary-row .primary-btn[data-state="paused"] {
      background: var(--vscode-charts-orange, var(--vscode-button-background));
    }

    .progress {
      margin-top: 8px;
      display: none;
      align-items: center;
      gap: 8px;
    }
    .progress[data-show="true"] { display: flex; }
    .progress-bar {
      flex: 1;
      height: 4px;
      background: var(--vscode-progressBar-background, var(--border));
      border-radius: 2px;
      overflow: hidden;
      opacity: 0.6;
    }
    .progress-bar-fill {
      height: 100%;
      width: 0%;
      background: var(--vscode-button-background);
      transition: width 180ms ease;
    }
    .progress-text {
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
      font-variant-numeric: tabular-nums;
      flex: 0 0 auto;
    }

    /* ---------- semantic status ---------- */
    .status {
      margin-top: 10px;
      padding: 6px 8px;
      font-size: 0.86em;
      color: var(--vscode-foreground);
      background: var(--vscode-textBlockQuote-background, transparent);
      border-left: 3px solid var(--tone-muted);
      border-radius: 2px;
      min-height: 1.4em;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .status[data-tone="info"]    { border-left-color: var(--tone-info); }
    .status[data-tone="success"] { border-left-color: var(--tone-success); }
    .status[data-tone="warn"]    { border-left-color: var(--tone-warn); }
    .status[data-tone="error"]   { border-left-color: var(--tone-error); color: var(--tone-error); }
    .status[data-tone="muted"]   { border-left-color: var(--tone-muted); color: var(--vscode-descriptionForeground); }
    .status .dot {
      display: inline-block;
      width: 6px; height: 6px;
      border-radius: 50%;
      margin-right: 6px;
      vertical-align: 1px;
      background: currentColor;
      opacity: 0.8;
    }
    .status-action { margin-top: 6px; }
    .status-action button {
      padding: 3px 10px;
      font-size: 0.85em;
      flex: 0 0 auto;
    }

    .footer-hint {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
      font-size: 0.78em;
      color: var(--vscode-descriptionForeground);
      opacity: 0.85;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .footer-hint kbd {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.92em;
      padding: 0 4px;
      border: 1px solid var(--border);
      border-radius: 3px;
      background: var(--vscode-textCodeBlock-background, transparent);
    }
    code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
    }
    audio { display: none; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <!-- Header & provider strip -->
  <div class="topbar">
    <h1>AI Voice Studio</h1>
    <span class="spacer"></span>
    <button id="setKeyLink" class="key-btn" title="Set the API key for the active provider">Set API Key</button>
  </div>
  <div class="provider-strip" id="providerStrip" role="tablist"></div>

  <!-- Voice & model -->
  <div class="row">
    <label for="model">Model</label>
    <select id="model"></select>
  </div>
  <div class="row" id="voiceRow">
    <label for="voice">Voice</label>
    <select id="voice"></select>
    <button id="testVoiceBtn" class="secondary tiny icon" title="Read a short sample with the current voice">▶</button>
  </div>

  <!-- Voice settings (per-provider, collapsible) -->
  <details class="card" id="voiceSettings" open>
    <summary>Voice character <span class="meta" id="voiceSettingsMeta"></span></summary>
    <div id="voiceSettingsBody">
      <!-- MiMo block — voice clone uploader (clonemode only) -->
      <div class="panel hidden" id="clonePanel">
        <div class="panel-title">Voice clone sample</div>
        <div class="panel-hint">Upload a clean mp3 / wav clip (≤10 MB after base64). The voice is cloned per request.</div>
        <div class="button-row">
          <button id="cloneUploadBtn" class="secondary tiny">Choose audio file…</button>
          <button id="cloneClearBtn" class="secondary tiny">Clear</button>
        </div>
        <input id="cloneFileInput" type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,.mp3,.wav" class="hidden" />
        <div class="clone-status" id="cloneStatus" data-loaded="false">No sample uploaded.</div>
      </div>

      <!-- MiMo block — style prompt + templates -->
      <div class="row stack hidden" id="stylePromptRow">
        <label id="stylePromptLabel" for="stylePrompt">Style</label>
        <textarea id="stylePrompt" class="compact" placeholder="Describe tone, pacing, emotion. Empty = neutral."></textarea>
        <div class="button-row">
          <button id="insertDirectorBtn" class="secondary tiny">Insert Director Mode template</button>
          <button id="insertVoiceDesignBtn" class="secondary tiny hidden">Insert Voice Design template</button>
        </div>
      </div>

      <!-- MiMo block — opening style tags -->
      <div class="row stack hidden" id="styleGroupsRow">
        <label>Style tags</label>
        <div class="group-hint">Injected as <code>(tag)</code> at the start of each chunk. Custom tags work too.</div>
        <div id="styleGroups"></div>
      </div>

      <!-- MiMo block — audio event tags -->
      <div class="row stack hidden" id="eventGroupsRow">
        <label>Sound tags</label>
        <div class="group-hint">Injected as <code>（紧张，深呼吸）</code> in front of the text.</div>
        <div id="eventGroups"></div>
      </div>

      <!-- MiMo block — preset library -->
      <div class="row stack hidden" id="presetRow">
        <label>Preset</label>
        <div class="button-row">
          <select id="presetSelect"></select>
          <button id="presetApplyBtn" class="secondary tiny">Apply</button>
          <button id="presetSaveBtn" class="secondary tiny">Save…</button>
          <button id="presetDeleteBtn" class="secondary tiny">Delete</button>
        </div>
      </div>

      <!-- Gemini block -->
      <div class="hidden" id="geminiBlock">
        <div class="row stack">
          <label for="geminiPreamble">Style preamble</label>
          <textarea id="geminiPreamble" class="tight" placeholder="Optional natural-language direction — e.g. 'Read in a warm, slow narrator voice'. Auto-prefixed before each chunk."></textarea>
        </div>
        <div class="row stack">
          <label>Audio tags</label>
          <div class="group-hint">Click to insert at the cursor in the transcript. English bracketed cues work best.</div>
          <div id="geminiAudioTags" class="chips"></div>
        </div>
      </div>

      <!-- Qwen block -->
      <div class="hidden" id="qwenBlock">
        <div class="row">
          <label for="qwenEndpoint">Endpoint</label>
          <select id="qwenEndpoint">
            <option value="china">China — dashscope.aliyuncs.com</option>
            <option value="international">International — dashscope-intl.aliyuncs.com</option>
          </select>
        </div>
        <div class="row">
          <label for="qwenLanguageType">Language</label>
          <select id="qwenLanguageType"></select>
        </div>
        <div class="row stack" id="qwenInstructionsRow">
          <label for="qwenInstructions">Instructions</label>
          <textarea id="qwenInstructions" class="compact" placeholder="Only sent with qwen3-tts-instruct-flash."></textarea>
        </div>
      </div>

      <!-- MiniMax block -->
      <div class="hidden" id="minimaxBlock">
        <div class="row">
          <label for="minimaxRegion">Region</label>
          <select id="minimaxRegion">
            <option value="mainland">Mainland — api.minimaxi.com</option>
            <option value="global">Global — api.minimax.io</option>
          </select>
        </div>
        <div class="row">
          <label for="minimaxFormat">Format</label>
          <select id="minimaxFormat">
            <option value="mp3">mp3</option>
            <option value="wav">wav</option>
            <option value="pcm">pcm</option>
          </select>
        </div>
        <div class="row">
          <label for="minimaxEmotion">Emotion</label>
          <select id="minimaxEmotion"></select>
        </div>
        <div class="row">
          <label for="minimaxLanguageBoost">Lang boost</label>
          <select id="minimaxLanguageBoost"></select>
        </div>
        <div class="row">
          <label>Speed</label>
          <input id="minimaxSpeed" type="number" min="0.5" max="2" step="0.05" />
          <label style="flex: 0 0 32px; text-align: right;">Vol</label>
          <input id="minimaxVol" type="number" min="0" max="10" step="0.1" />
          <label style="flex: 0 0 36px; text-align: right;">Pitch</label>
          <input id="minimaxPitch" type="number" min="-12" max="12" step="1" />
        </div>
        <div class="row stack hidden" id="minimaxSpeechTagRow">
          <label>语气词</label>
          <div class="group-hint">Click to insert at the cursor — only the speech-2.8 family supports them.</div>
          <div id="minimaxSpeechTags" class="chips"></div>
        </div>
      </div>
    </div>
  </details>

  <!-- Composer -->
  <div class="composer">
    <div class="row">
      <label for="rate">Speed</label>
      <input id="rate" type="range" min="0.5" max="4" step="0.05" />
      <span class="rate-value" id="rateValue"></span>
    </div>

    <textarea id="text" placeholder="Type or paste text, or use ⌘⌥R / Ctrl+Alt+R on a selection in the editor."></textarea>

    <div class="primary-row">
      <button id="primary" class="primary-btn">▶ Read</button>
      <button id="stop" class="secondary">⏹ Stop</button>
    </div>

    <div class="progress" id="progress" data-show="false">
      <div class="progress-bar"><div class="progress-bar-fill" id="progressFill"></div></div>
      <span class="progress-text" id="progressText">0 / 0</span>
    </div>

    <div class="status" id="status" data-tone="muted"><span class="dot"></span><span id="statusText">Idle.</span></div>
    <div class="status-action hidden" id="statusAction">
      <button id="statusActionBtn" class="secondary"></button>
    </div>
  </div>

  <div class="footer-hint">
    <span><kbd>⌘⌥R</kbd> / <kbd>Ctrl+Alt+R</kbd> — read selection or clipboard</span>
    <span><kbd>⌘⌥S</kbd> / <kbd>Ctrl+Alt+S</kbd> — stop</span>
  </div>

  <audio id="player"></audio>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const CATALOGS = ${catalogsJson};
      const STYLE_GROUPS = ${styleGroupsJson};
      const EVENT_GROUPS = ${eventGroupsJson};
      const DIRECTOR_TEMPLATE = ${directorTemplate};
      const VOICE_DESIGN_TEMPLATE = ${voiceDesignTemplate};
      const VOICE_DESIGN_PLACEHOLDER = ${designPlaceholder};
      const VOICE_CLONE_PLACEHOLDER = ${clonePlaceholder};
      const GEMINI_AUDIO_TAGS = ${geminiAudioTagsJson};
      const QWEN_LANGUAGE_TYPES = ${qwenLanguageTypesJson};
      const MINIMAX_EMOTIONS = ${minimaxEmotionsJson};
      const MINIMAX_LANGUAGE_BOOSTS = ${minimaxLanguageBoostsJson};
      const MINIMAX_SPEECH_TAGS = ${minimaxSpeechTagsJson};
      const MINIMAX_TAG_CAPABLE = new Set(${minimaxTagCapableJson});
      const PROVIDER_GLYPHS = ${providerGlyphsJson};
      const TEST_PHRASES = {
        Chinese: "你好，这是您选择的语音。",
        English: "Hello, this is your selected voice.",
        German: "Hallo, dies ist Ihre ausgewählte Stimme.",
        Auto: "Hello, this is your selected voice.",
      };
      function pickTestPhrase() {
        if (state.provider === "qwen") {
          const lang = (state.qwen && state.qwen.languageType) || "Auto";
          return TEST_PHRASES[lang] || TEST_PHRASES.Auto;
        }
        return TEST_PHRASES.English;
      }
      const MAX_CLONE_BASE64 = 10 * 1024 * 1024;

      let state = ${initialConfigJson};
      let mode = "idle"; // idle | playing | paused | synth
      let activeSession = null;
      let sessionDone = false;
      let chunksPlayed = 0;
      let currentlyPlaying = null;
      let playGeneration = 0;
      let pendingAction = null;
      const queue = [];

      // ---------- WebAudio seamless PCM streaming ----------
      // SSE delivers many small PCM segments back-to-back; using <audio> per
      // segment leaves audible 50–100 ms gaps. The WebAudio path schedules
      // each segment on a shared AudioContext timeline so adjacent segments
      // butt up against each other sample-accurately.
      let audioCtx = null;
      let pcmNextStartTime = 0;
      const pcmActiveSources = new Set();
      function ensureAudioContext() {
        if (!audioCtx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          audioCtx = new Ctx({ sampleRate: 24000 });
        }
        if (audioCtx.state === "suspended" && mode !== "paused") {
          audioCtx.resume().catch(() => {});
        }
        return audioCtx;
      }
      function decodePcm16ToAudioBuffer(ctx, base64) {
        const binary = atob(base64);
        const sampleCount = (binary.length / 2) | 0;
        const buffer = ctx.createBuffer(1, sampleCount, 24000);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i++) {
          const lo = binary.charCodeAt(2 * i);
          const hi = binary.charCodeAt(2 * i + 1);
          let sample = (hi << 8) | lo;
          if (sample >= 0x8000) sample -= 0x10000;
          data[i] = sample / 32768;
        }
        return buffer;
      }
      function enqueuePcmSubChunk(msg) {
        const ctx = ensureAudioContext();
        const audioBuffer = decodePcm16ToAudioBuffer(ctx, msg.audioBase64);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        const rate = Number.isFinite(state.playbackRate) ? state.playbackRate : 1;
        source.playbackRate.value = Math.max(0.5, Math.min(4, rate));
        source.connect(ctx.destination);

        const startAt = Math.max(ctx.currentTime + 0.005, pcmNextStartTime);
        try {
          source.start(startAt);
        } catch (err) {
          // start() throws if ctx is closed or in an inconsistent state — drop.
          source.disconnect();
          return;
        }
        const effectiveDuration = audioBuffer.duration / source.playbackRate.value;
        pcmNextStartTime = startAt + effectiveDuration;
        pcmActiveSources.add(source);
        source.onended = () => {
          pcmActiveSources.delete(source);
          if (!activeSession) return;
          if (msg.isLast) {
            chunksPlayed += 1;
            setProgress(chunksPlayed, activeSession.total);
            if (sessionDone && pcmActiveSources.size === 0) {
              setMode("idle");
              setStatus("Done.", "success");
              activeSession = null;
            }
          }
        };

        if (mode === "synth") {
          setMode("playing");
          setStatus(msg.label ? "Playing — " + msg.label : "Playing.", "info");
        }
      }
      function tearDownPcmStream() {
        for (const src of pcmActiveSources) {
          try {
            src.onended = null;
            src.stop();
            src.disconnect();
          } catch (_) {
            // ignore
          }
        }
        pcmActiveSources.clear();
        pcmNextStartTime = 0;
        if (audioCtx && audioCtx.state === "running") {
          audioCtx.suspend().catch(() => {});
        }
      }

      const els = {
        providerStrip:      document.getElementById("providerStrip"),
        setKeyLink:         document.getElementById("setKeyLink"),
        model:              document.getElementById("model"),
        voiceRow:           document.getElementById("voiceRow"),
        voice:              document.getElementById("voice"),
        testVoiceBtn:       document.getElementById("testVoiceBtn"),
        voiceSettings:      document.getElementById("voiceSettings"),
        voiceSettingsMeta:  document.getElementById("voiceSettingsMeta"),
        clonePanel:         document.getElementById("clonePanel"),
        cloneUploadBtn:     document.getElementById("cloneUploadBtn"),
        cloneClearBtn:      document.getElementById("cloneClearBtn"),
        cloneFileInput:     document.getElementById("cloneFileInput"),
        cloneStatus:        document.getElementById("cloneStatus"),
        stylePromptRow:     document.getElementById("stylePromptRow"),
        stylePromptLabel:   document.getElementById("stylePromptLabel"),
        stylePrompt:        document.getElementById("stylePrompt"),
        insertDirectorBtn:  document.getElementById("insertDirectorBtn"),
        insertVoiceDesignBtn: document.getElementById("insertVoiceDesignBtn"),
        styleGroupsRow:     document.getElementById("styleGroupsRow"),
        styleGroups:        document.getElementById("styleGroups"),
        eventGroupsRow:     document.getElementById("eventGroupsRow"),
        eventGroups:        document.getElementById("eventGroups"),
        presetRow:          document.getElementById("presetRow"),
        presetSelect:       document.getElementById("presetSelect"),
        presetApplyBtn:     document.getElementById("presetApplyBtn"),
        presetSaveBtn:      document.getElementById("presetSaveBtn"),
        presetDeleteBtn:    document.getElementById("presetDeleteBtn"),
        geminiBlock:        document.getElementById("geminiBlock"),
        geminiPreamble:     document.getElementById("geminiPreamble"),
        geminiAudioTags:    document.getElementById("geminiAudioTags"),
        qwenBlock:          document.getElementById("qwenBlock"),
        qwenEndpoint:       document.getElementById("qwenEndpoint"),
        qwenLanguageType:   document.getElementById("qwenLanguageType"),
        qwenInstructionsRow: document.getElementById("qwenInstructionsRow"),
        qwenInstructions:   document.getElementById("qwenInstructions"),
        minimaxBlock:       document.getElementById("minimaxBlock"),
        minimaxRegion:      document.getElementById("minimaxRegion"),
        minimaxFormat:      document.getElementById("minimaxFormat"),
        minimaxEmotion:     document.getElementById("minimaxEmotion"),
        minimaxLanguageBoost: document.getElementById("minimaxLanguageBoost"),
        minimaxSpeed:       document.getElementById("minimaxSpeed"),
        minimaxVol:         document.getElementById("minimaxVol"),
        minimaxPitch:       document.getElementById("minimaxPitch"),
        minimaxSpeechTagRow: document.getElementById("minimaxSpeechTagRow"),
        minimaxSpeechTags:  document.getElementById("minimaxSpeechTags"),
        rate:               document.getElementById("rate"),
        rateValue:          document.getElementById("rateValue"),
        text:               document.getElementById("text"),
        primary:            document.getElementById("primary"),
        stop:               document.getElementById("stop"),
        progress:           document.getElementById("progress"),
        progressFill:       document.getElementById("progressFill"),
        progressText:       document.getElementById("progressText"),
        status:             document.getElementById("status"),
        statusText:         document.getElementById("statusText"),
        statusAction:       document.getElementById("statusAction"),
        statusActionBtn:    document.getElementById("statusActionBtn"),
        player:             document.getElementById("player"),
      };

      // ---------- helpers ----------

      function setStatus(msg, tone, action) {
        const safeTone = (tone || "info");
        els.statusText.textContent = msg;
        els.status.dataset.tone = safeTone;
        if (action && action.label && action.id) {
          pendingAction = action;
          els.statusActionBtn.textContent = action.label;
          els.statusAction.classList.remove("hidden");
        } else {
          pendingAction = null;
          els.statusAction.classList.add("hidden");
        }
      }

      function setMode(next) {
        mode = next;
        els.primary.dataset.state = mode;
        if (mode === "playing") {
          els.primary.textContent = "⏸ Pause";
        } else if (mode === "paused") {
          els.primary.textContent = "▶ Resume";
        } else if (mode === "synth") {
          els.primary.textContent = "⌛ Synthesizing…";
        } else {
          els.primary.textContent = "▶ Read";
        }
        els.primary.disabled = mode === "synth";
      }

      function setProgress(played, total) {
        if (!total || total <= 0) {
          els.progress.dataset.show = "false";
          els.progressFill.style.width = "0%";
          els.progressText.textContent = "0 / 0";
          return;
        }
        const pct = Math.max(0, Math.min(1, played / total));
        els.progress.dataset.show = "true";
        els.progressFill.style.width = (pct * 100).toFixed(1) + "%";
        els.progressText.textContent = played + " / " + total;
      }

      function resetSession() {
        playGeneration += 1;
        queue.length = 0;
        activeSession = null;
        sessionDone = false;
        chunksPlayed = 0;
        currentlyPlaying = null;
        setProgress(0, 0);
        els.player.pause();
        els.player.removeAttribute("src");
        els.player.load();
        tearDownPcmStream();
      }

      function failActivePlayback(message) {
        const shouldNotifyExtension = !!activeSession;
        resetSession();
        setMode("idle");
        setStatus(message, "error");
        if (shouldNotifyExtension) {
          vscode.postMessage({ type: "requestStop" });
        }
      }

      function activeCatalog() {
        return CATALOGS.find((p) => p.id === state.provider) || CATALOGS[0];
      }
      function activeProviderState() { return state[state.provider] || {}; }
      function isMimo()     { return state.provider === "mimo"; }
      function isMiniMax()  { return state.provider === "minimax"; }
      function isGemini()   { return state.provider === "gemini"; }
      function isQwen()     { return state.provider === "qwen"; }
      function mimoModel()  { return (state.mimo && state.mimo.model) || ""; }
      function isVoiceDesign() { return isMimo() && mimoModel() === "mimo-v2.5-tts-voicedesign"; }
      function isVoiceClone()  { return isMimo() && mimoModel() === "mimo-v2.5-tts-voiceclone"; }

      function formatBytes(n) {
        if (!n) return "0 B";
        if (n < 1024) return n + " B";
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
        return (n / 1024 / 1024).toFixed(2) + " MB";
      }

      function audioMime(format) {
        if (format === "mp3") return "audio/mpeg";
        if (format === "aac") return "audio/aac";
        if (format === "flac") return "audio/flac";
        if (format === "opus") return "audio/ogg";
        if (format === "pcm") return "audio/wav";
        return "audio/" + format;
      }

      function wrapPcmAsWav(base64pcm) {
        const raw = Uint8Array.from(atob(base64pcm), (c) => c.charCodeAt(0));
        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        function writeStr(offset, str) { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }
        writeStr(0, "RIFF");
        view.setUint32(4, 36 + raw.length, true);
        writeStr(8, "WAVE");
        writeStr(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeStr(36, "data");
        view.setUint32(40, raw.length, true);
        const wav = new Uint8Array(44 + raw.length);
        wav.set(new Uint8Array(header), 0);
        wav.set(raw, 44);
        let bin = "";
        for (let i = 0; i < wav.length; i++) bin += String.fromCharCode(wav[i]);
        return btoa(bin);
      }

      function activeVoiceLabel() {
        const cat = activeCatalog();
        const v = (cat.voices || []).find((v) => v.id === activeProviderState().voice);
        return v ? v.name : (activeProviderState().voice || "—");
      }

      function voicesForModel(catalog, model) {
        return (catalog.voices || []).filter((v) => !v.models || v.models.length === 0 || v.models.indexOf(model) !== -1);
      }

      function ensureActiveVoiceForModel() {
        const catalog = activeCatalog();
        const ps = activeProviderState();
        const voices = voicesForModel(catalog, ps.model);
        if (voices.length === 0) return undefined;
        const current = voices.find((v) => v.id === ps.voice);
        if (current) return current.id;
        ps.voice = voices[0].id;
        return ps.voice;
      }

      // ---------- core renderers ----------

      function renderProviderStrip() {
        els.providerStrip.innerHTML = "";
        for (const p of CATALOGS) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.dataset.providerId = p.id;
          btn.dataset.active = p.id === state.provider ? "true" : "false";
          btn.title = p.label;
          const glyph = document.createElement("span");
          glyph.className = "glyph";
          glyph.textContent = PROVIDER_GLYPHS[p.id] || "•";
          const label = document.createElement("span");
          label.textContent = p.label;
          btn.appendChild(glyph);
          btn.appendChild(label);
          btn.addEventListener("click", () => {
            if (p.id === state.provider) return;
            state.provider = p.id;
            renderAll();
            vscode.postMessage({ type: "providerChanged", provider: p.id });
          });
          els.providerStrip.appendChild(btn);
        }
      }

      function renderModelOptions() {
        const catalog = activeCatalog();
        els.model.innerHTML = "";
        for (const m of catalog.models) {
          const opt = document.createElement("option");
          opt.value = m.id;
          opt.textContent = m.label;
          if (m.description) opt.title = m.description;
          if (m.id === activeProviderState().model) opt.selected = true;
          els.model.appendChild(opt);
        }
      }

      function renderVoiceOptions() {
        const catalog = activeCatalog();
        const model = activeProviderState().model;
        els.voice.innerHTML = "";
        const voices = voicesForModel(catalog, model);
        const groups = new Map();
        for (const v of voices) {
          const cat = v.category || "Voices";
          if (!groups.has(cat)) groups.set(cat, []);
          groups.get(cat).push(v);
        }
        for (const [groupName, members] of groups) {
          const useGroup = groups.size > 1;
          const container = useGroup ? document.createElement("optgroup") : els.voice;
          if (useGroup) container.label = groupName;
          for (const v of members) {
            const opt = document.createElement("option");
            opt.value = v.id;
            const star = v.recommended ? " ★" : "";
            opt.textContent = useGroup ? v.name + star : v.name + star + " — " + groupName;
            if (v.id === activeProviderState().voice) opt.selected = true;
            container.appendChild(opt);
          }
          if (useGroup) els.voice.appendChild(container);
        }
      }

      function renderProviderBlocks() {
        // Toggle the per-provider blocks first, then their inner controls.
        els.geminiBlock.classList.toggle("hidden",   !isGemini());
        els.qwenBlock.classList.toggle("hidden",     !isQwen());
        els.minimaxBlock.classList.toggle("hidden",  !isMiniMax());

        const showMimo = isMimo();
        els.styleGroupsRow.classList.toggle("hidden", !showMimo);
        els.eventGroupsRow.classList.toggle("hidden", !showMimo);
        els.presetRow.classList.toggle("hidden",       !showMimo);
        els.stylePromptRow.classList.toggle("hidden",  !showMimo);

        // Voice row — hide for voicedesign so the synthetic placeholder doesn't clutter.
        els.voiceRow.classList.toggle("hidden", isVoiceDesign());
        els.clonePanel.classList.toggle("hidden", !isVoiceClone());

        // Style prompt label / placeholder swap based on MiMo sub-mode.
        if (isVoiceDesign()) {
          els.stylePromptLabel.textContent = "Voice";
          els.stylePrompt.placeholder = "Describe the target voice — gender/age, timbre, emotion, pace. Required.";
          els.insertVoiceDesignBtn.classList.remove("hidden");
          els.insertDirectorBtn.classList.add("hidden");
        } else if (isVoiceClone()) {
          els.stylePromptLabel.textContent = "Style";
          els.stylePrompt.placeholder = "Optional — extra direction for the cloned voice.";
          els.insertVoiceDesignBtn.classList.add("hidden");
          els.insertDirectorBtn.classList.remove("hidden");
        } else {
          els.stylePromptLabel.textContent = "Style";
          els.stylePrompt.placeholder = "Describe tone, pacing, emotion. Empty = neutral.";
          els.insertVoiceDesignBtn.classList.add("hidden");
          els.insertDirectorBtn.classList.remove("hidden");
        }

        if (showMimo) {
          const newPrompt = (state.mimo && state.mimo.stylePrompt) || "";
          if (els.stylePrompt.value !== newPrompt) els.stylePrompt.value = newPrompt;
          renderCloneStatus();
          renderTagGroups();
          renderPresetSelect();
        }
        if (isGemini()) {
          const newPreamble = (state.gemini && state.gemini.stylePreamble) || "";
          if (els.geminiPreamble.value !== newPreamble) els.geminiPreamble.value = newPreamble;
          renderGeminiAudioTags();
        }
        if (isMiniMax()) {
          renderMiniMaxBlock();
        }
        if (isQwen()) {
          const qs = state.qwen || {};
          if (els.qwenLanguageType.options.length === 0) {
            for (const lt of QWEN_LANGUAGE_TYPES) {
              const o = document.createElement("option");
              o.value = lt.id;
              o.textContent = lt.label;
              els.qwenLanguageType.appendChild(o);
            }
          }
          if (els.qwenEndpoint.value !== (qs.endpoint || "china")) {
            els.qwenEndpoint.value = qs.endpoint || "china";
          }
          if (els.qwenLanguageType.value !== (qs.languageType || "Auto")) {
            els.qwenLanguageType.value = qs.languageType || "Auto";
          }
          const showQwenInstr = qs.model === "qwen3-tts-instruct-flash";
          els.qwenInstructionsRow.classList.toggle("hidden", !showQwenInstr);
          // Preserve in-progress typing when an external config refresh arrives.
          const qwenFocused = document.activeElement === els.qwenInstructions;
          const newQwenInstr = qs.instructions || "";
          if (!qwenFocused && els.qwenInstructions.value !== newQwenInstr) {
            els.qwenInstructions.value = newQwenInstr;
          }
        }

        renderVoiceSettingsMeta();
      }

      function renderVoiceSettingsMeta() {
        const cat = activeCatalog();
        const modelLabel = (cat.models.find((m) => m.id === activeProviderState().model) || {}).label || activeProviderState().model || "—";
        els.voiceSettingsMeta.textContent = activeVoiceLabel() + " · " + modelLabel;
      }

      function renderCloneStatus() {
        const s = state.mimo && state.mimo.voiceCloneSample;
        if (!s) {
          els.cloneStatus.dataset.loaded = "false";
          els.cloneStatus.textContent = "No sample uploaded.";
        } else {
          els.cloneStatus.dataset.loaded = "true";
          els.cloneStatus.textContent =
            s.fileName + " — " + s.mime + " · " + formatBytes(s.sizeBytes);
        }
      }

      function renderTagGroups() {
        renderGroupContainer(
          els.styleGroups,
          STYLE_GROUPS,
          (state.mimo && state.mimo.openingStyleTags) || [],
          toggleStyleTag,
          submitCustomStyleTag,
        );
        renderGroupContainer(
          els.eventGroups,
          EVENT_GROUPS,
          (state.mimo && state.mimo.audioEventTags) || [],
          toggleEventTag,
          submitCustomEventTag,
        );
      }

      function renderGroupContainer(container, groups, activeIds, onToggle, onCustom) {
        const active = new Set(activeIds);
        const presetIds = new Set();
        for (const g of groups) for (const t of g.tags) presetIds.add(t.id);
        const customActive = activeIds.filter((id) => !presetIds.has(id));

        container.innerHTML = "";

        // Custom tags pinned at the top.
        if (customActive.length > 0) {
          const customDetails = document.createElement("details");
          customDetails.className = "tag-group";
          customDetails.open = true;
          const summary = document.createElement("summary");
          const title = document.createElement("span");
          title.textContent = "自定义";
          summary.appendChild(title);
          const count = document.createElement("span");
          count.className = "group-count";
          count.textContent = "" + customActive.length;
          summary.appendChild(count);
          customDetails.appendChild(summary);

          const chipBox = document.createElement("div");
          chipBox.className = "chips";
          for (const id of customActive) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "chip custom";
            chip.dataset.active = "true";
            chip.textContent = id;
            chip.title = "Click to remove";
            chip.addEventListener("click", () => onToggle(id));
            chipBox.appendChild(chip);
          }
          customDetails.appendChild(chipBox);
          container.appendChild(customDetails);
        }

        for (const group of groups) {
          const details = document.createElement("details");
          details.className = "tag-group";
          const activeInGroup = group.tags.filter((t) => active.has(t.id)).length;
          if (activeInGroup > 0) details.open = true;

          const summary = document.createElement("summary");
          const title = document.createElement("span");
          title.textContent = group.label;
          summary.appendChild(title);
          if (group.description) summary.title = group.description;
          const count = document.createElement("span");
          count.className = "group-count";
          count.textContent = activeInGroup > 0 ? activeInGroup + " / " + group.tags.length : "" + group.tags.length;
          summary.appendChild(count);
          details.appendChild(summary);

          const chipBox = document.createElement("div");
          chipBox.className = "chips";
          for (const tag of group.tags) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "chip";
            chip.textContent = tag.label;
            chip.dataset.active = active.has(tag.id) ? "true" : "false";
            chip.addEventListener("click", () => onToggle(tag.id));
            chipBox.appendChild(chip);
          }
          details.appendChild(chipBox);

          if (group.description) {
            const hint = document.createElement("div");
            hint.className = "group-hint";
            hint.textContent = group.description;
            details.appendChild(hint);
          }

          container.appendChild(details);
        }

        // Custom-tag input, always at the bottom.
        const customRow = document.createElement("div");
        customRow.className = "custom-tag-row";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Add custom tag…";
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const v = input.value.trim();
            if (v) {
              onCustom(v);
              input.value = "";
            }
          }
        });
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "secondary tiny";
        addBtn.textContent = "Add";
        addBtn.addEventListener("click", () => {
          const v = input.value.trim();
          if (v) {
            onCustom(v);
            input.value = "";
          }
        });
        customRow.appendChild(input);
        customRow.appendChild(addBtn);
        container.appendChild(customRow);
      }

      function renderGeminiAudioTags() {
        els.geminiAudioTags.innerHTML = "";
        for (const tag of GEMINI_AUDIO_TAGS) {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "chip audio-tag";
          chip.textContent = tag;
          chip.title = "Insert " + tag + " at the cursor in the transcript";
          chip.addEventListener("click", () => insertAudioTag(tag));
          els.geminiAudioTags.appendChild(chip);
        }
      }

      function insertAudioTag(tag) {
        const ta = els.text;
        const start = ta.selectionStart || ta.value.length;
        const end = ta.selectionEnd || ta.value.length;
        const before = ta.value.slice(0, start);
        const after = ta.value.slice(end);
        const insert = (before && !/\\s$/.test(before) ? " " : "") + tag + " ";
        ta.value = before + insert + after;
        const caret = (before + insert).length;
        ta.focus();
        ta.setSelectionRange(caret, caret);
        vscode.postMessage({ type: "geminiInsertAudioTag", tag: tag });
      }




      function renderPresetSelect() {
        const presets = (state.mimo && state.mimo.stylePresets) || [];
        els.presetSelect.innerHTML = "";
        if (presets.length === 0) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "(no presets saved)";
          opt.disabled = true;
          opt.selected = true;
          els.presetSelect.appendChild(opt);
          els.presetApplyBtn.disabled = true;
          els.presetDeleteBtn.disabled = true;
        } else {
          for (const p of presets) {
            const opt = document.createElement("option");
            opt.value = p.name;
            opt.textContent = p.name;
            els.presetSelect.appendChild(opt);
          }
          els.presetApplyBtn.disabled = false;
          els.presetDeleteBtn.disabled = false;
        }
      }

      function renderRate() {
        const rate = state.playbackRate || 1;
        els.rate.value = String(rate);
        els.rateValue.textContent = rate.toFixed(2) + "×";
        els.player.playbackRate = rate;
      }

      function renderAll() {
        renderProviderStrip();
        renderModelOptions();
        renderVoiceOptions();
        renderProviderBlocks();
        renderRate();
      }

      // ---------- tag mutators ----------

      function toggleStyleTag(id) {
        const current = new Set((state.mimo && state.mimo.openingStyleTags) || []);
        if (current.has(id)) current.delete(id); else current.add(id);
        commitStyleTags(Array.from(current));
      }
      function submitCustomStyleTag(value) {
        const current = new Set((state.mimo && state.mimo.openingStyleTags) || []);
        current.add(value);
        commitStyleTags(Array.from(current));
      }
      function commitStyleTags(tags) {
        if (!state.mimo) state.mimo = {};
        state.mimo.openingStyleTags = tags;
        renderTagGroups();
        vscode.postMessage({ type: "mimoStyleTagsChanged", tags: tags });
      }
      function toggleEventTag(id) {
        const current = new Set((state.mimo && state.mimo.audioEventTags) || []);
        if (current.has(id)) current.delete(id); else current.add(id);
        commitEventTags(Array.from(current));
      }
      function submitCustomEventTag(value) {
        const current = new Set((state.mimo && state.mimo.audioEventTags) || []);
        current.add(value);
        commitEventTags(Array.from(current));
      }
      function commitEventTags(tags) {
        if (!state.mimo) state.mimo = {};
        state.mimo.audioEventTags = tags;
        renderTagGroups();
        vscode.postMessage({ type: "mimoAudioEventTagsChanged", tags: tags });
      }

      // ---------- event wiring ----------

      els.setKeyLink.addEventListener("click", () => {
        vscode.postMessage({ type: "requestSetKey" });
      });

      els.model.addEventListener("change", () => {
        const ps = activeProviderState();
        ps.model = els.model.value;
        if (isMimo()) {
          if (els.model.value === "mimo-v2.5-tts-voicedesign") ps.voice = VOICE_DESIGN_PLACEHOLDER;
          else if (els.model.value === "mimo-v2.5-tts-voiceclone") ps.voice = VOICE_CLONE_PLACEHOLDER;
        }
        const voice = ensureActiveVoiceForModel();
        renderVoiceOptions();
        renderProviderBlocks();
        vscode.postMessage({ type: "modelChanged", provider: state.provider, model: els.model.value, voice: voice });
      });

      els.voice.addEventListener("change", () => {
        const ps = activeProviderState();
        ps.voice = els.voice.value;
        renderVoiceSettingsMeta();
        vscode.postMessage({ type: "voiceChanged", provider: state.provider, voice: els.voice.value });
      });

      els.testVoiceBtn.addEventListener("click", () => {
        if (mode === "synth" || mode === "playing") return;
        commitPendingProviderEdits();
        resetSession();
        setMode("synth");
        setStatus("Testing " + activeVoiceLabel() + "…", "info");
        vscode.postMessage({ type: "requestRead", text: pickTestPhrase() });
      });


      // ---- Qwen controls ----
      els.qwenEndpoint.addEventListener("change", () => {
        if (!state.qwen) state.qwen = {};
        const endpoint = els.qwenEndpoint.value === "international" ? "international" : "china";
        state.qwen.endpoint = endpoint;
        vscode.postMessage({ type: "qwenEndpointChanged", endpoint: endpoint });
      });
      els.qwenLanguageType.addEventListener("change", () => {
        if (!state.qwen) state.qwen = {};
        const lt = els.qwenLanguageType.value;
        state.qwen.languageType = lt;
        vscode.postMessage({ type: "qwenLanguageTypeChanged", languageType: lt });
      });
      function commitQwenInstructions() {
        const text = els.qwenInstructions.value;
        if (!state.qwen) state.qwen = {};
        if (state.qwen.instructions === text) return;
        state.qwen.instructions = text;
        vscode.postMessage({ type: "qwenInstructionsChanged", text: text });
      }
      els.qwenInstructions.addEventListener("change", commitQwenInstructions);
      els.qwenInstructions.addEventListener("blur", commitQwenInstructions);


      // ---- MiniMax controls ----
      function renderMiniMaxBlock() {
        const ms = state.minimax || {};
        if (els.minimaxEmotion.options.length === 0) {
          for (const e of MINIMAX_EMOTIONS) {
            const o = document.createElement("option");
            o.value = e.id;
            o.textContent = e.label;
            els.minimaxEmotion.appendChild(o);
          }
        }
        if (els.minimaxLanguageBoost.options.length === 0) {
          for (const id of MINIMAX_LANGUAGE_BOOSTS) {
            const o = document.createElement("option");
            o.value = id;
            o.textContent = id;
            els.minimaxLanguageBoost.appendChild(o);
          }
        }
        if (els.minimaxRegion.value !== (ms.region || "mainland")) {
          els.minimaxRegion.value = ms.region || "mainland";
        }
        if (els.minimaxFormat.value !== (ms.format || "mp3")) {
          els.minimaxFormat.value = ms.format || "mp3";
        }
        if (els.minimaxEmotion.value !== (ms.emotion || "auto")) {
          els.minimaxEmotion.value = ms.emotion || "auto";
        }
        if (els.minimaxLanguageBoost.value !== (ms.languageBoost || "auto")) {
          els.minimaxLanguageBoost.value = ms.languageBoost || "auto";
        }
        const speed = typeof ms.speed === "number" ? ms.speed : 1;
        const vol = typeof ms.vol === "number" ? ms.vol : 1;
        const pitch = typeof ms.pitch === "number" ? ms.pitch : 0;
        if (document.activeElement !== els.minimaxSpeed && els.minimaxSpeed.value !== String(speed)) {
          els.minimaxSpeed.value = String(speed);
        }
        if (document.activeElement !== els.minimaxVol && els.minimaxVol.value !== String(vol)) {
          els.minimaxVol.value = String(vol);
        }
        if (document.activeElement !== els.minimaxPitch && els.minimaxPitch.value !== String(pitch)) {
          els.minimaxPitch.value = String(pitch);
        }
        const showTags = MINIMAX_TAG_CAPABLE.has(ms.model);
        els.minimaxSpeechTagRow.classList.toggle("hidden", !showTags);
        if (showTags && els.minimaxSpeechTags.childElementCount === 0) {
          for (const tag of MINIMAX_SPEECH_TAGS) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "chip audio-tag";
            chip.textContent = tag.label;
            chip.title = "插入 " + tag.token + "（MiniMax 官方语气词标记）";
            chip.addEventListener("click", () => insertAudioTag(tag.token));
            els.minimaxSpeechTags.appendChild(chip);
          }
        }
      }

      els.minimaxRegion.addEventListener("change", () => {
        if (!state.minimax) state.minimax = {};
        const region = els.minimaxRegion.value === "global" ? "global" : "mainland";
        state.minimax.region = region;
        vscode.postMessage({ type: "minimaxRegionChanged", region: region });
      });
      els.minimaxFormat.addEventListener("change", () => {
        if (!state.minimax) state.minimax = {};
        const format = els.minimaxFormat.value;
        state.minimax.format = format;
        vscode.postMessage({ type: "minimaxFormatChanged", format: format });
      });
      els.minimaxEmotion.addEventListener("change", () => {
        if (!state.minimax) state.minimax = {};
        const emotion = els.minimaxEmotion.value;
        state.minimax.emotion = emotion;
        vscode.postMessage({ type: "minimaxEmotionChanged", emotion: emotion });
      });
      els.minimaxLanguageBoost.addEventListener("change", () => {
        if (!state.minimax) state.minimax = {};
        const boost = els.minimaxLanguageBoost.value;
        state.minimax.languageBoost = boost;
        vscode.postMessage({ type: "minimaxLanguageBoostChanged", boost: boost });
      });
      function commitMiniMaxNumber(el, key, msgType) {
        const value = parseFloat(el.value);
        if (!Number.isFinite(value)) return;
        if (!state.minimax) state.minimax = {};
        if (state.minimax[key] === value) return;
        state.minimax[key] = value;
        vscode.postMessage({ type: msgType, [key]: value });
      }
      els.minimaxSpeed.addEventListener("change", () => commitMiniMaxNumber(els.minimaxSpeed, "speed", "minimaxSpeedChanged"));
      els.minimaxVol.addEventListener("change", () => commitMiniMaxNumber(els.minimaxVol, "vol", "minimaxVolChanged"));
      els.minimaxPitch.addEventListener("change", () => commitMiniMaxNumber(els.minimaxPitch, "pitch", "minimaxPitchChanged"));

      // ---- MiMo style prompt + templates ----
      function commitStylePrompt() {
        const text = els.stylePrompt.value;
        if (!state.mimo) state.mimo = {};
        if (state.mimo.stylePrompt === text) return;
        state.mimo.stylePrompt = text;
        vscode.postMessage({ type: "mimoStylePromptChanged", text: text });
      }
      els.stylePrompt.addEventListener("change", commitStylePrompt);
      els.stylePrompt.addEventListener("blur", commitStylePrompt);

      els.insertDirectorBtn.addEventListener("click", () => insertTemplate(DIRECTOR_TEMPLATE));
      els.insertVoiceDesignBtn.addEventListener("click", () => insertTemplate(VOICE_DESIGN_TEMPLATE));
      function insertTemplate(text) {
        const cur = els.stylePrompt.value;
        const next = cur.trim() ? cur.trimEnd() + "\\n\\n" + text : text;
        els.stylePrompt.value = next;
        if (!state.mimo) state.mimo = {};
        state.mimo.stylePrompt = next;
        els.stylePrompt.focus();
        vscode.postMessage({ type: "mimoStylePromptChanged", text: next });
      }

      // ---- Voice clone uploader ----
      els.cloneUploadBtn.addEventListener("click", () => els.cloneFileInput.click());
      els.cloneClearBtn.addEventListener("click", () => {
        if (!state.mimo) state.mimo = {};
        state.mimo.voiceCloneSample = null;
        renderCloneStatus();
        vscode.postMessage({ type: "mimoVoiceCloneSampleClear" });
      });
      els.cloneFileInput.addEventListener("change", () => {
        const file = els.cloneFileInput.files && els.cloneFileInput.files[0];
        if (!file) return;
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        const allowed = file.type === "audio/mpeg" || file.type === "audio/mp3" || file.type === "audio/wav" || file.type === "audio/x-wav" || ext === "mp3" || ext === "wav";
        if (!allowed) {
          setStatus("Voice clone supports mp3 / wav only.", "error");
          els.cloneFileInput.value = "";
          return;
        }
        const reader = new FileReader();
        reader.onerror = () => setStatus("Could not read the audio file.", "error");
        reader.onload = () => {
          const dataUrl = reader.result;
          if (typeof dataUrl !== "string") {
            setStatus("Unexpected file reader result.", "error");
            return;
          }
          const commaIdx = dataUrl.indexOf(",");
          const base64Part = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
          if (base64Part.length > MAX_CLONE_BASE64) {
            setStatus("Voice clone sample exceeds 10 MB (base64). Use a shorter clip.", "error");
            return;
          }
          let mime = file.type;
          const supportedMime = mime === "audio/mpeg" || mime === "audio/mp3" || mime === "audio/wav" || mime === "audio/x-wav";
          if (!supportedMime) mime = ext === "wav" ? "audio/wav" : "audio/mpeg";
          const normalizedDataUrl = "data:" + mime + ";base64," + base64Part;
          if (!state.mimo) state.mimo = {};
          state.mimo.voiceCloneSample = { fileName: file.name, mime: mime, sizeBytes: file.size };
          renderCloneStatus();
          setStatus("Voice clone sample loaded — " + file.name, "success");
          vscode.postMessage({
            type: "mimoVoiceCloneSampleSet",
            dataUrl: normalizedDataUrl,
            mime: mime,
            fileName: file.name,
            sizeBytes: file.size,
          });
        };
        reader.readAsDataURL(file);
        els.cloneFileInput.value = "";
      });

      // ---- Preset library ----
      els.presetApplyBtn.addEventListener("click", () => {
        const name = els.presetSelect.value;
        if (!name) return;
        vscode.postMessage({ type: "mimoPresetApply", name: name });
      });
      els.presetDeleteBtn.addEventListener("click", () => {
        const name = els.presetSelect.value;
        if (!name) return;
        vscode.postMessage({ type: "mimoPresetDelete", name: name });
      });
      els.presetSaveBtn.addEventListener("click", () => {
        const defaultName = "preset-" + new Date().toISOString().slice(0, 16).replace("T", " ");
        const name = (window.prompt("Preset name", defaultName) || "").trim();
        if (!name) return;
        if (!state.mimo) state.mimo = {};
        const preset = {
          name: name,
          stylePrompt: state.mimo.stylePrompt || "",
          openingStyleTags: state.mimo.openingStyleTags || [],
          audioEventTags: state.mimo.audioEventTags || [],
        };
        vscode.postMessage({ type: "mimoPresetSave", preset: preset });
      });

      // ---- Gemini preamble ----
      function commitGeminiPreamble() {
        const text = els.geminiPreamble.value;
        if (!state.gemini) state.gemini = {};
        if (state.gemini.stylePreamble === text) return;
        state.gemini.stylePreamble = text;
        vscode.postMessage({ type: "geminiStylePreambleChanged", text: text });
      }
      els.geminiPreamble.addEventListener("change", commitGeminiPreamble);
      els.geminiPreamble.addEventListener("blur", commitGeminiPreamble);

      function commitPendingProviderEdits() {
        if (isMimo()) {
          const promptText = els.stylePrompt.value;
          if ((state.mimo && state.mimo.stylePrompt) !== promptText) {
            if (!state.mimo) state.mimo = {};
            state.mimo.stylePrompt = promptText;
            vscode.postMessage({ type: "mimoStylePromptChanged", text: promptText });
          }
        }
        if (isGemini()) {
          const preambleText = els.geminiPreamble.value;
          if ((state.gemini && state.gemini.stylePreamble) !== preambleText) {
            if (!state.gemini) state.gemini = {};
            state.gemini.stylePreamble = preambleText;
            vscode.postMessage({ type: "geminiStylePreambleChanged", text: preambleText });
          }
        }
      }

      // ---- speed / play / stop ----
      function pcmStreamingActive() {
        return audioCtx !== null && pcmActiveSources.size > 0;
      }
      els.rate.addEventListener("input", () => {
        const rate = parseFloat(els.rate.value);
        state.playbackRate = rate;
        els.rateValue.textContent = rate.toFixed(2) + "×";
        els.player.playbackRate = rate;
        // Apply to currently-scheduled WebAudio sources too (best effort —
        // future sub-chunks pick up the new rate via state.playbackRate).
        if (audioCtx) {
          for (const src of pcmActiveSources) {
            try { src.playbackRate.setValueAtTime(rate, audioCtx.currentTime); } catch (_) { /* ignore */ }
          }
        }
        vscode.postMessage({ type: "rateChanged", rate: rate });
      });

      els.primary.addEventListener("click", () => {
        if (mode === "synth") return;
        if (mode === "playing") {
          if (pcmStreamingActive() && audioCtx) {
            audioCtx.suspend().catch(() => {});
          } else {
            els.player.pause();
          }
          setMode("paused");
          setStatus("Paused.", "muted");
          return;
        }
        if (mode === "paused") {
          if (pcmStreamingActive() && audioCtx) {
            audioCtx.resume().then(() => {
              setMode("playing");
              setStatus("Playing.", "info");
            }).catch((err) => {
              setStatus("Resume failed: " + (err && err.message || err), "error");
            });
          } else {
            els.player.play().then(() => {
              setMode("playing");
              setStatus("Playing.", "info");
            }).catch(function (err) {
              setStatus("Resume failed: " + (err && err.message || err), "error");
            });
          }
          return;
        }
        const text = els.text.value.trim();
        if (!text) {
          setStatus("Type or paste text first.", "warn");
          return;
        }
        commitPendingProviderEdits();
        resetSession();
        setMode("synth");
        setStatus("Synthesizing…", "info");
        vscode.postMessage({ type: "requestRead", text: text });
      });

      els.stop.addEventListener("click", () => {
        resetSession();
        setMode("idle");
        setStatus("Stopped.", "muted");
        vscode.postMessage({ type: "requestStop" });
      });

      els.statusActionBtn.addEventListener("click", () => {
        if (!pendingAction) return;
        vscode.postMessage({ type: pendingAction.id });
      });

      // ---- player chunk pipeline ----
      function startNextChunk() {
        if (mode === "paused" || mode === "idle") {
          if (queue.length === 0 && sessionDone) {
            setMode("idle");
            setStatus("Done.", "success");
            activeSession = null;
          }
          return;
        }
        if (queue.length === 0) {
          if (sessionDone) {
            setMode("idle");
            setStatus("Done.", "success");
            activeSession = null;
          }
          return;
        }
        if (!activeSession) return;
        const next = queue.shift();
        currentlyPlaying = next;
        const sessionId = activeSession.id;
        const generation = playGeneration;
        const playFormat = next.format === "pcm" ? "wav" : next.format;
        const playData = next.format === "pcm" ? wrapPcmAsWav(next.audioBase64) : next.audioBase64;
        els.player.src = "data:" + audioMime(playFormat) + ";base64," + playData;
        els.player.playbackRate = parseFloat(els.rate.value);
        els.player.play().then(function () {
          if (generation !== playGeneration || !activeSession || activeSession.id !== sessionId) return;
          setMode("playing");
          setStatus(next.label ? "Playing — " + next.label : "Playing.", "info");
        }).catch(function (err) {
          if (generation !== playGeneration || !activeSession || activeSession.id !== sessionId) return;
          failActivePlayback("Playback failed: " + (err && err.message || err));
        });
      }

      els.player.addEventListener("ended", () => {
        const finished = currentlyPlaying;
        currentlyPlaying = null;
        if (activeSession) {
          if (finished && finished.isSubChunk) {
            if (finished.isLast) {
              chunksPlayed += 1;
              setProgress(chunksPlayed, activeSession.total);
            }
          } else {
            chunksPlayed += 1;
            setProgress(chunksPlayed, activeSession.total);
          }
        }
        startNextChunk();
      });
      els.player.addEventListener("error", () => {
        if (!activeSession) return;
        failActivePlayback("Audio decode failed.");
      });

      // ---- inbound messages ----
      window.addEventListener("message", (event) => {
        const msg = event.data;
        if (!msg) return;
        switch (msg.type) {
          case "sessionStart":
            resetSession();
            activeSession = { id: msg.sessionId, total: msg.totalChunks };
            sessionDone = false;
            chunksPlayed = 0;
            setProgress(0, msg.totalChunks);
            setMode("synth");
            break;
          case "play":
            if (!activeSession || msg.sessionId !== activeSession.id) break;
            queue.push(msg);
            if (els.player.paused && mode !== "paused") {
              startNextChunk();
            }
            break;
          case "playSubChunk":
            if (!activeSession || msg.sessionId !== activeSession.id) break;
            if (msg.format === "pcm") {
              // WebAudio path: sample-accurate seamless playback.
              enqueuePcmSubChunk(msg);
            } else {
              // Fallback for non-PCM streaming (none today, but keep the path).
              queue.push({
                ...msg,
                isSubChunk: true,
                chunkIndex: msg.isLast ? -1 : -2,
                totalChunks: activeSession.total,
              });
              if (els.player.paused && mode !== "paused") {
                startNextChunk();
              }
            }
            break;
          case "chunkBoundary":
            // Streaming has finished pushing PCM segments for a chunk. The
            // trailing sub-chunk already has isLast=true, so progress will
            // advance when that segment finishes playing. Nothing to do here
            // beyond keeping the status label fresh.
            if (!activeSession || msg.sessionId !== activeSession.id) break;
            setStatus("Playing — " + msg.label, "info");
            break;
          case "sessionEnd":
            if (!activeSession || msg.sessionId !== activeSession.id) break;
            sessionDone = true;
            if (msg.cancelled) {
              resetSession();
              setMode("idle");
              setStatus("Cancelled.", "muted");
            } else if (queue.length === 0 && els.player.paused && mode !== "paused") {
              setMode("idle");
              setStatus("Done.", "success");
              activeSession = null;
            }
            break;
          case "stop":
            resetSession();
            setMode("idle");
            setStatus("Stopped.", "muted");
            break;
          case "status":
            if (!activeSession && mode === "synth" && (msg.tone === "error" || msg.tone === "warn" || msg.tone === "muted")) {
              setMode("idle");
            }
            setStatus(msg.status, msg.tone, msg.action);
            break;
          case "config":
            state = msg.config;
            renderAll();
            break;
        }
      });

      renderAll();
      setMode("idle");
      vscode.postMessage({ type: "ready" });
    })();
  </script>
</body>
</html>`;
  }
}

interface SerializedConfig {
  provider: ProviderId;
  playbackRate: number;
  mimo: {
    model: string;
    voice: string;
    stylePrompt: string;
    openingStyleTags: string[];
    audioEventTags: string[];
    stylePresets: MiMoStylePreset[];
    voiceCloneSample?: { fileName: string; mime: string; sizeBytes: number };
  };
  minimax: {
    model: string;
    voice: string;
    region: MiniMaxRegion;
    format: MiniMaxFormat;
    speed: number;
    vol: number;
    pitch: number;
    emotion: MiniMaxEmotion;
    languageBoost: string;
  };
  gemini: { model: string; voice: string; stylePreamble: string };
  qwen: {
    model: string;
    voice: string;
    endpoint: QwenEndpoint;
    languageType: QwenLanguageType;
    instructions: string;
  };
}

interface SerializedCatalog {
  id: ProviderId;
  label: string;
  models: { id: string; label: string; description?: string }[];
  voices: { id: string; name: string; category: string; recommended?: boolean; models: string[] }[];
}

function serializeConfig(cfg: AppConfig, cloneSample?: MiMoVoiceCloneSampleRecord): SerializedConfig {
  return {
    provider: cfg.provider,
    playbackRate: cfg.playbackRate,
    mimo: {
      model: cfg.mimo.model,
      voice: cfg.mimo.voice,
      stylePrompt: cfg.mimo.stylePrompt,
      openingStyleTags: cfg.mimo.openingStyleTags,
      audioEventTags: cfg.mimo.audioEventTags,
      stylePresets: cfg.mimo.stylePresets,
      voiceCloneSample: cloneSample
        ? { fileName: cloneSample.fileName, mime: cloneSample.mime, sizeBytes: cloneSample.sizeBytes }
        : undefined,
    },
    minimax: {
      model: cfg.minimax.model,
      voice: cfg.minimax.voice,
      region: cfg.minimax.region,
      format: cfg.minimax.format,
      speed: cfg.minimax.speed,
      vol: cfg.minimax.vol,
      pitch: cfg.minimax.pitch,
      emotion: cfg.minimax.emotion,
      languageBoost: cfg.minimax.languageBoost,
    },
    gemini: {
      model: cfg.gemini.model,
      voice: cfg.gemini.voice,
      stylePreamble: cfg.gemini.stylePreamble,
    },
    qwen: {
      model: cfg.qwen.model,
      voice: cfg.qwen.voice,
      endpoint: cfg.qwen.endpoint,
      languageType: cfg.qwen.languageType,
      instructions: cfg.qwen.instructions,
    },
  };
}

function serializeCatalogs(): SerializedCatalog[] {
  return PROVIDER_IDS.map((id) => {
    const c = CATALOGS[id];
    return {
      id,
      label: PROVIDER_LABELS[id],
      models: c.models.map((m) => ({ id: m.id, label: m.label, description: m.description })),
      voices: c.voices.map((v) => ({
        id: v.id,
        name: v.name,
        category: v.category,
        recommended: v.recommended,
        models: v.models,
      })),
    };
  });
}

function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}
