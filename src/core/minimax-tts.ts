import WebSocket from "ws";
import { TTSApiError, type SynthesizeContext, type SynthesizeResult } from "./providers";
import {
  WS_URLS,
  type MiniMaxEmotion,
  type MiniMaxFormat,
  type MiniMaxModel,
  type MiniMaxRegion,
} from "./minimax-voices";

const OVERALL_TIMEOUT_MS = 90_000;
const FIRST_AUDIO_TIMEOUT_MS = 15_000;
const HANDSHAKE_TIMEOUT_MS = 10_000;

export interface MiniMaxSynthesizeArgs extends SynthesizeContext {
  apiKey: string;
  region: MiniMaxRegion;
  model: MiniMaxModel;
  voice: string;
  format: MiniMaxFormat;
  sampleRate: number;
  bitrate: number;
  channel: 1 | 2;
  speed: number;
  vol: number;
  pitch: number;
  emotion: MiniMaxEmotion;
  englishNormalization: boolean;
  languageBoost?: string;
  pronunciationDict?: string[];
}

interface T2AEvent {
  event?: string;
  data?: { audio?: string };
  is_final?: boolean;
  base_resp?: { status_code?: number; status_msg?: string };
  trace_id?: string;
  session_id?: string;
}

/**
 * MiniMax T2A WebSocket streaming synthesizer.
 *
 * Protocol summary (platform.minimaxi.com/docs/guides/speech-t2a-websocket):
 *
 *   1. Open `wss://api.minimaxi.com/ws/v1/t2a_v2` (or `api.minimax.io` for the
 *      global endpoint) with `Authorization: Bearer <apiKey>`.
 *   2. Server replies once with `{"event": "connected_success"}`.
 *   3. Send `task_start` with model + voice_setting + audio_setting.
 *   4. Send `task_continue` with the text to synthesize.
 *   5. Server streams `{"data": {"audio": "<hex>"}, "is_final": bool}` events.
 *      Each `audio` field is the hex-encoded raw bytes of the chosen format
 *      (mp3 / wav / pcm). Concatenating them yields the full audio blob.
 *   6. After the final segment (`is_final: true`), send `task_finish` and
 *      close the socket.
 *
 * We open one session per text chunk; the upstream text-chunker already
 * parallelizes chunks via the playback session's lookahead, so per-chunk
 * sessions stay simple without hurting first-audio latency for long text.
 */
