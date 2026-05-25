import { TTSApiError, type SynthesizeContext, type SynthesizeResult } from "./providers";
import { ENDPOINT_URLS, supportsInstructions, type QwenEndpoint, type QwenLanguageType, type QwenTTSModel } from "./qwen-voices";

const REQUEST_TIMEOUT_MS = 90_000;

export interface QwenSynthesizeArgs extends SynthesizeContext {
  apiKey: string;
  endpoint: QwenEndpoint;
  model: QwenTTSModel;
  voice: string;
  languageType: QwenLanguageType;
  instructions?: string;
  /**
   * If set, the request is sent with `X-DashScope-SSE: enable` and each
   * inline base64 PCM segment is forwarded as soon as it arrives via
   * `onSubChunk`. The resolved `SynthesizeResult.audioBase64` is empty when
   * sub-chunks have already been delivered (the caller is expected to have
   * played them); `format` is `"wav"` (we wrap PCM segments in WAV headers
   * client-side).
   */
  onSubChunk?: (audioBase64: string, isLast: boolean) => void;
}

interface QwenAudio {
  data?: string;
  url?: string;
  mime_type?: string;
  mimeType?: string;
  format?: string;
}

interface QwenResponse {
  output?: {
    audio?: QwenAudio;
    finish_reason?: string;
  };
  request_id?: string;
  code?: string | number;
  message?: string;
  error?: { code?: string | number; message?: string };
}

