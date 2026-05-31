import type { ProviderCatalog, VoiceConfig } from "./providers";

export type MiMoModel =
  | "mimo-v2.5-tts"
  | "mimo-v2.5-tts-voicedesign"
  | "mimo-v2.5-tts-voiceclone"
  | "mimo-v2-tts";

export type MiMoFormat = "mp3" | "wav";

export const DEFAULT_MODEL: MiMoModel = "mimo-v2.5-tts";
export const DEFAULT_VOICE = "Chloe";
export const LEGACY_DEFAULT_VOICE = "default_en";
export const DEFAULT_FORMAT: MiMoFormat = "wav";
export const DEFAULT_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";

export const MODEL_LABELS: Record<MiMoModel, string> = {
  "mimo-v2.5-tts": "MiMo-V2.5-TTS · Preset",
  "mimo-v2.5-tts-voicedesign": "MiMo-V2.5-TTS · Voice Design",
  "mimo-v2.5-tts-voiceclone": "MiMo-V2.5-TTS · Voice Clone",
  "mimo-v2-tts": "MiMo-V2-TTS · Legacy",
};

export const MODEL_DESCRIPTIONS: Record<MiMoModel, string> = {
  "mimo-v2.5-tts": "Use a built-in preset voice. Supports singing mode, opening style tags and audio event tags.",
  "mimo-v2.5-tts-voicedesign": "Describe a custom voice in plain language; the model invents the timbre. No preset voice required.",
  "mimo-v2.5-tts-voiceclone": "Upload an audio sample (mp3/wav, ≤10 MB) and the model clones the voice for synthesis.",
  "mimo-v2-tts": "Legacy V2 model, kept for backward compatibility with the original Chinese / English presets.",
};

export const VOICE_DESIGN_PLACEHOLDER = "__from_prompt__";
export const VOICE_CLONE_PLACEHOLDER = "__from_sample__";

export function isPresetModel(model: MiMoModel): boolean {
  return model === "mimo-v2.5-tts" || model === "mimo-v2-tts";
}

export function isVoiceDesignModel(model: MiMoModel): boolean {
  return model === "mimo-v2.5-tts-voicedesign";
}

export function isVoiceCloneModel(model: MiMoModel): boolean {
  return model === "mimo-v2.5-tts-voiceclone";
}

const V25_PRESET: MiMoModel[] = ["mimo-v2.5-tts"];
const V2_PRESET: MiMoModel[] = ["mimo-v2-tts"];
const VOICE_DESIGN: MiMoModel[] = ["mimo-v2.5-tts-voicedesign"];
const VOICE_CLONE: MiMoModel[] = ["mimo-v2.5-tts-voiceclone"];
export const VOICES: VoiceConfig[] = [
  { id: "Chloe",        name: "Chloe",               category: "English",  description: "Expressive English female voice.",                         models: V25_PRESET, recommended: true },
  { id: "Mia",          name: "Mia",                 category: "English",  description: "Natural English female voice.",                            models: V25_PRESET },
  { id: "Milo",         name: "Milo",                category: "English",  description: "Warm English male voice.",                                 models: V25_PRESET },
  { id: "Dean",         name: "Dean",                category: "English",  description: "Grounded English male voice for narration.",               models: V25_PRESET },
  { id: "冰糖",         name: "Bingtang",            category: "Chinese",  description: "Clear Chinese female voice for narration.",                models: V25_PRESET, recommended: true },
  { id: "茉莉",         name: "Moli",                category: "Chinese",  description: "Soft Chinese female voice, calm tone.",                    models: V25_PRESET },
  { id: "苏打",         name: "Soda",                category: "Chinese",  description: "Bright Chinese male voice, short-form.",                   models: V25_PRESET },
  { id: "白桦",         name: "Baihua",              category: "Chinese",  description: "Steady Chinese male voice for long text.",                 models: V25_PRESET },
  { id: "default_zh",   name: "MiMo Chinese Female", category: "Legacy",   description: "Legacy MiMo-V2 Chinese female voice.",                     models: V2_PRESET },
  { id: "default_en",   name: "MiMo English Female", category: "Legacy",   description: "Legacy MiMo-V2 English female voice.",                     models: V2_PRESET },
  { id: VOICE_DESIGN_PLACEHOLDER, name: "Custom — described in prompt", category: "Custom", description: "Voice is invented from the user prompt.", models: VOICE_DESIGN, recommended: true },
  { id: VOICE_CLONE_PLACEHOLDER,  name: "Custom — cloned from sample",  category: "Custom", description: "Voice is cloned from an uploaded audio sample.", models: VOICE_CLONE, recommended: true },
];

