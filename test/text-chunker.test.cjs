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
