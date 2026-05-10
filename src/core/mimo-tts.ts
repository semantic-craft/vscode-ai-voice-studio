import { TTSApiError, type SynthesizeContext, type SynthesizeResult } from "./providers";
import {
  isPresetModel,
  isVoiceCloneModel,
  isVoiceDesignModel,
  type MiMoFormat,
  type MiMoModel,
} from "./mimo-voices";

const REQUEST_TIMEOUT_MS = 90_000;
/** MiMo doc limit: base64-encoded audio sample ≤ 10 MB. */
const MAX_CLONE_BASE64_BYTES = 10 * 1024 * 1024;

export interface MiMoVoiceCloneSample {
  /** Full data URL: `data:{mime};base64,XXXX` */
  dataUrl: string;
  /** Raw file size of the original audio in bytes (informational, not enforced). */
  sizeBytes: number;
}

export interface MiMoSynthesizeArgs extends SynthesizeContext {
  apiKey: string;
  baseUrl: string;
  model: MiMoModel;
  voice: string;
  format: MiMoFormat;
  stylePrompt?: string;
  openingStyleTags?: string[];
  audioEventTags?: string[];
  voiceCloneSample?: MiMoVoiceCloneSample;
}

interface MiMoResponse {
  choices?: Array<{
    message?: {
      audio?: { data?: string };
    };
  }>;
  error?: {
    message?: string;
    code?: string | number;
  };
}

interface MiMoMessage {
  role: "user" | "assistant";
  content: string;
}

interface MiMoAudioField {
  format: MiMoFormat;
  voice?: string;
}

export async function synthesizeMiMo(args: MiMoSynthesizeArgs): Promise<SynthesizeResult> {
  const text = args.text.trim();
  if (!text) {
    throw new TTSApiError("Text cannot be empty.", -1);
  }
  if (!args.apiKey) {
    throw new TTSApiError("MiMo API key is missing.", -1);
  }
  if (args.apiKey.startsWith("sk-")) {
    throw new TTSApiError(
      "Use a MiMo Token Plan key (tp-…), not a pay-as-you-go sk- key.",
      -1,
    );
  }

  const decoratedText = applyStyleTags(text, args.openingStyleTags, args.audioEventTags);
  const { messages, audio } = buildRequestPayload(args, decoratedText);

  const url = `${normalizeBaseUrl(args.baseUrl)}/chat/completions`;
  const body = {
    model: args.model,
    messages,
    audio,
    stream: false,
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
        "api-key": args.apiKey,
      },
      body: JSON.stringify(body),
      signal: timeoutController.signal,
    });

    const raw = await response.text();
    const data = parseJson(raw);

    if (!response.ok) {
      throw new TTSApiError(data.error?.message || `HTTP ${response.status} ${response.statusText}`, response.status);
    }
    if (data.error) {
      throw new TTSApiError(data.error.message || "MiMo TTS request failed.", normalizeErrorCode(data.error.code));
    }

    const audioData = data.choices?.[0]?.message?.audio?.data;
    if (!audioData) {
      throw new TTSApiError(`No audio data returned from MiMo (${describeVoice(args)}).`, -4);
    }
    return { audioBase64: audioData, format: args.format };
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

function buildRequestPayload(
  args: MiMoSynthesizeArgs,
  decoratedText: string,
): { messages: MiMoMessage[]; audio: MiMoAudioField } {
  const style = args.stylePrompt?.trim() ?? "";

  if (isVoiceDesignModel(args.model)) {
    if (!style) {
      throw new TTSApiError(
        "Voice Design requires a description in the Style / Voice description field.",
        -1,
      );
    }
    return {
      messages: [
        { role: "user", content: style },
        { role: "assistant", content: decoratedText },
      ],
      // Doc explicitly omits the voice field for voicedesign requests.
      audio: { format: args.format },
    };
  }

  if (isVoiceCloneModel(args.model)) {
    const sample = args.voiceCloneSample;
    if (!sample) {
      throw new TTSApiError(
        "Voice Clone requires an uploaded audio sample (mp3 or wav).",
        -1,
      );
    }
    validateCloneSample(sample);
    const messages: MiMoMessage[] = [];
    // user content can be empty per the doc, but if a style prompt is set we forward it.
    messages.push({ role: "user", content: style });
    messages.push({ role: "assistant", content: decoratedText });
    return {
      messages,
      audio: { format: args.format, voice: sample.dataUrl },
    };
  }

  // Preset models (mimo-v2.5-tts / mimo-v2-tts).
  if (!isPresetModel(args.model)) {
    throw new TTSApiError(`Unsupported MiMo model: ${args.model}`, -1);
  }
  const messages: MiMoMessage[] = [];
  if (style) {
    messages.push({ role: "user", content: style });
  }
  messages.push({ role: "assistant", content: decoratedText });
  return {
    messages,
    audio: { format: args.format, voice: args.voice },
  };
}

function validateCloneSample(sample: MiMoVoiceCloneSample): void {
  const match = sample.dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) {
    throw new TTSApiError("Voice clone sample must be a base64 data URL.", -1);
  }
  const mime = match[1].toLowerCase();
  const allowedMime = mime === "audio/mpeg" || mime === "audio/mp3" || mime === "audio/wav" || mime === "audio/x-wav";
  if (!allowedMime) {
    throw new TTSApiError(
      `Voice clone sample MIME ${mime} is not supported. Use audio/mpeg or audio/wav.`,
      -1,
    );
  }
  // Doc constraint: base64 string itself ≤ 10 MB.
  if (match[2].length > MAX_CLONE_BASE64_BYTES) {
    throw new TTSApiError(
      `Voice clone sample exceeds 10 MB (base64). Provide a shorter clip.`,
      -1,
    );
  }
}

function applyStyleTags(text: string, openingStyleTags?: string[], audioEventTags?: string[]): string {
  const opening = normalizeTags(openingStyleTags);
  const events = normalizeTags(audioEventTags);
  if (opening.some(isSingingTag)) {
    return `(唱歌)${text}`;
  }
  const stylePrefix = opening.length > 0 ? `(${opening.join(" ")})` : "";
  const eventPrefix = events.length > 0 ? `（${events.join("，")}）` : "";
  return `${stylePrefix}${eventPrefix}${text}`;
}

function normalizeTags(tags: string[] | undefined): string[] {
  return Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
}

function isSingingTag(tag: string): boolean {
  return ["唱歌", "sing", "singing"].includes(tag.toLowerCase());
}

function describeVoice(args: MiMoSynthesizeArgs): string {
  if (isVoiceDesignModel(args.model)) return "voice-design";
  if (isVoiceCloneModel(args.model)) return "voice-clone";
  return args.voice;
}

function parseJson(raw: string): MiMoResponse {
  try {
    return JSON.parse(raw) as MiMoResponse;
  } catch {
    return { error: { message: raw || "MiMo TTS returned a non-JSON response." } };
  }
}

function normalizeErrorCode(code: string | number | undefined): number {
  if (typeof code === "number") return code;
  const parsed = Number(code);
  return Number.isFinite(parsed) ? parsed : -6;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
}
