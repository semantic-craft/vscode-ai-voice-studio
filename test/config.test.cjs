const assert = require("node:assert/strict");
const Module = require("node:module");
const { test } = require("node:test");

function withMockedVscode(settings, run) {
  const previousLoad = Module._load;
  const mockVscode = {
    ConfigurationTarget: { Global: 1 },
    workspace: {
      getConfiguration(section) {
        assert.equal(section, "aiVoiceStudio");
        return {
          get(key) {
            return settings[key];
          },
          async update(key, value) {
            settings[key] = value;
          },
        };
      },
    },
  };

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "vscode") return mockVscode;
    return previousLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve("../out/config.js")];
    return run(require("../out/config.js"));
  } finally {
    Module._load = previousLoad;
    delete require.cache[require.resolve("../out/config.js")];
  }
}

test("getConfig tolerates dirty non-string settings without throwing", () => {
  withMockedVscode(
    {
      provider: "mimo",
      playbackRate: Number.POSITIVE_INFINITY,
      chunkSize: 12,
      "openai.voice": 42,
      "openai.format": "pcm",
      "openai.instructions": ["not", "a", "string"],
      "openai.speed": 99,
      "openai.baseUrl": { bad: true },
      "minimax.voice": null,
      "minimax.speed": "fast",
      "minimax.vol": Number.NaN,
      "minimax.pitch": 99,
      "minimax.languageBoost": 7,
      "minimax.pronunciationDict": ["  处理/(chu3)(li3)  ", 123, "", "处理/(chu3)(li3)"],
      "mimo.voice": undefined,
      "mimo.stylePrompt": ["bad"],
      "mimo.openingStyleTags": [" 开心 ", "开心", 3],
      "mimo.audioEventTags": "笑",
      "mimo.stylePresets": [
        { name: "  A  ", stylePrompt: 1, openingStyleTags: [" 慢速 ", "慢速"], audioEventTags: [2, "笑"] },
        { name: "A", stylePrompt: "duplicate" },
        { name: "" },
        null,
      ],
      "gemini.voice": 123,
      "gemini.baseUrl": [],
      "gemini.stylePreamble": { bad: true },
    },
    ({ getConfig }) => {
      const cfg = getConfig();

      assert.equal(cfg.provider, "mimo");
      assert.equal(cfg.playbackRate, 1);
      assert.equal(cfg.chunkSize, 80);
      assert.equal(cfg.openai.voice, "cedar");
      assert.equal(cfg.openai.format, "pcm");
      assert.equal(cfg.openai.instructions, "");
      assert.equal(cfg.openai.speed, 4);
      assert.equal(cfg.openai.baseUrl, "https://api.openai.com/v1");
      assert.equal(cfg.minimax.voice, "Chinese (Mandarin)_Radio_Host");
      assert.equal(cfg.minimax.speed, 1);
      assert.equal(cfg.minimax.vol, 1);
      assert.equal(cfg.minimax.pitch, 12);
      assert.equal(cfg.minimax.languageBoost, "");
      assert.deepEqual(cfg.minimax.pronunciationDict, ["处理/(chu3)(li3)"]);
      assert.equal(cfg.mimo.voice, "mimo_default");
      assert.equal(cfg.mimo.stylePrompt, "");
      assert.deepEqual(cfg.mimo.openingStyleTags, ["开心"]);
      assert.deepEqual(cfg.mimo.audioEventTags, []);
      assert.deepEqual(cfg.mimo.stylePresets, [
        { name: "A", stylePrompt: "", openingStyleTags: ["慢速"], audioEventTags: ["笑"] },
      ]);
      assert.equal(cfg.gemini.voice, "Kore");
      assert.equal(cfg.gemini.baseUrl, "https://generativelanguage.googleapis.com/v1beta");
      assert.equal(cfg.gemini.stylePreamble, "");
    },
  );
});
