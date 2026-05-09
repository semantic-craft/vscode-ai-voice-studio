export type OpenAITTSModel = "gpt-4o-mini-tts" | "tts-1" | "tts-1-hd";
export type OpenAIResponseFormat = "mp3" | "wav";

export interface VoiceConfig {
  id: string;
  name: string;
  gender: "female" | "male" | "neutral";
  category: "Recommended" | "General" | "Expressive" | "Deep";
  description: string;
  models: OpenAITTSModel[];
  recommended?: boolean;
}

export const DEFAULT_MODEL: OpenAITTSModel = "gpt-4o-mini-tts";
export const DEFAULT_VOICE = "cedar";
export const DEFAULT_FORMAT: OpenAIResponseFormat = "mp3";

export const MODEL_LABELS: Record<OpenAITTSModel, string> = {
  "gpt-4o-mini-tts": "GPT-4o Mini TTS",
  "tts-1": "TTS-1",
  "tts-1-hd": "TTS-1 HD",
};

const ALL_MODELS: OpenAITTSModel[] = ["gpt-4o-mini-tts", "tts-1", "tts-1-hd"];
const LATEST_ONLY: OpenAITTSModel[] = ["gpt-4o-mini-tts"];

export const VOICES: VoiceConfig[] = [
  { id: "cedar",   name: "Cedar",   gender: "male",    category: "Recommended", description: "Recommended natural narration.", models: LATEST_ONLY, recommended: true },
  { id: "marin",   name: "Marin",   gender: "female",  category: "Recommended", description: "Recommended polished reading.",   models: LATEST_ONLY, recommended: true },
  { id: "coral",   name: "Coral",   gender: "female",  category: "General",     description: "Bright, friendly voice.",          models: ALL_MODELS },
  { id: "alloy",   name: "Alloy",   gender: "neutral", category: "General",     description: "Balanced neutral voice.",          models: ALL_MODELS },
  { id: "ash",     name: "Ash",     gender: "male",    category: "General",     description: "Clear, steady voice.",             models: ALL_MODELS },
  { id: "ballad",  name: "Ballad",  gender: "male",    category: "Expressive",  description: "Expressive narration.",            models: LATEST_ONLY },
  { id: "echo",    name: "Echo",    gender: "male",    category: "General",     description: "Crisp summaries.",                 models: ALL_MODELS },
  { id: "fable",   name: "Fable",   gender: "neutral", category: "Expressive",  description: "Warm storytelling.",               models: ALL_MODELS },
  { id: "nova",    name: "Nova",    gender: "female",  category: "General",     description: "Smooth, energetic voice.",         models: ALL_MODELS },
  { id: "onyx",    name: "Onyx",    gender: "male",    category: "Deep",        description: "Deeper long-form voice.",          models: ALL_MODELS },
  { id: "sage",    name: "Sage",    gender: "female",  category: "General",     description: "Calm, careful reading.",           models: ALL_MODELS },
  { id: "shimmer", name: "Shimmer", gender: "female",  category: "General",     description: "Light, upbeat voice.",             models: ALL_MODELS },
  { id: "verse",   name: "Verse",   gender: "neutral", category: "Expressive",  description: "Lyrical, stylized voice.",         models: LATEST_ONLY },
];

export function getVoiceById(id: string): VoiceConfig | undefined {
  return VOICES.find((v) => v.id === id);
}

export function isVoiceAvailableForModel(voice: VoiceConfig, model: OpenAITTSModel): boolean {
  return voice.models.includes(model);
}

export function getVoicesForModel(model: OpenAITTSModel): VoiceConfig[] {
  return VOICES.filter((v) => v.models.includes(model));
}
