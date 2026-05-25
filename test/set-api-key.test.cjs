const assert = require("node:assert/strict");
const Module = require("node:module");
const { test } = require("node:test");

function withMockedVscode(handlers, run) {
  const previousLoad = Module._load;
  const settings = {};
  const commands = new Map();
  const secretsStore = new Map();
  const captured = { inputBoxOptions: null };
  let inputBoxResponse;

  const mockVscode = {
    ConfigurationTarget: { Global: 1 },
    StatusBarAlignment: { Right: 2 },
    commands: {
      registerCommand(id, callback) {
        commands.set(id, callback);
        return { dispose() {} };
      },
      async executeCommand() {},
    },
    env: { clipboard: { async readText() { return ""; } } },
    window: {
      activeTextEditor: undefined,
      createStatusBarItem() {
        return {
          command: undefined,
          text: "",
          tooltip: "",
          show() {},
          dispose() {},
        };
      },
      registerWebviewViewProvider() {
        return { dispose() {} };
      },
      async showInformationMessage() {},
      async showWarningMessage() {},
      async showErrorMessage() {},
      async showInputBox(options) {
        captured.inputBoxOptions = options;
        return inputBoxResponse;
      },
      async showQuickPick(items) {
        const list = await items;
        return list.find((item) => item.id === "qwen") ?? list[0];
      },
    },
    workspace: {
      getConfiguration() {
        return {
          get() { return undefined; },
          async update() {},
        };
      },
      onDidChangeConfiguration() {
        return { dispose() {} };
      },
    },
    Uri: { joinPath(...parts) { return { parts }; } },
  };

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "vscode") return mockVscode;
    return previousLoad.call(this, request, parent, isMain);
  };

  const cachePaths = [
    require.resolve("../out/config.js"),
    require.resolve("../out/extension.js"),
    require.resolve("../out/webview-view-provider.js"),
  ];
  for (const path of cachePaths) delete require.cache[path];

  try {
    const extension = require("../out/extension.js");
    return run({
      extension,
      commands,
      secretsStore,
      captured,
      setInputBoxResponse(value) { inputBoxResponse = value; },
    });
  } finally {
    Module._load = previousLoad;
    for (const path of cachePaths) delete require.cache[path];
  }
}

function activateExtension(ctx, secretsStore) {
  ctx.extension.activate({
    extensionUri: { path: "/extension" },
    globalState: { get() { return undefined; }, async update() {} },
    secrets: {
      async get(key) { return secretsStore.get(key); },
      async store(key, value) { secretsStore.set(key, value); },
      async delete(key) { secretsStore.delete(key); },
    },
    subscriptions: [],
  });
}

test("setApiKey rejects whitespace-only input via validateInput", async () => {
  await withMockedVscode({}, async (ctx) => {
    activateExtension(ctx, ctx.secretsStore);
    ctx.setInputBoxResponse("   ");

    await ctx.commands.get("aiVoiceStudio.setApiKey")();

    const options = ctx.captured.inputBoxOptions;
    assert.equal(typeof options.validateInput, "function");
    assert.equal(options.validateInput(""), "API key cannot be empty.");
    assert.equal(options.validateInput("   "), "API key cannot be empty.");
    assert.equal(options.validateInput("sk-abc"), null);

    // Whitespace-only response should not be stored even if the input box returns it.
    assert.equal(ctx.secretsStore.size, 0);
  });
});

test("setApiKey stores trimmed input", async () => {
  await withMockedVscode({}, async (ctx) => {
    activateExtension(ctx, ctx.secretsStore);
    ctx.setInputBoxResponse("  sk-real-key  ");

    await ctx.commands.get("aiVoiceStudio.setApiKey")();

    assert.equal(ctx.secretsStore.get("aiVoiceStudio.qwen.dashscopeApiKey"), "sk-real-key");
  });
});
