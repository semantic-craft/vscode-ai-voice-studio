# Changelog

All notable changes to **AI Voice Studio** are documented here. The format is
loosely [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.1] — 2026-05-22

### Fixed
- Normalized synthesized text chunks so mixed Chinese / English input no
  longer produces chunks with leading whitespace while still preserving
  necessary English word spacing.

### Added
- Added runtime regression coverage for extension activation, lazy webview
  registration, playback prefetch cancellation, and text chunking boundaries.

## [0.6.0] — 2026-05-22

### Added
- **OpenAI full format palette.** Six output formats — `mp3`, `opus`,
  `aac`, `flac`, `wav`, `pcm` — selectable from the sidebar dropdown
  with descriptions. PCM is auto-wrapped with a 24 kHz / 16-bit WAV
  header for in-browser playback.
- **OpenAI server-side speed control.** Slider (0.25–4.0×) for `tts-1`
  and `tts-1-hd`; automatically hidden when `gpt-4o-mini-tts` is
  selected. Persisted only on slider release to avoid disk-write storms.
- **Custom voice ID support.** The voice field accepts arbitrary strings,
  so OpenAI custom voices (`voice_123abc`) work via `settings.json`
  without any extra UI.

### Changed
- Config updates from the webview are now serialized through a
  `queueConfigUpdate` chain, preventing race conditions when the user
  changes multiple settings in quick succession.
- All pending edits (instructions, speed, style prompts, preambles) are
  flushed via a single `commitPendingProviderEdits()` before Read and
  Test Voice, replacing the scattered per-provider flush blocks.
- MiniMax speed / volume / pitch sliders now split `input` (visual
  feedback) from `change` (config write), matching the new OpenAI speed
  pattern and eliminating high-frequency disk writes during dragging.
- `activationEvents` narrowed from `onStartupFinished` to the six
  specific views and commands, reducing cold-start overhead.

### Fixed
- Hardened audio playback and validation against edge cases from the
  previous release cycle.

## [0.5.2] — 2026-05-11

### Fixed
- Hardened runtime playback state so stale cancelled sessions no longer
  overwrite a newer read session.
- Fixed one-ahead chunk prefetch error handling to avoid unhandled promise
  rejections when the next chunk fails before the current chunk finishes.
- Fixed model switching so a provider always keeps a voice supported by the
  active model, including stale settings from older sessions.
- Fixed MiMo voice-clone uploads from files with missing or generic browser
  MIME types by normalizing the stored data URL.
- Fixed long unpunctuated input so it is still hard-split under
  `aiVoiceStudio.chunkSize` instead of sending an oversized request.

## [0.5.1] — 2026-05-11

### Changed
- README: added a top-level **Supported models** table so the
  marketplace listing makes the four-provider model lineup
  scannable at a glance. Docs-only — no code changes.

## [0.5.0] — 2026-05-11

### Added
- **Google Gemini provider.** Three preview models
  (`gemini-3.1-flash-tts-preview`, `gemini-2.5-flash-preview-tts`,
  `gemini-2.5-pro-preview-tts`), 30 prebuilt voices, inline
  `[whispers]/[laughs]/…` audio-tag chips, and an optional style preamble
  prefix. Raw 24 kHz PCM is wrapped to WAV in-process for webview playback.
- **MiMo v2.5 voice design + voice clone.** New
  `mimo-v2.5-tts-voicedesign` (describe the voice in natural language —
  no preset needed) and `mimo-v2.5-tts-voiceclone` (upload an mp3/wav
  ≤10 MB; cloned per request). Sample lives in `globalState`, never in
  settings.
- **Director Mode + Voice Design templates** for MiMo: one-click insert
  rich style prompts that read like a stage direction.
- **MiMo style + sound-event tag library.** Doc-aligned chip palettes
  with categories (`开心`, `严肃`, `兴奋`, `粤语`, `夹子音`, `笑`,
  `深呼吸`, `哽咽`, …) plus inline custom-tag input. The `唱歌` tag
  still overrides everything else.
- **MiMo style preset library.** Save the current
  (`stylePrompt`, opening tags, event tags) bundle by name; apply or
  delete from the sidebar. Stored under
  `aiVoiceStudio.mimo.stylePresets`.
- **MiniMax 2.8 / 2.6 / 02 / 01 turbo variants** —
  `speech-2.8-turbo`, `speech-2.6-turbo`, `speech-02-turbo`,
  `speech-01-hd`, `speech-01-turbo` join the model list. Each is
  labelled with its trade-off (fastest, low-latency, small-language, …).
- **MiniMax voice character knobs.** Inline volume (0–10), pitch
  (-12..+12 semitones), emotion (`auto / happy / sad / angry / fearful /
  disgusted / surprised / neutral`), and channel (mono / stereo).
