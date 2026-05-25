export type ProviderId = "mimo" | "gemini" | "qwen";

export const PROVIDER_IDS: ProviderId[] = ["mimo", "gemini", "qwen"];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  mimo: "MiMo",
  gemini: "Gemini",
  qwen: "Qwen",
};

export class TTSApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
  ) {
    super(message);
    this.name = "TTSApiError";
  }
}

export interface SynthesizeContext {
  text: string;
  signal?: AbortSignal;
}

export interface SynthesizeResult {
  audioBase64: string;
  format: string;
}

export interface VoiceConfig {
  id: string;
  name: string;
  category: string;
  description: string;
  models: string[];
  recommended?: boolean;
}

export interface ModelInfo {
  id: string;
  label: string;
  description?: string;
}

export interface ProviderCatalog {
  id: ProviderId;
  label: string;
  models: ModelInfo[];
  voices: VoiceConfig[];
  defaults: {
    model: string;
    voice: string;
    format: string;
  };
}

export function isProviderId(value: unknown): value is ProviderId {
  return value === "mimo" || value === "gemini" || value === "qwen";
}

export function getVoiceById(catalog: ProviderCatalog, id: string): VoiceConfig | undefined {
  return catalog.voices.find((v) => v.id === id);
}

export function isVoiceAvailableForModel(voice: VoiceConfig, model: string): boolean {
  return voice.models.length === 0 || voice.models.includes(model);
}

export function getVoicesForModel(catalog: ProviderCatalog, model: string): VoiceConfig[] {
  return catalog.voices.filter((v) => isVoiceAvailableForModel(v, model));
}
