import type { ProviderCatalog, VoiceConfig } from "./providers";

export type GeminiTTSModel =
  | "gemini-3.1-flash-tts-preview"
  | "gemini-2.5-flash-preview-tts"
  | "gemini-2.5-pro-preview-tts";

export type GeminiFormat = "wav";

export const DEFAULT_MODEL: GeminiTTSModel = "gemini-3.1-flash-tts-preview";
export const DEFAULT_VOICE = "Kore";
export const DEFAULT_FORMAT: GeminiFormat = "wav";
export const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export const MODEL_LABELS: Record<GeminiTTSModel, string> = {
  "gemini-3.1-flash-tts-preview": "Gemini 3.1 Flash TTS · Preview",
  "gemini-2.5-flash-preview-tts": "Gemini 2.5 Flash · Preview TTS",
  "gemini-2.5-pro-preview-tts": "Gemini 2.5 Pro · Preview TTS",
};

export const MODEL_DESCRIPTIONS: Record<GeminiTTSModel, string> = {
  "gemini-3.1-flash-tts-preview":
    "Latest Gemini speech preview. 30 prebuilt voices, 60+ languages, inline style preambles + [audio tags]. Free on the AI Studio free tier.",
  "gemini-2.5-flash-preview-tts":
    "Earlier Flash TTS preview. Same 30-voice roster, slightly different rate limits.",
  "gemini-2.5-pro-preview-tts":
    "Pro variant of the Gemini 2.5 TTS preview. Higher quality, smaller free tier.",
};

const ALL_MODELS: GeminiTTSModel[] = [
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
];

interface GeminiVoiceSeed {
  id: string;
  hint: string;
  category: "Bright" | "Warm" | "Calm" | "Expressive" | "Distinctive" | "Clear";
  recommended?: boolean;
}

const SEEDS: GeminiVoiceSeed[] = [
  { id: "Zephyr",        hint: "Bright",        category: "Bright",       recommended: true },
  { id: "Puck",          hint: "Upbeat",        category: "Bright",       recommended: true },
  { id: "Charon",        hint: "Informative",   category: "Calm",         recommended: true },
  { id: "Kore",          hint: "Firm",          category: "Calm",         recommended: true },
  { id: "Fenrir",        hint: "Excitable",     category: "Expressive" },
  { id: "Leda",          hint: "Youthful",      category: "Bright" },
  { id: "Orus",          hint: "Firm",          category: "Calm" },
  { id: "Aoede",         hint: "Breezy",        category: "Warm" },
  { id: "Callirrhoe",    hint: "Easy-going",    category: "Warm" },
  { id: "Autonoe",       hint: "Bright",        category: "Bright" },
  { id: "Enceladus",     hint: "Breathy",       category: "Distinctive" },
  { id: "Iapetus",       hint: "Clear",         category: "Clear" },
  { id: "Umbriel",       hint: "Easy-going",    category: "Warm" },
  { id: "Algieba",       hint: "Smooth",        category: "Warm" },
  { id: "Despina",       hint: "Smooth",        category: "Warm" },
  { id: "Erinome",       hint: "Clear",         category: "Clear" },
  { id: "Algenib",       hint: "Gravelly",      category: "Distinctive" },
  { id: "Rasalgethi",    hint: "Informative",   category: "Calm" },
  { id: "Laomedeia",     hint: "Upbeat",        category: "Bright" },
  { id: "Achernar",      hint: "Soft",          category: "Warm" },
  { id: "Alnilam",       hint: "Firm",          category: "Calm" },
  { id: "Schedar",       hint: "Even",          category: "Calm" },
  { id: "Gacrux",        hint: "Mature",        category: "Distinctive" },
  { id: "Pulcherrima",   hint: "Forward",       category: "Expressive" },
  { id: "Achird",        hint: "Friendly",      category: "Warm" },
  { id: "Zubenelgenubi", hint: "Casual",        category: "Warm" },
  { id: "Vindemiatrix",  hint: "Gentle",        category: "Warm" },
  { id: "Sadachbia",     hint: "Lively",        category: "Bright" },
  { id: "Sadaltager",    hint: "Knowledgeable", category: "Calm" },
  { id: "Sulafat",       hint: "Warm",          category: "Warm" },
];

export const VOICES: VoiceConfig[] = SEEDS.map((seed) => ({
  id: seed.id,
  name: `${seed.id}`,
  category: seed.category,
  description: `${seed.hint}. Voices are language-agnostic; the model auto-detects the input language.`,
  models: ALL_MODELS,
  recommended: seed.recommended,
}));

/**
 * Inline audio tags. Documented as English-only even when the transcript is in
 * another language. They render as `[laughs]`, `[whispers]`, etc., inside the
 * transcript rather than as a separate field.
 */
export const AUDIO_TAG_PRESETS: string[] = [
  "[whispers]",
  "[shouting]",
  "[excitedly]",
  "[bored]",
  "[sighs]",
  "[gasp]",
  "[laughs]",
  "[very fast]",
  "[very slow]",
  "[sarcastic]",
  "[cough]",
  "[crying]",
  "[curious]",
  "[mischievously]",
  "[panicked]",
  "[serious]",
  "[tired]",
  "[trembling]",
  "[giggles]",
  "[amazed]",
];

export function isGeminiModel(value: string | undefined): value is GeminiTTSModel {
  return (
    value === "gemini-3.1-flash-tts-preview" ||
    value === "gemini-2.5-flash-preview-tts" ||
    value === "gemini-2.5-pro-preview-tts"
  );
}

export const GEMINI_CATALOG: ProviderCatalog = {
  id: "gemini",
  label: "Gemini",
  models: (Object.keys(MODEL_LABELS) as GeminiTTSModel[]).map((id) => ({
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
