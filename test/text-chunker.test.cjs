const assert = require("node:assert/strict");
const { test } = require("node:test");

const { chunkText } = require("../out/core/text-chunker.js");

test("chunker returns no empty chunks and trims surrounding whitespace", () => {
  assert.deepEqual(chunkText("   \n  "), []);
  assert.deepEqual(chunkText("  hello  ", { maxChars: 80 }), ["hello"]);
});

test("chunker respects maxChars for mixed Chinese and English prose", () => {
  const text =
    "第一句说明问题。第二句继续推进论证！Third sentence keeps going; fourth sentence adds pressure. " +
    "最后一句收束。";
  const chunks = chunkText(text, { maxChars: 28, minChars: 8 });

  assert.equal(chunks.length > 1, true);
  for (const chunk of chunks) {
    assert.equal(chunk.length <= 28, true, `${chunk.length}: ${chunk}`);
    assert.equal(chunk.trim(), chunk);
  }
  assert.equal(chunks.join("").replace(/\s+/g, ""), text.replace(/\s+/g, ""));
});

test("chunker hard-splits oversized sentences under maxChars", () => {
  const text = "abcdefghij".repeat(7);
  const chunks = chunkText(text, { maxChars: 15, minChars: 4 });

  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    [15, 15, 15, 15, 10],
  );
  assert.equal(chunks.join(""), text);
});

test("chunker uses punctuation breaks before hard-splitting prose", () => {
  // No sentence-ending punctuation, so the whole string is one "sentence"
  // and goes through splitOversized. With the soft-break support, every
  // split lands on a comma/space, not in the middle of a word.
  const text = "alpha, beta, gamma, delta, epsilon";
  const chunks = chunkText(text, { maxChars: 15, minChars: 5 });

  assert.deepEqual(chunks, ["alpha, beta,", "gamma, delta,", "epsilon"]);
  // Boundary check: no two adjacent chunks share a letter-letter join,
  // which would indicate a mid-word split.
  for (let i = 0; i < chunks.length - 1; i++) {
    const tail = chunks[i].charAt(chunks[i].length - 1);
    const head = chunks[i + 1].charAt(0);
    assert.equal(
      /[A-Za-z]/.test(tail) && /[A-Za-z]/.test(head),
      false,
      `mid-word split between "${chunks[i]}" and "${chunks[i + 1]}"`,
    );
  }
});
