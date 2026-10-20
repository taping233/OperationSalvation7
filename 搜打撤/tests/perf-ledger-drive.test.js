// @vitest-environment node
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';

// Evaluate only the page installer. Never execute the capture CLI or launch a browser.
const source = readFileSync(new URL('../scripts/perf-ledger-capture.mjs', import.meta.url), 'utf8');
const installer = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body
  .find(node => node.type === 'FunctionDeclaration' && node.id.name === 'plInstall');
const installerSource = source.slice(installer.start, installer.end);

function fixture(mode, { busyPolls = 0, initialPhase = 'battle', missingSnapshot = false } = {}) {
  const calls = [];
  let phase = initialPhase;
  let deckSelection = mode === 'boss' ? { selected: [], need: 0 } : null;
  let snapshots = 0;
  const A = {
    observe: () => ({ ok: true, phase, battle: { deckSelection }, actions: [] }),
    setTurbo: async enabled => calls.push(['turbo', enabled]),
    policies: { greedy: () => 'greedy' },
    step: async (policy, options) => { calls.push(['step', policy, options]); phase = 'hub'; return {}; },
    act: async action => {
      calls.push(['act', action]);
      if (action.name === 'confirmDeck') deckSelection = null;
      if (action.name === 'confirmDeploy') phase = 'battle';
      return { ok: true };
    },
  };
  const window = { SDT: { Agent: A, Battle: { getSnapshot: () => {
    snapshots++;
    return missingSnapshot ? null : { busy: snapshots <= busyPolls, deckSelection, foes: [], hand: [] };
  } } } };
  vm.runInNewContext(`(${installerSource})()`, {
    window, performance: { now: () => 0 },
    setTimeout: (resolve, ms) => { calls.push(['wait', ms]); resolve(); },
  });
  return { calls, snapshots: () => snapshots, run: () => mode === 'boss'
    ? window.__PL.driveBoss() : window.__PL.runDrive({ stopAtBattle: true }) };
}

describe.each(['run', 'boss'])('performance ledger %s drive', mode => {
  it('waits for the battle, buffers, then disables turbo before returning', async () => {
    const f = fixture(mode, { busyPolls: 2 });
    const result = await f.run();
    expect(result).toMatchObject({ ok: true, stoppedAt: mode === 'boss' ? 'boss-battle' : 'battle', steps: 0 });
    expect(f.calls.slice(-(mode === 'boss' ? 5 : 4))).toEqual([
      ...(mode === 'boss' ? [['wait', 120]] : []),
      ['wait', 250], ['wait', 250], ['wait', 1200], ['turbo', false],
    ]);
    expect(f.snapshots()).toBe(4); // Three polls and the returned battle summary.
  });

  it('retains the 40-poll bound when no snapshot arrives', async () => {
    const f = fixture(mode, { missingSnapshot: true });
    const result = await f.run();
    expect(result.ok).toBe(true); // Preserve existing timeout behavior, without claiming readiness.
    expect(result.battle).toBeNull();
    expect(f.calls.filter(call => call[0] === 'wait' && call[1] === 250)).toHaveLength(40);
    expect(f.calls.slice(-2)).toEqual([['wait', 1200], ['turbo', false]]);
    expect(f.snapshots()).toBe(41);
  });

  it.each(['hub', 'settlement'])('redeploys from %s with the existing action and delay order', async initialPhase => {
    const f = fixture(mode, { initialPhase });
    const result = await f.run();
    const start = initialPhase === 'settlement' ? 2 : 1;
    expect(f.calls.slice(start, start + 6)).toEqual([
      ['act', { type: 'ui', name: 'hubTab', params: { tab: 'deploy' } }], ['wait', 500],
      ['act', { type: 'ui', name: 'deploy' }], ['wait', 700],
      ['act', { type: 'ui', name: 'confirmDeploy' }], ['wait', 1500],
    ]);
    if (initialPhase === 'settlement') {
      expect(f.calls[1]).toEqual(['step', 'greedy', { commandTimeoutMs: 20000 }]);
    }
    expect(result.events).toEqual([{ redeploy: true }]);
    expect(result.ok).toBe(true);
  });
});
