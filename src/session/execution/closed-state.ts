import type { SessionRecord } from "../../types.js";

export function applyRereadClosedState(
  record: SessionRecord,
  latest: SessionRecord | undefined,
  now: string,
): boolean {
  if (!latest) {
    return false;
  }
  if (latest.closed === true) {
    record.closed = true;
    record.closedAt = latest.closedAt ?? record.closedAt ?? now;
    record.pid = latest.pid;
    if (latest.acpx) {
      record.acpx = {
        ...record.acpx,
        ...latest.acpx,
      };
    }
    return true;
  }
  record.closed = false;
  record.closedAt = undefined;
  return true;
}
