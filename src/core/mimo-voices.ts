import type { ProviderCatalog, VoiceConfig } from "./providers";

export type MiMoModel = "mimo-v2.5-tts" | "mimo-v2-tts";
export type MiMoFormat = "mp3" | "wav";

export const DEFAULT_MODEL: MiMoModel = "mimo-v2.5-tts";
export const DEFAULT_VOICE = "mimo_default";
export const DEFAULT_FORMAT: MiMoFormat = "wav";
export const DEFAULT_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";

export const MODEL_LABELS: Record<MiMoModel, string> = {
  "mimo-v2.5-tts": "MiMo-V2.5-TTS",
  "mimo-v2-tts": "MiMo-V2-TTS",
};

const V25_ONLY: MiMoModel[] = ["mimo-v2.5-tts"];
const V2_ONLY: MiMoModel[] = ["mimo-v2-tts"];
const ALL_MODELS: MiMoModel[] = ["mimo-v2.5-tts", "mimo-v2-tts"];

export const VOICES: VoiceConfig[] = [
  { id: "mimo_default", name: "MiMo Default", category: "Default",  description: "Platform default voice for the active region.", models: ALL_MODELS, recommended: true },
  { id: "冰糖",         name: "Bingtang",     category: "Chinese",  description: "Clear Chinese female voice for narration.",      models: V25_ONLY, recommended: true },
  { id: "茉莉",         name: "Moli",         category: "Chinese",  description: "Soft Chinese female voice, calm tone.",          models: V25_ONLY },
  { id: "苏打",         name: "Soda",         category: "Chinese",  description: "Bright Chinese male voice, short-form.",         models: V25_ONLY },
  { id: "白桦",         name: "Baihua",       category: "Chinese",  description: "Steady Chinese male voice for long text.",       models: V25_ONLY },
  { id: "Mia",          name: "Mia",          category: "English",  description: "Natural English female voice.",                  models: V25_ONLY },
  { id: "Chloe",        name: "Chloe",        category: "English",  description: "Expressive English female voice.",               models: V25_ONLY, recommended: true },
  { id: "Milo",         name: "Milo",         category: "English",  description: "Warm English male voice.",                       models: V25_ONLY },
  { id: "Dean",         name: "Dean",         category: "English",  description: "Grounded English male voice for narration.",     models: V25_ONLY },
  { id: "default_zh",   name: "MiMo Chinese Female", category: "Legacy", description: "Legacy MiMo-V2 Chinese female voice.",       models: V2_ONLY },
  { id: "default_en",   name: "MiMo English Female", category: "Legacy", description: "Legacy MiMo-V2 English female voice.",       models: V2_ONLY },
];

export const MIMO_CATALOG: ProviderCatalog = {
  id: "mimo",
  label: "MiMo",
  models: ALL_MODELS.map((id) => ({ id, label: MODEL_LABELS[id] })),
  voices: VOICES,
  defaults: {
    model: DEFAULT_MODEL,
    voice: DEFAULT_VOICE,
    format: DEFAULT_FORMAT,
  },
};
