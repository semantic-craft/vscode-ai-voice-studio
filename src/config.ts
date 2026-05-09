import * as vscode from "vscode";
import { isProviderId, type ProviderId } from "./core/providers";
import {
  DEFAULT_FORMAT as OPENAI_DEFAULT_FORMAT,
  DEFAULT_MODEL as OPENAI_DEFAULT_MODEL,
  DEFAULT_VOICE as OPENAI_DEFAULT_VOICE,
  type OpenAIResponseFormat,
  type OpenAITTSModel,
} from "./core/openai-voices";
import {
  DEFAULT_BITRATE,
  DEFAULT_FORMAT as MINIMAX_DEFAULT_FORMAT,
  DEFAULT_MODEL as MINIMAX_DEFAULT_MODEL,
  DEFAULT_REGION,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_VOICE as MINIMAX_DEFAULT_VOICE,
  type MiniMaxFormat,
  type MiniMaxModel,
  type MiniMaxRegion,
} from "./core/minimax-voices";
import {
  DEFAULT_BASE_URL as MIMO_DEFAULT_BASE_URL,
  DEFAULT_FORMAT as MIMO_DEFAULT_FORMAT,
  DEFAULT_MODEL as MIMO_DEFAULT_MODEL,
  DEFAULT_VOICE as MIMO_DEFAULT_VOICE,
  type MiMoFormat,
  type MiMoModel,
} from "./core/mimo-voices";

const SECTION = "aiVoiceStudio";
const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

export interface OpenAIConfig {
  model: OpenAITTSModel;
  voice: string;
  format: OpenAIResponseFormat;
  instructions: string;
  baseUrl: string;
}

export interface MiniMaxConfig {
  model: MiniMaxModel;
  voice: string;
  format: MiniMaxFormat;
  region: MiniMaxRegion;
  speed: number;
  sampleRate: number;
  bitrate: number;
  languageBoost: string;
}

export interface MiMoConfig {
  model: MiMoModel;
  voice: string;
  format: MiMoFormat;
  baseUrl: string;
  stylePrompt: string;
  openingStyleTags: string[];
  audioEventTags: string[];
}

export interface AppConfig {
  provider: ProviderId;
  playbackRate: number;
  chunkSize: number;
  openai: OpenAIConfig;
  minimax: MiniMaxConfig;
  mimo: MiMoConfig;
}

export function getConfig(): AppConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    provider: normalizeProvider(cfg.get<string>("provider")),
    playbackRate: clampRate(cfg.get<number>("playbackRate") ?? cfg.get<number>("openai.playbackRate") ?? 1),
    chunkSize: clampChunkSize(cfg.get<number>("chunkSize") ?? 250),
    openai: {
      model: normalizeOpenAIModel(cfg.get<string>("openai.model")),
      voice: cfg.get<string>("openai.voice")?.trim() || OPENAI_DEFAULT_VOICE,
      format: normalizeOpenAIFormat(cfg.get<string>("openai.format")),
      instructions: cfg.get<string>("openai.instructions")?.trim() || "",
      baseUrl: cfg.get<string>("openai.baseUrl")?.trim() || OPENAI_DEFAULT_BASE_URL,
    },
    minimax: {
      model: normalizeMiniMaxModel(cfg.get<string>("minimax.model")),
      voice: cfg.get<string>("minimax.voice")?.trim() || MINIMAX_DEFAULT_VOICE,
      format: normalizeMiniMaxFormat(cfg.get<string>("minimax.format")),
      region: normalizeRegion(cfg.get<string>("minimax.region")),
      speed: clampMiniMaxSpeed(cfg.get<number>("minimax.speed") ?? 1),
      sampleRate: cfg.get<number>("minimax.sampleRate") || DEFAULT_SAMPLE_RATE,
      bitrate: cfg.get<number>("minimax.bitrate") || DEFAULT_BITRATE,
      languageBoost: cfg.get<string>("minimax.languageBoost")?.trim() || "",
    },
    mimo: {
      model: normalizeMiMoModel(cfg.get<string>("mimo.model")),
      voice: cfg.get<string>("mimo.voice")?.trim() || MIMO_DEFAULT_VOICE,
      format: normalizeMiMoFormat(cfg.get<string>("mimo.format")),
      baseUrl: cfg.get<string>("mimo.baseUrl")?.trim() || MIMO_DEFAULT_BASE_URL,
      stylePrompt: cfg.get<string>("mimo.stylePrompt")?.trim() || "",
      openingStyleTags: normalizeTagList(cfg.get<string[]>("mimo.openingStyleTags")),
      audioEventTags: normalizeTagList(cfg.get<string[]>("mimo.audioEventTags")),
    },
  };
}

export async function setMiMoOpeningStyleTags(tags: string[]): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("mimo.openingStyleTags", tags, vscode.ConfigurationTarget.Global);
}

export async function setMiMoAudioEventTags(tags: string[]): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("mimo.audioEventTags", tags, vscode.ConfigurationTarget.Global);
}

export async function setPlaybackRate(rate: number): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("playbackRate", clampRate(rate), vscode.ConfigurationTarget.Global);
}

export async function setProvider(provider: ProviderId): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("provider", provider, vscode.ConfigurationTarget.Global);
}

export async function setProviderVoice(provider: ProviderId, voice: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update(`${provider}.voice`, voice, vscode.ConfigurationTarget.Global);
}

export async function setProviderModel(provider: ProviderId, model: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update(`${provider}.model`, model, vscode.ConfigurationTarget.Global);
}

function normalizeProvider(value: string | undefined): ProviderId {
  return isProviderId(value) ? value : "openai";
}

function normalizeOpenAIModel(value: string | undefined): OpenAITTSModel {
  if (value === "gpt-4o-mini-tts" || value === "tts-1" || value === "tts-1-hd") return value;
  return OPENAI_DEFAULT_MODEL;
}

function normalizeOpenAIFormat(value: string | undefined): OpenAIResponseFormat {
  return value === "wav" || value === "mp3" ? value : OPENAI_DEFAULT_FORMAT;
}

function normalizeMiniMaxModel(value: string | undefined): MiniMaxModel {
  if (value === "speech-2.8-hd" || value === "speech-2.6-hd" || value === "speech-02-hd") return value;
  return MINIMAX_DEFAULT_MODEL;
}

function normalizeMiniMaxFormat(value: string | undefined): MiniMaxFormat {
  return value === "wav" || value === "mp3" ? value : MINIMAX_DEFAULT_FORMAT;
}

function normalizeRegion(value: string | undefined): MiniMaxRegion {
  return value === "global" || value === "mainland" ? value : DEFAULT_REGION;
}

function normalizeMiMoModel(value: string | undefined): MiMoModel {
  if (value === "mimo-v2.5-tts" || value === "mimo-v2-tts") return value;
  return MIMO_DEFAULT_MODEL;
}

function normalizeMiMoFormat(value: string | undefined): MiMoFormat {
  return value === "mp3" || value === "wav" ? value : MIMO_DEFAULT_FORMAT;
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.max(0.5, Math.min(4, rate));
}

function clampMiniMaxSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  return Math.max(0.5, Math.min(2, speed));
}

function clampChunkSize(size: number): number {
  if (!Number.isFinite(size)) return 250;
  return Math.max(80, Math.min(2000, Math.round(size)));
}

function normalizeTagList(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(new Set(tags.map((t) => t?.trim()).filter((t): t is string => !!t)));
}
