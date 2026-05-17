import { TTSApiError, type SynthesizeContext, type SynthesizeResult } from "./providers";
import type { OpenAIResponseFormat, OpenAITTSModel } from "./openai-voices";

const REQUEST_TIMEOUT_MS = 90_000;

export interface OpenAISynthesizeArgs extends SynthesizeContext {
  apiKey: string;
  baseUrl: string;
  model: OpenAITTSModel;
  voice: string;
  format: OpenAIResponseFormat;
  instructions?: string;
}

export async function synthesizeOpenAI(args: OpenAISynthesizeArgs): Promise<SynthesizeResult> {
  const text = args.text.trim();
  if (!text) {
    throw new TTSApiError("Text cannot be empty.", -1);
  }
  if (!args.apiKey) {
    throw new TTSApiError("OpenAI API key is missing.", -1);
  }
  if (args.signal?.aborted) {
    throw new TTSApiError("TTS synthesis cancelled.", -7);
  }

  const url = `${stripTrailingSlash(args.baseUrl)}/audio/speech`;
  const body: Record<string, unknown> = {
    model: args.model,
    input: text,
    voice: args.voice,
    response_format: args.format,
  };
  if (supportsInstructions(args.model) && args.instructions?.trim()) {
    body.instructions = args.instructions.trim();
  }

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

    if (!response.ok) {
      throw new TTSApiError(await readErrorDetail(response), response.status);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
      throw new TTSApiError("OpenAI TTS returned an empty audio file.", -4);
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

async function readErrorDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return `OpenAI TTS request failed: HTTP ${response.status} ${response.statusText}`;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message || text;
  } catch {
    return text;
  }
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function supportsInstructions(model: OpenAITTSModel): boolean {
  return model === "gpt-4o-mini-tts";
}
