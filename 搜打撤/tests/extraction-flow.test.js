import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('game/src/game.run.altar.js', 'utf8');
let game, UI, base, openEmergencyModal, openBaseHub;
beforeEach(() => {
  document.body.innerHTML = '<div id="body"></div>';
  game = { state: 'idle', layerIdx: 2, trackPos: 0, ownedCards: Array.from({ length: 4 }, (_, i) => ({ uid: String(i), card: { id: String(i), name: `卡${i}` } })), inventory: [], usedPocket: [], turn: 1, elapsed: 0, hp: 20, maxHp: 30, coins: 0, runActive: true };
  UI = { acts: {}, showOverlay: (_, html) => { document.getElementById('body').innerHTML = html; }, hideOverlay: () => { UI.acts = {}; }, act: (name, fn) => { UI.acts[name] = fn; }, log() {}, refresh() {}, registerHelp() {}, helpBtn: () => '' };
  base = { data: { coins: 0, collection: {} }, deposit: vi.fn(), depositCards: vi.fn(), isSha: () => false, stashRoom: () => 0, stashUsed: () => 20, stashCap: () => 20 };
  openBaseHub = vi.fn(() => { game.state = 'modal'; });
  const SDT = { Base: base, Sound: { sfx() {}, music() {} }, Cards: { cardHTML: c => c.name, sellPrice: () => 1 }, Meta: { track() {} } };
  const nodeShell = o => UI.showOverlay('', `${o.body || ''}${o.foot || ''}`);
  const code = source.slice(source.indexOf('function openBagSacrifice(')).replace('export function emergencyExitPaymentState', 'function emergencyExitPaymentState').replace('export function openEmergencyModal', 'function openEmergencyModal');
  openEmergencyModal = new Function('game', 'UI', 'SDT', 'curLayer', 'esc', 'escAttr', 'Sfx', 'MAP', 'syncPlayTime', 'clearSave', '_set_cardPageOpen', 'nodeShell', 'nodeOpt', 'openBaseHub', `${code}; return openEmergencyModal;`)(game, UI, SDT, () => ({ logical: [{ def: { type: 'emergencyExit' } }] }), String, String, { tick() {}, ding() {} }, { rules: {} }, () => {}, () => {}, () => {}, nodeShell, (act, label) => `<button data-act="${act}">${label}</button>`, openBaseHub);
});

it('三张献祭完成后到达整理页，仓库满仍能完成整理并回基地', () => {
  openEmergencyModal();
  UI.acts.payExit();
  for (const uid of ['0', '1', '2']) UI.acts.sacPick({ uid });
  UI.acts.sacConfirm();
  expect(game.ownedCards.map(o => o.uid)).toEqual(['3']);
  expect(game.state).toBe('done');
  expect(document.querySelector('[data-act="exFinish"]')).not.toBeNull();
  UI.acts.exFinish();
  expect(document.querySelector('[data-act="goBase"]')).not.toBeNull();
  UI.acts.goBase();
  expect(openBaseHub).toHaveBeenCalledOnce();
  expect(game.state).toBe('modal');
});

it('取消献祭回到撤离点，继续深入恢复地图状态且不丢卡', () => {
  openEmergencyModal();
  UI.acts.payExit();
  UI.acts.sacPick({ uid: '0' });
  UI.acts.sacCancel();
  UI.acts.stayHere();
  expect(game.state).toBe('idle');
  expect(game.ownedCards).toHaveLength(4);
});
