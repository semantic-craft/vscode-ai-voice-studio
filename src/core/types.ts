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

export interface VoiceCatalog {
  id: "qwen";
  label: "Qwen-TTS";
  models: ModelInfo[];
  voices: VoiceConfig[];
  defaults: {
    model: string;
    voice: string;
    format: string;
  };
}

export function getVoiceById(catalog: VoiceCatalog, id: string): VoiceConfig | undefined {
  return catalog.voices.find((v) => v.id === id);
}

export function isVoiceAvailableForModel(voice: VoiceConfig, model: string): boolean {
  return voice.models.length === 0 || voice.models.includes(model);
}

export function getVoicesForModel(catalog: VoiceCatalog, model: string): VoiceConfig[] {
  return catalog.voices.filter((v) => isVoiceAvailableForModel(v, model));
}
