import * as vscode from "vscode";
import { getConfig, setPlaybackRate, type AppConfig } from "./config";
import { CATALOGS } from "./core/synthesize";
import { PROVIDER_IDS, PROVIDER_LABELS, type ProviderId } from "./core/providers";

type IncomingMessage =
  | { type: "ready" }
  | { type: "log"; payload: unknown }
  | { type: "requestRead"; text: string }
  | { type: "requestStop" }
  | { type: "rateChanged"; rate: number }
  | { type: "providerChanged"; provider: ProviderId }
  | { type: "voiceChanged"; provider: ProviderId; voice: string }
  | { type: "modelChanged"; provider: ProviderId; model: string };

export type StudioMessageHandler = (msg: IncomingMessage) => void;

export class VoiceStudioViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "aiVoiceStudio.studio";

  private view?: vscode.WebviewView;
  private handler?: StudioMessageHandler;

  constructor(private readonly extensionUri: vscode.Uri) {}

  setMessageHandler(handler: StudioMessageHandler): void {
    this.handler = handler;
  }

  isReady(): boolean {
    return this.view !== undefined;
  }

  postPlay(audioBase64: string, format: string, playbackRate: number, label?: string): void {
    this.view?.webview.postMessage({ type: "play", audioBase64, format, playbackRate, label });
  }

  postStop(): void {
    this.view?.webview.postMessage({ type: "stop" });
  }

  postStatus(status: string, tone: "info" | "error" | "muted" = "info"): void {
    this.view?.webview.postMessage({ type: "status", status, tone });
  }

  postConfig(cfg: AppConfig): void {
    this.view?.webview.postMessage({ type: "config", config: serializeConfig(cfg) });
  }

  reveal(): void {
    if (this.view) {
      this.view.show?.(true);
      return;
    }
    vscode.commands.executeCommand("aiVoiceStudio.studio.focus");
  }

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

    webviewView.webview.onDidReceiveMessage((message: IncomingMessage) => {
      if (!message) return;
      if (message.type === "log") {
        console.log("[aiVoiceStudio webview]", message.payload);
        return;
      }
      if (message.type === "rateChanged") {
        void setPlaybackRate(message.rate);
      }
      this.handler?.(message);
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
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

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Voice Studio</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      padding: 12px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: transparent;
      line-height: 1.45;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 1.05em;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .badge {
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-size: 0.78em;
      font-weight: 500;
    }
    .row { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
    label { flex: 0 0 64px; color: var(--vscode-descriptionForeground); font-size: 0.9em; }
    select, input[type="range"], textarea, button {
      font-family: inherit;
      font-size: inherit;
    }
    select {
      flex: 1;
      padding: 3px 6px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      border-radius: 2px;
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
      border: 1px solid var(--vscode-input-border, var(--vscode-dropdown-border));
      border-radius: 2px;
      margin: 6px 0;
    }
    .button-row { display: flex; gap: 6px; margin-top: 8px; }
    button {
      flex: 1;
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
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .status {
      margin-top: 10px;
      padding: 6px 8px;
      font-size: 0.88em;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-textBlockQuote-background, transparent);
      border-left: 2px solid var(--vscode-focusBorder);
      border-radius: 2px;
      min-height: 1.4em;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .status[data-tone="error"] {
      color: var(--vscode-errorForeground);
      border-left-color: var(--vscode-errorForeground);
    }
    .hint {
      margin-top: 8px;
      font-size: 0.82em;
      color: var(--vscode-descriptionForeground);
      opacity: 0.85;
    }
    code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
    }
    audio { display: none; }
  </style>
</head>
<body>
  <h1>AI Voice Studio <span class="badge" id="providerBadge">M2</span></h1>

  <div class="row">
    <label for="provider">Provider</label>
    <select id="provider"></select>
  </div>
  <div class="row">
    <label for="model">Model</label>
    <select id="model"></select>
  </div>
  <div class="row">
    <label for="voice">Voice</label>
    <select id="voice"></select>
  </div>
  <div class="row">
    <label for="rate">Speed</label>
    <input id="rate" type="range" min="0.5" max="4" step="0.05" />
    <span class="rate-value" id="rateValue"></span>
  </div>

  <textarea id="text" placeholder="Type or paste text to read. Or use Cmd+Alt+R / Ctrl+Alt+R on a selection in the editor."></textarea>

  <div class="button-row">
    <button id="read">▶ Read</button>
    <button id="stop" class="secondary">⏹ Stop</button>
  </div>

  <div class="status" id="status" data-tone="muted">Idle.</div>
  <div class="hint">Set keys via <code>AI Voice Studio: Set API Key</code>. Provider-specific knobs (instructions, region, baseUrl…) live in <code>settings.json</code>.</div>

  <audio id="player"></audio>

  <script nonce="${nonce}">
    (function () {
      const vscode = acquireVsCodeApi();
      const CATALOGS = ${catalogsJson};

      let state = ${initialConfigJson};

      const els = {
        provider:     document.getElementById("provider"),
        providerBadge:document.getElementById("providerBadge"),
        model:        document.getElementById("model"),
        voice:        document.getElementById("voice"),
        rate:         document.getElementById("rate"),
        rateValue:    document.getElementById("rateValue"),
        text:         document.getElementById("text"),
        read:         document.getElementById("read"),
        stop:         document.getElementById("stop"),
        status:       document.getElementById("status"),
        player:       document.getElementById("player"),
      };

      function setStatus(msg, tone) {
        els.status.textContent = msg;
        els.status.dataset.tone = tone || "info";
      }

      function setBusy(busy) { els.read.disabled = busy; }

      function renderProviderOptions() {
        els.provider.innerHTML = "";
        for (const p of CATALOGS) {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = p.label;
          if (p.id === state.provider) opt.selected = true;
          els.provider.appendChild(opt);
        }
      }

      function activeCatalog() {
        return CATALOGS.find((p) => p.id === state.provider) || CATALOGS[0];
      }

      function activeProviderState() {
        return state[state.provider] || {};
      }

      function renderModelOptions() {
        const catalog = activeCatalog();
        els.model.innerHTML = "";
        for (const m of catalog.models) {
          const opt = document.createElement("option");
          opt.value = m.id;
          opt.textContent = m.label;
          if (m.id === activeProviderState().model) opt.selected = true;
          els.model.appendChild(opt);
        }
      }

      function renderVoiceOptions() {
        const catalog = activeCatalog();
        const model = activeProviderState().model;
        els.voice.innerHTML = "";
        const voices = catalog.voices.filter((v) => !v.models || v.models.length === 0 || v.models.indexOf(model) !== -1);
        for (const v of voices) {
          const opt = document.createElement("option");
          opt.value = v.id;
          const star = v.recommended ? " ★" : "";
          opt.textContent = v.name + star + " — " + v.category;
          if (v.id === activeProviderState().voice) opt.selected = true;
          els.voice.appendChild(opt);
        }
      }

      function renderRate() {
        const rate = state.playbackRate || 1;
        els.rate.value = String(rate);
        els.rateValue.textContent = rate.toFixed(2) + "×";
        els.player.playbackRate = rate;
      }

      function renderBadge() {
        const label = (CATALOGS.find((p) => p.id === state.provider) || {}).label || state.provider;
        els.providerBadge.textContent = "M2 · " + label;
      }

      function renderAll() {
        renderProviderOptions();
        renderModelOptions();
        renderVoiceOptions();
        renderRate();
        renderBadge();
      }

      els.provider.addEventListener("change", () => {
        const next = els.provider.value;
        state.provider = next;
        renderModelOptions();
        renderVoiceOptions();
        renderBadge();
        vscode.postMessage({ type: "providerChanged", provider: next });
      });

      els.model.addEventListener("change", () => {
        const ps = activeProviderState();
        ps.model = els.model.value;
        renderVoiceOptions();
        vscode.postMessage({ type: "modelChanged", provider: state.provider, model: els.model.value });
      });

      els.voice.addEventListener("change", () => {
        const ps = activeProviderState();
        ps.voice = els.voice.value;
        vscode.postMessage({ type: "voiceChanged", provider: state.provider, voice: els.voice.value });
      });

      els.rate.addEventListener("input", () => {
        const rate = parseFloat(els.rate.value);
        state.playbackRate = rate;
        els.rateValue.textContent = rate.toFixed(2) + "×";
        els.player.playbackRate = rate;
        vscode.postMessage({ type: "rateChanged", rate: rate });
      });

      els.read.addEventListener("click", () => {
        const text = els.text.value.trim();
        if (!text) {
          setStatus("Type or paste text first.", "error");
          return;
        }
        setBusy(true);
        setStatus("Synthesizing…");
        vscode.postMessage({ type: "requestRead", text: text });
      });

      els.stop.addEventListener("click", () => {
        els.player.pause();
        els.player.currentTime = 0;
        setBusy(false);
        setStatus("Stopped.");
        vscode.postMessage({ type: "requestStop" });
      });

      els.player.addEventListener("ended", () => { setBusy(false); setStatus("Done."); });
      els.player.addEventListener("error", () => { setBusy(false); setStatus("Audio decode failed.", "error"); });

      window.addEventListener("message", (event) => {
        const msg = event.data;
        if (!msg) return;
        switch (msg.type) {
          case "play": {
            const src = "data:audio/" + msg.format + ";base64," + msg.audioBase64;
            els.player.src = src;
            els.player.playbackRate = parseFloat(els.rate.value);
            els.player.play().then(function () {
              setStatus(msg.label ? "Playing — " + msg.label : "Playing.");
            }).catch(function (err) {
              setBusy(false);
              setStatus("Playback failed: " + (err && err.message || err), "error");
            });
            break;
          }
          case "stop":
            els.player.pause();
            els.player.currentTime = 0;
            setBusy(false);
            setStatus("Stopped.");
            break;
          case "status":
            setBusy((msg.status || "").toLowerCase().indexOf("synthesiz") === 0);
            setStatus(msg.status, msg.tone);
            break;
          case "config":
            state = msg.config;
            renderAll();
            break;
        }
      });

      renderAll();
      vscode.postMessage({ type: "ready" });
      vscode.postMessage({ type: "log", payload: "M2 webview ready" });
    })();
  </script>
</body>
</html>`;
  }
}

interface SerializedConfig {
  provider: ProviderId;
  playbackRate: number;
  openai: { model: string; voice: string };
  minimax: { model: string; voice: string };
  mimo: { model: string; voice: string };
}

interface SerializedCatalog {
  id: ProviderId;
  label: string;
  models: { id: string; label: string }[];
  voices: { id: string; name: string; category: string; recommended?: boolean; models: string[] }[];
}

function serializeConfig(cfg: AppConfig): SerializedConfig {
  return {
    provider: cfg.provider,
    playbackRate: cfg.playbackRate,
    openai: { model: cfg.openai.model, voice: cfg.openai.voice },
    minimax: { model: cfg.minimax.model, voice: cfg.minimax.voice },
    mimo: { model: cfg.mimo.model, voice: cfg.mimo.voice },
  };
}

function serializeCatalogs(): SerializedCatalog[] {
  return PROVIDER_IDS.map((id) => {
    const c = CATALOGS[id];
    return {
      id,
      label: PROVIDER_LABELS[id],
      models: c.models.map((m) => ({ id: m.id, label: m.label })),
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
