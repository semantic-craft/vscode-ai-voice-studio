import type { ProviderCatalog, VoiceConfig } from "./providers";

export type OpenAITTSModel = "gpt-4o-mini-tts" | "tts-1" | "tts-1-hd";
export type OpenAIResponseFormat = "mp3" | "wav";

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
  { id: "cedar",   name: "Cedar",   category: "Recommended", description: "Recommended natural narration.", models: LATEST_ONLY, recommended: true },
  { id: "marin",   name: "Marin",   category: "Recommended", description: "Recommended polished reading.",   models: LATEST_ONLY, recommended: true },
  { id: "coral",   name: "Coral",   category: "General",     description: "Bright, friendly voice.",          models: ALL_MODELS },
  { id: "alloy",   name: "Alloy",   category: "General",     description: "Balanced neutral voice.",          models: ALL_MODELS },
  { id: "ash",     name: "Ash",     category: "General",     description: "Clear, steady voice.",             models: ALL_MODELS },
  { id: "ballad",  name: "Ballad",  category: "Expressive",  description: "Expressive narration.",            models: LATEST_ONLY },
  { id: "echo",    name: "Echo",    category: "General",     description: "Crisp summaries.",                 models: ALL_MODELS },
  { id: "fable",   name: "Fable",   category: "Expressive",  description: "Warm storytelling.",               models: ALL_MODELS },
  { id: "nova",    name: "Nova",    category: "General",     description: "Smooth, energetic voice.",         models: ALL_MODELS },
  { id: "onyx",    name: "Onyx",    category: "Deep",        description: "Deeper long-form voice.",          models: ALL_MODELS },
  { id: "sage",    name: "Sage",    category: "General",     description: "Calm, careful reading.",           models: ALL_MODELS },
  { id: "shimmer", name: "Shimmer", category: "General",     description: "Light, upbeat voice.",             models: ALL_MODELS },
  { id: "verse",   name: "Verse",   category: "Expressive",  description: "Lyrical, stylized voice.",         models: LATEST_ONLY },
];

export const OPENAI_CATALOG: ProviderCatalog = {
  id: "openai",
  label: "OpenAI",
  models: (Object.keys(MODEL_LABELS) as OpenAITTSModel[]).map((id) => ({
    id,
    label: MODEL_LABELS[id],
  })),
  voices: VOICES,
  defaults: {
    model: DEFAULT_MODEL,
    voice: DEFAULT_VOICE,
    format: DEFAULT_FORMAT,
  },
};
