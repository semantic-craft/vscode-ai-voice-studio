# Changelog

## 0.12.3 - 2026-05-28

Fix the "Set API Key" flow, which gave no sign that a key had been saved.

- **Root cause**: the sidebar's Set API Key button ran the generic
  `setApiKey` command, which opened a *provider picker* first. Clicking a
  button labelled "Set API Key" and then getting a provider QuickPick was
  confusing — pasting the key into that picker's filter and pressing Enter
  matched no provider, so the command silently returned with nothing saved
  and no message.
- **Fix**: the sidebar button now stores the key for the *currently active*
  provider directly — no picker — going straight to the key input box. The
  command-palette `AI Voice Studio: Set API Key…` still asks which provider,
  since there's no active-provider context there.
- **Feedback**: saving now gives three confirmations — the VS Code toast, a
  `✓ … API key saved` line in the sidebar status, and a persistent badge.
  The button shows **API Key ✓** (muted) when a key is stored for the active
  provider and **Set API Key** (accent) when it isn't. The badge reflects
  existing keys on load and updates when you switch providers or clear a key.

## 0.12.2 - 2026-05-28

Discoverability + sidebar polish pass. No change to the synthesis path —
audio output is byte-for-byte the same as 0.12.1.

- **Marketplace metadata**: `displayName` is now
  `AI Voice Studio: Qwen, MiniMax, MiMo & Gemini TTS`, the `description` leads
  with a Chinese one-liner (English second) so the search-result preview shows
  the highlights in Chinese first, and `keywords` gains the phrase forms people
  actually type — `qwen tts`, `minimax tts`, `mimo tts`, `gemini tts` — plus
  bare provider names and Chinese terms (`语音合成`, `文字转语音`, `朗读`,
  `通义千问`, `小米`). Takes effect only after a republish re-indexes the
  Marketplace.
- **Set API Key button**: the faint top-right `Set key…` text link became a
  filled accent button labelled **Set API Key** (larger, bold), so first-run
  users can see where to paste a key.
- **MiniMax 语气词 chips (display fix)**: the chips rendered the raw English
  token (`(laughs)`, `(sighs)`) instead of their Chinese label. They now show
  中文 (笑声 / 叹气 / 换气 …); clicking still inserts the documented MiniMax
  marker, and the tooltip shows exactly what gets inserted. Per the official
  T2A docs the marker stays English-in-parens even inside Chinese text, so the
  inserted token is unchanged — only the chip label is localized.
- **MiniMax emotion dropdown**: relabelled to pure Chinese (开心 / 伤感 /
  愤怒 / 害怕 / 厌恶 / 惊讶 / 中性 / 自动). The underlying `emotion` API values
  are unchanged.
- **README**: now documents the MiniMax provider end to end (it was missing
  entirely), with a bilingual Chinese-first intro, the `minimax.*` settings
  row, and the `MINIMAX_API_KEY` / `MINIMAXI_API_KEY` env fallbacks.

## 0.12.1 - 2026-05-27

Hardening pass on the MiniMax provider after a session-goal audit caught
two bugs and one piece of dead code that wouldn't have surfaced in the
unit tests as written:

- **Fix (real)**: when the user picked `format: "pcm"`, the webview
  wrapped the bytes in a WAV header hardcoded to 24 kHz (the rate Qwen
  Realtime uses), so MiniMax PCM at its default 32 kHz played back ~75%
  speed and a fourth lower. Now wrapped inside `synthesizeMiniMax` with
  the actual `sampleRate` and surfaced to the webview as `format: "wav"`.
- **Fix (latency)**: the 15 s first-audio timer started when
  `synthesizeMiniMax` was entered, so a slow WebSocket handshake (up to
  10 s) ate the budget. Moved the timer arming inside the
  `connected_success` handler so it measures server-side TTFB only.
- **Cleanup**: the `task_failed` switch case was unreachable because the
  generic `base_resp.status_code !== 0` guard fired first. Reordered so
  `task_failed` keeps its dedicated message; the generic guard is now a
  safety net for unnamed error frames. New regression test pins this.
- **Test robustness**: the in-process server no longer reconstructs
  `WS_URLS.global` via string-replace; both originals are captured up
  front and restored verbatim.

## 0.12.0 - 2026-05-27

