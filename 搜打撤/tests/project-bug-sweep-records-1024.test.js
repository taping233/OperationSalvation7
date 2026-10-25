import { afterEach, expect, it } from 'vitest';
import { exportJSON, listRuns, recordRun, resetRunCounters } from '../game/src/agent/agent.recorder.js';

afterEach(() => { localStorage.removeItem('sdt-run-records'); resetRunCounters(); });
const old = { id: 'old', ts: 1, outcome: 'extract', carried: [{ name: '旧卡', count: 2, value: 4 }], carriedValue: 8 };
it('appending a run retains the exact stored historical record while statistics use a safe projection', () => {
  localStorage.setItem('sdt-run-records', JSON.stringify([old]));
  expect(listRuns()[0]).toMatchObject({ battles: { fought: 0, won: 0 } });
  recordRun('abandon');
  expect(JSON.parse(localStorage.getItem('sdt-run-records'))[0]).toEqual(old);
  expect(JSON.parse(exportJSON()).runs[0]).toEqual(old);
});

it('JSON export preserves incomplete or damaged source rows without applying statistics defaults', () => {
  const rows = [null, 'legacy', old, { id: 'damaged', turns: 'bad', carried: [null] }];
  localStorage.setItem('sdt-run-records', JSON.stringify(rows));
  expect(listRuns()).toHaveLength(2);
  expect(JSON.parse(exportJSON()).runs).toEqual(rows);
});