export async function synthesizeQwen(args: QwenSynthesizeArgs): Promise<SynthesizeResult> {
  const text = args.text.trim();
  if (!text) {
    throw new TTSApiError("Text cannot be empty.", -1);
  }
  if (!args.apiKey) {
    throw new TTSApiError("DashScope API key is missing. Set DASHSCOPE_API_KEY or save a DashScope key.", -1);
  }
  if (args.signal?.aborted) {
    throw new TTSApiError("TTS synthesis cancelled.", -7);
  }

  const input: Record<string, unknown> = {
    text,
    voice: args.voice,
    language_type: args.languageType,
  };
  const instructions = args.instructions?.trim();
  if (instructions && supportsInstructions(args.model)) {
    input.instructions = instructions;
  }

  const body = {
    model: args.model,
    input,
  };

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => timeoutController.abort();
  args.signal?.addEventListener("abort", onAbort, { once: true });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.apiKey}`,
    "Content-Type": "application/json",
  };
  if (args.onSubChunk) headers["X-DashScope-SSE"] = "enable";

  try {
    const response = await fetch(ENDPOINT_URLS[args.endpoint], {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: timeoutController.signal,
    });

    if (args.onSubChunk) {
      return await readStreamingResponse(response, args.onSubChunk, args.signal);
    }

    const raw = await response.text();
    const payload = parseJson(raw);

    if (!response.ok) {
      throw new TTSApiError(readErrorDetail(payload, raw, response), response.status);
    }
    if (payload.error || payload.code) {
      const code = payload.error?.code ?? payload.code;
      throw new TTSApiError(
        payload.error?.message ?? payload.message ?? "Qwen-TTS request failed.",
        normalizeErrorCode(code),
      );
    }

    const audio = payload.output?.audio;
    if (audio?.data) {
      const audioBase64 = normalizeBase64Audio(audio.data, "Qwen-TTS");
      const declaredFormat = inferAudioFormat(audio.mime_type ?? audio.mimeType, audio.format, undefined, "pcm");
      return {
        audioBase64,
        format: hasAudioFormatHint(audio) ? declaredFormat : inferAudioFormatFromBase64(audioBase64, declaredFormat),
      };
    }
    if (audio?.url) {
      return downloadAudio(audio.url, timeoutController.signal);
    }

    const requestId = payload.request_id ? ` (request_id: ${payload.request_id})` : "";
    const finish = payload.output?.finish_reason ? ` finish_reason=${payload.output.finish_reason}` : "";
    throw new TTSApiError(`No audio data returned from Qwen-TTS${finish}${requestId}.`, -4);
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

async function readStreamingResponse(
  response: Response,
  onSubChunk: (audioBase64: string, isLast: boolean) => void,
  externalSignal: AbortSignal | undefined,
): Promise<SynthesizeResult> {
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    const payload = parseJson(raw);
    throw new TTSApiError(readErrorDetail(payload, raw, response), response.status);
  }
  if (!response.body) {
    throw new TTSApiError("Qwen-TTS streaming response has no body.", -4);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // One-ahead buffer: we keep the most recent segment so we can correctly tag
  // it as `isLast=true` once the stream ends. Earlier segments are emitted as
  // soon as the next segment arrives — that's what makes this true streaming.
  let pendingSegment: string | null = null;
  let emittedAny = false;
  let sawFinish = false;
  let firstErrorCode: number | undefined;
  let firstErrorMessage: string | undefined;

  try {
    while (true) {
      if (externalSignal?.aborted) {
        throw new TTSApiError("TTS synthesis cancelled.", -7);
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const rawEvent = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        separator = buffer.indexOf("\n\n");

        const dataLines: string[] = [];
        for (const line of rawEvent.split("\n")) {
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length === 0) continue;
        const payloadText = dataLines.join("");
        if (!payloadText || payloadText === "[DONE]") continue;

        let payload: QwenResponse;
        try {
          payload = JSON.parse(payloadText) as QwenResponse;
        } catch {
          continue;
        }
        if (payload.error || payload.code !== undefined) {
          const code = payload.error?.code ?? payload.code;
          firstErrorCode = normalizeErrorCode(code);
          firstErrorMessage = payload.error?.message ?? payload.message ?? "Qwen-TTS streaming error.";
          continue;
        }
        const audio = payload.output?.audio;
        if (audio?.data) {
          const seg = normalizeBase64Audio(audio.data, "Qwen-TTS");
          if (pendingSegment !== null) {
            onSubChunk(pendingSegment, false);
            emittedAny = true;
          }
          pendingSegment = seg;
        }
        if (payload.output?.finish_reason === "stop") {
          sawFinish = true;
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // releaseLock can throw if the reader was already cancelled; ignore.
    }
  }

  if (firstErrorMessage) {
    throw new TTSApiError(firstErrorMessage, firstErrorCode ?? -6);
  }
  if (pendingSegment === null && !emittedAny) {
    throw new TTSApiError(`No audio data returned from Qwen-TTS${sawFinish ? " (empty stream)" : ""}.`, -4);
  }
  if (pendingSegment !== null) {
    onSubChunk(pendingSegment, true);
  }
  return { audioBase64: "", format: "wav" };
}

async function downloadAudio(url: string, signal: AbortSignal): Promise<SynthesizeResult> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new TTSApiError(`Failed to download Qwen-TTS audio: HTTP ${response.status} ${response.statusText}`, response.status);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new TTSApiError("Qwen-TTS returned an empty audio file.", -4);
  }
  return {
    audioBase64: buffer.toString("base64"),
    format: inferAudioFormat(response.headers.get("content-type"), undefined, url, "wav"),
  };
}

function parseJson(raw: string): QwenResponse {
  try {
    return JSON.parse(raw) as QwenResponse;
  } catch {
    return { error: { message: raw || "Qwen-TTS returned a non-JSON response." } };
  }
}

function readErrorDetail(payload: QwenResponse, raw: string, response: Response): string {
  return (
    payload.error?.message ??
    payload.message ??
    (raw || `Qwen-TTS request failed: HTTP ${response.status} ${response.statusText}`)
  );
}

function normalizeErrorCode(code: string | number | undefined): number {
  if (typeof code === "number") return code;
  const parsed = Number(code);
  return Number.isFinite(parsed) ? parsed : -6;
}

function hasAudioFormatHint(audio: QwenAudio): boolean {
  return Boolean(audio.mime_type || audio.mimeType || audio.format);
}

function normalizeBase64Audio(value: string, serviceName: string): string {
  const clean = value.replace(/\s+/g, "");
  const padded = clean.padEnd(Math.ceil(clean.length / 4) * 4, "=");
  if (!isBase64(padded) || Buffer.from(padded, "base64").length === 0) {
    throw new TTSApiError(`${serviceName} returned malformed base64 audio data.`, -4);
  }
  return padded;
}

function isBase64(value: string): boolean {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function inferAudioFormat(
  contentType: string | null | undefined,
  explicit?: string,
  url?: string,
  fallback = "wav",
): string {
  const value = `${explicit ?? ""} ${contentType ?? ""} ${url ?? ""}`.toLowerCase();
  if (value.includes("mpeg") || value.includes(".mp3")) return "mp3";
  if (value.includes("wav") || value.includes("x-wav") || value.includes(".wav")) return "wav";
  if (value.includes("aac") || value.includes(".aac")) return "aac";
  if (value.includes("ogg") || value.includes("opus") || value.includes(".opus")) return "opus";
  if (value.includes("flac") || value.includes(".flac")) return "flac";
  return fallback;
}

function inferAudioFormatFromBase64(base64: string, fallback: string): string {
  const buffer = Buffer.from(base64, "base64");
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  ) {
    return "wav";
  }
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString("ascii") === "ID3") {
    return "mp3";
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "OggS") {
    return "opus";
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "fLaC") {
    return "flac";
  }
  if (buffer.length >= 2 && buffer[0] === 0xff) {
    // AAC ADTS sync is 12 bits (0xFFF) with layer bits zero in byte 1.
    if ((buffer[1] & 0xf6) === 0xf0) return "aac";
    // MP3 sync is 11 bits (0xFFE) with layer bits non-zero.
    if ((buffer[1] & 0xe0) === 0xe0 && (buffer[1] & 0x06) !== 0) return "mp3";
  }
  return fallback;
}
