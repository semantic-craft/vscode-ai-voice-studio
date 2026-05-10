# AI Voice Studio

Read text aloud inside VS Code with **OpenAI**, **MiniMax**, **MiMo**, and
**Google Gemini** TTS — no intermediate files, no separate apps. Driven from
a sidebar panel and a single keyboard shortcut.

> Migrated from the [Raycast AI Voice Studio](https://github.com/xwzhangSZU/Raycast-Minimax-TTS)
> extension. Same providers, plus voice clone, voice design, director-mode
> templates, MiniMax 语气词 chips, Gemini 30-voice roster, chunked synthesis,
> pause/resume, and per-chunk prefetch.

_Screenshots: TODO — sidebar, status bar progress, MiMo style chips._

## Features

- **Four providers, one switcher.**
  - OpenAI (`gpt-4o-mini-tts`, `tts-1`, `tts-1-hd`)
  - MiniMax (`speech-2.8-hd`/`turbo`, `2.6-hd`/`turbo`, `02-hd`/`turbo`,
    `01-hd`/`turbo`; mainland & global endpoints)
  - MiMo Token Plan (`mimo-v2.5-tts`, `mimo-v2.5-tts-voicedesign`,
    `mimo-v2.5-tts-voiceclone`, `mimo-v2-tts`)
  - Google Gemini (`gemini-3.1-flash-tts-preview`, `gemini-2.5-flash-preview-tts`,
    `gemini-2.5-pro-preview-tts`) with 30 prebuilt voices.
- **Sidebar UI optimized for one-handed driving.** Provider chip strip
  (instant click-to-switch), grouped voice dropdown, ▶ Test button to
  preview the current voice, semantic-coloured status bar, state-aware
  Read/Pause/Resume button, keyboard-shortcut footer.
- **Voice character card.** A single collapsible panel surfaces every
  per-provider knob — OpenAI instructions, MiniMax region/speed/volume/
  pitch/emotion/channel/language-boost/语气词/pause/pronunciation, MiMo
  style prompt + chips + voice clone uploader + preset library, Gemini
  style preamble + audio-tag chips.
- **Voice clone** (MiMo). Upload an mp3/wav clip (≤10 MB after base64);
  the voice is cloned per request. Sample lives in `globalState`, never
  in `settings.json`.
- **Voice design** (MiMo). Describe the target voice in plain language —
  no preset needed.
- **MiniMax 语气词 chips** (`speech-2.8-hd`/`turbo` only): click `(laughs)`,
  `(sighs)`, `(emm)`, `(humming)`, etc. to insert at the cursor.
- **MiniMax pause helper.** Insert `<#0.3#>`/`<#0.5#>`/`<#1#>`/… markers
  between words.
- **MiniMax pronunciation overrides.** Multi-line editor for
  `pronunciation_dict.tone` — `处理/(chu3)(li3)` for pinyin, or
  `危险/dangerous` for substitution.
- **Gemini audio tags.** Inline `[whispers]`, `[laughs]`, `[gasps]`,
  `[applause]`, etc. — click to insert at the cursor in the transcript.
- **Chunked synthesis with 1-ahead prefetch.** Long input is split at
  sentence boundaries; the next chunk is being synthesized while the
  current chunk plays.
- **Pause / Resume / Stop.** Pause is local (audio element); Stop aborts
  the in-flight fetch and drains the queue.
- **MiMo emotion + audio-event tags.** Toggleable chip rows inject
  `(开心)`, `(严肃)` style prefixes plus `（笑声，叹息）` event prefixes
  before each chunk. The `唱歌` tag overrides everything else.
- **Style preset library** (MiMo). Save (`stylePrompt`, opening tags,
  event tags) bundles by name; apply or delete from the sidebar.
- **Director Mode + Voice Design templates** (MiMo). One-click insert
  rich, doc-aligned style prompts.
- **Status bar indicator.** Synth spinner → playing `i/n` → idle, click
  to focus the sidebar.
- **Secrets in SecretStorage.** API keys never touch `settings.json`.

## Quick start

1. Install the `.vsix` (or from the Marketplace once published):
   ```
   code --install-extension ai-voice-studio-0.5.0.vsix
   ```
2. Open the **AI Voice Studio** entry in the Activity Bar.
3. Click the **Set key…** link in the sidebar header (or run
   `AI Voice Studio: Set API Key…` from the Command Palette) and pick a
   provider. Paste your key.
4. Tap the provider chip strip to switch backends instantly. Pick a voice;
   click **▶** for a quick sample.
5. Type or paste text. Click **▶ Read**, or select text in the editor and
   press **⌘⌥R** / **Ctrl+Alt+R**.
6. **⏸ Pause** / **▶ Resume** with the same primary button. **⏹ Stop** or
   **⌘⌥S** / **Ctrl+Alt+S** cancels the in-flight session.

## Providers

### OpenAI

- Models: `gpt-4o-mini-tts` (default), `tts-1`, `tts-1-hd`.
- Voices: `cedar`, `alloy`, `verse`, `marin`, plus the legacy `tts-1` set.
- Speaking **Instructions** (only on `gpt-4o-mini-tts`) are editable inline
  from the Voice character card.
- Custom base URL via `aiVoiceStudio.openai.baseUrl` (any
  OpenAI-compatible endpoint).

### MiniMax

- Models: `speech-2.8-hd` (default), `speech-2.8-turbo`, `speech-2.6-hd`,
  `speech-2.6-turbo`, `speech-02-hd`, `speech-02-turbo`, `speech-01-hd`,
  `speech-01-turbo`.
- 15 curated voice IDs (English news, Chinese radio host, anime
  archetypes, multilingual presets).
- Region switch — `mainland` → `api.minimaxi.com`, `global` →
  `api.minimax.io`.
- Voice character knobs: `speed` (0.5–2.0), `vol` (0–10),
  `pitch` (-12..+12 semitones), `emotion`
  (`auto/happy/sad/angry/fearful/disgusted/surprised/neutral`),
  `channel` (mono/stereo), `languageBoost`
  (40+ languages — `auto`, `Chinese`, `Chinese,Yue`, `English`, `Japanese`,
  `Korean`, `Spanish`, `French`, `German`, `Russian`, `Arabic`,
  `Portuguese`, `Italian`, `Indonesian`, `Vietnamese`, `Thai`, …).
- 语气词 chips (speech-2.8 family): `(laughs) (chuckle) (sighs) (coughs)
  (clear-throat) (groans) (breath) (pant) (gasps) (humming) (emm)
  (sneezes) …` — inserted at the cursor in the transcript.
- Pause helper: `<#0.3#>` / `<#1#>` / `<#3#>` markers between words.
- Pronunciation overrides: `处理/(chu3)(li3)` (pinyin) or
  `危险/dangerous` (substitution), one per line.

### MiMo

- Models:
  - `mimo-v2.5-tts` — preset voices (Bingtang / Chloe / etc.). Supports
    singing mode and the full tag library.
  - `mimo-v2.5-tts-voicedesign` — describe the target voice in plain
    language (no preset needed).
  - `mimo-v2.5-tts-voiceclone` — upload an mp3/wav clip (≤10 MB) and
    speak with the cloned voice.
  - `mimo-v2-tts` — legacy V2 model with the original Chinese/English
    presets.
- Use a **Token Plan key** (`tp-…`). Pay-as-you-go `sk-…` keys are
  rejected early with a clear message.
- Style chips → opening tag prefix (`(开心)`, `(粤语)`, `(唱歌)`, …).
- Sound chips → audio event prefix `（紧张，深呼吸，哽咽）`.
- Custom-tag input lets you add any tag the docs accept.
- Director Mode + Voice Design templates: one-click insert structured
  style prompts.
- Style preset library: save (`stylePrompt`, opening tags, event tags)
  bundles by name; apply or delete from the sidebar.

### Gemini

- Models: `gemini-3.1-flash-tts-preview` (default), `gemini-2.5-flash-preview-tts`,
  `gemini-2.5-pro-preview-tts`.
- 30 prebuilt voices (Zephyr / Puck / Charon / Kore / Aoede / Leda /
  Orus / …) organised by personality category.
- Style preamble — a short natural-language directive prefixed in front of
  every chunk (e.g. `"Read in a calm narrator voice"`).
- Inline audio tags via chip insertion: `[whispers]`, `[laughs]`,
  `[gasps]`, `[applause]`, `[sighs]`, `[gentle laughter]`, etc.
- Audio is returned as raw 24 kHz PCM and wrapped to WAV in-process for
  webview playback.
- Free on AI Studio's free tier (rate-limited per Google's policy).

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
| `aiVoiceStudio.provider` | `openai` | `openai` \| `minimax` \| `mimo` \| `gemini` |
| `aiVoiceStudio.playbackRate` | `1` | 0.5–4.0; client-side, no re-synth |
| `aiVoiceStudio.chunkSize` | `250` | Max chars per chunk (80–2000) |
| `aiVoiceStudio.openai.model` | `gpt-4o-mini-tts` | |
| `aiVoiceStudio.openai.instructions` | `""` | Only on `gpt-4o-mini-tts` |
| `aiVoiceStudio.minimax.model` | `speech-2.8-hd` | 8 model variants |
| `aiVoiceStudio.minimax.region` | `mainland` | |
| `aiVoiceStudio.minimax.speed` | `1` | 0.5–2.0 |
| `aiVoiceStudio.minimax.vol` | `1` | 0–10 |
| `aiVoiceStudio.minimax.pitch` | `0` | -12..+12 semitones |
| `aiVoiceStudio.minimax.emotion` | `auto` | `auto/happy/sad/angry/fearful/disgusted/surprised/neutral` |
| `aiVoiceStudio.minimax.channel` | `1` | 1 mono, 2 stereo |
| `aiVoiceStudio.minimax.languageBoost` | `""` | 40+ languages |
| `aiVoiceStudio.minimax.pronunciationDict` | `[]` | One entry per item, e.g. `处理/(chu3)(li3)` |
| `aiVoiceStudio.mimo.model` | `mimo-v2.5-tts` | preset / voicedesign / voiceclone / v2 |
| `aiVoiceStudio.mimo.openingStyleTags` | `[]` | Driven by Style chips |
| `aiVoiceStudio.mimo.audioEventTags` | `[]` | Driven by Sound chips |
| `aiVoiceStudio.mimo.stylePrompt` | `""` | Doubles as voice description for `voicedesign` |
| `aiVoiceStudio.mimo.stylePresets` | `[]` | Saved style bundles |
| `aiVoiceStudio.gemini.model` | `gemini-3.1-flash-tts-preview` | |
| `aiVoiceStudio.gemini.voice` | `Kore` | 30 prebuilt voices |
| `aiVoiceStudio.gemini.stylePreamble` | `""` | Optional natural-language preamble |

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

- *"X API key not set"* → click the inline **Set API Key** button or run
  the command. Keys live in VS Code's SecretStorage.
- *"Use a MiMo Token Plan key (tp-…), not a pay-as-you-go sk- key."* →
  MiMo's TTS endpoint only accepts Token Plan keys.
- *"Invalid voice/model for …"* → switching models can leave a voice that
  isn't supported. Re-pick a voice; the dropdown filters to the active
  model.
- *"Voice clone sample exceeds 10 MB."* → the per-request base64 limit is
  ~10 MB. Trim the source clip or re-encode at a lower bitrate.

## License

MIT — see `LICENSE`.
