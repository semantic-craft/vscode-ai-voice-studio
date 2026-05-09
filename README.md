# AI Voice Studio

Read text aloud inside VS Code with **OpenAI**, **MiniMax**, or **MiMo** TTS — no
intermediate files, no separate apps. Driven from a sidebar panel and a single
keyboard shortcut.

> Migrated from the [Raycast AI Voice Studio](https://github.com/XWzhangSZU?tab=repositories)
> extension. Same providers, same voice catalog, rebuilt for VS Code's Activity
> Bar with chunked synthesis, pause/resume, and per-chunk prefetch.

_Screenshots: TODO — sidebar, status bar progress, MiMo style chips._

## Features

- **Three providers, one switcher.** OpenAI (`gpt-4o-mini-tts`, `tts-1`,
  `tts-1-hd`), MiniMax (`speech-2.8-hd`/`2.6-hd`/`02-hd`, mainland & global
  endpoints), MiMo Token Plan (`mimo-v2.5-tts`, `mimo-v2-tts`).
- **Sidebar UI.** Activity Bar entry with provider / model / voice / speed +
  inline text box. Voices grouped by category for easy scan.
- **Chunked synthesis with 1-ahead prefetch.** Long input is split at sentence
  boundaries. The next chunk is being synthesized while the current chunk
  plays, so the gap between chunks is essentially network latency.
- **Pause / Resume / Stop.** Pause is local (audio element); Stop aborts the
  active fetch, drains the queue, and frees the session.
- **MiMo emotion + audio-event tags.** Toggleable chip rows inject
  `(开心)`, `(严肃)` style prefixes plus `（笑声，叹息）` event prefixes
  before each chunk.
- **Speaking-instructions support** for `gpt-4o-mini-tts`, plus speed /
  sample-rate / bitrate / language-boost knobs for MiniMax.
- **Status bar indicator.** Synth spinner → playing `i/n` → idle, click to
  focus the sidebar.
- **Secrets in SecretStorage.** API keys never touch settings.json.

## Quick start

1. Install the `.vsix` (or from the Marketplace once published):
   ```
   code --install-extension ai-voice-studio-0.4.0.vsix
   ```
2. Open the **AI Voice Studio** entry in the Activity Bar.
3. Run `AI Voice Studio: Set API Key…` from the Command Palette and pick the
   provider you want. Paste your key. (Or just press **Read** with no key set —
   the side panel offers a "Set API Key" button inline.)
4. Select voice and speed in the sidebar. Type or paste text into the box and
   click **▶ Read**, or select text in the editor and press **⌘⌥R** /
   **Ctrl+Alt+R**.
5. **⏸ Pause** / **▶ Resume** with the same primary button. **⏹ Stop** or
   **⌘⌥S** / **Ctrl+Alt+S** cancels the in-flight session.

## Providers

### OpenAI

- Models: `gpt-4o-mini-tts` (default), `tts-1`, `tts-1-hd`.
- Voices: `cedar`, `alloy`, `verse`, `marin`, plus the legacy `tts-1` set.
- Speaking instructions are honored on `gpt-4o-mini-tts` only —
  `aiVoiceStudio.openai.instructions` lets you bias tone, pacing, language.
- Custom base URL via `aiVoiceStudio.openai.baseUrl` (any OpenAI-compatible
  endpoint).

### MiniMax

- Models: `speech-2.8-hd` (default), `speech-2.6-hd`, `speech-02-hd`.
- 15 curated voice IDs (English news, Chinese radio host, anime archetypes,
  multilingual presets).
- Region switch — `mainland` → `api.minimaxi.com`, `global` →
  `api.minimax.io`.
- Server-side `speed` (0.5–2.0), `sampleRate`, `bitrate`, `languageBoost`.

### MiMo

- Models: `mimo-v2.5-tts` (default, Chinese & English voices), `mimo-v2-tts`
  (legacy).
- Use a **Token Plan key** (`tp-…`). Pay-as-you-go `sk-…` keys are rejected
  early with a clear message.
- Style chips → opening tag prefix `(开心)`, `(唱歌)`, etc.
- Sound chips → audio event prefix `（笑声，叹息）`.
- Free-form `aiVoiceStudio.mimo.stylePrompt` is sent as a leading user message
  for tone shaping.

## Commands

| Command | Default keybinding |
|---|---|
| `AI Voice Studio: Read Selection (or Clipboard)` | ⌘⌥R / Ctrl+Alt+R |
| `AI Voice Studio: Stop Reading` | ⌘⌥S / Ctrl+Alt+S |
| `AI Voice Studio: Set API Key…` | — |
| `AI Voice Studio: Clear API Key…` | — |
| `AI Voice Studio: Focus Sidebar` | — |

## Settings cheat sheet

| Key | Default | Notes |
|---|---|---|
| `aiVoiceStudio.provider` | `openai` | `openai` \| `minimax` \| `mimo` |
| `aiVoiceStudio.playbackRate` | `1` | 0.5–4.0; client-side, no re-synth |
| `aiVoiceStudio.chunkSize` | `250` | Max chars per chunk (80–2000) |
| `aiVoiceStudio.openai.model` | `gpt-4o-mini-tts` | |
| `aiVoiceStudio.openai.voice` | `cedar` | |
| `aiVoiceStudio.openai.instructions` | `""` | Only on `gpt-4o-mini-tts` |
| `aiVoiceStudio.minimax.region` | `mainland` | |
| `aiVoiceStudio.minimax.speed` | `1` | 0.5–2.0 |
| `aiVoiceStudio.mimo.openingStyleTags` | `[]` | Driven by Style chips |
| `aiVoiceStudio.mimo.audioEventTags` | `[]` | Driven by Sound chips |

(Full schema in `package.json` → `contributes.configuration`.)

## How chunking works

Long input is split at Chinese / English sentence terminators
(`。！？；…\.!?;`), merged so each chunk fits under `chunkSize`, and overflow
inside one sentence falls back to soft-break punctuation (`，、,`). The
session pipelines synthesis: while chunk *i* plays, chunk *i+1* is already
being fetched. **Stop** aborts the in-flight `fetch` via `AbortController`;
**Pause** only suspends the `<audio>` element so the prefetch keeps filling
the queue.

## Troubleshooting

- *"X API key not set"* → click the inline **Set API Key** button or run the
  command. Keys live in VS Code's SecretStorage.
- *"Use a MiMo Token Plan key (tp-…), not a pay-as-you-go sk- key."* → MiMo's
  TTS endpoint only accepts Token Plan keys.
- *"Invalid voice/model for …"* → switching models can leave a voice that
  isn't supported. Re-pick a voice; the dropdown filters to the active model.

## License

MIT — see `LICENSE`.
