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
  DEFAULT_EMOTION as MINIMAX_DEFAULT_EMOTION,
  DEFAULT_FORMAT as MINIMAX_DEFAULT_FORMAT,
  DEFAULT_MODEL as MINIMAX_DEFAULT_MODEL,
  DEFAULT_PITCH as MINIMAX_DEFAULT_PITCH,
  DEFAULT_REGION,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_VOICE as MINIMAX_DEFAULT_VOICE,
  DEFAULT_VOL as MINIMAX_DEFAULT_VOL,
  isMiniMaxEmotion,
  isMiniMaxModel,
  type MiniMaxEmotion,
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
import {
  DEFAULT_BASE_URL as GEMINI_DEFAULT_BASE_URL,
  DEFAULT_MODEL as GEMINI_DEFAULT_MODEL,
  DEFAULT_VOICE as GEMINI_DEFAULT_VOICE,
  type GeminiTTSModel,
} from "./core/gemini-voices";

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
  vol: number;
  pitch: number;
  emotion: MiniMaxEmotion;
  channel: 1 | 2;
  sampleRate: number;
  bitrate: number;
  languageBoost: string;
  pronunciationDict: string[];
}

export interface MiMoStylePreset {
  name: string;
  stylePrompt: string;
  openingStyleTags: string[];
  audioEventTags: string[];
}

export interface MiMoConfig {
  model: MiMoModel;
  voice: string;
  format: MiMoFormat;
  baseUrl: string;
  stylePrompt: string;
  openingStyleTags: string[];
  audioEventTags: string[];
  stylePresets: MiMoStylePreset[];
}

export interface GeminiConfig {
  model: GeminiTTSModel;
  voice: string;
  baseUrl: string;
  stylePreamble: string;
}

export interface AppConfig {
  provider: ProviderId;
  playbackRate: number;
  chunkSize: number;
  openai: OpenAIConfig;
  minimax: MiniMaxConfig;
  mimo: MiMoConfig;
  gemini: GeminiConfig;
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
      vol: clampMiniMaxVol(cfg.get<number>("minimax.vol") ?? MINIMAX_DEFAULT_VOL),
      pitch: clampMiniMaxPitch(cfg.get<number>("minimax.pitch") ?? MINIMAX_DEFAULT_PITCH),
      emotion: normalizeEmotion(cfg.get<string>("minimax.emotion")),
      channel: normalizeChannel(cfg.get<number>("minimax.channel") ?? 1),
      sampleRate: cfg.get<number>("minimax.sampleRate") || DEFAULT_SAMPLE_RATE,
      bitrate: cfg.get<number>("minimax.bitrate") || DEFAULT_BITRATE,
      languageBoost: cfg.get<string>("minimax.languageBoost")?.trim() || "",
      pronunciationDict: normalizeTagList(cfg.get<string[]>("minimax.pronunciationDict")),
    },
    mimo: {
      model: normalizeMiMoModel(cfg.get<string>("mimo.model")),
      voice: cfg.get<string>("mimo.voice")?.trim() || MIMO_DEFAULT_VOICE,
      format: normalizeMiMoFormat(cfg.get<string>("mimo.format")),
      baseUrl: cfg.get<string>("mimo.baseUrl")?.trim() || MIMO_DEFAULT_BASE_URL,
      stylePrompt: cfg.get<string>("mimo.stylePrompt") ?? "",
      openingStyleTags: normalizeTagList(cfg.get<string[]>("mimo.openingStyleTags")),
      audioEventTags: normalizeTagList(cfg.get<string[]>("mimo.audioEventTags")),
      stylePresets: normalizePresetList(cfg.get<unknown[]>("mimo.stylePresets")),
    },
    gemini: {
      model: normalizeGeminiModel(cfg.get<string>("gemini.model")),
      voice: cfg.get<string>("gemini.voice")?.trim() || GEMINI_DEFAULT_VOICE,
      baseUrl: cfg.get<string>("gemini.baseUrl")?.trim() || GEMINI_DEFAULT_BASE_URL,
      stylePreamble: cfg.get<string>("gemini.stylePreamble") ?? "",
    },
  };
}

export async function setMiMoOpeningStyleTags(tags: string[]): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("mimo.openingStyleTags", tags, vscode.ConfigurationTarget.Global);
}

export async function setGeminiStylePreamble(text: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("gemini.stylePreamble", text, vscode.ConfigurationTarget.Global);
}

