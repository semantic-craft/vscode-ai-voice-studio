import { TTSApiError, type SynthesizeContext, type SynthesizeResult } from "./providers";
import type { MiMoFormat, MiMoModel } from "./mimo-voices";

const REQUEST_TIMEOUT_MS = 90_000;

export interface MiMoSynthesizeArgs extends SynthesizeContext {
  apiKey: string;
  baseUrl: string;
  model: MiMoModel;
  voice: string;
  format: MiMoFormat;
  stylePrompt?: string;
  openingStyleTags?: string[];
  audioEventTags?: string[];
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
  const url = `${normalizeBaseUrl(args.baseUrl)}/chat/completions`;
  const body = {
    model: args.model,
    messages: buildMessages(decoratedText, args.stylePrompt),
    audio: { format: args.format, voice: args.voice },
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

    const audio = data.choices?.[0]?.message?.audio?.data;
    if (!audio) {
      throw new TTSApiError(`No audio data returned from MiMo (${args.voice}).`, -4);
    }
    return { audioBase64: audio, format: args.format };
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

function buildMessages(text: string, stylePrompt: string | undefined): Array<{ role: "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  const style = stylePrompt?.trim();
  if (style) {
    messages.push({ role: "user", content: style });
  }
  messages.push({ role: "assistant", content: text });
  return messages;
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
