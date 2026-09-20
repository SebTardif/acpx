import assert from "node:assert/strict";
import test from "node:test";
import { invokePromptActiveHook } from "../src/session/execution/prompt-active-hook.js";

test("invokePromptActiveHook reports and rethrows cancel failures", async () => {
  const seen: unknown[] = [];
  await assert.rejects(
    () =>
      invokePromptActiveHook(
        async () => {
          throw new Error("cancel failed");
        },
        (error) => {
          seen.push(error);
        },
      ),
    /cancel failed/,
  );
  assert.equal(seen.length, 1);
  assert.ok(seen[0] instanceof Error);
  assert.equal(seen[0].message, "cancel failed");
});

test("invokePromptActiveHook no-ops when the hook is omitted", async () => {
  await invokePromptActiveHook(undefined, () => {
    throw new Error("should not report");
  });
});
