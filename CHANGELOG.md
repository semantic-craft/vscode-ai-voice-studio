# Changelog

## 0.7.1 - 2026-05-25

- Sidebar no longer clobbers the Instructions textarea while the user is
  actively typing in it; an external config refresh now preserves in-progress
  edits.
- Playback rate from settings now updates the live `<audio>` element, so
  speed changes apply to the currently-playing chunk instead of only the next
  one.
- Test-Voice button picks a phrase matching the selected `language_type`
  (Chinese / English / German / Auto) instead of always speaking English.
- Text chunker prefers commas / whitespace breaks before hard-splitting long
  sentences without sentence-ending punctuation, removing many mid-word cuts.
- `Set DashScope API Key…` rejects whitespace-only input and no longer stores
  an empty secret.
- Audio sniffer distinguishes AAC ADTS frames from MP3 sync frames using the
  layer-bit field, so AAC payloads without an explicit format hint are tagged
  correctly.
- Default `waitUntilReady` timeout bumped from 3s to 5s to better cover
  cold-activation on slower systems.

## 0.7.0 - 2026-05-25

- Converted the extension into a focused Qwen-TTS Studio.
- Removed all non-Qwen TTS surfaces, settings, source files, and tests.
- Removed the hidden compatibility mapping for old local configuration so the
  extension now uses Qwen settings directly.
- Kept DashScope / Alibaba Cloud key routing through
  `DASHSCOPE_API_KEY` and `aiVoiceStudio.qwen.dashscopeApiKey`.
- Kept chunked playback, cancellation, timeout handling, test voice, quick read,
  speed control, stop reading, and sidebar status/progress.
- Hardened `output.audio.data` playback by sniffing container bytes only when
  Qwen does not provide an explicit audio format hint.

## 0.6.1

- Qwen-TTS migration groundwork: DashScope endpoint, Qwen model/voice/language
  settings, `qwen3-tts-flash` default, optional instruct-model instructions,
  and base64/URL audio handling.
