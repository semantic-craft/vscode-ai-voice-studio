import type { ProviderCatalog, VoiceConfig } from "./providers";

export type MiniMaxModel =
  | "speech-2.8-hd"
  | "speech-2.8-turbo"
  | "speech-2.6-hd"
  | "speech-2.6-turbo"
  | "speech-02-hd"
  | "speech-02-turbo"
  | "speech-01-hd"
  | "speech-01-turbo";
export type MiniMaxFormat = "mp3" | "wav";
export type MiniMaxRegion = "global" | "mainland";
export type MiniMaxEmotion =
  | "auto"
  | "happy"
  | "sad"
  | "angry"
  | "fearful"
  | "disgusted"
  | "surprised"
  | "neutral";

export const DEFAULT_MODEL: MiniMaxModel = "speech-2.8-hd";
export const DEFAULT_VOICE = "Chinese (Mandarin)_Radio_Host";
export const DEFAULT_FORMAT: MiniMaxFormat = "mp3";
export const DEFAULT_REGION: MiniMaxRegion = "mainland";
export const DEFAULT_SAMPLE_RATE = 32000;
export const DEFAULT_BITRATE = 128000;
export const DEFAULT_EMOTION: MiniMaxEmotion = "auto";
export const DEFAULT_PITCH = 0;
export const DEFAULT_VOL = 1;

export const MODEL_LABELS: Record<MiniMaxModel, string> = {
  "speech-2.8-hd": "Speech 2.8 HD — emotion + 语气词",
  "speech-2.8-turbo": "Speech 2.8 Turbo — fastest 2.8",
  "speech-2.6-hd": "Speech 2.6 HD — low-latency 2.6",
  "speech-2.6-turbo": "Speech 2.6 Turbo — chat / digital human",
  "speech-02-hd": "Speech 02 HD — premium prosody",
  "speech-02-turbo": "Speech 02 Turbo — small-language strong",
  "speech-01-hd": "Speech 01 HD — legacy stable",
  "speech-01-turbo": "Speech 01 Turbo — legacy fast",
};

const ALL_MODELS: MiniMaxModel[] = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
  "speech-2.6-hd",
  "speech-2.6-turbo",
  "speech-02-hd",
  "speech-02-turbo",
  "speech-01-hd",
  "speech-01-turbo",
];

/**
 * Models that support inline 语气词 tokens like (laughs), (sighs).
 * Per docs, only the speech-2.8 family supports them.
 */
export const TAG_CAPABLE_MODELS: MiniMaxModel[] = ["speech-2.8-hd", "speech-2.8-turbo"];

/**
 * Models that support `voice_setting.emotion`. The 2.8 family explicitly
 * advertises "情绪渲染融合语气词"; older HD/turbo models accept the field too.
 */
export const EMOTION_CAPABLE_MODELS: MiniMaxModel[] = ALL_MODELS;

export const EMOTION_OPTIONS: { id: MiniMaxEmotion; label: string }[] = [
  { id: "auto", label: "Auto (model decides)" },
  { id: "happy", label: "Happy 开心" },
  { id: "sad", label: "Sad 伤感" },
  { id: "angry", label: "Angry 愤怒" },
  { id: "fearful", label: "Fearful 害怕" },
  { id: "disgusted", label: "Disgusted 厌恶" },
  { id: "surprised", label: "Surprised 惊讶" },
  { id: "neutral", label: "Neutral 中性" },
];

/**
 * 语气词 inline tokens (only for speech-2.8 family).
 * Source: platform.minimaxi.com docs/api-reference/speech-t2a-http
 */
export const SPEECH_TAG_PRESETS: { token: string; label: string }[] = [
  { token: "(laughs)", label: "笑声" },
  { token: "(chuckle)", label: "轻笑" },
  { token: "(sighs)", label: "叹气" },
  { token: "(coughs)", label: "咳嗽" },
  { token: "(clear-throat)", label: "清嗓子" },
  { token: "(groans)", label: "呻吟" },
  { token: "(breath)", label: "换气" },
  { token: "(pant)", label: "喘气" },
  { token: "(inhale)", label: "吸气" },
  { token: "(exhale)", label: "呼气" },
  { token: "(gasps)", label: "倒吸气" },
  { token: "(sniffs)", label: "吸鼻子" },
  { token: "(snorts)", label: "喷鼻息" },
  { token: "(burps)", label: "打嗝" },
  { token: "(lip-smacking)", label: "咂嘴" },
  { token: "(humming)", label: "哼唱" },
  { token: "(hissing)", label: "嘶嘶声" },
  { token: "(emm)", label: "嗯" },
  { token: "(sneezes)", label: "喷嚏" },
];

/**
 * Language-boost preset list. Empty string = "(no boost)" / let default decide.
 * Subset of doc's 40-language roster — these cover the majority of real cases.
 */
export const LANGUAGE_BOOST_PRESETS: string[] = [
  "auto",
  "Chinese",
  "Chinese,Yue",
  "English",
  "Japanese",
  "Korean",
  "Spanish",
  "French",
  "German",
  "Russian",
  "Portuguese",
  "Italian",
  "Arabic",
  "Indonesian",
  "Vietnamese",
  "Thai",
  "Turkish",
  "Polish",
  "Dutch",
  "Hindi",
];

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

export function isMiniMaxModel(value: string | undefined): value is MiniMaxModel {
  if (!value) return false;
  return ALL_MODELS.includes(value as MiniMaxModel);
}

export function isMiniMaxEmotion(value: string | undefined): value is MiniMaxEmotion {
  return (
    value === "auto" ||
    value === "happy" ||
    value === "sad" ||
    value === "angry" ||
    value === "fearful" ||
    value === "disgusted" ||
    value === "surprised" ||
    value === "neutral"
  );
}

export function modelSupportsTags(model: MiniMaxModel): boolean {
  return TAG_CAPABLE_MODELS.includes(model);
}

export function modelSupportsEmotion(model: MiniMaxModel): boolean {
  return EMOTION_CAPABLE_MODELS.includes(model);
}
