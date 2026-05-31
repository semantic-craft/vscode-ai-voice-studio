import * as vscode from "vscode";
import { isProviderId, type ProviderId } from "./core/providers";
import {
  DEFAULT_BASE_URL as MIMO_DEFAULT_BASE_URL,
  DEFAULT_FORMAT as MIMO_DEFAULT_FORMAT,
  DEFAULT_MODEL as MIMO_DEFAULT_MODEL,
  normalizeMiMoVoice,
  type MiMoFormat,
  type MiMoModel,
} from "./core/mimo-voices";
import {
  DEFAULT_BITRATE as MINIMAX_DEFAULT_BITRATE,
  DEFAULT_EMOTION as MINIMAX_DEFAULT_EMOTION,
  DEFAULT_FORMAT as MINIMAX_DEFAULT_FORMAT,
  DEFAULT_LANGUAGE_BOOST as MINIMAX_DEFAULT_LANGUAGE_BOOST,
  DEFAULT_MODEL as MINIMAX_DEFAULT_MODEL,
  DEFAULT_PITCH as MINIMAX_DEFAULT_PITCH,
  DEFAULT_REGION as MINIMAX_DEFAULT_REGION,
  DEFAULT_SAMPLE_RATE as MINIMAX_DEFAULT_SAMPLE_RATE,
  DEFAULT_SPEED as MINIMAX_DEFAULT_SPEED,
  DEFAULT_VOICE as MINIMAX_DEFAULT_VOICE,
  DEFAULT_VOL as MINIMAX_DEFAULT_VOL,
  isMiniMaxEmotion,
  isMiniMaxFormat,
  isMiniMaxModel,
  isMiniMaxRegion,
  type MiniMaxEmotion,
  type MiniMaxFormat,
  type MiniMaxModel,
  type MiniMaxRegion,
} from "./core/minimax-voices";
import {
  DEFAULT_BASE_URL as GEMINI_DEFAULT_BASE_URL,
  DEFAULT_MODEL as GEMINI_DEFAULT_MODEL,
  DEFAULT_VOICE as GEMINI_DEFAULT_VOICE,
  type GeminiTTSModel,
} from "./core/gemini-voices";
import {
  DEFAULT_ENDPOINT as QWEN_DEFAULT_ENDPOINT,
  DEFAULT_LANGUAGE_TYPE as QWEN_DEFAULT_LANGUAGE_TYPE,
  DEFAULT_MODEL as QWEN_DEFAULT_MODEL,
  DEFAULT_VOICE as QWEN_DEFAULT_VOICE,
  isQwenEndpoint,
  isQwenLanguageType,
  isQwenModel,
  type QwenEndpoint,
  type QwenLanguageType,
  type QwenTTSModel,
} from "./core/qwen-voices";

const SECTION = "aiVoiceStudio";

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

export interface MiniMaxConfig {
  model: MiniMaxModel;
  voice: string;
  region: MiniMaxRegion;
  format: MiniMaxFormat;
  sampleRate: number;
  bitrate: number;
  speed: number;
  vol: number;
  pitch: number;
  emotion: MiniMaxEmotion;
  englishNormalization: boolean;
  languageBoost: string;
}

export interface GeminiConfig {
  model: GeminiTTSModel;
  voice: string;
  baseUrl: string;
  stylePreamble: string;
}

export interface QwenConfig {
  model: QwenTTSModel;
  voice: string;
  endpoint: QwenEndpoint;
  languageType: QwenLanguageType;
  instructions: string;
}

export interface AppConfig {
  provider: ProviderId;
  playbackRate: number;
  chunkSize: number;
  mimo: MiMoConfig;
  minimax: MiniMaxConfig;
  gemini: GeminiConfig;
  qwen: QwenConfig;
}

