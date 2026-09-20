import assert from "node:assert/strict";
import test from "node:test";
import { applyRereadClosedState } from "../src/session/execution/closed-state.js";
import { makeSessionRecord } from "./runtime-test-helpers.js";

test("applyRereadClosedState keeps memory flags when the reread is missing", () => {
  const record = makeSessionRecord({
    acpxRecordId: "closed-reread",
    acpSessionId: "closed-reread",
    agentCommand: "agent-a",
    cwd: "/tmp/closed-reread",
    closed: false,
  });
  record.closed = false;
  assert.equal(applyRereadClosedState(record, undefined, "2026-01-01T00:00:00.000Z"), false);
  assert.equal(record.closed, false);
});

test("applyRereadClosedState restores a concurrently closed record", () => {
  const record = makeSessionRecord({
    acpxRecordId: "closed-reread",
    acpSessionId: "closed-reread",
    agentCommand: "agent-a",
    cwd: "/tmp/closed-reread",
    closed: false,
  });
  const latest = makeSessionRecord({
    acpxRecordId: "closed-reread",
    acpSessionId: "closed-reread",
    agentCommand: "agent-a",
    cwd: "/tmp/closed-reread",
    closed: true,
  });
  latest.closed = true;
  latest.closedAt = "2026-02-01T00:00:00.000Z";
  latest.pid = 4242;
  latest.acpx = { desired_mode_id: "ask" };
  assert.equal(applyRereadClosedState(record, latest, "2026-03-01T00:00:00.000Z"), true);
  assert.equal(record.closed, true);
  assert.equal(record.closedAt, "2026-02-01T00:00:00.000Z");
  assert.equal(record.pid, 4242);
  assert.equal(record.acpx?.desired_mode_id, "ask");
});

test("applyRereadClosedState clears closed when the latest record is open", () => {
  const record = makeSessionRecord({
    acpxRecordId: "closed-reread",
    acpSessionId: "closed-reread",
    agentCommand: "agent-a",
    cwd: "/tmp/closed-reread",
    closed: true,
  });
  record.closed = true;
  record.closedAt = "2026-02-01T00:00:00.000Z";
  const latest = makeSessionRecord({
    acpxRecordId: "closed-reread",
    acpSessionId: "closed-reread",
    agentCommand: "agent-a",
    cwd: "/tmp/closed-reread",
    closed: false,
  });
  latest.closed = false;
  assert.equal(applyRereadClosedState(record, latest, "2026-03-01T00:00:00.000Z"), true);
  assert.equal(record.closed, false);
  assert.equal(record.closedAt, undefined);
});
