# Changelog

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
