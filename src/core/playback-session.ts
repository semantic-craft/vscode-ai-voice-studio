import { TTSApiError, type SynthesizeResult } from "./providers";

export interface PlaybackChunkPayload {
  index: number;
  total: number;
  result: SynthesizeResult;
}

export type ChunkSink = (payload: PlaybackChunkPayload) => void;

export type ChunkSynthesizer = (text: string, signal: AbortSignal) => Promise<SynthesizeResult>;

export interface SessionResult {
  cancelled: boolean;
  emitted: number;
}

export async function runPlaybackSession(
  chunks: string[],
  synthesizeChunk: ChunkSynthesizer,
  onChunk: ChunkSink,
  signal: AbortSignal,
): Promise<SessionResult> {
  if (chunks.length === 0) return { cancelled: false, emitted: 0 };

  let pending: Promise<SynthesizeResult> | null = synthesizeChunk(chunks[0], signal);
  let emitted = 0;

  for (let i = 0; i < chunks.length; i++) {
    if (signal.aborted) return { cancelled: true, emitted };

    const current = pending!;
    pending = i + 1 < chunks.length ? synthesizeChunk(chunks[i + 1], signal) : null;

    let result: SynthesizeResult;
    try {
      result = await current;
    } catch (err) {
      if (signal.aborted || (err instanceof TTSApiError && err.code === -7)) {
        return { cancelled: true, emitted };
      }
      throw err;
    }

    if (signal.aborted) return { cancelled: true, emitted };

    onChunk({ index: i, total: chunks.length, result });
    emitted += 1;
  }

  return { cancelled: false, emitted };
}
