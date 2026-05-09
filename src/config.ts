import * as vscode from "vscode";
import {
  DEFAULT_FORMAT,
  DEFAULT_MODEL,
  DEFAULT_VOICE,
  type OpenAIResponseFormat,
  type OpenAITTSModel,
} from "./core/openai-voices";

const SECTION = "aiVoiceStudio";

export interface OpenAIConfig {
  model: OpenAITTSModel;
  voice: string;
  format: OpenAIResponseFormat;
  playbackRate: number;
  instructions: string;
  baseUrl: string;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export function getOpenAIConfig(): OpenAIConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    model: normalizeModel(cfg.get<string>("openai.model")),
    voice: cfg.get<string>("openai.voice")?.trim() || DEFAULT_VOICE,
    format: normalizeFormat(cfg.get<string>("openai.format")),
    playbackRate: clampRate(cfg.get<number>("openai.playbackRate") ?? 1),
    instructions: cfg.get<string>("openai.instructions")?.trim() || "",
    baseUrl: cfg.get<string>("openai.baseUrl")?.trim() || DEFAULT_BASE_URL,
  };
}

export async function setPlaybackRate(rate: number): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("openai.playbackRate", clampRate(rate), vscode.ConfigurationTarget.Global);
}

function normalizeModel(value: string | undefined): OpenAITTSModel {
  if (value === "gpt-4o-mini-tts" || value === "tts-1" || value === "tts-1-hd") return value;
  return DEFAULT_MODEL;
}

function normalizeFormat(value: string | undefined): OpenAIResponseFormat {
  return value === "wav" || value === "mp3" ? value : DEFAULT_FORMAT;
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.max(0.5, Math.min(4, rate));
}
