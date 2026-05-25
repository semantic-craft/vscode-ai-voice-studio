# AI Voice Studio

Read text aloud inside VS Code with multiple TTS providers — **OpenAI**, **MiMo** (小米), **Google Gemini**, and **Alibaba Qwen** — switchable from a single sidebar.

## Features

- Provider switcher at the top of the sidebar: OpenAI, MiMo, Gemini, Qwen.
- Per-provider model and voice catalogs, with category grouping.
- Per-provider parameter blocks:
  - **OpenAI** — model, voice, format (mp3 / wav / opus / aac / flac / pcm), instructions, server-side speed, custom base URL.
  - **MiMo** — model (preset / voicedesign / voiceclone / legacy v2), voice presets, format, style prompt, opening-style tags, audio-event tags, saved style presets, voice clone uploader (≤10 MB).
  - **Gemini** — 30 prebuilt voices, style preamble, audio-tag chips.
  - **Qwen** — model, voice, endpoint (China / International), `language_type` (Auto / Chinese / English / German), optional instructions for `qwen3-tts-instruct-flash`.
- Chunked long-text playback with next-chunk prefetch.
- Sidebar Read, Test Voice, Pause / Resume, Stop, progress, and local playback-speed control.
- Quick Read command for the current selection or clipboard (⌘⌥R / Ctrl+Alt+R).
- API keys per provider in VS Code SecretStorage, plus environment-variable fallbacks (`OPENAI_API_KEY`, `GEMINI_API_KEY` / `GOOGLE_API_KEY`, `DASHSCOPE_API_KEY`).

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
| `aiVoiceStudio.provider` | `openai` | One of `openai`, `mimo`, `gemini`, `qwen`. |
| `aiVoiceStudio.playbackRate` | `1` | Local playback speed, 0.5–4.0. |
| `aiVoiceStudio.chunkSize` | `250` | Maximum characters per synthesis chunk. |
| `aiVoiceStudio.openai.*` | — | model, voice, format, instructions, speed, baseUrl. |
| `aiVoiceStudio.mimo.*` | — | model, voice, format, baseUrl, stylePrompt, openingStyleTags, audioEventTags, stylePresets. |
| `aiVoiceStudio.gemini.*` | — | model, voice, baseUrl, stylePreamble. |
| `aiVoiceStudio.qwen.*` | — | model, voice, endpoint, languageType, instructions. |

## Development

```bash
npm install
npm test
npm run lint
npm run vscode:prepublish
```

Live API calls are opt-in inside tests. Do not call OpenAI / MiMo / Gemini / DashScope from tests unless explicitly guarded by an environment variable such as `AI_VOICE_STUDIO_LIVE=1`.
