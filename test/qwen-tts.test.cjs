const assert = require("node:assert/strict");
const { test } = require("node:test");

const { synthesizeQwen } = require("../out/core/qwen-tts.js");

function mockFetch(handler) {
  const previous = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = previous;
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("Qwen-TTS request follows DashScope multimodal generation shape", async () => {
  let url;
  let body;
  let auth;
  const restore = mockFetch(async (requestUrl, init) => {
    url = requestUrl;
    body = JSON.parse(init.body);
    auth = init.headers.Authorization;
    return jsonResponse({ output: { audio: { data: Buffer.from([1, 2, 3]).toString("base64") } } });
  });

  try {
    const result = await synthesizeQwen({
      text: "你好",
      apiKey: "sk-test",
      endpoint: "china",
      model: "qwen3-tts-flash",
      voice: "Cherry",
      languageType: "Chinese",
      instructions: "This should not be sent.",
    });

    assert.equal(url, "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation");
    assert.equal(auth, "Bearer sk-test");
    assert.deepEqual(body, {
      model: "qwen3-tts-flash",
      input: {
        text: "你好",
        voice: "Cherry",
        language_type: "Chinese",
      },
    });
    assert.equal(result.audioBase64, Buffer.from([1, 2, 3]).toString("base64"));
    assert.equal(result.format, "pcm");
  } finally {
    restore();
  }
});

test("Qwen-TTS data response sniffs WAV containers before PCM fallback", async () => {
  const wavHeader = Buffer.from("RIFFxxxxWAVEfmt ", "ascii");
  const restore = mockFetch(async () => jsonResponse({ output: { audio: { data: wavHeader.toString("base64") } } }));

  try {
    const result = await synthesizeQwen({
      text: "你好",
      apiKey: "sk-test",
      endpoint: "china",
      model: "qwen3-tts-flash",
      voice: "Cherry",
      languageType: "Chinese",
    });

    assert.equal(result.audioBase64, wavHeader.toString("base64"));
    assert.equal(result.format, "wav");
  } finally {
    restore();
  }
});

test("Qwen-TTS data response trusts explicit audio format over sniffing", async () => {
  const pcmThatLooksLikeWav = Buffer.from("RIFFxxxxWAVEfmt ", "ascii");
  const restore = mockFetch(async () =>
    jsonResponse({ output: { audio: { data: pcmThatLooksLikeWav.toString("base64"), format: "pcm" } } }),
  );

  try {
    const result = await synthesizeQwen({
      text: "你好",
      apiKey: "sk-test",
      endpoint: "china",
      model: "qwen3-tts-flash",
      voice: "Cherry",
      languageType: "Chinese",
    });

    assert.equal(result.format, "pcm");
  } finally {
    restore();
  }
});

test("Qwen-TTS sniff distinguishes AAC ADTS from MP3 sync frames", async () => {
  const aacFrame = Buffer.from([0xff, 0xf1, 0x50, 0x80, 0x00, 0x1f, 0xfc]);
  const restore = mockFetch(async () =>
    jsonResponse({ output: { audio: { data: aacFrame.toString("base64") } } }),
  );

  try {
    const result = await synthesizeQwen({
      text: "hi",
      apiKey: "sk-test",
      endpoint: "china",
      model: "qwen3-tts-flash",
      voice: "Cherry",
      languageType: "English",
    });

    assert.equal(result.format, "aac");
  } finally {
    restore();
  }
});

test("Qwen-TTS sniff still reports MP3 for non-zero layer sync bytes", async () => {
  const mp3Frame = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
  const restore = mockFetch(async () =>
    jsonResponse({ output: { audio: { data: mp3Frame.toString("base64") } } }),
  );

  try {
    const result = await synthesizeQwen({
      text: "hi",
      apiKey: "sk-test",
      endpoint: "china",
      model: "qwen3-tts-flash",
      voice: "Cherry",
      languageType: "English",
    });

    assert.equal(result.format, "mp3");
  } finally {
    restore();
  }
});

test("Qwen-TTS instruct model sends instructions and downloads URL audio", async () => {
  const calls = [];
  const restore = mockFetch(async (url, init) => {
    calls.push({ url, init });
    if (calls.length === 1) {
      return jsonResponse({ output: { audio: { url: "https://example.test/qwen.wav" } } });
    }
    return new Response(Uint8Array.from([4, 5, 6]), {
      status: 200,
      headers: { "content-type": "audio/wav" },
    });
  });

  try {
    const result = await synthesizeQwen({
      text: "Hello",
      apiKey: "sk-test",
      endpoint: "international",
      model: "qwen3-tts-instruct-flash",
      voice: "Ethan",
      languageType: "English",
      instructions: "Read warmly.",
    });

    const body = JSON.parse(calls[0].init.body);
    assert.equal(calls[0].url, "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation");
    assert.equal(body.input.instructions, "Read warmly.");
    assert.equal(calls[1].url, "https://example.test/qwen.wav");
    assert.equal(result.audioBase64, Buffer.from([4, 5, 6]).toString("base64"));
    assert.equal(result.format, "wav");
  } finally {
    restore();
  }
});
