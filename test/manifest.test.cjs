const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readManifest() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
}

test("activation events match contributed view and commands", () => {
  const manifest = readManifest();
  const activationEvents = new Set(manifest.activationEvents);
  const commands = new Set(manifest.contributes.commands.map((entry) => entry.command));
  const views = manifest.contributes.views.aiVoiceStudio.map((entry) => entry.id);

  assert.deepEqual(views, ["aiVoiceStudio.studio"]);
  assert.equal(activationEvents.has("onView:aiVoiceStudio.studio"), true);

  for (const command of commands) {
    assert.equal(
      activationEvents.has(`onCommand:${command}`),
      true,
      `${command} is contributed but does not activate the extension`,
    );
  }

  assert.equal(activationEvents.has("onStartupFinished"), false);
});

test("menus and keybindings point only at contributed commands", () => {
  const manifest = readManifest();
  const commands = new Set(manifest.contributes.commands.map((entry) => entry.command));
  const menuItems = Object.values(manifest.contributes.menus).flat();
  const keybindings = manifest.contributes.keybindings;

  for (const item of menuItems) {
    assert.equal(commands.has(item.command), true, `${item.command} menu item is not contributed`);
  }
  for (const binding of keybindings) {
    assert.equal(commands.has(binding.command), true, `${binding.command} keybinding is not contributed`);
  }
});
