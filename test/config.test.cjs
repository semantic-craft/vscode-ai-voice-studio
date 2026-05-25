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

test("getConfig tolerates dirty Qwen settings without throwing", () => {
  withMockedVscode(
    {
      playbackRate: Number.POSITIVE_INFINITY,
      chunkSize: 12,
      "qwen.model": "bad",
      "qwen.voice": null,
      "qwen.endpoint": "global",
      "qwen.languageType": "Spanish",
      "qwen.instructions": ["not", "a", "string"],
    },
    ({ getConfig }) => {
      const cfg = getConfig();

      assert.equal(cfg.playbackRate, 1);
      assert.equal(cfg.chunkSize, 80);
      assert.equal(cfg.qwen.model, "qwen3-tts-flash");
      assert.equal(cfg.qwen.voice, "Cherry");
      assert.equal(cfg.qwen.endpoint, "china");
      assert.equal(cfg.qwen.languageType, "Auto");
      assert.equal(cfg.qwen.instructions, "");
    },
  );
});

test("Qwen setters normalize settings before writing", async () => {
  const settings = {};
  await withMockedVscode(
    settings,
    async ({ setQwenEndpoint, setQwenLanguageType, setProviderModel, setProviderVoice }) => {
      await setProviderModel("qwen", "qwen3-tts-flash");
      await setProviderVoice("qwen", "Serena");
      await setQwenEndpoint("bad");
      await setQwenLanguageType("German");

      assert.equal(settings["qwen.model"], "qwen3-tts-flash");
      assert.equal(settings["qwen.voice"], "Serena");
      assert.equal(settings["qwen.endpoint"], "china");
      assert.equal(settings["qwen.languageType"], "German");
    },
  );
});