export interface StyleTagPreset {
  id: string;
  label: string;
}

export interface StyleTagGroup {
  id: string;
  label: string;
  description?: string;
  tags: StyleTagPreset[];
}

/**
 * Opening-style tags injected as `(tag)` at the start of the assistant message.
 * Mirrors the eight categories from the MiMo v2.5 docs.
 */
export const STYLE_TAG_GROUPS: StyleTagGroup[] = [
  {
    id: "basic-emotion",
    label: "基础情绪",
    tags: [
      { id: "开心", label: "开心" },
      { id: "悲伤", label: "悲伤" },
      { id: "愤怒", label: "愤怒" },
      { id: "恐惧", label: "恐惧" },
      { id: "惊讶", label: "惊讶" },
      { id: "兴奋", label: "兴奋" },
      { id: "委屈", label: "委屈" },
      { id: "平静", label: "平静" },
      { id: "冷漠", label: "冷漠" },
    ],
  },
  {
    id: "complex-emotion",
    label: "复合情绪",
    tags: [
      { id: "怅然", label: "怅然" },
      { id: "欣慰", label: "欣慰" },
      { id: "无奈", label: "无奈" },
      { id: "愧疚", label: "愧疚" },
      { id: "释然", label: "释然" },
      { id: "嫉妒", label: "嫉妒" },
      { id: "厌倦", label: "厌倦" },
      { id: "忐忑", label: "忐忑" },
      { id: "动情", label: "动情" },
    ],
  },
  {
    id: "tone",
    label: "整体语调",
    tags: [
      { id: "温柔", label: "温柔" },
      { id: "高冷", label: "高冷" },
      { id: "活泼", label: "活泼" },
      { id: "严肃", label: "严肃" },
      { id: "慵懒", label: "慵懒" },
      { id: "俏皮", label: "俏皮" },
      { id: "深沉", label: "深沉" },
      { id: "干练", label: "干练" },
      { id: "凌厉", label: "凌厉" },
    ],
  },
  {
    id: "timbre",
    label: "音色定位",
    tags: [
      { id: "磁性", label: "磁性" },
      { id: "醇厚", label: "醇厚" },
      { id: "清亮", label: "清亮" },
      { id: "空灵", label: "空灵" },
      { id: "稚嫩", label: "稚嫩" },
      { id: "苍老", label: "苍老" },
      { id: "甜美", label: "甜美" },
      { id: "沙哑", label: "沙哑" },
      { id: "醇雅", label: "醇雅" },
    ],
  },
  {
    id: "persona",
    label: "人设腔调",
    tags: [
      { id: "夹子音", label: "夹子音" },
      { id: "御姐音", label: "御姐音" },
      { id: "正太音", label: "正太音" },
      { id: "大叔音", label: "大叔音" },
      { id: "台湾腔", label: "台湾腔" },
    ],
  },
  {
    id: "dialect",
    label: "方言",
    tags: [
      { id: "东北话", label: "东北话" },
      { id: "四川话", label: "四川话" },
      { id: "河南话", label: "河南话" },
      { id: "粤语", label: "粤语" },
    ],
  },
  {
    id: "roleplay",
    label: "角色扮演",
    tags: [
      { id: "孙悟空", label: "孙悟空" },
      { id: "林黛玉", label: "林黛玉" },
    ],
  },
  {
    id: "singing",
    label: "唱歌",
    description: "唱歌 标签会覆盖其他风格；歌词建议使用中文。",
    tags: [{ id: "唱歌", label: "唱歌" }],
  },
];

/**
 * Inline audio-event tags injected as a Chinese-bracket prefix.
 * Mirrors the four categories in the docs.
 */
