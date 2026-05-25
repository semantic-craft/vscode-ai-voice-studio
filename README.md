# Qwen TTS Studio

Read text aloud inside VS Code with Alibaba Cloud **Qwen-TTS** through
DashScope / Model Studio. The extension is a focused Qwen-TTS sidebar: choose
model, voice, endpoint, language, optional instruct-model style instructions,
and playback speed.

## Features

- Qwen-TTS non-streaming HTTP synthesis via DashScope.
- Default model: `qwen3-tts-flash`.
- Optional style-instruction model: `qwen3-tts-instruct-flash`.
- `instructions` is sent only with `qwen3-tts-instruct-flash`.
- Language control through Qwen's `language_type`: `Auto`, `Chinese`,
  `English`, and `German`.
- China and international DashScope endpoints.
- Chunked long-text playback with next-chunk prefetch.
- Sidebar read, test voice, pause/resume, stop, progress, and speed control.
- Quick Read command for the current selection or clipboard.
- DashScope API key from VS Code SecretStorage or `DASHSCOPE_API_KEY`.

## Setup

1. Install the extension in VS Code.
2. Run **Qwen TTS Studio: Set DashScope API Key...** or set
   `DASHSCOPE_API_KEY` in the VS Code extension host environment.
3. Open the Qwen TTS sidebar, choose a voice and language, paste text, and
   press **Read**.

## Commands

| Command | Description |
| --- | --- |
| `aiVoiceStudio.quickRead` | Read the selected editor text, or clipboard text if there is no selection. |
| `aiVoiceStudio.stop` | Stop current playback and cancel in-flight synthesis. |
| `aiVoiceStudio.setApiKey` | Store a DashScope API key in VS Code SecretStorage. |
| `aiVoiceStudio.clearApiKey` | Clear the stored DashScope API key. |
| `aiVoiceStudio.focusView` | Focus the Qwen TTS sidebar. |

## Settings

| Setting | Default | Notes |
| --- | --- | --- |
| `aiVoiceStudio.playbackRate` | `1` | Local playback speed, 0.5-4.0. |
| `aiVoiceStudio.chunkSize` | `250` | Maximum characters per synthesis chunk. |
| `aiVoiceStudio.qwen.model` | `qwen3-tts-flash` | `qwen3-tts-flash` or `qwen3-tts-instruct-flash`. |
| `aiVoiceStudio.qwen.voice` | `Cherry` | Qwen voice ID. |
| `aiVoiceStudio.qwen.endpoint` | `china` | `china` or `international`. |
| `aiVoiceStudio.qwen.languageType` | `Auto` | Sent as `language_type`. |
| `aiVoiceStudio.qwen.instructions` | `""` | Sent only with `qwen3-tts-instruct-flash`. |

## Qwen-TTS Request Shape

The extension uses the DashScope multimodal generation endpoint:

```http
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
Authorization: Bearer ${DASHSCOPE_API_KEY}
Content-Type: application/json
```

```json
{
  "model": "qwen3-tts-flash",
  "input": {
    "text": "...",
    "voice": "Cherry",
    "language_type": "Chinese"
  }
}
```

For `qwen3-tts-instruct-flash`, the extension may add:

```json
{
  "input": {
    "instructions": "Read warmly with a measured cadence."
  }
}
```

## Development

```bash
npm install
npm test
npm run lint
npm run vscode:prepublish
```

Live DashScope calls should be opt-in in any future smoke script. Do not call
DashScope from tests unless explicitly guarded by an environment variable such
as `AI_VOICE_STUDIO_LIVE=1`.
