const assert = require("node:assert/strict");
const { test } = require("node:test");

const { runPlaybackSession } = require("../out/core/playback-session.js");
const { TTSApiError } = require("../out/core/providers.js");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("playback session prefetches the next chunk before emitting the current one", async () => {
  const first = deferred();
  const second = deferred();
  const started = [];
  const emitted = [];
  const controller = new AbortController();

  const running = runPlaybackSession(
    ["first", "second"],
    (text) => {
      started.push(text);
      return text === "first" ? first.promise : second.promise;
    },
    (payload) => emitted.push(payload),
    controller.signal,
  );

  assert.deepEqual(started, ["first", "second"]);
  assert.deepEqual(emitted, []);

  first.resolve({ audioBase64: "MQ==", format: "mp3" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].index, 0);

  second.resolve({ audioBase64: "Mg==", format: "mp3" });
  assert.deepEqual(await running, { cancelled: false, emitted: 2 });
  assert.equal(emitted.length, 2);
});

test("playback session reports provider aborts as cancellation", async () => {
  const result = await runPlaybackSession(
    ["only"],
    async () => {
      throw new TTSApiError("aborted", -7);
    },
    () => assert.fail("cancelled chunks should not emit"),
    new AbortController().signal,
  );

  assert.deepEqual(result, { cancelled: true, emitted: 0 });
});

test("playback session settles prefetched failures without unhandled rejections", async () => {
  const first = deferred();
  const second = deferred();
  const started = [];
  const controller = new AbortController();

  const running = runPlaybackSession(
    ["first", "second"],
    (text) => {
      started.push(text);
      return text === "first" ? first.promise : second.promise;
    },
    () => assert.fail("failed chunks should not emit"),
    controller.signal,
  );

  assert.deepEqual(started, ["first", "second"]);
  second.reject(new Error("prefetched failure"));
  first.reject(new Error("current failure"));

  await assert.rejects(running, /current failure/);
});
