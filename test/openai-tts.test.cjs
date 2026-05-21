const assert = require("node:assert/strict");
const { test } = require("node:test");

const { synthesizeOpenAI } = require("../out/core/openai-tts.js");

function mockFetch(handler) {
  const previous = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = previous;
  };
}

function audioResponse(bytes = [1, 2, 3]) {
  return new Response(Uint8Array.from(bytes), {
    status: 200,
    headers: { "content-type": "application/octet-stream" },
  });
}

test("OpenAI speech request includes current TTS controls without unsupported language field", async () => {
  let body;
  const restore = mockFetch(async (_url, init) => {
    body = JSON.parse(init.body);
    return audioResponse();
  });

  try {
    const result = await synthesizeOpenAI({
      text: "Hello",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1/",
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      format: "mp3",
      instructions: "Read warmly.",
      speed: 1.25,
      language: "zh",
    });

    assert.equal(result.format, "mp3");
    assert.equal(body.model, "gpt-4o-mini-tts");
    assert.equal(body.input, "Hello");
    assert.equal(body.voice, "alloy");
    assert.equal(body.response_format, "mp3");
    assert.equal(body.instructions, "Read warmly.");
    assert.equal(body.speed, 1.25);
    assert.equal(Object.hasOwn(body, "language"), false);
  } finally {
    restore();
  }
});

test("OpenAI legacy models omit instructions but keep response format", async () => {
  let body;
  const restore = mockFetch(async (_url, init) => {
    body = JSON.parse(init.body);
    return audioResponse([4, 5, 6]);
  });

  try {
    const result = await synthesizeOpenAI({
      text: "Legacy",
      apiKey: "sk-test",
      baseUrl: "https://api.openai.com/v1",
      model: "tts-1",
      voice: "alloy",
      format: "pcm",
      instructions: "This should not be sent.",
      speed: 1,
    });

    assert.equal(result.audioBase64, Buffer.from([4, 5, 6]).toString("base64"));
    assert.equal(result.format, "pcm");
    assert.equal(body.response_format, "pcm");
    assert.equal(Object.hasOwn(body, "instructions"), false);
    assert.equal(Object.hasOwn(body, "speed"), false);
  } finally {
    restore();
  }
});
