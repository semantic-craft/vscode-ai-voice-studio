import { type ProviderCatalog, type ProviderId, type SynthesizeContext, type SynthesizeResult } from "./providers";
import { MIMO_CATALOG } from "./mimo-voices";
import { synthesizeMiMo, type MiMoSynthesizeArgs } from "./mimo-tts";
import { MINIMAX_CATALOG } from "./minimax-voices";
import { synthesizeMiniMax, type MiniMaxSynthesizeArgs } from "./minimax-tts";
import { GEMINI_CATALOG } from "./gemini-voices";
import { synthesizeGemini, type GeminiSynthesizeArgs } from "./gemini-tts";
import { QWEN_CATALOG } from "./qwen-voices";
import { synthesizeQwen, type QwenSynthesizeArgs } from "./qwen-tts";

export const CATALOGS: Record<ProviderId, ProviderCatalog> = {
  mimo: MIMO_CATALOG,
  minimax: MINIMAX_CATALOG,
  gemini: GEMINI_CATALOG,
  qwen: QWEN_CATALOG,
};

export type ProviderArgs =
  | ({ provider: "mimo" } & Omit<MiMoSynthesizeArgs, keyof SynthesizeContext>)
  | ({ provider: "minimax" } & Omit<MiniMaxSynthesizeArgs, keyof SynthesizeContext>)
  | ({ provider: "gemini" } & Omit<GeminiSynthesizeArgs, keyof SynthesizeContext>)
  | ({ provider: "qwen" } & Omit<QwenSynthesizeArgs, keyof SynthesizeContext>);

export async function synthesize(ctx: SynthesizeContext, args: ProviderArgs): Promise<SynthesizeResult> {
  switch (args.provider) {
    case "mimo":
      return synthesizeMiMo({ ...ctx, ...args });
    case "minimax":
      return synthesizeMiniMax({ ...ctx, ...args });
    case "gemini":
      return synthesizeGemini({ ...ctx, ...args });
    case "qwen":
      return synthesizeQwen({ ...ctx, ...args });
  }
}
