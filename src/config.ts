import * as vscode from "vscode";
import {
  DEFAULT_ENDPOINT,
  DEFAULT_LANGUAGE_TYPE,
  DEFAULT_MODEL,
  DEFAULT_VOICE,
  isQwenEndpoint,
  isQwenLanguageType,
  isQwenModel,
  type QwenEndpoint,
  type QwenLanguageType,
  type QwenTTSModel,
} from "./core/qwen-voices";

const SECTION = "aiVoiceStudio";

export interface QwenConfig {
  model: QwenTTSModel;
  voice: string;
  endpoint: QwenEndpoint;
  languageType: QwenLanguageType;
  instructions: string;
}

export interface AppConfig {
  playbackRate: number;
  chunkSize: number;
  qwen: QwenConfig;
}

export function getConfig(): AppConfig {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    playbackRate: clampRate(cfg.get<number>("playbackRate") ?? 1),
    chunkSize: clampChunkSize(cfg.get<number>("chunkSize") ?? 250),
    qwen: {
      model: normalizeQwenModel(cfg.get<string>("qwen.model")),
      voice: getTrimmedString(cfg, "qwen.voice") || DEFAULT_VOICE,
      endpoint: normalizeQwenEndpoint(cfg.get<string>("qwen.endpoint")),
      languageType: normalizeQwenLanguageType(cfg.get<string>("qwen.languageType")),
      instructions: getString(cfg, "qwen.instructions"),
    },
  };
}

export async function setQwenModel(model: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("qwen.model", normalizeQwenModel(model), vscode.ConfigurationTarget.Global);
}

export async function setQwenVoice(voice: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("qwen.voice", voice.trim() || DEFAULT_VOICE, vscode.ConfigurationTarget.Global);
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

export async function setPlaybackRate(rate: number): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  await cfg.update("playbackRate", clampRate(rate), vscode.ConfigurationTarget.Global);
}

function getString(cfg: vscode.WorkspaceConfiguration, key: string): string {
  const value = cfg.get<unknown>(key);
  return typeof value === "string" ? value : "";
}

function getTrimmedString(cfg: vscode.WorkspaceConfiguration, key: string): string {
  return getString(cfg, key).trim();
}

function normalizeQwenModel(value: string | undefined): QwenTTSModel {
  return isQwenModel(value) ? value : DEFAULT_MODEL;
}

function normalizeQwenEndpoint(value: string | undefined): QwenEndpoint {
  return isQwenEndpoint(value) ? value : DEFAULT_ENDPOINT;
}

function normalizeQwenLanguageType(value: string | undefined): QwenLanguageType {
  return isQwenLanguageType(value) ? value : DEFAULT_LANGUAGE_TYPE;
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return 1;
  return Math.max(0.5, Math.min(4, rate));
}

function clampChunkSize(size: number): number {
  if (!Number.isFinite(size)) return 250;
  return Math.max(80, Math.min(2000, Math.round(size)));
}
