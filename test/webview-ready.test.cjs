const assert = require("node:assert/strict");
const Module = require("node:module");
const { test } = require("node:test");

function withMockedVscode(run) {
  const previousLoad = Module._load;
  const settings = {};
  const mockVscode = {
    ConfigurationTarget: { Global: 1 },
    commands: {
      async executeCommand() {},
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
    },
  };

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "vscode") return mockVscode;
    return previousLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve("../out/config.js")];
    delete require.cache[require.resolve("../out/webview-view-provider.js")];
    return run(require("../out/webview-view-provider.js"));
  } finally {
    Module._load = previousLoad;
    delete require.cache[require.resolve("../out/config.js")];
    delete require.cache[require.resolve("../out/webview-view-provider.js")];
  }
}

function createFakeWebviewView() {
  let receiveMessage;
  let disposeView;
  const webview = {
    cspSource: "vscode-test:",
    options: undefined,
    html: "",
    async postMessage() {
      return true;
    },
    onDidReceiveMessage(callback) {
      receiveMessage = callback;
      return { dispose() {} };
    },
  };
  const view = {
    webview,
    show() {},
    onDidDispose(callback) {
      disposeView = callback;
      return { dispose() {} };
    },
  };
  return {
    view,
    send(message) {
      assert.equal(typeof receiveMessage, "function");
      receiveMessage(message);
    },
    dispose() {
      assert.equal(typeof disposeView, "function");
      disposeView();
    },
  };
}

test("waitUntilReady resolves when ready arrives after the wait starts", async () => {
  await withMockedVscode(async ({ VoiceStudioViewProvider }) => {
    const provider = new VoiceStudioViewProvider({});
    const waiting = provider.waitUntilReady(500);
    const fake = createFakeWebviewView();

    provider.resolveWebviewView(fake.view, {}, {});
    fake.send({ type: "ready" });

    assert.equal(await waiting, true);
    assert.equal(provider.isReady(), true);
  });
});

test("waitUntilReady resolves false when the webview is disposed first", async () => {
  await withMockedVscode(async ({ VoiceStudioViewProvider }) => {
    const provider = new VoiceStudioViewProvider({});
    const fake = createFakeWebviewView();
    provider.resolveWebviewView(fake.view, {}, {});

    const waiting = provider.waitUntilReady(500);
    fake.dispose();

    assert.equal(await waiting, false);
    assert.equal(provider.isReady(), false);
  });
});
