import { type ProviderCatalog, type ProviderId, type SynthesizeContext, type SynthesizeResult } from "./providers";
import { OPENAI_CATALOG } from "./openai-voices";
import { synthesizeOpenAI, type OpenAISynthesizeArgs } from "./openai-tts";
import { MINIMAX_CATALOG } from "./minimax-voices";
import { synthesizeMiniMax, type MiniMaxSynthesizeArgs } from "./minimax-tts";
import { MIMO_CATALOG } from "./mimo-voices";
import { synthesizeMiMo, type MiMoSynthesizeArgs } from "./mimo-tts";

export const CATALOGS: Record<ProviderId, ProviderCatalog> = {
  openai: OPENAI_CATALOG,
  minimax: MINIMAX_CATALOG,
  mimo: MIMO_CATALOG,
};

export type ProviderArgs =
  | ({ provider: "openai" } & Omit<OpenAISynthesizeArgs, keyof SynthesizeContext>)
  | ({ provider: "minimax" } & Omit<MiniMaxSynthesizeArgs, keyof SynthesizeContext>)
  | ({ provider: "mimo" } & Omit<MiMoSynthesizeArgs, keyof SynthesizeContext>);

export async function synthesize(ctx: SynthesizeContext, args: ProviderArgs): Promise<SynthesizeResult> {
  switch (args.provider) {
    case "openai":
      return synthesizeOpenAI({ ...ctx, ...args });
    case "minimax":
      return synthesizeMiniMax({ ...ctx, ...args });
    case "mimo":
      return synthesizeMiMo({ ...ctx, ...args });
  }
}