Restore the **MiniMax T2A** provider, this time on the WebSocket streaming
endpoint (`wss://api.minimaxi.com/ws/v1/t2a_v2`, with `api.minimax.io` for the
global region). MiniMax was dropped in 0.7.0 when the extension narrowed to
Qwen-only; bringing it back rounds the sidebar out to four providers (MiMo,
MiniMax, Gemini, Qwen) following the same factory/registry pattern the others
use.

- **New module** `src/core/minimax-tts.ts` — opens one WebSocket per text
  chunk, waits for `connected_success`, sends `task_start` →
  `task_continue` → buffers all hex-encoded audio segments until
  `is_final: true`, then sends `task_finish` and closes. Tiered timeouts
  (15 s first-audio, 90 s overall, 10 s handshake) mirror the Qwen realtime
  path. Audio segments are concatenated and surfaced as a single
  `SynthesizeResult` per chunk; the upstream playback session's lookahead
  keeps first-audio latency low for long text.
- **New module** `src/core/minimax-voices.ts` — six current models
  (`speech-2.8-hd/turbo`, `speech-2.6-hd/turbo`, `speech-02-hd/turbo`),
  curated Chinese/English voice roster from the previous v0.5.0 catalog
  plus `male-qn-qingse` from the doc example, emotion presets, language
  boost presets, and 语气词 inline tokens (2.8 family only).
- **Sidebar UI** gains a MiniMax provider tab with region, format,
  emotion, language-boost, speed/vol/pitch, and 语气词 chips for the 2.8
  models. Provider strip is already a 4-column grid so no layout change
  was needed.
- **Secrets** reads `MINIMAX_API_KEY` / `MINIMAXI_API_KEY` env vars as a
  fallback to the SecretStorage entry.
- **Config schema** adds `aiVoiceStudio.minimax.*` keys (model, voice,
  region, format, sampleRate, bitrate, speed, vol, pitch, emotion,
  englishNormalization, languageBoost) with the documented ranges as
  schema-level constraints.

No bump to runtime dependencies — `ws@8.21.0` from 0.11.x is reused for the
new socket. Bundle size grows ~6 KB (compiled JS for the new modules).

## 0.11.1 - 2026-05-27

Fix: 0.11.0 vsix shipped without `node_modules/ws/`, so the extension threw
`Cannot find module 'ws'` on activation and the sidebar webview never
rendered (empty panel after clicking the activity-bar icon). The cause was
`.vscodeignore` blanket-ignoring `node_modules/**` while the changelog claimed
the extension was "zero-dep at runtime" — that stopped being true the moment
0.11.0 added `ws` for the Qwen Realtime WebSocket path.

- Re-include `node_modules/ws/**` from the .vscodeignore deny-list (keeping
  `ws` test fixtures, .github metadata, and READMEs out so the package
  stays small — `ws@8.21.0` is itself zero-dep).
- No code changes; everything that worked in 0.11.0 still works once `ws`
  can be `require()`-ed.

## 0.11.0 - 2026-05-25

Add the **Qwen-TTS Realtime WebSocket** path (`qwen3-tts-flash-realtime` and
`qwen3-tts-instruct-flash-realtime`). Users can opt into the realtime model
from the sidebar model picker.

- **New runtime dependency**: `ws ^8.21.0` (no other transitive deps).
- **New module** `src/core/qwen-tts-realtime.ts` implementing the
  `wss://dashscope.aliyuncs.com/api-ws/v1/realtime` protocol (server_commit
  mode): connect → `session.update` → `input_text_buffer.append` →
  `session.finish`, then forward each `response.audio.delta` segment via the
  same `onSubChunk` callback the HTTP SSE path uses. Tiered timeouts
  (15 s first-audio, 90 s overall) carry over.
- **Dispatch** in `synthesizeQwen` routes any `*-realtime` model to the
  WebSocket implementation; non-realtime models continue to use HTTP SSE.

**Latency caveat (measured against DashScope):** the realtime model reaches
sub-100 ms server-side TTFB *after* the WebSocket is open. A cold-connect
HTTP handshake + WS upgrade still costs ~400 ms on a typical link, so the
single-shot first-audio time (~490 ms in our test) is only marginally
faster than the HTTP SSE path (~510 ms). The WebSocket path will become
genuinely lower-latency once we reuse a single open connection across
multiple synthesis calls — a follow-up.

## 0.10.0 - 2026-05-25

Big latency + ergonomics push for the Qwen-TTS streaming path, and the provider
lineup is trimmed to **Qwen / Gemini / MiMo** (OpenAI removed).

