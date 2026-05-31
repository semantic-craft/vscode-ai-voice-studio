import type { ProviderCatalog, VoiceConfig } from "./providers";

export type QwenTTSModel =
  | "qwen3-tts-flash"
  | "qwen3-tts-instruct-flash"
  | "qwen3-tts-flash-realtime"
  | "qwen3-tts-instruct-flash-realtime";
export type QwenEndpoint = "china" | "international";
export type QwenLanguageType = "Auto" | "Chinese" | "English" | "German";

export const DEFAULT_MODEL: QwenTTSModel = "qwen3-tts-flash";
export const DEFAULT_VOICE = "Cherry";
export const DEFAULT_ENDPOINT: QwenEndpoint = "china";
export const DEFAULT_LANGUAGE_TYPE: QwenLanguageType = "Auto";

export const ENDPOINT_URLS: Record<QwenEndpoint, string> = {
  china: "https://dashscope.aliyuncs.com/api/v1",
  international: "https://dashscope-intl.aliyuncs.com/api/v1",
};

export const REALTIME_WS_URLS: Record<QwenEndpoint, string> = {
  china: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
  international: "wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime",
};

export const LANGUAGE_TYPES: Array<{ id: QwenLanguageType; label: string }> = [
  { id: "Auto", label: "Auto" },
  { id: "Chinese", label: "Chinese" },
  { id: "English", label: "English" },
  { id: "German", label: "German" },
];

export const MODEL_LABELS: Record<QwenTTSModel, string> = {
  "qwen3-tts-flash": "Qwen3 TTS Flash (HTTP SSE)",
  "qwen3-tts-instruct-flash": "Qwen3 TTS Instruct Flash (HTTP SSE)",
  "qwen3-tts-flash-realtime": "Qwen3 TTS Flash Realtime (WebSocket)",
  "qwen3-tts-instruct-flash-realtime": "Qwen3 TTS Instruct Flash Realtime (WebSocket)",
};

export const MODEL_DESCRIPTIONS: Record<QwenTTSModel, string> = {
  "qwen3-tts-flash": "Default HTTP SSE streaming model. Sub-second first audio.",
  "qwen3-tts-instruct-flash": "HTTP SSE model that accepts style instructions.",
  "qwen3-tts-flash-realtime": "WebSocket realtime model. ~100 ms first audio.",
  "qwen3-tts-instruct-flash-realtime": "WebSocket realtime model with style instructions.",
};

const ALL_MODELS: QwenTTSModel[] = [
  "qwen3-tts-flash",
  "qwen3-tts-instruct-flash",
  "qwen3-tts-flash-realtime",
  "qwen3-tts-instruct-flash-realtime",
];
const NON_REALTIME_FLASH_ONLY: QwenTTSModel[] = ["qwen3-tts-flash"];
const NON_REALTIME_BOTH: QwenTTSModel[] = ["qwen3-tts-flash", "qwen3-tts-instruct-flash"];
const ALL: QwenTTSModel[] = ALL_MODELS;

export const VOICES: VoiceConfig[] = [
  {
    id: "Cherry",
    name: "Cherry / 芊悦",
    category: "General",
    description: "Sunny, friendly female voice. Supports Chinese, English, German, and other listed languages.",
    models: ALL,
    recommended: true,
  },
  {
    id: "Serena",
    name: "Serena / 苏瑶",
    category: "General",
    description: "Natural female voice for narration and conversation.",
    models: ALL,
  },
  {
    id: "Ethan",
    name: "Ethan / 晨煦",
    category: "General",
    description: "Warm male voice for long-form reading.",
    models: ALL,
  },
  {
    id: "Chelsie",
    name: "Chelsie / 千雪",
    category: "General",
    description: "Clear female voice with a composed tone.",
    models: ALL,
  },
  {
    id: "Kai",
    name: "Kai / 凯",
    category: "General",
    description: "Natural male voice for multilingual reading.",
    models: ALL,
  },
  {
    id: "Dylan",
    name: "Dylan / 北京-晓东",
    category: "Chinese Dialect",
    description: "Beijing dialect voice; also supports English, German, and other listed languages.",
    models: NON_REALTIME_FLASH_ONLY,
  },
  {
    id: "Jada",
    name: "Jada / 上海-阿珍",
    category: "Chinese Dialect",
    description: "Shanghainese voice; also supports English, German, and other listed languages.",
    models: NON_REALTIME_FLASH_ONLY,
  },
  {
    id: "Sunny",
    name: "Sunny / 四川-晴儿",
    category: "Chinese Dialect",
    description: "Sichuan dialect voice; also supports English, German, and other listed languages.",
    models: NON_REALTIME_FLASH_ONLY,
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

export function isRealtimeModel(model: QwenTTSModel): boolean {
  return model === "qwen3-tts-flash-realtime" || model === "qwen3-tts-instruct-flash-realtime";
}

export function isQwenEndpoint(value: string | undefined): value is QwenEndpoint {
  return value === "china" || value === "international";
}

export function isQwenLanguageType(value: string | undefined): value is QwenLanguageType {
  return value === "Auto" || value === "Chinese" || value === "English" || value === "German";
}

export function supportsInstructions(model: QwenTTSModel): boolean {
  return model === "qwen3-tts-instruct-flash" || model === "qwen3-tts-instruct-flash-realtime";
}

// `NON_REALTIME_BOTH` is exported to make the relationship explicit at compile
// time (some dialect-only voices intentionally exclude realtime); the symbol
// is not currently consumed externally.
export const NON_REALTIME_MODELS: QwenTTSModel[] = NON_REALTIME_BOTH;
