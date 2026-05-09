# Changelog

All notable changes to **AI Voice Studio** are documented here. The format is
loosely [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
