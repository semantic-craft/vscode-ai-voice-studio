import type { ProviderCatalog, VoiceConfig } from "./providers";

export type MiniMaxModel = "speech-2.8-hd" | "speech-2.6-hd" | "speech-02-hd";
export type MiniMaxFormat = "mp3" | "wav";
export type MiniMaxRegion = "global" | "mainland";

export const DEFAULT_MODEL: MiniMaxModel = "speech-2.8-hd";
export const DEFAULT_VOICE = "Chinese (Mandarin)_Radio_Host";
export const DEFAULT_FORMAT: MiniMaxFormat = "mp3";
export const DEFAULT_REGION: MiniMaxRegion = "mainland";
export const DEFAULT_SAMPLE_RATE = 32000;
export const DEFAULT_BITRATE = 128000;

export const MODEL_LABELS: Record<MiniMaxModel, string> = {
  "speech-2.8-hd": "Speech 2.8 HD",
  "speech-2.6-hd": "Speech 2.6 HD",
  "speech-02-hd": "Speech 02 HD",
};

const ALL_MODELS: MiniMaxModel[] = ["speech-2.8-hd", "speech-2.6-hd", "speech-02-hd"];

export const VOICES: VoiceConfig[] = [
  { id: "Chinese (Mandarin)_Radio_Host",     name: "电台男主播", category: "中文普通话", description: "温度、节奏松弛的男声，适合论文/长文听书。", models: ALL_MODELS, recommended: true },
  { id: "Chinese (Mandarin)_Sincere_Adult",  name: "真诚青年",   category: "中文普通话", description: "真诚稳重、同辈聊天感强，适合论文讲解。", models: ALL_MODELS },
  { id: "Chinese (Mandarin)_Gentleman",      name: "温润男声",   category: "中文普通话", description: "温润耐心、书卷气，适合导师讲解。", models: ALL_MODELS },
  { id: "Chinese (Mandarin)_Lyrical_Voice",  name: "抒情男声",   category: "中文普通话", description: "柔和抒情，适合散文化论文。", models: ALL_MODELS },
  { id: "Chinese (Mandarin)_Reliable_Executive", name: "沉稳高管", category: "中文普通话", description: "沉稳可靠中年男声，适合正式材料。", models: ALL_MODELS },
  { id: "Chinese (Mandarin)_News_Anchor",    name: "新闻女声",   category: "中文普通话", description: "专业播音腔女声，适合新闻/正式文本。", models: ALL_MODELS, recommended: true },
  { id: "Chinese (Mandarin)_Wise_Women",     name: "阅历姐姐",   category: "中文普通话", description: "知性娓娓的女声，适合前辈引路式讲读。", models: ALL_MODELS },
  { id: "Chinese (Mandarin)_Gentle_Senior",  name: "温柔学姐",   category: "中文普通话", description: "温婉柔和、亲切有感染力的女声。", models: ALL_MODELS },
  { id: "Chinese (Mandarin)_Warm_Bestie",    name: "温暖闺蜜",   category: "中文普通话", description: "温柔清亮、舒缓的年轻女声。", models: ALL_MODELS },
  { id: "Chinese_sweet_girl_vv1",            name: "甜美少女",   category: "中文普通话", description: "清脆富表现力、朝气年轻女声。", models: ALL_MODELS },
  { id: "English_CalmWoman",                 name: "Calm Woman",         category: "English", description: "Warm, clear American English female voice.",     models: ALL_MODELS, recommended: true },
  { id: "English_captivating_female1",       name: "Captivating Female", category: "English", description: "Bright, enthusiastic American English female voice.", models: ALL_MODELS },
  { id: "English_AttractiveGirl",            name: "Attractive Woman",   category: "English", description: "Engaging American English female voice.",         models: ALL_MODELS },
  { id: "English_Trustworth_Man",            name: "Trustworthy Man",    category: "English", description: "Reliable American English male voice.",           models: ALL_MODELS },
  { id: "English_Gentle-voiced_man",         name: "Gentle Man",         category: "English", description: "Gentle American English male voice.",             models: ALL_MODELS },
];

export const MINIMAX_CATALOG: ProviderCatalog = {
  id: "minimax",
  label: "MiniMax",
  models: ALL_MODELS.map((id) => ({ id, label: MODEL_LABELS[id] })),
  voices: VOICES,
  defaults: {
    model: DEFAULT_MODEL,
    voice: DEFAULT_VOICE,
    format: DEFAULT_FORMAT,
  },
};