- **MiniMax 语气词 chips** for the speech-2.8 family —
  `(laughs) (chuckle) (sighs) (coughs) (clear-throat) (groans)
  (breath) (pant) (gasps) (humming) (emm) (sneezes) …` — click to
  insert at the cursor in the transcript.
- **MiniMax pause helper.** Quick `+0.3s / +0.5s / +1s / +2s / +3s`
  buttons insert `<#x#>` markers at the cursor.
- **MiniMax pronunciation overrides.** Multi-line editor for
  `pronunciation_dict.tone` entries — `处理/(chu3)(li3)` for pinyin
  or `危险/dangerous` for substitution.
- **Top-tier UX pass.** Provider chip strip (instant click-to-switch)
  replaces the dropdown; "Set key…" rescue link in the header; ▶ Test
  button reads a short sample with the current voice; collapsible
  "Voice character" card consolidates per-provider settings; semantic
  status colours with a dot indicator; state-aware primary button;
  keyboard shortcut footer with `<kbd>` styling.
- **Surfaced settings inline.** OpenAI `instructions`, MiniMax `speed /
  region / languageBoost`, Gemini `stylePreamble` are now editable
  directly from the sidebar — no settings.json round-trip.

### Changed
- `aiVoiceStudio.provider` enum now includes `gemini`. The provider
  catalog grew from three to four backends.
- Voice-clone payload is stored in `ExtensionContext.globalState`
  rather than synced settings — base64 mp3/wav samples are too big for
  `settings.json`.
- README + marketplace description updated to reflect the four-provider
  offering and the new feature surface.

## [0.4.0] — 2026-05-10

### Added
- Status bar item showing session state (idle / synth spinner / playing
  *i/n* / error). Click to focus the sidebar.
- Voice dropdown grouped by category via `<optgroup>` — MiniMax's larger
  voice list is now scannable.
- Inline progress bar with `i / n` counter under the buttons during
  multi-chunk playback.
- MiMo audio-event chip row (`笑声`, `叹息`, `哭声`, `咳嗽`, `惊讶`),
  parallel to the opening style chips.
- Inline "Set API Key" rescue button on the status row when synthesis is
  blocked by a missing key.

### Changed
- Sidebar badge no longer carries an in-development milestone marker.

## [0.3.0] — 2026-05-10

### Added
- Sentence-aware text chunker (`text-chunker.ts`) splits long input at
  Chinese / English sentence terminators; oversized sentences fall back to
  soft-break punctuation.
- Playback session pipeline (`playback-session.ts`): synthesizes chunk
  *i+1* in flight while chunk *i* is still playing.
- Pause / Resume primary button driven by an `idle → playing → paused`
  state machine. Stop fully aborts the active session via
  `AbortController`.
- MiMo opening-style chip selector with `开心`, `难过`, `严肃`, `平静`,
  `兴奋`, `唱歌` presets. Tags inject as a `(开心)` prefix per chunk; the
  `唱歌` tag overrides others.
- Settings: `aiVoiceStudio.chunkSize`, `aiVoiceStudio.mimo.openingStyleTags`,
  `aiVoiceStudio.mimo.audioEventTags`.

## [0.2.0] — 2026-05-10

### Added
- Multi-provider support — **MiniMax** and **MiMo Token Plan** join OpenAI.
- Provider switcher in the sidebar; model and voice dropdowns rebuild to
  match the active provider.
- Provider-keyed SecretStorage so every backend keeps its own API key.
- Voice catalogs: 8 OpenAI voices, 15 MiniMax voices (English / Chinese /
  multilingual / anime archetypes), 11 MiMo voices (V2.5 + legacy V2).
- MiniMax: region switch (`mainland` / `global`), server-side speed,
  sample rate, bitrate, and `languageBoost` knobs.
- MiMo: Token Plan key validation (rejects pay-as-you-go `sk-` keys),
  free-form `stylePrompt` for tone shaping.

### Changed
- Generic `aiVoiceStudio.setApiKey` / `clearApiKey` commands replace the
  OpenAI-only versions; both pop a provider QuickPick first.

## [0.1.0] — 2026-05-10

### Added
- Initial OpenAI Quick Read MVP migrated from the Raycast extension.
- Activity Bar entry + sidebar webview with provider, voice, speed and
  inline text box.
- Commands: `Read Selection (or Clipboard)` (⌘⌥R / Ctrl+Alt+R),
  `Stop Reading` (⌘⌥S / Ctrl+Alt+S), `Set API Key…`, `Clear API Key…`,
  `Focus Sidebar`.
- Editor context-menu entry for selected text.
- HTML5 `<audio>` playback with client-side `playbackRate` (0.5–4.0);
  base64 data URLs avoid temp files.
