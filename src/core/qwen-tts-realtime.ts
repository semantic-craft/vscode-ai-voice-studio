import WebSocket from "ws";
import { TTSApiError, type SynthesizeContext, type SynthesizeResult } from "./providers";
import {
  REALTIME_WS_URLS,
  supportsInstructions,
  type QwenEndpoint,
  type QwenLanguageType,
  type QwenTTSModel,
} from "./qwen-voices";

const OVERALL_TIMEOUT_MS = 90_000;
const FIRST_AUDIO_TIMEOUT_MS = 15_000;

export interface QwenRealtimeSynthesizeArgs extends SynthesizeContext {
  apiKey: string;
  endpoint: QwenEndpoint;
  model: QwenTTSModel; // must be a *-realtime variant
  voice: string;
  languageType: QwenLanguageType;
  instructions?: string;
  /**
   * Called for each PCM segment received from the server (`response.audio.delta`).
   * `isLast=true` is emitted exactly once, when the trailing segment is known
   * to be final (after `response.done` / `session.finished`).
   */
  onSubChunk: (audioBase64: string, isLast: boolean) => void;
}

interface RealtimeEvent {
  type?: string;
  delta?: string;
  audio?: string;
  error?: { code?: string | number; message?: string };
  message?: string;
  code?: string | number;
  session?: { id?: string };
}

/**
 * Streaming synthesizer for `qwen3-tts-flash-realtime` / `*-instruct-flash-realtime`.
 *
 * Protocol summary (DashScope WebSocket Realtime, server_commit mode):
 *
 *   1. Open `wss://.../api-ws/v1/realtime?model=<model>` with
 *      `Authorization: Bearer <apiKey>` in the upgrade headers.
 *   2. Send `session.update` with voice, response_format (pcm), mode, and
 *      optional instructions (instruct-flash-realtime only).
 *   3. Send `input_text_buffer.append` with the text to synthesize.
 *   4. Send `session.finish` once we have no more text.
 *   5. Server streams `response.audio.delta` events; each `delta` field is
 *      base64-encoded 24 kHz mono 16-bit PCM.
 *   6. `response.done` / `session.finished` marks the end of audio. Close
 *      the socket.
 */
export async function synthesizeQwenRealtime(
  args: QwenRealtimeSynthesizeArgs,
): Promise<SynthesizeResult> {
  const text = args.text.trim();
  if (!text) throw new TTSApiError("Text cannot be empty.", -1);
  if (!args.apiKey) throw new TTSApiError("Qwen DashScope API key is missing.", -1);
  if (args.signal?.aborted) throw new TTSApiError("TTS synthesis cancelled.", -7);

  const url = `${REALTIME_WS_URLS[args.endpoint]}?model=${encodeURIComponent(args.model)}`;

  return new Promise<SynthesizeResult>((resolve, reject) => {
    let settled = false;
    let pendingSegment: string | null = null;
    let emittedAny = false;
    let sawFinish = false;
    let firstAudioTimer: ReturnType<typeof setTimeout> | undefined;
    let overallTimer: ReturnType<typeof setTimeout> | undefined;
    let onAbortListener: (() => void) | undefined;

    const cleanup = (): void => {
      if (firstAudioTimer) clearTimeout(firstAudioTimer);
      if (overallTimer) clearTimeout(overallTimer);
      if (args.signal && onAbortListener) {
        args.signal.removeEventListener("abort", onAbortListener);
      }
    };

    const settle = (
      fn: () => void,
    ): void => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        ws.removeAllListeners();
        ws.close();
      } catch {
        // ignore
      }
      fn();
    };

    const fail = (err: TTSApiError): void => settle(() => reject(err));
    const done = (): void => {
      // Flush the trailing buffered segment with isLast=true. If the server
      // closed without sending finish but did send audio, treat that as
      // best-effort success.
      if (pendingSegment !== null) {
        args.onSubChunk(pendingSegment, true);
        pendingSegment = null;
        emittedAny = true;
      }
      if (!emittedAny) {
        return settle(() => reject(new TTSApiError("No audio received from Qwen Realtime.", -4)));
      }
      settle(() => resolve({ audioBase64: "", format: "wav" }));
    };

    const ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "X-DashScope-DataInspection": "enable",
      },
      handshakeTimeout: 10_000,
    });

    overallTimer = setTimeout(() => {
      fail(new TTSApiError(`Realtime WebSocket timeout after ${OVERALL_TIMEOUT_MS / 1000}s`, -2));
    }, OVERALL_TIMEOUT_MS);
    firstAudioTimer = setTimeout(() => {
      if (!emittedAny && pendingSegment === null) {
        fail(new TTSApiError(`Qwen Realtime sent no audio within ${FIRST_AUDIO_TIMEOUT_MS / 1000}s.`, -2));
      }
    }, FIRST_AUDIO_TIMEOUT_MS);

    if (args.signal) {
      onAbortListener = () => fail(new TTSApiError("TTS synthesis cancelled.", -7));
      args.signal.addEventListener("abort", onAbortListener, { once: true });
    }

    ws.on("open", () => {
      const sessionConfig: Record<string, unknown> = {
        voice: args.voice,
        response_format: "pcm",
        mode: "server_commit",
      };
      const instructions = args.instructions?.trim();
      if (instructions && supportsInstructions(args.model)) {
        sessionConfig.instructions = instructions;
      }
      try {
        ws.send(JSON.stringify({ type: "session.update", session: sessionConfig }));
        ws.send(JSON.stringify({ type: "input_text_buffer.append", text }));
        ws.send(JSON.stringify({ type: "session.finish" }));
      } catch (err) {
        fail(new TTSApiError(
          `Failed to send to Qwen Realtime: ${err instanceof Error ? err.message : String(err)}`,
          -6,
        ));
      }
    });

    ws.on("message", (data) => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(data.toString()) as RealtimeEvent;
      } catch {
        return;
      }
      switch (event.type) {
        case "response.audio.delta": {
          const seg = event.delta ?? event.audio;
          if (typeof seg === "string" && seg.length > 0) {
            if (firstAudioTimer) {
              clearTimeout(firstAudioTimer);
              firstAudioTimer = undefined;
            }
            if (pendingSegment !== null) {
              args.onSubChunk(pendingSegment, false);
              emittedAny = true;
            }
            pendingSegment = seg;
          }
          break;
        }
        case "response.done":
        case "session.finished": {
          sawFinish = true;
          done();
          break;
        }
        case "error": {
          const code =
            typeof event.error?.code === "number" ? event.error.code : -6;
          const message = event.error?.message ?? event.message ?? "Qwen Realtime error.";
          fail(new TTSApiError(message, code));
          break;
        }
        default:
          // session.created, session.updated, etc. — informational.
          break;
      }
    });

    ws.on("close", () => {
      if (settled) return;
      if (sawFinish || pendingSegment !== null || emittedAny) {
        done();
      } else {
        fail(new TTSApiError("Qwen Realtime closed before sending audio.", -4));
      }
    });

    ws.on("error", (err: Error) => {
      fail(new TTSApiError(`Realtime WebSocket: ${err.message}`, -6));
    });
  });
}
