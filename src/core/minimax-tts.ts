import { TTSApiError, type SynthesizeContext, type SynthesizeResult } from "./providers";
import {
  modelSupportsEmotion,
  type MiniMaxEmotion,
  type MiniMaxFormat,
  type MiniMaxModel,
  type MiniMaxRegion,
} from "./minimax-voices";

const REQUEST_TIMEOUT_MS = 90_000;

export interface MiniMaxSynthesizeArgs extends SynthesizeContext {
  apiKey: string;
  region: MiniMaxRegion;
  model: MiniMaxModel;
  voice: string;
  format: MiniMaxFormat;
  speed: number;
  vol: number;
  pitch: number;
  emotion: MiniMaxEmotion;
  sampleRate: number;
  bitrate: number;
  channel: 1 | 2;
  languageBoost?: string;
  pronunciationDict?: string[];
}

interface MiniMaxResponse {
  data?: { audio?: string };
  base_resp?: { status_code?: number; status_msg?: string };
  trace_id?: string;
}

export async function synthesizeMiniMax(args: MiniMaxSynthesizeArgs): Promise<SynthesizeResult> {
  const text = args.text.trim();
  if (!text) {
    throw new TTSApiError("Text cannot be empty.", -1);
  }
  if (!args.apiKey) {
    throw new TTSApiError("MiniMax API key is missing.", -1);
  }

  const voiceSetting: Record<string, unknown> = {
    voice_id: args.voice,
    speed: args.speed,
    vol: args.vol,
    pitch: args.pitch,
  };
  if (args.emotion !== "auto" && modelSupportsEmotion(args.model)) {
    voiceSetting.emotion = args.emotion;
  }

  const body: Record<string, unknown> = {
    model: args.model,
    text,
    stream: false,
    output_format: "hex",
    voice_setting: voiceSetting,
    audio_setting: {
      sample_rate: args.sampleRate,
      bitrate: args.bitrate,
      format: args.format,
      channel: args.channel,
    },
  };

  if (args.languageBoost) {
    body.language_boost = args.languageBoost;
  }

  const tones = (args.pronunciationDict ?? []).map((s) => s.trim()).filter(Boolean);
  if (tones.length > 0) {
    body.pronunciation_dict = { tone: tones };
  }

  const url = `${getBaseUrl(args.region)}/v1/t2a_v2`;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => timeoutController.abort();
  args.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: timeoutController.signal,
    });

    const payload = (await response.json().catch(() => null)) as MiniMaxResponse | null;

    if (!response.ok) {
      const message = payload?.base_resp?.status_msg || response.statusText || "MiniMax TTS request failed";
      throw new TTSApiError(`HTTP ${response.status}: ${message}`, response.status);
    }

    const baseResp = payload?.base_resp;
    if (!payload || !baseResp || baseResp.status_code !== 0) {
      throw new TTSApiError(
        `${baseResp?.status_msg || "MiniMax TTS failed"} (code: ${baseResp?.status_code ?? "unknown"})`,
        baseResp?.status_code ?? -3,
      );
    }

    const audioHex = payload.data?.audio;
    if (!audioHex) {
      throw new TTSApiError(`No audio data returned (trace_id: ${payload.trace_id || "unknown"}).`, -4);
    }

    const buffer = Buffer.from(audioHex, "hex");
    if (buffer.length === 0) {
      throw new TTSApiError("Decoded audio is empty.", -4);
    }
    return { audioBase64: buffer.toString("base64"), format: args.format };
  } catch (error) {
    if (error instanceof TTSApiError) throw error;
    if (args.signal?.aborted) {
      throw new TTSApiError("TTS synthesis cancelled.", -7);
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new TTSApiError(`Request timeout after ${REQUEST_TIMEOUT_MS / 1000}s`, -2);
    }
    throw new TTSApiError(error instanceof Error ? error.message : String(error), -6);
  } finally {
    clearTimeout(timeoutId);
    args.signal?.removeEventListener("abort", onAbort);
  }
}

function getBaseUrl(region: MiniMaxRegion): string {
  return region === "global" ? "https://api.minimax.io" : "https://api.minimaxi.com";
}
