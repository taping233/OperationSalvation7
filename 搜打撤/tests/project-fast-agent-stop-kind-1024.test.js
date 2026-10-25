import { expect, it } from 'vitest';
import { classifyStop, noteStopReason, recordRun, resetRunCounters } from '../game/src/agent/agent.recorder.js';

it.each([
  ['runner-load-timeout', 'stalled'],
  ['runner-load-failed', 'error'],
])('persists %s with the matching diagnostic kind instead of unknown', (code, kind) => {
  localStorage.clear();
  window.SDT = { game: {} };
  resetRunCounters();
  noteStopReason({ code, steps: 0 });
  expect(classifyStop(code)).toBe(kind);
  const entry = recordRun('abandon');
  expect(entry.stopReason).toMatchObject({ code, kind, steps: 0 });
  expect(JSON.parse(localStorage.getItem('sdt-run-records'))[0].stopReason).toMatchObject({ code, kind });
});
