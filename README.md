# AI Voice Studio — Qwen / MiMo / Gemini TTS

> **在 VS Code 里朗读文本、生成语音。** 一个侧边栏里一键切换 **Qwen TTS**、**MiMo TTS（小米）**、**Google Gemini TTS** 多家语音合成引擎；支持声音克隆、音色设计、情感与语气词标签、流式播放与亚秒级首字音延迟。论文听书、长文朗读、讲稿配音都适用。
>
> **Read text aloud inside VS Code.** Switch between **Qwen**, **MiMo** (小米) and **Google Gemini** text-to-speech (TTS) from a single sidebar — voice cloning, voice design, emotion & tone-word (语气词) tags, streaming playback, and sub-second first-audio latency.

Qwen-TTS uses **SSE streaming with WebAudio seamless concatenation** for sub-second first-audio latency.

## Features

- Provider switcher at the top of the sidebar: Qwen, Gemini, MiMo.
- Per-provider model and voice catalogs, with category grouping.
- Per-provider parameter blocks:
  - **Qwen** — model (`qwen3-tts-flash` / `qwen3-tts-instruct-flash`), voice, endpoint (China / International), `language_type` (Auto / Chinese / English / German), and instruct-only style instructions. **Default streaming path uses HTTP SSE** with `X-DashScope-SSE: enable`, delivering PCM segments to the sidebar as they're generated.
  - **Gemini** — Gemini 3.1 / 2.5 flash & pro TTS preview, 30 prebuilt voices, style preamble, audio-tag chips.
  - **MiMo** — preset / voicedesign / voiceclone / legacy v2 models, style prompt, opening-style tags, audio-event tags, saved style presets, voice-clone uploader (≤10 MB).
- **WebAudio seamless playback** for streamed PCM — adjacent SSE segments are scheduled on a shared `AudioContext` timeline, eliminating the 50–100 ms gap that an `<audio>` element would otherwise produce per segment.
- **Multi-step lookahead** (default 2 chunks ahead) so multi-chunk text doesn't stall between chunks.
- **Tiered timeouts** — 15 s time-to-first-byte plus a 90 s overall ceiling; idle connections are surfaced before the wall-clock budget expires.
- Sidebar Read, Test Voice, Pause / Resume (works with both WebAudio and HTMLAudio paths), Stop, progress, and local playback-speed control (live-applied to in-flight WebAudio sources).
- Quick Read command for the current selection or clipboard (⌘⌥R / Ctrl+Alt+R).
- API keys per provider in VS Code SecretStorage, plus environment-variable fallbacks (`DASHSCOPE_API_KEY` for Qwen, `GEMINI_API_KEY` / `GOOGLE_API_KEY` for Gemini).

## Setup

1. Install the extension in VS Code.
2. Open the **AI Voice Studio** sidebar.
3. Pick the provider you want from the strip at the top.
4. Click **Set key** (or run `AI Voice Studio: Set API Key…`) to store the API key.
5. Paste text, press **▶ Read**, or use ⌘⌥R / Ctrl+Alt+R on a selection in the editor.

## Commands

| Command | Description |
| --- | --- |
| `aiVoiceStudio.quickRead` | Read the selected editor text, or clipboard text if there is no selection. |
| `aiVoiceStudio.stop` | Stop current playback and cancel in-flight synthesis. |
| `aiVoiceStudio.setApiKey` | Store an API key for a chosen provider in VS Code SecretStorage. |
| `aiVoiceStudio.clearApiKey` | Clear the stored API key for a chosen provider. |
| `aiVoiceStudio.focusView` | Focus the AI Voice Studio sidebar. |

## Settings

| Setting | Default | Notes |
| --- | --- | --- |
| `aiVoiceStudio.provider` | `qwen` | One of `qwen`, `gemini`, `mimo`. |
| `aiVoiceStudio.playbackRate` | `1` | Local playback speed, 0.5–4.0. |
| `aiVoiceStudio.chunkSize` | `250` | Maximum characters per synthesis chunk. |
| `aiVoiceStudio.qwen.*` | — | model, voice, endpoint, languageType, instructions. |
| `aiVoiceStudio.gemini.*` | — | model, voice, baseUrl, stylePreamble. |
| `aiVoiceStudio.mimo.*` | — | model, voice, format, baseUrl, stylePrompt, openingStyleTags, audioEventTags, stylePresets. |

## Streaming pipeline (Qwen)

1. Text is segmented at sentence boundaries (`chunkSize` cap).
2. Up to `lookahead + 1` segments are kept in-flight at once (default lookahead = 2).
3. Each segment goes out as an HTTP POST with `X-DashScope-SSE: enable`. PCM sub-chunks stream back as Server-Sent Events.
4. The webview decodes each base64 PCM segment into an `AudioBuffer` (24 kHz, mono, 16-bit signed) and schedules an `AudioBufferSourceNode` on a shared `AudioContext`. Adjacent segments butt up against each other on the timeline — no audible gap.
5. Pause / resume call `audioCtx.suspend()` / `audioCtx.resume()`; Stop tears down all sources and suspends the context.

## Development

```bash
npm install
npm test
npm run lint
npm run vscode:prepublish
```

Live API calls are opt-in inside tests. Do not call DashScope / Gemini / MiMo from tests unless explicitly guarded by an environment variable such as `AI_VOICE_STUDIO_LIVE=1`.