export async function synthesizeMiniMax(args: MiniMaxSynthesizeArgs): Promise<SynthesizeResult> {
  const text = args.text.trim();
  if (!text) throw new TTSApiError("Text cannot be empty.", -1);
  if (!args.apiKey) throw new TTSApiError("MiniMax API key is missing.", -1);
  if (args.signal?.aborted) throw new TTSApiError("TTS synthesis cancelled.", -7);

  return new Promise<SynthesizeResult>((resolve, reject) => {
    let settled = false;
    let connectedAck = false;
    let taskStarted = false;
    let sawFinal = false;
    let firstAudioTimer: ReturnType<typeof setTimeout> | undefined;
    let overallTimer: ReturnType<typeof setTimeout> | undefined;
    let onAbortListener: (() => void) | undefined;
    const audioChunks: Buffer[] = [];

    const ws = new WebSocket(WS_URLS[args.region], {
      headers: { Authorization: `Bearer ${args.apiKey}` },
      handshakeTimeout: HANDSHAKE_TIMEOUT_MS,
    });

    const cleanup = (): void => {
      if (firstAudioTimer) clearTimeout(firstAudioTimer);
      if (overallTimer) clearTimeout(overallTimer);
      if (args.signal && onAbortListener) {
        args.signal.removeEventListener("abort", onAbortListener);
      }
    };

    const settle = (fn: () => void): void => {
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

    const finalize = (): void => {
      const buffer = Buffer.concat(audioChunks);
      if (buffer.length === 0) {
        return settle(() => reject(new TTSApiError("MiniMax returned no audio data.", -4)));
      }
      // PCM has no container header — surface it as "pcm" so the webview wraps
      // it in a WAV header before handing to the <audio> element. mp3 / wav
      // already self-describe.
      const format = args.format;
      settle(() => resolve({ audioBase64: buffer.toString("base64"), format }));
    };

    overallTimer = setTimeout(() => {
      fail(new TTSApiError(`MiniMax WebSocket timeout after ${OVERALL_TIMEOUT_MS / 1000}s`, -2));
    }, OVERALL_TIMEOUT_MS);
    firstAudioTimer = setTimeout(() => {
      if (audioChunks.length === 0) {
        fail(new TTSApiError(`MiniMax sent no audio within ${FIRST_AUDIO_TIMEOUT_MS / 1000}s.`, -2));
      }
    }, FIRST_AUDIO_TIMEOUT_MS);

    if (args.signal) {
      onAbortListener = () => fail(new TTSApiError("TTS synthesis cancelled.", -7));
      args.signal.addEventListener("abort", onAbortListener, { once: true });
    }

    const sendStartAndText = (): void => {
      const voiceSetting: Record<string, unknown> = {
        voice_id: args.voice,
        speed: args.speed,
        vol: args.vol,
        pitch: args.pitch,
        english_normalization: args.englishNormalization,
      };
      if (args.emotion !== "auto") voiceSetting.emotion = args.emotion;

      const audioSetting: Record<string, unknown> = {
        sample_rate: args.sampleRate,
        bitrate: args.bitrate,
        format: args.format,
        channel: args.channel,
      };

      const startPayload: Record<string, unknown> = {
        event: "task_start",
        model: args.model,
        voice_setting: voiceSetting,
        audio_setting: audioSetting,
      };
      if (args.languageBoost && args.languageBoost !== "auto") {
        startPayload.language_boost = args.languageBoost;
      }
      const tones = (args.pronunciationDict ?? []).map((s) => s.trim()).filter(Boolean);
      if (tones.length > 0) {
        startPayload.pronunciation_dict = { tone: tones };
      }

      try {
        ws.send(JSON.stringify(startPayload));
        ws.send(JSON.stringify({ event: "task_continue", text }));
      } catch (err) {
        fail(new TTSApiError(
          `Failed to send to MiniMax: ${err instanceof Error ? err.message : String(err)}`,
          -6,
        ));
      }
    };

    const sendFinish = (): void => {
      try {
        ws.send(JSON.stringify({ event: "task_finish" }));
      } catch {
        // The server may have already closed the socket post-final-audio.
        // We have everything we need; just finalize.
      }
    };

    ws.on("open", () => {
      // No-op. The server greets us with `connected_success` next; we wait
      // for that handshake before sending task_start to match the docs.
    });

    ws.on("message", (data) => {
      let event: T2AEvent;
      try {
        event = JSON.parse(data.toString()) as T2AEvent;
      } catch {
        return;
      }

      // Surface API-level errors no matter which event carries them.
      const baseResp = event.base_resp;
      if (baseResp && typeof baseResp.status_code === "number" && baseResp.status_code !== 0) {
        const msg = baseResp.status_msg || "MiniMax T2A error.";
        fail(new TTSApiError(`${msg} (code: ${baseResp.status_code})`, baseResp.status_code));
        return;
      }

      switch (event.event) {
        case "connected_success": {
          connectedAck = true;
          sendStartAndText();
          return;
        }
        case "task_started": {
          taskStarted = true;
          return;
        }
        case "task_failed": {
          const msg = baseResp?.status_msg || "MiniMax task_failed.";
          fail(new TTSApiError(msg, baseResp?.status_code ?? -3));
          return;
        }
        case "task_finished": {
          // Some deployments emit task_finished as the explicit terminator;
          // others just close after the final audio frame. Either path lands
          // in `finalize`.
          if (sawFinal || audioChunks.length > 0) finalize();
          return;
        }
        default:
          // Fall through — many audio frames omit an `event` field and only
          // carry `data.audio` + `is_final`.
          break;
      }

      const audioHex = event.data?.audio;
      if (typeof audioHex === "string" && audioHex.length > 0) {
        if (firstAudioTimer) {
          clearTimeout(firstAudioTimer);
          firstAudioTimer = undefined;
        }
        try {
          audioChunks.push(Buffer.from(audioHex, "hex"));
        } catch (err) {
          fail(new TTSApiError(
            `Malformed audio frame from MiniMax: ${err instanceof Error ? err.message : String(err)}`,
            -4,
          ));
          return;
        }
      }

      if (event.is_final === true) {
        sawFinal = true;
        sendFinish();
        finalize();
      }
    });

    ws.on("close", () => {
      if (settled) return;
      if (sawFinal || audioChunks.length > 0) {
        finalize();
      } else if (!connectedAck) {
        fail(new TTSApiError("MiniMax closed the WebSocket before the handshake completed.", -6));
      } else if (!taskStarted) {
        fail(new TTSApiError("MiniMax closed the WebSocket before task_started was acknowledged.", -6));
      } else {
        fail(new TTSApiError("MiniMax closed the WebSocket before sending audio.", -4));
      }
    });

    ws.on("error", (err: Error) => {
      fail(new TTSApiError(`MiniMax WebSocket: ${err.message}`, -6));
    });
  });
}
