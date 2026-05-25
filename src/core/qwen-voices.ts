import type { ProviderCatalog, VoiceConfig } from "./providers";

export type QwenTTSModel = "qwen3-tts-flash" | "qwen3-tts-instruct-flash";
export type QwenEndpoint = "china" | "international";
export type QwenLanguageType = "Auto" | "Chinese" | "English" | "German";

export const DEFAULT_MODEL: QwenTTSModel = "qwen3-tts-flash";
export const DEFAULT_VOICE = "Cherry";
export const DEFAULT_ENDPOINT: QwenEndpoint = "china";
export const DEFAULT_LANGUAGE_TYPE: QwenLanguageType = "Auto";

export const ENDPOINT_URLS: Record<QwenEndpoint, string> = {
  china: "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
  international: "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
};

export const LANGUAGE_TYPES: Array<{ id: QwenLanguageType; label: string }> = [
  { id: "Auto", label: "Auto" },
  { id: "Chinese", label: "Chinese" },
  { id: "English", label: "English" },
  { id: "German", label: "German" },
];

export const MODEL_LABELS: Record<QwenTTSModel, string> = {
  "qwen3-tts-flash": "Qwen3 TTS Flash",
  "qwen3-tts-instruct-flash": "Qwen3 TTS Instruct Flash",
};

export const MODEL_DESCRIPTIONS: Record<QwenTTSModel, string> = {
  "qwen3-tts-flash": "Current recommended Qwen-TTS non-realtime model.",
  "qwen3-tts-instruct-flash": "Qwen-TTS model that accepts style instructions.",
};

const ALL_MODELS: QwenTTSModel[] = ["qwen3-tts-flash", "qwen3-tts-instruct-flash"];
const FLASH_ONLY: QwenTTSModel[] = ["qwen3-tts-flash"];
const BOTH_MODELS: QwenTTSModel[] = ALL_MODELS;

export const VOICES: VoiceConfig[] = [
  {
    id: "Cherry",
    name: "Cherry / 芊悦",
    category: "General",
    description: "Sunny, friendly female voice. Supports Chinese, English, German, and other listed languages.",
    models: BOTH_MODELS,
    recommended: true,
  },
  {
    id: "Serena",
    name: "Serena / 苏瑶",
    category: "General",
    description: "Natural female voice for narration and conversation.",
    models: BOTH_MODELS,
  },
  {
    id: "Ethan",
    name: "Ethan / 晨煦",
    category: "General",
    description: "Warm male voice for long-form reading.",
    models: BOTH_MODELS,
  },
  {
    id: "Chelsie",
    name: "Chelsie / 千雪",
    category: "General",
    description: "Clear female voice with a composed tone.",
    models: BOTH_MODELS,
  },
  {
    id: "Kai",
    name: "Kai / 凯",
    category: "General",
    description: "Natural male voice for multilingual reading.",
    models: BOTH_MODELS,
  },
  {
    id: "Dylan",
    name: "Dylan / 北京-晓东",
    category: "Chinese Dialect",
    description: "Beijing dialect voice; also supports English, German, and other listed languages.",
    models: FLASH_ONLY,
  },
  {
    id: "Jada",
    name: "Jada / 上海-阿珍",
    category: "Chinese Dialect",
    description: "Shanghainese voice; also supports English, German, and other listed languages.",
    models: FLASH_ONLY,
  },
  {
    id: "Sunny",
    name: "Sunny / 四川-晴儿",
    category: "Chinese Dialect",
    description: "Sichuan dialect voice; also supports English, German, and other listed languages.",
    models: FLASH_ONLY,
  },
];

export const QWEN_CATALOG: ProviderCatalog = {
  id: "qwen",
  label: "Qwen",
  models: ALL_MODELS.map((id) => ({ id, label: MODEL_LABELS[id], description: MODEL_DESCRIPTIONS[id] })),
  voices: VOICES,
  defaults: {
    model: DEFAULT_MODEL,
    voice: DEFAULT_VOICE,
    format: "wav",
  },
};

export function isQwenModel(value: string | undefined): value is QwenTTSModel {
  if (!value) return false;
  return ALL_MODELS.includes(value as QwenTTSModel);
}

export function isQwenEndpoint(value: string | undefined): value is QwenEndpoint {
  return value === "china" || value === "international";
}

export function isQwenLanguageType(value: string | undefined): value is QwenLanguageType {
  return value === "Auto" || value === "Chinese" || value === "English" || value === "German";
}

export function supportsInstructions(model: QwenTTSModel): boolean {
  return model === "qwen3-tts-instruct-flash";
}
