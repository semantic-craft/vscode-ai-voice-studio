const assert = require("node:assert/strict");
const Module = require("node:module");
const { test } = require("node:test");

function withMockedVscode(run) {
  const previousLoad = Module._load;
  const settings = {};
  const commands = new Map();
  const executedCommands = [];
  let registeredViewProvider;
  let configChangeHandler;
  const statusItems = [];

  const mockVscode = {
    ConfigurationTarget: { Global: 1 },
    StatusBarAlignment: { Right: 2 },
    commands: {
      registerCommand(id, callback) {
        commands.set(id, callback);
        return { dispose() {} };
      },
      async executeCommand(id, ...args) {
        executedCommands.push({ id, args });
      },
    },
    env: {
      clipboard: {
        async readText() {
          return "";
        },
      },
    },
    window: {
      activeTextEditor: undefined,
      createStatusBarItem(alignment, priority) {
        const item = {
          alignment,
          priority,
          command: undefined,
          text: "",
          tooltip: "",
          showCalled: false,
          disposed: false,
          show() {
            this.showCalled = true;
          },
          dispose() {
            this.disposed = true;
          },
        };
        statusItems.push(item);
        return item;
      },
      registerWebviewViewProvider(viewType, provider, options) {
        registeredViewProvider = { viewType, provider, options };
        return { dispose() {} };
      },
      async showInformationMessage() {},
      async showWarningMessage() {},
      async showErrorMessage() {},
      async showInputBox() {},
      async showQuickPick() {},
    },
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
      onDidChangeConfiguration(callback) {
        configChangeHandler = callback;
        return { dispose() {} };
      },
    },
    Uri: {
      joinPath(...parts) {
        return { parts };
      },
    },
  };

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "vscode") return mockVscode;
    return previousLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve("../out/config.js")];
    delete require.cache[require.resolve("../out/extension.js")];
    delete require.cache[require.resolve("../out/webview-view-provider.js")];
    return run({
      extension: require("../out/extension.js"),
      commands,
      configChangeHandler: () => configChangeHandler,
      executedCommands,
      registeredViewProvider: () => registeredViewProvider,
      statusItems,
    });
  } finally {
    Module._load = previousLoad;
    delete require.cache[require.resolve("../out/config.js")];
    delete require.cache[require.resolve("../out/extension.js")];
    delete require.cache[require.resolve("../out/webview-view-provider.js")];
  }
}

test("extension activates lazily registered commands and webview provider", async () => {
  await withMockedVscode(async (ctx) => {
    const subscriptions = [];
    ctx.extension.activate({
      extensionUri: { path: "/extension" },
      globalState: {
        get() {
          return undefined;
        },
        async update() {},
      },
      secrets: {
        async get() {
          return undefined;
        },
        async store() {},
        async delete() {},
      },
      subscriptions,
    });

    assert.equal(ctx.statusItems.length, 1);
    assert.equal(ctx.statusItems[0].command, "aiVoiceStudio.focusView");
    assert.equal(ctx.statusItems[0].text, "$(unmute) Qwen TTS");
    assert.equal(ctx.statusItems[0].showCalled, true);

    assert.deepEqual([...ctx.commands.keys()].sort(), [
      "aiVoiceStudio.clearApiKey",
      "aiVoiceStudio.focusView",
      "aiVoiceStudio.quickRead",
      "aiVoiceStudio.setApiKey",
      "aiVoiceStudio.stop",
    ]);

    const view = ctx.registeredViewProvider();
    assert.equal(view.viewType, "aiVoiceStudio.studio");
    assert.equal(view.options.webviewOptions.retainContextWhenHidden, true);
    assert.equal(typeof ctx.configChangeHandler(), "function");
    assert.equal(subscriptions.length >= 7, true);

    await ctx.commands.get("aiVoiceStudio.focusView")();
    assert.deepEqual(ctx.executedCommands.at(-1), {
      id: "aiVoiceStudio.studio.focus",
      args: [],
    });
  });
});
