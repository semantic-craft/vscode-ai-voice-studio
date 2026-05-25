import { TTSApiError, type SynthesizeResult } from "./providers";

export interface PlaybackChunkPayload {
  index: number;
  total: number;
  result: SynthesizeResult;
}

export type ChunkSink = (payload: PlaybackChunkPayload) => void;

export type ChunkSynthesizer = (text: string, signal: AbortSignal) => Promise<SynthesizeResult>;

type SettledSynthesis =
  | { ok: true; result: SynthesizeResult }
  | { ok: false; error: unknown };

export interface SessionResult {
  cancelled: boolean;
  emitted: number;
}

export interface PlaybackSessionOptions {
  /**
   * How many chunks to keep prefetched ahead of the one currently being
   * emitted. A value of 1 means "next chunk is in flight while current plays".
   * Higher values flatten gap between chunks at the cost of running more
   * concurrent synth requests.
   */
  lookahead?: number;
}

const DEFAULT_LOOKAHEAD = 2;

export async function runPlaybackSession(
  chunks: string[],
  synthesizeChunk: ChunkSynthesizer,
  onChunk: ChunkSink,
  signal: AbortSignal,
  options: PlaybackSessionOptions = {},
): Promise<SessionResult> {
  if (chunks.length === 0) return { cancelled: false, emitted: 0 };

  const lookahead = Math.max(1, Math.min(options.lookahead ?? DEFAULT_LOOKAHEAD, chunks.length));

  // Sliding window of in-flight (or settled) synthesizers. Index 0 is the
  // chunk we're about to emit; the rest are pre-fetched.
  const pending: Promise<SettledSynthesis>[] = [];
  let nextChunkToPrime = 0;

  const primeNext = (): void => {
    if (nextChunkToPrime >= chunks.length) return;
    if (signal.aborted) return;
    pending.push(settleSynthesis(synthesizeChunk(chunks[nextChunkToPrime], signal)));
    nextChunkToPrime += 1;
  };

  // Pre-fetch up to `lookahead` chunks so the first emit doesn't wait for the
  // second to even start.
  for (let i = 0; i < lookahead; i++) primeNext();

  let emitted = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (signal.aborted) return { cancelled: true, emitted };

    const current = pending.shift()!;
    // Keep the window full: as soon as we pop one off, prime the next.
    primeNext();

    const settled = await current;
    if (!settled.ok) {
      const err = settled.error;
      if (signal.aborted || (err instanceof TTSApiError && err.code === -7)) {
        return { cancelled: true, emitted };
      }
      throw err;
    }
    const { result } = settled;

    if (signal.aborted) return { cancelled: true, emitted };

    onChunk({ index: i, total: chunks.length, result });
    emitted += 1;
  }

  return { cancelled: false, emitted };
}

async function settleSynthesis(promise: Promise<SynthesizeResult>): Promise<SettledSynthesis> {
  try {
    return { ok: true, result: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}
