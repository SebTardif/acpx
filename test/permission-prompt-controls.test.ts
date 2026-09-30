import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { promptForPermission, visiblePromptText } from "../src/permission-prompt.js";

describe("visiblePromptText", () => {
  it("escapes CR and ESC so a command line cannot hide itself", () => {
    const rendered = visiblePromptText("echo\r\u001b[1Ahidden");

    assert.equal(rendered.includes("\r"), false);
    assert.equal(rendered.includes("\u001b"), false);
    assert.equal(rendered.includes("x"), true);
    assert.equal(rendered.includes("0d"), true);
    assert.equal(rendered, "echo\\x0d\\x1b[1Ahidden");
  });

  it("escapes a write path that would overwrite the real filename", () => {
    const rendered = visiblePromptText("notes\rHIDDEN.txt");

    assert.equal(rendered.includes("\r"), false);
    assert.equal(rendered.includes("x"), true);
    assert.equal(rendered.includes("0d"), true);
    assert.equal(rendered, "notes\\x0dHIDDEN.txt");
  });

  it("escapes a tool title that would hide a destructive command", () => {
    const rendered = visiblePromptText("read\rrm -rf /");

    assert.equal(rendered.includes("\r"), false);
    assert.equal(rendered.includes("x"), true);
    assert.equal(rendered.includes("0d"), true);
    assert.equal(rendered, "read\\x0drm -rf /");
  });

  it("escapes tab, newline, DEL, and C1 controls", () => {
    const rendered = visiblePromptText("a\tb\nc\u007fd\u009fe");

    assert.equal(rendered.includes("\t"), false);
    assert.equal(rendered.includes("\n"), false);
    assert.equal(rendered.includes("\u007f"), false);
    assert.equal(rendered.includes("\u009f"), false);
    assert.equal(rendered, "a\\x09b\\x0ac\\x7fd\\x9fe");
  });

  it("leaves ordinary text and non-C1 characters unchanged", () => {
    assert.equal(visiblePromptText("Allow write? (y/N) "), "Allow write? (y/N) ");
    assert.equal(visiblePromptText("café\u00a0\u00a1"), "café\u00a0\u00a1");
  });
});

describe("askPermission control escaping", () => {
  it("writes escaped header, details, and prompt to stderr", async () => {
    const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    const stderrDescriptor = Object.getOwnPropertyDescriptor(process.stderr, "isTTY");
    const originalWrite = process.stderr.write;
    let captured = "";

    const defineIsTTY = (stream: object) => {
      Object.defineProperty(stream, "isTTY", {
        configurable: true,
        enumerable: true,
        get: () => true,
      });
    };

    const restoreIsTTY = (stream: object, descriptor: PropertyDescriptor | undefined) => {
      if (descriptor) {
        Object.defineProperty(stream, "isTTY", descriptor);
        return;
      }
      delete (stream as { isTTY?: boolean }).isTTY;
    };

    try {
      defineIsTTY(process.stdin);
      defineIsTTY(process.stderr);
      process.stderr.write = ((
        chunk: string | Uint8Array,
        encoding?: unknown,
        callback?: unknown,
      ) => {
        captured += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
        const done = typeof encoding === "function" ? encoding : callback;
        if (typeof done === "function") {
          done();
        }
        return true;
      }) as typeof process.stderr.write;

      const controller = new AbortController();
      const pending = promptForPermission({
        header: "path notes\rHIDDEN.txt",
        details: "echo\r\n\u001b[1Ahidden",
        prompt: "\nAllow read\rrm -rf /? ",
        signal: controller.signal,
      });
      queueMicrotask(() => {
        controller.abort();
      });

      await Promise.race([
        pending.then(
          () => undefined,
          () => undefined,
        ),
        new Promise((resolve) => {
          setTimeout(resolve, 200);
        }),
      ]);

      // Readline closes a TTY question with its own CRLF. That terminator is not prompt text.
      const promptText = captured.endsWith("\r\n") ? captured.slice(0, -2) : captured;
      assert.equal(promptText.includes("\r"), false);
      assert.equal(promptText.includes("\u001b"), false);
      assert.match(promptText, /notes\\x0dHIDDEN\.txt/);
      assert.match(promptText, /echo\\x0d\\x0a\\x1b\[1Ahidden/);
      assert.match(promptText, /\nAllow read\\x0drm -rf \//);
    } finally {
      process.stderr.write = originalWrite;
      restoreIsTTY(process.stdin, stdinDescriptor);
      restoreIsTTY(process.stderr, stderrDescriptor);
    }
  });
});