export function getConfig(): AppConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const mimoModel = normalizeMiMoModel(cfg.get<string>("mimo.model"));
  return {
    provider: normalizeProvider(cfg.get<string>("provider")),
    playbackRate: clampRate(cfg.get<number>("playbackRate") ?? 1),
    chunkSize: clampChunkSize(cfg.get<number>("chunkSize") ?? 250),
    mimo: {
      model: mimoModel,
      voice: normalizeMiMoVoice(cfg.get<string>("mimo.voice"), mimoModel),
      format: normalizeMiMoFormat(cfg.get<string>("mimo.format")),
      baseUrl: getTrimmedString(cfg, "mimo.baseUrl") || MIMO_DEFAULT_BASE_URL,
      stylePrompt: getString(cfg, "mimo.stylePrompt"),
      openingStyleTags: normalizeTagList(cfg.get<string[]>("mimo.openingStyleTags")),
      audioEventTags: normalizeTagList(cfg.get<string[]>("mimo.audioEventTags")),
      stylePresets: normalizePresetList(cfg.get<unknown[]>("mimo.stylePresets")),
    },
    minimax: {
      model: normalizeMiniMaxModel(cfg.get<string>("minimax.model")),
      voice: getTrimmedString(cfg, "minimax.voice") || MINIMAX_DEFAULT_VOICE,
      region: normalizeMiniMaxRegion(cfg.get<string>("minimax.region")),
      format: normalizeMiniMaxFormat(cfg.get<string>("minimax.format")),
      sampleRate: clampSampleRate(cfg.get<number>("minimax.sampleRate") ?? MINIMAX_DEFAULT_SAMPLE_RATE),
      bitrate: clampBitrate(cfg.get<number>("minimax.bitrate") ?? MINIMAX_DEFAULT_BITRATE),
      speed: clampMiniMaxSpeed(cfg.get<number>("minimax.speed") ?? MINIMAX_DEFAULT_SPEED),
      vol: clampMiniMaxVol(cfg.get<number>("minimax.vol") ?? MINIMAX_DEFAULT_VOL),
      pitch: clampMiniMaxPitch(cfg.get<number>("minimax.pitch") ?? MINIMAX_DEFAULT_PITCH),
      emotion: normalizeMiniMaxEmotion(cfg.get<string>("minimax.emotion")),
      englishNormalization: cfg.get<boolean>("minimax.englishNormalization") === true,
      languageBoost: getTrimmedString(cfg, "minimax.languageBoost") || MINIMAX_DEFAULT_LANGUAGE_BOOST,
    },
    gemini: {
      model: normalizeGeminiModel(cfg.get<string>("gemini.model")),
      voice: getTrimmedString(cfg, "gemini.voice") || GEMINI_DEFAULT_VOICE,
      baseUrl: getTrimmedString(cfg, "gemini.baseUrl") || GEMINI_DEFAULT_BASE_URL,
      stylePreamble: getString(cfg, "gemini.stylePreamble"),
    },
    qwen: {
      model: normalizeQwenModel(cfg.get<string>("qwen.model")),
      voice: getTrimmedString(cfg, "qwen.voice") || QWEN_DEFAULT_VOICE,
      endpoint: normalizeQwenEndpoint(cfg.get<string>("qwen.endpoint")),
      languageType: normalizeQwenLanguageType(cfg.get<string>("qwen.languageType")),
      instructions: getString(cfg, "qwen.instructions"),
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

export async function setMiniMaxRegion(region: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.region", normalizeMiniMaxRegion(region), vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxFormat(format: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.format", normalizeMiniMaxFormat(format), vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxEmotion(emotion: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.emotion", normalizeMiniMaxEmotion(emotion), vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxLanguageBoost(boost: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.languageBoost", boost.trim() || MINIMAX_DEFAULT_LANGUAGE_BOOST, vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxSpeed(speed: number): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.speed", clampMiniMaxSpeed(speed), vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxVol(vol: number): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.vol", clampMiniMaxVol(vol), vscode.ConfigurationTarget.Global);
}

export async function setMiniMaxPitch(pitch: number): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("minimax.pitch", clampMiniMaxPitch(pitch), vscode.ConfigurationTarget.Global);
}

export async function setQwenEndpoint(endpoint: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("qwen.endpoint", normalizeQwenEndpoint(endpoint), vscode.ConfigurationTarget.Global);
}

export async function setQwenLanguageType(languageType: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("qwen.languageType", normalizeQwenLanguageType(languageType), vscode.ConfigurationTarget.Global);
}

export async function setQwenInstructions(text: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("qwen.instructions", text, vscode.ConfigurationTarget.Global);
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
  return isProviderId(value) ? value : "qwen";
}

function getString(cfg: vscode.WorkspaceConfiguration, key: string): string {
  const value = cfg.get<unknown>(key);
  return typeof value === "string" ? value : "";
}

function getTrimmedString(cfg: vscode.WorkspaceConfiguration, key: string): string {
  return getString(cfg, key).trim();
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

function normalizeMiniMaxModel(value: string | undefined): MiniMaxModel {
  return isMiniMaxModel(value) ? value : MINIMAX_DEFAULT_MODEL;
}

function normalizeMiniMaxRegion(value: string | undefined): MiniMaxRegion {
  return isMiniMaxRegion(value) ? value : MINIMAX_DEFAULT_REGION;
}

function normalizeMiniMaxFormat(value: string | undefined): MiniMaxFormat {
  return isMiniMaxFormat(value) ? value : MINIMAX_DEFAULT_FORMAT;
}

function normalizeMiniMaxEmotion(value: string | undefined): MiniMaxEmotion {
  return isMiniMaxEmotion(value) ? value : MINIMAX_DEFAULT_EMOTION;
}

const MINIMAX_SAMPLE_RATES = [8000, 16000, 22050, 24000, 32000, 44100];

function clampSampleRate(rate: number): number {
  if (!Number.isFinite(rate)) return MINIMAX_DEFAULT_SAMPLE_RATE;
  // Snap to the closest documented rate.
  let best = MINIMAX_SAMPLE_RATES[0];
  let bestDelta = Math.abs(rate - best);
  for (const r of MINIMAX_SAMPLE_RATES) {
    const d = Math.abs(rate - r);
    if (d < bestDelta) {
      best = r;
      bestDelta = d;
    }
  }
  return best;
}

function clampBitrate(bitrate: number): number {
  if (!Number.isFinite(bitrate)) return MINIMAX_DEFAULT_BITRATE;
  return Math.max(32000, Math.min(256000, Math.round(bitrate / 1000) * 1000));
}

function clampMiniMaxSpeed(speed: number): number {
  if (!Number.isFinite(speed)) return MINIMAX_DEFAULT_SPEED;
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

function normalizeQwenModel(value: string | undefined): QwenTTSModel {
  return isQwenModel(value) ? value : QWEN_DEFAULT_MODEL;
}

function normalizeQwenEndpoint(value: string | undefined): QwenEndpoint {
  return isQwenEndpoint(value) ? value : QWEN_DEFAULT_ENDPOINT;
}

function normalizeQwenLanguageType(value: string | undefined): QwenLanguageType {
  return isQwenLanguageType(value) ? value : QWEN_DEFAULT_LANGUAGE_TYPE;
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.max(0.5, Math.min(4, rate));
}

function clampChunkSize(size: number): number {
  if (!Number.isFinite(size)) return 250;
  return Math.max(80, Math.min(2000, Math.round(size)));
}

function normalizeTagList(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(
      tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );
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
