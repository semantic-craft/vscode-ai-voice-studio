import { TTSApiError, type SynthesizeContext, type SynthesizeResult } from "./providers";
import type { GeminiFormat, GeminiTTSModel } from "./gemini-voices";

const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Gemini speech-generation returns headerless 16-bit signed little-endian
 * mono PCM at 24 kHz. We always wrap into WAV before handing the bytes to
 * the webview audio element.
 */
const PCM_SAMPLE_RATE = 24_000;
const PCM_CHANNELS = 1;
const PCM_BITS_PER_SAMPLE = 16;

export interface GeminiSynthesizeArgs extends SynthesizeContext {
  apiKey: string;
  baseUrl: string;
  model: GeminiTTSModel;
  voice: string;
  /** We always emit "wav" because we wrap the raw PCM ourselves. Kept for symmetry. */
  format: GeminiFormat;
  /** Optional inline preamble prefixed in front of the transcript ("Read in <style>:"). */
  stylePreamble?: string;
}

interface GeminiInlineData {
  data?: string;
  mimeType?: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: GeminiInlineData;
  inline_data?: GeminiInlineData;
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

export async function synthesizeGemini(args: GeminiSynthesizeArgs): Promise<SynthesizeResult> {
  const text = args.text.trim();
  if (!text) {
    throw new TTSApiError("Text cannot be empty.", -1);
  }
  if (!args.apiKey) {
    throw new TTSApiError("Gemini API key is missing.", -1);
  }
  if (args.signal?.aborted) {
    throw new TTSApiError("TTS synthesis cancelled.", -7);
  }

  const transcript = composeTranscript(text, args.stylePreamble);
  const url = `${normalizeBaseUrl(args.baseUrl)}/models/${encodeURIComponent(args.model)}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: transcript }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: args.voice },
        },
      },
    },
  };

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => timeoutController.abort();
  args.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": args.apiKey,
      },
      body: JSON.stringify(body),
      signal: timeoutController.signal,
    });

    const raw = await response.text();
    const data = parseJson(raw);

    if (!response.ok) {
      const detail = data.error?.message || raw || `HTTP ${response.status} ${response.statusText}`;
      throw new TTSApiError(detail, response.status);
    }
    if (data.error) {
      throw new TTSApiError(data.error.message || "Gemini TTS request failed.", data.error.code ?? -6);
    }
    if (data.promptFeedback?.blockReason) {
      throw new TTSApiError(
        `Gemini blocked the request: ${data.promptFeedback.blockReason}. Try rephrasing or shortening the text.`,
        -1,
      );
    }

    const part = data.candidates?.[0]?.content?.parts?.[0];
    const inline = part?.inlineData ?? part?.inline_data;
    const audioBase64 = inline?.data;
    if (!audioBase64) {
      const finish = data.candidates?.[0]?.finishReason;
      throw new TTSApiError(
        finish && finish !== "STOP"
          ? `No audio data returned (finishReason=${finish}).`
          : "No audio data returned from Gemini.",
        -4,
      );
    }

    const mimeType = inline?.mimeType ?? "audio/L16;codec=pcm;rate=24000";
    const sampleRate = parseSampleRate(mimeType) ?? PCM_SAMPLE_RATE;
    const wavBase64 = wrapPcmAsWav(audioBase64, sampleRate, PCM_CHANNELS, PCM_BITS_PER_SAMPLE);
    return { audioBase64: wavBase64, format: "wav" };
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

function composeTranscript(text: string, stylePreamble: string | undefined): string {
  const preamble = stylePreamble?.trim();
  if (!preamble) return text;
  return preamble.endsWith(":") ? `${preamble} ${text}` : `${preamble}: ${text}`;
}

function parseJson(raw: string): GeminiResponse {
  try {
    return JSON.parse(raw) as GeminiResponse;
  } catch {
    return { error: { message: raw || "Gemini TTS returned a non-JSON response." } };
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function parseSampleRate(mimeType: string): number | null {
  const match = mimeType.match(/rate=(\d+)/i);
  if (!match) return null;
  const rate = Number(match[1]);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Wrap raw PCM bytes in a 44-byte RIFF/WAV header so the webview <audio>
 * element can play it without any extra decoding on the JS side.
 */
function wrapPcmAsWav(pcmBase64: string, sampleRate: number, channels: number, bitsPerSample: number): string {
  const pcm = decodeBase64Pcm(pcmBase64);
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8, 4, "ascii");
  header.write("fmt ", 12, 4, "ascii");
  header.writeUInt32LE(16, 16);             // Subchunk1Size for PCM
  header.writeUInt16LE(1, 20);              // AudioFormat = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, 4, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]).toString("base64");
}

function decodeBase64Pcm(value: string): Buffer {
  const clean = value.replace(/\s+/g, "");
  const padded = clean.padEnd(Math.ceil(clean.length / 4) * 4, "=");
  if (!isBase64(padded)) {
    throw new TTSApiError("Gemini returned malformed base64 audio data.", -4);
  }
  const pcm = Buffer.from(padded, "base64");
  if (pcm.length === 0) {
    throw new TTSApiError("Gemini returned empty PCM audio data.", -4);
  }
  return pcm;
}

function isBase64(value: string): boolean {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}
