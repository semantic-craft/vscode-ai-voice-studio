const assert = require("node:assert/strict");
const { test } = require("node:test");
const { WebSocketServer } = require("ws");

const { synthesizeMiniMax } = require("../out/core/minimax-tts.js");
const { WS_URLS } = require("../out/core/minimax-voices.js");

const ORIGINAL_WS_URL = WS_URLS.mainland;

function startTestServer(handler) {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port: 0 });
    wss.on("error", reject);
    wss.on("listening", () => {
      const { port } = wss.address();
      const url = `ws://127.0.0.1:${port}`;
      WS_URLS.mainland = url;
      WS_URLS.global = url;
      wss.on("connection", handler);
      resolve({
        url,
        async close() {
          await new Promise((r) => wss.close(r));
          WS_URLS.mainland = ORIGINAL_WS_URL;
          WS_URLS.global = ORIGINAL_WS_URL.replace("api.minimaxi.com", "api.minimax.io");
        },
      });
    });
  });
}

function defaultArgs(overrides) {
  return {
    text: "你好",
    apiKey: "test-key",
    region: "mainland",
    model: "speech-2.6-turbo",
    voice: "Chinese (Mandarin)_Radio_Host",
    format: "mp3",
    sampleRate: 32000,
    bitrate: 128000,
    channel: 1,
    speed: 1,
    vol: 1,
    pitch: 0,
    emotion: "auto",
    englishNormalization: false,
    languageBoost: "auto",
    ...overrides,
  };
}

test("MiniMax WebSocket synthesizer follows connected_success → task_start → task_continue → audio → task_finish", async () => {
  const received = [];
  const audioBytes = Buffer.from([0xff, 0xfb, 0x12, 0x34, 0x56, 0x78]);

  const server = await startTestServer((ws, req) => {
    received.push({ phase: "open", headers: req.headers });
    ws.send(JSON.stringify({ event: "connected_success" }));
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      received.push({ phase: "client", msg });
      if (msg.event === "task_start") {
        ws.send(JSON.stringify({ event: "task_started" }));
      } else if (msg.event === "task_continue") {
        // Split into two frames to exercise concatenation.
        ws.send(JSON.stringify({ data: { audio: audioBytes.slice(0, 3).toString("hex") }, is_final: false }));
        ws.send(JSON.stringify({ data: { audio: audioBytes.slice(3).toString("hex") }, is_final: true }));
      } else if (msg.event === "task_finish") {
        ws.send(JSON.stringify({ event: "task_finished" }));
        ws.close();
      }
    });
  });

  try {
    const result = await synthesizeMiniMax(defaultArgs());

    // Authorization header present in upgrade
    assert.equal(received[0].phase, "open");
    assert.equal(received[0].headers.authorization, "Bearer test-key");

    // task_start payload shape
    const start = received[1].msg;
    assert.equal(start.event, "task_start");
    assert.equal(start.model, "speech-2.6-turbo");
    assert.deepEqual(start.voice_setting, {
      voice_id: "Chinese (Mandarin)_Radio_Host",
      speed: 1,
      vol: 1,
      pitch: 0,
      english_normalization: false,
    });
    assert.deepEqual(start.audio_setting, {
      sample_rate: 32000,
      bitrate: 128000,
      format: "mp3",
      channel: 1,
    });
    assert.equal("language_boost" in start, false, "language_boost should be omitted when auto");

    // task_continue payload shape
    const cont = received[2].msg;
    assert.deepEqual(cont, { event: "task_continue", text: "你好" });

    // Final result concatenates both audio frames
    assert.equal(result.format, "mp3");
    assert.equal(Buffer.from(result.audioBase64, "base64").toString("hex"), audioBytes.toString("hex"));
  } finally {
    await server.close();
  }
});

test("MiniMax synthesizer includes emotion + language_boost when set", async () => {
  let startPayload;
  const server = await startTestServer((ws) => {
    ws.send(JSON.stringify({ event: "connected_success" }));
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.event === "task_start") startPayload = msg;
      if (msg.event === "task_continue") {
        ws.send(JSON.stringify({ data: { audio: "ab" }, is_final: true }));
      }
      if (msg.event === "task_finish") ws.close();
    });
  });

  try {
    await synthesizeMiniMax(defaultArgs({ emotion: "happy", languageBoost: "Chinese,Yue" }));
    assert.equal(startPayload.voice_setting.emotion, "happy");
    assert.equal(startPayload.language_boost, "Chinese,Yue");
  } finally {
    await server.close();
  }
});

test("MiniMax synthesizer rejects when server reports a non-zero status_code", async () => {
  const server = await startTestServer((ws) => {
    ws.send(JSON.stringify({ event: "connected_success" }));
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.event === "task_start") {
        ws.send(JSON.stringify({
          event: "task_failed",
          base_resp: { status_code: 1004, status_msg: "auth failed" },
        }));
        ws.close();
      }
    });
  });

  try {
    await assert.rejects(
      synthesizeMiniMax(defaultArgs()),
      (err) => err.code === 1004 && /auth failed/.test(err.message),
    );
  } finally {
    await server.close();
  }
});

test("MiniMax synthesizer rejects when the server closes before sending audio", async () => {
  const server = await startTestServer((ws) => {
    ws.send(JSON.stringify({ event: "connected_success" }));
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.event === "task_start") {
        // ack the task, then close before any audio frame arrives — this
        // exercises the "closed mid-stream" path rather than the handshake
        // path.
        ws.send(JSON.stringify({ event: "task_started" }));
        ws.close();
      }
    });
  });

  try {
    await assert.rejects(
      synthesizeMiniMax(defaultArgs()),
      (err) => /before sending audio/.test(err.message) && err.code === -4,
    );
  } finally {
    await server.close();
  }
});

test("MiniMax synthesizer aborts when the external signal fires", async () => {
  const server = await startTestServer((ws) => {
    ws.send(JSON.stringify({ event: "connected_success" }));
    // Never send audio — we want the abort to settle the promise.
  });

  const controller = new AbortController();
  try {
    const promise = synthesizeMiniMax(defaultArgs({ signal: controller.signal }));
    setTimeout(() => controller.abort(), 30);
    await assert.rejects(promise, (err) => err.code === -7 && /cancelled/i.test(err.message));
  } finally {
    await server.close();
  }
});