export const AUDIO_EVENT_GROUPS: StyleTagGroup[] = [
  {
    id: "pace",
    label: "语速与节奏",
    tags: [
      { id: "吸气", label: "吸气" },
      { id: "深呼吸", label: "深呼吸" },
      { id: "叹气", label: "叹气" },
      { id: "长叹一口气", label: "长叹一口气" },
      { id: "喘息", label: "喘息" },
      { id: "屏息", label: "屏息" },
    ],
  },
  {
    id: "emotion-state",
    label: "情绪状态",
    tags: [
      { id: "紧张", label: "紧张" },
      { id: "害怕", label: "害怕" },
      { id: "激动", label: "激动" },
      { id: "疲惫", label: "疲惫" },
      { id: "委屈", label: "委屈" },
      { id: "撒娇", label: "撒娇" },
      { id: "心虚", label: "心虚" },
      { id: "震惊", label: "震惊" },
      { id: "不耐烦", label: "不耐烦" },
    ],
  },
  {
    id: "voice-feature",
    label: "语音特征",
    tags: [
      { id: "颤抖", label: "颤抖" },
      { id: "声音颤抖", label: "声音颤抖" },
      { id: "变调", label: "变调" },
      { id: "破音", label: "破音" },
      { id: "鼻音", label: "鼻音" },
      { id: "气声", label: "气声" },
      { id: "沙哑", label: "沙哑" },
    ],
  },
  {
    id: "cry-laugh",
    label: "哭笑表达",
    tags: [
      { id: "笑", label: "笑" },
      { id: "轻笑", label: "轻笑" },
      { id: "大笑", label: "大笑" },
      { id: "冷笑", label: "冷笑" },
      { id: "抽泣", label: "抽泣" },
      { id: "呜咽", label: "呜咽" },
      { id: "哽咽", label: "哽咽" },
      { id: "嚎啕大哭", label: "嚎啕大哭" },
    ],
  },
];

/** Flat list, mostly kept so older callers keep compiling. */
export const STYLE_TAG_PRESETS: StyleTagPreset[] = STYLE_TAG_GROUPS.flatMap((g) => g.tags);
export const AUDIO_EVENT_PRESETS: StyleTagPreset[] = AUDIO_EVENT_GROUPS.flatMap((g) => g.tags);

export function defaultVoiceForModel(model: MiMoModel): string {
  if (model === "mimo-v2-tts") return LEGACY_DEFAULT_VOICE;
  if (isVoiceDesignModel(model)) return VOICE_DESIGN_PLACEHOLDER;
  if (isVoiceCloneModel(model)) return VOICE_CLONE_PLACEHOLDER;
  return DEFAULT_VOICE;
}

export function normalizeMiMoVoice(value: string | undefined, model: MiMoModel): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  const fallback = defaultVoiceForModel(model);
  if (!trimmed || trimmed === "mimo_default") return fallback;
  const voice = VOICES.find((v) => v.id === trimmed);
  if (!voice) return fallback;
  return voice.models.length === 0 || voice.models.includes(model) ? voice.id : fallback;
}

/**
 * Templates inserted into the style-prompt textarea on demand.
 */
export const DIRECTOR_TEMPLATE = `【角色】
（人物身份、性格底色、外形气质与说话习惯）

【场景】
（此刻发生什么、和谁说话、情绪处在哪一刻）

【指导】
（语速、气息、停顿、重音、共鸣位置、音色质感、情绪起伏）`;

export const VOICE_DESIGN_TEMPLATE = `（性别与年龄，例如：30 岁出头的女性 / a man in his early 50s）
（音色与质感：磁性 / 沙哑 / 清亮 / deep and gravelly）
（情绪与语气：温柔但带着疲惫 / warm and confident）
（语速与节奏：偏慢且沉稳 / fast, machine-gun delivery）`;

export const MIMO_CATALOG: ProviderCatalog = {
  id: "mimo",
  label: "MiMo",
  models: (Object.keys(MODEL_LABELS) as MiMoModel[]).map((id) => ({
    id,
    label: MODEL_LABELS[id],
    description: MODEL_DESCRIPTIONS[id],
  })),
  voices: VOICES,
  defaults: {
    model: DEFAULT_MODEL,
    voice: DEFAULT_VOICE,
    format: DEFAULT_FORMAT,
  },
};