export async function setOpenAIInstructions(text: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("openai.instructions", text, vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxSpeed(speed: number): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.speed", clampMiniMaxSpeed(speed), vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxRegion(region: "mainland" | "global"): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.region", region, vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxLanguageBoost(text: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.languageBoost", text, vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxPitch(pitch: number): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.pitch", clampMiniMaxPitch(pitch), vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxVol(vol: number): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.vol", clampMiniMaxVol(vol), vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxEmotion(emotion: MiniMaxEmotion): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.emotion", emotion, vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxChannel(channel: 1 | 2): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.channel", channel, vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxPronunciationDict(entries: string[]): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.pronunciationDict", entries, vscode.ConfigurationTarget.Global);
}

export async function setMiMoAudioEventTags(tags: string[]): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("mimo.audioEventTags", tags, vscode.ConfigurationTarget.Global);
}

export async function setMiMoStylePrompt(text: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("mimo.stylePrompt", text, vscode.ConfigurationTarget.Global);
}

export async function setMiMoStylePresets(presets: MiMoStylePreset[]): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("mimo.stylePresets", presets, vscode.ConfigurationTarget.Global);
}

/**
 * Voice-clone sample storage. Lives in `ExtensionContext.globalState` (NOT
 * settings.json) because the base64 payload can be megabytes — way too big
 * for synced settings.
 */
export interface MiMoVoiceCloneSampleRecord {
  dataUrl: string;
  mime: string;
  fileName: string;
  sizeBytes: number;
  storedAt: number;
}

const MIMO_VOICE_CLONE_KEY = "mimo.voiceCloneSample";

export function getMiMoVoiceCloneSample(state: vscode.Memento): MiMoVoiceCloneSampleRecord | undefined {
  const raw = state.get<unknown>(MIMO_VOICE_CLONE_KEY);
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as Partial<MiMoVoiceCloneSampleRecord>;
  if (
    typeof record.dataUrl !== "string" ||
    typeof record.mime !== "string" ||
    typeof record.fileName !== "string" ||
    typeof record.sizeBytes !== "number" ||
    typeof record.storedAt !== "number"
  ) {
    return undefined;
  }
  return record as MiMoVoiceCloneSampleRecord;
}

export async function setMiMoVoiceCloneSample(
  state: vscode.Memento,
  record: MiMoVoiceCloneSampleRecord | undefined,
): Promise<void> {
  await state.update(MIMO_VOICE_CLONE_KEY, record);
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
  return isMiniMaxModel(value) ? value : MINIMAX_DEFAULT_MODEL;
}

function normalizeEmotion(value: string | undefined): MiniMaxEmotion {
  return isMiniMaxEmotion(value) ? value : MINIMAX_DEFAULT_EMOTION;
}

function normalizeChannel(value: number | undefined): 1 | 2 {
  return value === 2 ? 2 : 1;
}

function normalizeMiniMaxFormat(value: string | undefined): MiniMaxFormat {
  return value === "wav" || value === "mp3" ? value : MINIMAX_DEFAULT_FORMAT;
}

function normalizeRegion(value: string | undefined): MiniMaxRegion {
  return value === "global" || value === "mainland" ? value : DEFAULT_REGION;
}

function normalizeMiMoModel(value: string | undefined): MiMoModel {
  if (
    value === "mimo-v2.5-tts" ||
    value === "mimo-v2.5-tts-voicedesign" ||
    value === "mimo-v2.5-tts-voiceclone" ||
    value === "mimo-v2-tts"
  ) {
    return value;
  }
  return MIMO_DEFAULT_MODEL;
}

function normalizeGeminiModel(value: string | undefined): GeminiTTSModel {
  if (
    value === "gemini-3.1-flash-tts-preview" ||
    value === "gemini-2.5-flash-preview-tts" ||
    value === "gemini-2.5-pro-preview-tts"
  ) {
    return value;
  }
  return GEMINI_DEFAULT_MODEL;
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

function clampMiniMaxVol(vol: number): number {
  if (!Number.isFinite(vol)) return MINIMAX_DEFAULT_VOL;
  return Math.max(0, Math.min(10, vol));
}

function clampMiniMaxPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) return MINIMAX_DEFAULT_PITCH;
  return Math.max(-12, Math.min(12, Math.round(pitch)));
}

function clampChunkSize(size: number): number {
  if (!Number.isFinite(size)) return 250;
  return Math.max(80, Math.min(2000, Math.round(size)));
}

function normalizeTagList(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(new Set(tags.map((t) => t?.trim()).filter((t): t is string => !!t)));
}

function normalizePresetList(raw: unknown[] | undefined): MiMoStylePreset[] {
  if (!Array.isArray(raw)) return [];
  const out: MiMoStylePreset[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj.name === "string" ? obj.name.trim() : "";
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      stylePrompt: typeof obj.stylePrompt === "string" ? obj.stylePrompt : "",
      openingStyleTags: normalizeTagList(Array.isArray(obj.openingStyleTags) ? (obj.openingStyleTags as string[]) : []),
      audioEventTags: normalizeTagList(Array.isArray(obj.audioEventTags) ? (obj.audioEventTags as string[]) : []),
    });
  }
  return out;
}
