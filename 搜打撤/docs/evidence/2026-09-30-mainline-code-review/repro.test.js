// Review-only probes. Assertions describe observed defects, not desired behaviour.
// Actual game modules run against isolated jsdom localStorage; no player storage is used.
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const ctx = new Proxy({}, { get: () => () => ctx, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => ctx;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div><div id="ovBody"></div>';
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2, battleHandMax: 10,
    bossDeckSize: 10, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
    items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
};
await import('../../../game/src/cards/cards.js');
await import('../../../game/src/ui/ui.js');
await import('../../../game/src/hub/base.js');
const session = await import('../../../game/src/run/game.session.js');
const { RunStorage } = await import('../../../game/src/hub/game.storage.js');
const { createRecoveryCommands } = await import('../../../game/src/hub/recovery.commands.js');
const { Base, UI } = window.SDT;
Object.assign(UI, { log() {}, refresh() {}, clearLog() {}, hideOverlay() {}, hideScreen() {}, showScreen() {},
  showOverlay() {}, act() {}, registerHelp() {}, helpBtn() { return ''; } });
window.SDT.Meta = { setXpMul() {}, track() {}, ACHIEVEMENTS: [], isUnlocked: () => false };
window.SDT.Nest = { renderNestMap() { session.game.state = 'idle'; } };
window.SDT.Battle = { restore: () => true };
const prevKey = slot => `sdt-run-${slot}-prev`;
const ordinary = (changes = {}) => ({ version: 2, seed: 'review-map', mapSeed: 'review-map',
  generatorVersion: 3, layoutVersion: 9, layerIdx: 0, trackPos: 0, myClass: '战士',
  hp: 30, maxHp: 50, nestActive: false, ...changes });
beforeEach(() => {
  localStorage.clear();
  for (let slot = 1; slot <= 5; slot++) RunStorage.remove(slot);
  session._set_active_slot(1); Base.use(1);
  Object.assign(session.game, { pendingExtraction: null, extractionPending: null, terminalPending: null,
    battleActive: false, runActive: false, nestActive: false, state: 'title', elapsed: 0, elapsedSynced: 0 });
  session.configureGameRuntime({ openClassChoice() {}, resumeExtraction: () => ({ ok: true }) });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it('F1: rejected fallback load grants old runtime permission to overwrite another run', () => {
  localStorage.setItem(RunStorage.key(1), JSON.stringify({ version: 2, seed: 'old-live-run',
    nestActive: true, hp: 30, _r2: { runId: 'old-run', revision: 3 } }));
  expect(session.loadGame(1).ok).toBe(true);
  const oldSeed = session.game.seed;
  const replacement = ordinary({ generatorVersion: 99, layoutVersion: 99,
    _r2: { runId: 'replacement-run', revision: 7 } });
  localStorage.setItem(prevKey(1), JSON.stringify(replacement));
  localStorage.setItem(RunStorage.key(1), '{broken');
  expect(session.saveGame()).toBe(false);
  const rejected = session.loadGame(1);
  expect(rejected.ok).toBe(false);
  expect(session.game.seed).toBe(oldSeed);
  const saved = session.saveGame();
  const raw = JSON.parse(localStorage.getItem(RunStorage.key(1)));
  console.log('F1', JSON.stringify({ rejected: rejected.code, saved, seed: raw.seed, identity: raw._r2 }));
  expect(saved).toBe(true); // defect: should remain blocked with STALE_SLOT
  expect(raw.seed).toBe(oldSeed);
  expect(raw._r2.runId).toBe('replacement-run');
});

it('F2: terminal transaction leaves a completed run in prev and resurrects it after new-run corruption', async () => {
  expect(RunStorage.write(1, ordinary({ seed: 'completed-run', mapSeed: 'completed-run', hp: 20 }))).toBe(true);
  expect(RunStorage.write(1, ordinary({ seed: 'completed-run', mapSeed: 'completed-run', hp: 15 }))).toBe(true);
  const oldPrev = localStorage.getItem(prevKey(1));
  const identity = RunStorage.readIdentity(1).value;
  const base = Base._readForCommit(1);
  const recovery = createRecoveryCommands({ storage: localStorage, baseApi: Base, runStore: RunStorage,
    lockManager: { request: async (_name, _opts, callback) => callback() } });
  const receipt = await recovery.commitBaseAndRun({ slotId: 1, requestId: 'review-terminal',
    expectedBaseRevision: base._m01.revision, expectedRunRevision: identity.revision },
  { command: 'run.death', runId: identity.runId, payload: { cards: [], deathClass: null },
    afterBase: structuredClone(base), afterRun: null, output: null });
  expect(receipt.ok).toBe(true);
  expect(localStorage.getItem(RunStorage.key(1))).toBeNull();
  expect(localStorage.getItem(prevKey(1))).toBe(oldPrev);
  expect(RunStorage.write(1, ordinary({ seed: 'new-run', mapSeed: 'new-run', hp: 50 }))).toBe(true);
  const newIdentity = RunStorage.readIdentity(1).value;
  localStorage.setItem(RunStorage.key(1), '{new-run-broken');
  const restored = RunStorage.read(1);
  const restoredIdentity = RunStorage.readIdentity(1).value;
  console.log('F2', JSON.stringify({ newIdentity, restoredIdentity, restoredSeed: restored.seed }));
  expect(restored.seed).toBe('completed-run'); // defect: backup belongs to a completed run
  expect(restoredIdentity.runId).toBe(identity.runId);
  expect(restoredIdentity.runId).not.toBe(newIdentity.runId);
});

it('F3: ordinary load destroys the persisted boss selection and immediately writes null', () => {
  localStorage.setItem(RunStorage.key(1), JSON.stringify(ordinary({ layerIdx: 3, bossPlan: 2 })));
  const loaded = session.loadGame(1);
  const persisted = JSON.parse(localStorage.getItem(RunStorage.key(1)));
  console.log('F3', JSON.stringify({ loaded: loaded.ok, runtimeBossPlan: session.game.bossPlan,
    persistedBossPlan: persisted.bossPlan }));
  expect(loaded.ok).toBe(true);
  expect(session.game.bossPlan).toBeNull(); // defect: should retain 2 on same-layer restore
  expect(persisted.bossPlan).toBeNull();
});

it('F4: valid organizing extraction in prev fails the first preflight because identity was read before fallback', () => {
  const pending = { version: 1, runId: 'extract-run', phase: 'organizing', requestSeq: 0,
    remainingCards: [], keptPocket: [], totalPocketCount: 0, lostPocketCount: 0, resources: { wood: 0, rations: 0 } };
  localStorage.setItem(prevKey(1), JSON.stringify(ordinary({ pendingExtraction: pending,
    _r2: { runId: 'extract-run', revision: 8 } })));
  localStorage.setItem(RunStorage.key(1), '{broken');
  const first = session.preflightRunMap(1);
  const second = session.preflightRunMap(1);
  console.log('F4', JSON.stringify({ first: { ok: first.ok, code: first.code }, second: { ok: second.ok } }));
  expect(first).toMatchObject({ ok: false, code: 'INVALID_EXTRACTION_IDENTITY' });
  expect(second.ok).toBe(true);
});
