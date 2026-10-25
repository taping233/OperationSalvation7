import { battleRules, playerFields } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { attackCue } from '../game/src/battle/view/battle.attack-cues.js';
import { impactProfile } from '../game/src/battle/view/battle.attack-profiles.js';
import { playEnemyMotion } from '../game/src/battle/view/battle.enemy-motion.js';

window.SDT ||= {};
window.SDT.Icons = { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(99, 20, 15, 0, 20, 1) }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession, takeFloats } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { vi.useFakeTimers(); window.SDT.Motion = { reduceMotion: () => false }; R.set$lastDeckSel([]); });
afterEach(() => { R.bindBattleRenderer(() => {}); vi.clearAllTimers(); vi.useRealTimers(); delete Element.prototype.animate; });

it.each([
  ['light', 'fixed', 3, 1], ['heavy', 'fixed', 12, 1],
  ['spell', 'spell', 3, 1], ['combo', 'fixed', 3, 3],
])('%s presentation follows real segments without changing damage or payment', async (profile, kind, amount, hitCount) => {
  const card = { id: `sample-${profile}`, name: '表现样板', type: kind === 'spell' ? '法术' : '武术',
    cost: 1, rarity: '古朴', dmg: amount, dmgType: kind, desc: `造成${amount}点${kind === 'spell' ? '法术' : '固定'}伤害。`,
    rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: {
      onPlay: [{ op: 'damage', amount, target: 'chosenEnemy', hitCount }],
    } } };
  const game = { ownedCards: [{ uid: 'sample', card, safe: false }], ...playerFields(100, 100, 0, 0, '战士', null), log() {}, heal() {}, addItem() {}, onBattleEnd() {} };
  const observed = [];
  R.bindBattleRenderer(() => { observed.push(...takeFloats()); });
  BattleSession.start(game, [{ id: 'bandit', name: '强盗', hp: 100, atk: 0 }], { isBoss: false });
  takeFloats(); observed.length = 0;
  BattleSession.commands.playCard('sample', 0);
  await vi.advanceTimersByTimeAsync(2000);
  expect(R.busy).toBe(false);
  expect(R.foes[0].hp).toBe(100 - amount * hitCount);
  expect(R.energy).toBe(98);
  const hits = observed.filter(event => event.hpBefore != null && event.cue);
  expect(hits).toHaveLength(hitCount);
  expect(hits.every(event => event.cue.profile === profile)).toBe(true);
});

it('rejects unknown cue kinds and keeps combo hits free of repeated freezes', () => {
  expect(attackCue('unknown', {})).toBeUndefined();
  expect(impactProfile(attackCue('fixed', {}, { hitCount: 4, amount: 12 }), 12).stopMs).toBe(0);
  expect(impactProfile(attackCue('attack', { dmg: 1 }), 12).stopMs).toBeGreaterThan(0);
  expect(impactProfile(null, 3, { critical: true }).stopMs).toBeGreaterThan(0);
  expect(impactProfile(null, 3, { kill: true }).stopMs).toBeGreaterThan(0);
  expect(impactProfile(null, 12, { kill: true, reduced: true }).stopMs).toBe(0);
});

it('real 迅疾箭 presents its windup in an earlier RAF render than the damage and still draws from the real pile', async () => {
  const card = C.all().find(card => card.id === 'tt2-swiftarrow'); expect(card).toBeTruthy();
  const game = { ownedCards: [{ uid: 'real-swiftarrow', card: structuredClone(card) }],
    ...playerFields(100, 100, 4, 0, '战士', null), log() {}, heal() {}, addItem() {}, onBattleEnd() {} };
  const observed = [];
  R.bindBattleRenderer(() => {
    const floats = takeFloats();
    if (floats.length) observed.push({ hp: R.foes[0].hp, floats });
  });
  BattleSession.start(game, [{ id: 'bandit', name: '强盗', hp: 35, atk: 0 }], { isBoss: false });
  await vi.advanceTimersByTimeAsync(100); takeFloats(); observed.length = 0;
  const drawBefore = R.drawPile.length;
  BattleSession.commands.playCard('real-swiftarrow', 0);
  await vi.advanceTimersByTimeAsync(2000);
  const windup = observed.findIndex(row => row.floats.some(f => f.cls === 'windupfx'));
  const hit = observed.findIndex(row => row.floats.some(f => f.hpBefore != null));
  expect(windup).toBeGreaterThanOrEqual(0); expect(hit).toBeGreaterThan(windup);
  expect(observed[windup].hp).toBe(35); expect(observed[hit].hp).toBe(32);
  expect(observed[windup].floats.find(f => f.cls === 'windupfx').cue.attacker).toBe('player-attack');
  expect(R.drawPile).toHaveLength(drawBefore - 1); expect(R.busy).toBe(false);
});

it('enemy sample only replaces bandit actions and cancels on preference changes or close', async () => {
  document.body.innerHTML = '<div id="sample"><img src="/game/assets/portraits/enemies/bandit.webp?v=1"></div>';
  const figure = document.querySelector('#sample');
  const runs = [];
  Element.prototype.animate = vi.fn(() => { const run = { cancel: vi.fn() }; runs.push(run); return run; });
  expect(playEnemyMotion(figure, 'attack')).toBe(true);
  expect(playEnemyMotion(figure, 'hurt')).toBe(true);
  expect(runs[0].cancel).toHaveBeenCalledOnce();
  window.SDT.Motion.reduceMotion = () => true;
  expect(playEnemyMotion(figure, 'attack')).toBe(false);
  window.SDT.Motion.reduceMotion = () => false;
  figure.querySelector('img').src = '/other-enemy.webp';
  expect(playEnemyMotion(figure, 'hurt')).toBe(false);
  expect(runs).toHaveLength(2);
  document.body.classList.add('reduce-motion');
  await Promise.resolve();
  expect(runs[1].cancel).toHaveBeenCalledOnce();
  document.body.classList.remove('reduce-motion');
  figure.querySelector('img').src = '/bandit.webp';
  expect(playEnemyMotion(figure, 'attack')).toBe(true);
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  expect(runs[2].cancel).toHaveBeenCalledOnce();
});
