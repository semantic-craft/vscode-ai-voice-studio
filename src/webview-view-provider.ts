import * as vscode from "vscode";
import { getConfig, setPlaybackRate, type AppConfig } from "./config";
import { QWEN_CATALOG, LANGUAGE_TYPES, type QwenEndpoint, type QwenLanguageType } from "./core/qwen-voices";

type IncomingMessage =
  | { type: "ready" }
  | { type: "log"; payload: unknown }
  | { type: "requestRead"; text: string }
  | { type: "requestStop" }
  | { type: "requestSetKey" }
  | { type: "rateChanged"; rate: number }
  | { type: "voiceChanged"; voice: string }
  | { type: "modelChanged"; model: string; voice?: string }
  | { type: "qwenEndpointChanged"; endpoint: QwenEndpoint }
  | { type: "qwenLanguageTypeChanged"; languageType: QwenLanguageType }
  | { type: "qwenInstructionsChanged"; text: string };

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

  postConfig(cfg: AppConfig): void {
    this.view?.webview.postMessage({
      type: "config",
      config: serializeConfig(cfg),
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
        console.log("[qwenTts webview]", message.payload);
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
      `media-src ${webview.cspSource} data: blob:`,
    ].join("; ");

    const initialConfigJson = JSON.stringify(serializeConfig(cfg));
    const catalogJson = JSON.stringify(QWEN_CATALOG);
    const languageTypesJson = JSON.stringify(LANGUAGE_TYPES);

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Qwen TTS Studio</title>
  <style>
    :root {
      color-scheme: light dark;
      --gap: 8px;
      --border: var(--vscode-widget-border, rgba(128,128,128,0.35));
      --muted: var(--vscode-descriptionForeground, rgba(150,150,150,0.9));
      --error: var(--vscode-errorForeground, #f48771);
      --success: var(--vscode-charts-green, #4caf50);
      --warn: var(--vscode-charts-orange, #f5a623);
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
    .topbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    h1 { margin: 0; font-size: 1.02em; font-weight: 650; }
    .spacer { flex: 1; }
    .link-button {
      border: none;
      background: transparent;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      padding: 2px 0;
    }
    .row { display: flex; align-items: center; gap: var(--gap); margin: 7px 0; }
    .row.stack { align-items: stretch; flex-direction: column; gap: 4px; }
    label { flex: 0 0 74px; color: var(--muted); font-size: 0.88em; }
    .row.stack > label { flex: 0 0 auto; }
    select, textarea, input[type="range"], button {
      font-family: inherit;
      font-size: inherit;
    }
    select {
      min-width: 0;
      flex: 1;
      padding: 3px 6px;
      color: var(--vscode-dropdown-foreground);
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--border);
      border-radius: 2px;
    }
    textarea {
      width: 100%;
      min-height: 116px;
      resize: vertical;
      padding: 7px 8px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, var(--border));
      border-radius: 2px;
    }
    textarea.compact { min-height: 58px; }
    input[type="range"] { flex: 1; accent-color: var(--vscode-button-background); }
    .rate-value {
      flex: 0 0 42px;
      text-align: right;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    .button-row { display: grid; grid-template-columns: 1fr auto auto; gap: 6px; margin-top: 8px; }
    button {
      padding: 5px 10px;
      border-radius: 3px;
      border: 1px solid transparent;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      cursor: pointer;
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button:disabled { opacity: 0.65; cursor: default; }
    .hidden { display: none !important; }
    .meta { color: var(--muted); font-size: 0.86em; margin-top: -2px; }
    .progress { margin-top: 10px; display: none; }
    .progress[data-show="true"] { display: block; }
    .progress-top { display: flex; justify-content: space-between; color: var(--muted); font-size: 0.84em; }
    .bar { height: 4px; overflow: hidden; border-radius: 999px; background: var(--vscode-progressBar-background, rgba(128,128,128,0.25)); }
    .fill { height: 100%; width: 0%; background: var(--vscode-button-background); transition: width 120ms ease; }
    .status {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status[data-tone="error"] { color: var(--error); }
    .status[data-tone="success"] { color: var(--success); }
    .status[data-tone="warn"] { color: var(--warn); }
    .status button { padding: 3px 7px; }
    kbd {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.82em;
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 1px 4px;
      color: var(--muted);
    }
    .hint { margin-top: 10px; color: var(--muted); font-size: 0.82em; display: flex; flex-wrap: wrap; gap: 8px; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>Qwen TTS Studio</h1>
    <div class="spacer"></div>
    <button class="link-button" id="setKeyLink">Set key</button>
  </div>

  <div class="row">
    <label for="model">Model</label>
    <select id="model"></select>
  </div>
  <div class="row">
    <label for="voice">Voice</label>
    <select id="voice"></select>
  </div>
  <div class="meta" id="voiceMeta"></div>
  <div class="row">
    <label for="endpoint">Endpoint</label>
    <select id="endpoint">
      <option value="china">China - dashscope.aliyuncs.com</option>
      <option value="international">International - dashscope-intl.aliyuncs.com</option>
    </select>
  </div>
  <div class="row">
    <label for="languageType">Language</label>
    <select id="languageType"></select>
  </div>
  <div class="row stack" id="instructionsRow">
    <label for="instructions">Instructions</label>
    <textarea id="instructions" class="compact" placeholder="Only sent with qwen3-tts-instruct-flash."></textarea>
  </div>
  <div class="row">
    <label for="rate">Speed</label>
    <input id="rate" type="range" min="0.5" max="4" step="0.05" />
    <span class="rate-value" id="rateValue">1.00x</span>
  </div>
  <div class="row stack">
    <label for="text">Text</label>
    <textarea id="text" placeholder="Paste text to read with Qwen-TTS..."></textarea>
  </div>
  <div class="button-row">
    <button id="primary">Read</button>
    <button class="secondary" id="testVoice">Test Voice</button>
    <button class="secondary" id="stop">Stop</button>
  </div>

  <div class="progress" id="progress">
    <div class="progress-top"><span>Progress</span><span id="progressText">0 / 0</span></div>
    <div class="bar"><div class="fill" id="progressFill"></div></div>
  </div>

  <div class="status" id="status" data-tone="muted">
    <span id="statusText">Ready.</span>
    <span id="statusAction" class="hidden"><button class="secondary" id="statusActionBtn"></button></span>
  </div>

  <div class="hint">
    <span><kbd>Cmd+Alt+R</kbd> / <kbd>Ctrl+Alt+R</kbd> read selection or clipboard</span>
    <span><kbd>Cmd+Alt+S</kbd> / <kbd>Ctrl+Alt+S</kbd> stop</span>
  </div>

  <audio id="player"></audio>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const CATALOG = ${catalogJson};
      const LANGUAGE_TYPES = ${languageTypesJson};
      const TEST_PHRASE = "Hello, this is your selected Qwen-TTS voice.";

      let state = ${initialConfigJson};
      let mode = "idle";
      let activeSession = null;
      let sessionDone = false;
      let chunksPlayed = 0;
      let playGeneration = 0;
      let pendingAction = null;
      const queue = [];

      const els = {
        setKeyLink: document.getElementById("setKeyLink"),
        model: document.getElementById("model"),
        voice: document.getElementById("voice"),
        voiceMeta: document.getElementById("voiceMeta"),
        endpoint: document.getElementById("endpoint"),
        languageType: document.getElementById("languageType"),
        instructionsRow: document.getElementById("instructionsRow"),
        instructions: document.getElementById("instructions"),
        rate: document.getElementById("rate"),
        rateValue: document.getElementById("rateValue"),
        text: document.getElementById("text"),
        primary: document.getElementById("primary"),
        testVoice: document.getElementById("testVoice"),
        stop: document.getElementById("stop"),
        progress: document.getElementById("progress"),
        progressText: document.getElementById("progressText"),
        progressFill: document.getElementById("progressFill"),
        status: document.getElementById("status"),
        statusText: document.getElementById("statusText"),
        statusAction: document.getElementById("statusAction"),
        statusActionBtn: document.getElementById("statusActionBtn"),
        player: document.getElementById("player"),
      };

      function qwen() { return state.qwen || {}; }
      function voicesForModel(model) {
        return CATALOG.voices.filter(function (voice) {
          return !voice.models || voice.models.length === 0 || voice.models.indexOf(model) >= 0;
        });
      }
      function currentVoice() {
        return CATALOG.voices.find(function (voice) { return voice.id === qwen().voice; });
      }
      function firstVoiceForModel(model) {
        const voices = voicesForModel(model);
        return voices.length ? voices[0].id : "";
      }
      function clearOptions(select) {
        while (select.firstChild) select.removeChild(select.firstChild);
      }
      function appendOption(select, value, label) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      }
      function renderModels() {
        clearOptions(els.model);
        CATALOG.models.forEach(function (model) {
          appendOption(els.model, model.id, model.label);
        });
        els.model.value = qwen().model || CATALOG.defaults.model;
      }
      function renderVoices() {
        clearOptions(els.voice);
        const model = qwen().model || CATALOG.defaults.model;
        const byCategory = new Map();
        voicesForModel(model).forEach(function (voice) {
          const group = voice.category || "Voices";
          if (!byCategory.has(group)) byCategory.set(group, []);
          byCategory.get(group).push(voice);
        });
        byCategory.forEach(function (voices, category) {
          const group = document.createElement("optgroup");
          group.label = category;
          voices.forEach(function (voice) {
            const option = document.createElement("option");
            option.value = voice.id;
            option.textContent = voice.recommended ? voice.name + " - recommended" : voice.name;
            group.appendChild(option);
          });
          els.voice.appendChild(group);
        });
        const available = voicesForModel(model).some(function (voice) { return voice.id === qwen().voice; });
        if (!available) {
          state.qwen.voice = firstVoiceForModel(model);
        }
        els.voice.value = qwen().voice || firstVoiceForModel(model);
        const voice = currentVoice();
        els.voiceMeta.textContent = voice ? voice.description : "";
      }
      function renderLanguages() {
        if (els.languageType.options.length === 0) {
          LANGUAGE_TYPES.forEach(function (lang) { appendOption(els.languageType, lang.id, lang.label); });
        }
        els.languageType.value = qwen().languageType || "Auto";
      }
      function renderAll() {
        if (!state.qwen) state.qwen = {};
        if (!state.qwen.model) state.qwen.model = CATALOG.defaults.model;
        if (!state.qwen.voice) state.qwen.voice = CATALOG.defaults.voice;
        renderModels();
        renderVoices();
        renderLanguages();
        els.endpoint.value = qwen().endpoint || "china";
        const showInstructions = qwen().model === "qwen3-tts-instruct-flash";
        els.instructionsRow.classList.toggle("hidden", !showInstructions);
        if (els.instructions.value !== (qwen().instructions || "")) {
          els.instructions.value = qwen().instructions || "";
        }
        const rate = Number.isFinite(state.playbackRate) ? state.playbackRate : 1;
        els.rate.value = String(rate);
        els.rateValue.textContent = rate.toFixed(2) + "x";
      }
      function setStatus(message, tone, action) {
        els.statusText.textContent = message;
        els.status.dataset.tone = tone || "info";
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
        if (mode === "playing") {
          els.primary.textContent = "Pause";
        } else if (mode === "paused") {
          els.primary.textContent = "Resume";
        } else if (mode === "synth") {
          els.primary.textContent = "Synthesizing...";
        } else {
          els.primary.textContent = "Read";
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
        setProgress(0, 0);
        els.player.pause();
        els.player.removeAttribute("src");
        els.player.load();
      }
      function failActivePlayback(message) {
        const shouldNotifyExtension = !!activeSession;
        resetSession();
        setMode("idle");
        setStatus(message, "error");
        if (shouldNotifyExtension) vscode.postMessage({ type: "requestStop" });
      }
      function commitInstructions() {
        const text = els.instructions.value;
        if (!state.qwen) state.qwen = {};
        if (state.qwen.instructions === text) return;
        state.qwen.instructions = text;
        vscode.postMessage({ type: "qwenInstructionsChanged", text: text });
      }
      function commitPendingEdits() {
        commitInstructions();
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
        const raw = Uint8Array.from(atob(base64pcm), function (c) { return c.charCodeAt(0); });
        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        function writeStr(offset, str) {
          for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        }
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
        const merged = new Uint8Array(44 + raw.length);
        merged.set(new Uint8Array(header), 0);
        merged.set(raw, 44);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < merged.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, Array.from(merged.subarray(i, i + chunkSize)));
        }
        return btoa(binary);
      }
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
        const sessionId = activeSession.id;
        const generation = playGeneration;
        const playFormat = next.format === "pcm" ? "wav" : next.format;
        const playData = next.format === "pcm" ? wrapPcmAsWav(next.audioBase64) : next.audioBase64;
        els.player.src = "data:" + audioMime(playFormat) + ";base64," + playData;
        els.player.playbackRate = parseFloat(els.rate.value);
        els.player.play().then(function () {
          if (generation !== playGeneration || !activeSession || activeSession.id !== sessionId) return;
          setMode("playing");
          setStatus(next.label ? "Playing - " + next.label : "Playing.", "info");
        }).catch(function (err) {
          if (generation !== playGeneration || !activeSession || activeSession.id !== sessionId) return;
          failActivePlayback("Playback failed: " + (err && err.message || err));
        });
      }

      els.setKeyLink.addEventListener("click", function () {
        vscode.postMessage({ type: "requestSetKey" });
      });
      els.model.addEventListener("change", function () {
        if (!state.qwen) state.qwen = {};
        state.qwen.model = els.model.value;
        const available = voicesForModel(state.qwen.model).some(function (voice) { return voice.id === state.qwen.voice; });
        if (!available) state.qwen.voice = firstVoiceForModel(state.qwen.model);
        renderAll();
        vscode.postMessage({ type: "modelChanged", model: state.qwen.model, voice: state.qwen.voice });
      });
      els.voice.addEventListener("change", function () {
        if (!state.qwen) state.qwen = {};
        state.qwen.voice = els.voice.value;
        renderVoices();
        vscode.postMessage({ type: "voiceChanged", voice: state.qwen.voice });
      });
      els.endpoint.addEventListener("change", function () {
        if (!state.qwen) state.qwen = {};
        state.qwen.endpoint = els.endpoint.value === "international" ? "international" : "china";
        vscode.postMessage({ type: "qwenEndpointChanged", endpoint: state.qwen.endpoint });
      });
      els.languageType.addEventListener("change", function () {
        if (!state.qwen) state.qwen = {};
        state.qwen.languageType = els.languageType.value;
        vscode.postMessage({ type: "qwenLanguageTypeChanged", languageType: state.qwen.languageType });
      });
      els.instructions.addEventListener("change", commitInstructions);
      els.instructions.addEventListener("blur", commitInstructions);
      els.rate.addEventListener("input", function () {
        const rate = parseFloat(els.rate.value);
        state.playbackRate = rate;
        els.rateValue.textContent = rate.toFixed(2) + "x";
        els.player.playbackRate = rate;
        vscode.postMessage({ type: "rateChanged", rate: rate });
      });
      els.primary.addEventListener("click", function () {
        if (mode === "synth") return;
        if (mode === "playing") {
          els.player.pause();
          setMode("paused");
          setStatus("Paused.", "muted");
          return;
        }
        if (mode === "paused") {
          els.player.play().then(function () {
            setMode("playing");
            setStatus("Playing.", "info");
          }).catch(function (err) {
            setStatus("Resume failed: " + (err && err.message || err), "error");
          });
          return;
        }
        const text = els.text.value.trim();
        if (!text) {
          setStatus("Type or paste text first.", "warn");
          return;
        }
        commitPendingEdits();
        resetSession();
        setMode("synth");
        setStatus("Synthesizing...", "info");
        vscode.postMessage({ type: "requestRead", text: text });
      });
      els.testVoice.addEventListener("click", function () {
        commitPendingEdits();
        resetSession();
        setMode("synth");
        setStatus("Testing voice...", "info");
        vscode.postMessage({ type: "requestRead", text: TEST_PHRASE });
      });
      els.stop.addEventListener("click", function () {
        resetSession();
        setMode("idle");
        setStatus("Stopped.", "muted");
        vscode.postMessage({ type: "requestStop" });
      });
      els.statusActionBtn.addEventListener("click", function () {
        if (!pendingAction) return;
        vscode.postMessage({ type: pendingAction.id });
      });
      els.player.addEventListener("ended", function () {
        chunksPlayed += 1;
        if (activeSession) setProgress(chunksPlayed, activeSession.total);
        startNextChunk();
      });
      els.player.addEventListener("error", function () {
        if (!activeSession) return;
        failActivePlayback("Audio decode failed.");
      });

      window.addEventListener("message", function (event) {
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
            if (els.player.paused && mode !== "paused") startNextChunk();
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
      vscode.postMessage({ type: "ready" });
    })();
  </script>
</body>
</html>`;
  }
}

interface SerializedConfig {
  playbackRate: number;
  chunkSize: number;
  qwen: {
    model: string;
    voice: string;
    endpoint: QwenEndpoint;
    languageType: QwenLanguageType;
    instructions: string;
  };
}

function serializeConfig(cfg: AppConfig): SerializedConfig {
  return {
    playbackRate: cfg.playbackRate,
    chunkSize: cfg.chunkSize,
    qwen: {
      model: cfg.qwen.model,
      voice: cfg.qwen.voice,
      endpoint: cfg.qwen.endpoint,
      languageType: cfg.qwen.languageType,
      instructions: cfg.qwen.instructions,
    },
  };
}

function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}