- **WebAudio seamless playback** for streamed PCM. Each SSE sub-chunk is now
  decoded into an `AudioBuffer` and scheduled on a shared `AudioContext`
  timeline, so adjacent segments butt up against each other sample-accurately.
  The 50–100 ms gap that `<audio>` introduced between segments is gone.
- **Multi-step lookahead.** `playback-session` now keeps a configurable
  prefetch window (default 2) — while the current chunk plays, the next two
  are already in flight. Multi-chunk text no longer stalls at chunk
  boundaries.
- **Tiered timeouts.** Qwen-TTS adds a 15 s time-to-first-byte timer on top of
  the existing 90 s overall ceiling. Stalled connections fail fast with a
  helpful message; long but live streams still get the full budget.
- **Removed OpenAI provider.** The provider switcher now exposes Qwen, Gemini,
  and MiMo. The OpenAI source, voices catalog, settings schema, and tests
  were removed. Existing `aiVoiceStudio.openai.*` settings are ignored
  (they'll be cleaned up the next time the user touches the section).
- **Provider default changed** from `openai` to `qwen`.

Test count goes from 25 (in 0.9.1) to 25 — we dropped the two OpenAI tests
and added two new ones for lookahead behavior and incremental SSE emit.

## 0.9.1 - 2026-05-25

- Fix(Qwen SSE): the previous 0.9.0 streaming reader buffered every PCM
  segment until the response finished, which silently regressed to
  non-streaming latency in production (the unit test masked it because the
  mock `Response` delivered the body in one read). The parser now uses a
  one-ahead buffer and emits each segment as soon as the next one arrives,
  tagging only the final segment with `isLast=true`. Live measurement against
  DashScope confirms first audio segment ~440–510 ms (versus ~1.0–1.4 s for
  the non-streaming URL path).
- Add a regression test that feeds SSE events through a real `ReadableStream`
  controller and asserts the emit happens between segments, not at the end.

## 0.9.0 - 2026-05-25

- Qwen-TTS now uses Server-Sent Events (`X-DashScope-SSE: enable`) under the
  hood. Each PCM segment that DashScope emits is forwarded to the webview as
  it arrives and wrapped as WAV for immediate playback. Expected first-audio
  latency drops from ~1.5–3 s (full-segment HTTP) to ~0.3–0.8 s on typical
  prose. (Other providers — OpenAI, MiMo, Gemini — keep the original
  non-streaming path.)
- Progress now advances on the trailing sub-chunk of each chunk-text segment,
  so multi-chunk text still shows N/M progress while streaming sub-segments
  inside each chunk.

## 0.8.1 - 2026-05-25

- Build: `vscode:prepublish` now wipes `out/` before recompiling, so stale
  compiled files (e.g. the old `types.js`) no longer leak into the VSIX.

## 0.8.0 - 2026-05-25

- Restored multi-provider support after the Qwen-only refactor. The sidebar
  again exposes a provider switcher with four providers:
  - **OpenAI** (`gpt-4o-mini-tts`, `tts-1`, `tts-1-hd`) with format / speed /
    instructions / custom base URL.
  - **MiMo** Token Plan (preset, voicedesign, voiceclone, legacy v2) with
    style prompt, opening-style tags, audio-event tags, saved style presets,
    and voice-clone uploader.
  - **Google Gemini** (Gemini 3.1 / 2.5 flash & pro TTS preview) with style
    preamble and audio-tag chips.
  - **Alibaba Qwen** (`qwen3-tts-flash`, `qwen3-tts-instruct-flash`) with
    DashScope endpoint, `language_type`, and instruct-only instructions.
- Removed the MiniMax provider that shipped in 0.6.1; the rest of the
  multi-provider surface is otherwise compatible with 0.6.1 configurations.
- API keys are stored per provider in VS Code SecretStorage. Environment
  variable fallbacks: `OPENAI_API_KEY`, `GEMINI_API_KEY` / `GOOGLE_API_KEY`,
  `DASHSCOPE_API_KEY`.
- Carried over the 0.7.1 UX fixes:
  - Qwen Instructions textarea no longer clobbers in-progress edits during
    external config refreshes.
  - Test-Voice button uses a language-appropriate sample phrase for Qwen.
  - Audio sniffer distinguishes AAC ADTS from MP3 sync frames.
  - `Set API Key…` rejects whitespace-only input.
  - Text chunker prefers commas / whitespace breaks before hard-splitting.
  - `waitUntilReady` default bumped from 3s to 5s.

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
