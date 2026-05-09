export interface ChunkerOptions {
  maxChars: number;
  minChars: number;
}

const DEFAULT_OPTIONS: ChunkerOptions = { maxChars: 250, minChars: 40 };

const SENTENCE_END = /[。！？；…\.!?;]/;
const SOFT_BREAK = /[，、,]/;

export function chunkText(text: string, opts: Partial<ChunkerOptions> = {}): string[] {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= options.maxChars) return [trimmed];

  const paragraphs = splitParagraphs(trimmed);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= options.maxChars) {
      pushOrMerge(chunks, paragraph, options);
      continue;
    }
    const sentences = splitSentences(paragraph);
    let buffer = "";
    for (const sentence of sentences) {
      if (sentence.length > options.maxChars) {
        if (buffer) {
          pushOrMerge(chunks, buffer, options);
          buffer = "";
        }
        for (const piece of splitOversized(sentence, options.maxChars)) {
          pushOrMerge(chunks, piece, options);
        }
        continue;
      }
      if (!buffer) {
        buffer = sentence;
      } else if (buffer.length + sentence.length <= options.maxChars) {
        buffer += sentence;
      } else {
        pushOrMerge(chunks, buffer, options);
        buffer = sentence;
      }
    }
    if (buffer) pushOrMerge(chunks, buffer, options);
  }

  return chunks;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  const out: string[] = [];
  let current = "";
  for (const ch of text) {
    current += ch;
    if (SENTENCE_END.test(ch)) {
      out.push(current);
      current = "";
    }
  }
  if (current.trim()) out.push(current);
  return out;
}

function splitOversized(sentence: string, maxChars: number): string[] {
  const out: string[] = [];
  let buffer = "";
  for (const ch of sentence) {
    buffer += ch;
    if (buffer.length >= maxChars && SOFT_BREAK.test(ch)) {
      out.push(buffer);
      buffer = "";
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

function pushOrMerge(chunks: string[], piece: string, options: ChunkerOptions): void {
  const last = chunks[chunks.length - 1];
  if (
    last !== undefined &&
    piece.length < options.minChars &&
    last.length + piece.length <= options.maxChars
  ) {
    chunks[chunks.length - 1] = last + piece;
    return;
  }
  chunks.push(piece);
}
