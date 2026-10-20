import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameMenuController } from './helpers/menu-controller.js';
import { battleRestartHTML, bindBattleRestart } from '../game/src/ui/settings-battle-restart.js';

let actions = {}, game, releaseAction;
const UI = { el: {},
  act(name, handler) { actions[name] = handler; },
  showOverlay(_title, html, mode) {
    UI.el.ovBody.innerHTML = html; UI.el.overlay.hidden = false;
    UI.el.overlay.classList.remove('closing'); UI._lastMode = mode;
  },
  hideOverlay: vi.fn(() => { UI.el.overlay.hidden = true; }), refresh() {}, log: vi.fn(),
};
const SDT = window.SDT = { UI, Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {}, musicMuted: false, sfxMuted: false,
    musicVolume: 0.7, sfxVolume: 0.6, setMusicMuted() {}, setSfxMuted() {}, setMusicVolume() {}, setSfxVolume() {} },
  Notes: { clearAll() {} },
  MAP: { rules: { battleEnergy: 3, battleHandMax: 30, bossDeckSize: 2, starterSha: 0,
    battleStartDraw: 2, battleTurnDraw: 1, diceSides: 6 }, items: {} } };
await import('../game/src/cards/cards.js');
const { BattleSession, configureBattleRenderer } = await import('../game/src/battle/core/battle.core.js');
const { Random } = await import('../game/src/core/random.js');
const { setTurbo } = await import('../game/src/core/turbo.js');
const hit = index => ({ id: `settings-hit-${index}`, name: `重开验证${index}`, cost: 1, type: '武术', dmg: 2, dmgType: 'fixed',
  desc: '造成2点固定伤害。', rules: { version: 1, battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] } } });
const settle = () => vi.advanceTimersByTimeAsync(1000);
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function start(options = {}) {
  game = { state: 'idle', runActive: true, battleActive: false, nestActive: false, discoveredPairs: new Set(), nestRunes: [],
    toggles: { index: false }, devMode: false, seed: 7431, hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 8,
    myClass: '侠客', characterId: null, turn: 1, layerIdx: 0, trackPos: 2, inventory: [{ id: 'rations', count: 2 }],
    ownedCards: [0, 1, 2].map(i => ({ uid: `owned-${i}`, card: hit(i), safe: false })),
    cardOrder: ['owned-0', 'owned-1', 'owned-2'], usedPocket: [], eventLog: [],
    log(message) { this.eventLog.push(String(message)); }, heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    persistSave: vi.fn(() => true), onBattleEnd: vi.fn() };
  SDT.game = game; SDT.Battle = BattleSession;
  Random.reseed(game.seed);
  BattleSession.start(game, [{ id: 'restart-target', name: '重开靶', hp: 80, atk: 3, behavior: 'strike' }],
    { isBoss: false, ...options });
  return game;
}

function openSettings() {
  const saveSession = vi.fn(), clearAllSlots = vi.fn();
  const controller = createGameMenuController({ SDT, UI, game, esc: String, getActiveSlot: () => 1,
    runtime: { syncDevVisibility() {}, rebuildNotes() {} }, saveSession, clearAllSlots });
  controller.openSettings();
  return { controller, saveSession, clearAllSlots, page: UI.el.ovBody.querySelector('.settings-page') };
}

beforeEach(async () => {
  vi.useFakeTimers(); actions = {}; releaseAction = null;
  document.body.innerHTML = '<div id="overlay" hidden><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'),
    ovTitle: document.getElementById('ovTitle') };
  configureBattleRenderer(snapshot => UI.showOverlay('', `<section class="battle-stage" data-token="${snapshot.battleToken}"></section>`, 'battle'));
  SDT.Cards.ensureSha(); SDT.Cards.ensureStarters(); SDT.Cards.ensureDmgTypes(); SDT.Cards.ensureEffectFields();
  setTurbo(true); start(); await settle(); UI.hideOverlay.mockClear();
});
afterEach(async () => {
  releaseAction?.(true); await flush();
  if (game?.battleActive) BattleSession.commands.flee();
  await vi.runOnlyPendingTimersAsync();
  configureBattleRenderer(null); vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers();
  localStorage.clear();
});

describe('settings restart of the current battle checkpoint', () => {
  it('restarts an ordinary battle with one click, restoring the entry state without ending or saving the run', async () => {
    const initial = BattleSession.getSnapshot(), rng = Random.snapshot(), identity = game.discoveredPairs;
    BattleSession.commands.playCard('owned-0', 0); await settle();
    BattleSession.commands.endTurn(); await settle();
    expect(BattleSession.getSnapshot().turn).toBe(2); expect(game.hp).toBeLessThan(100);
    game.coins = 99; game.inventory[0].count = 0;
    game.persistSave.mockClear();
    const { saveSession, clearAllSlots } = openSettings();
    const button = UI.el.ovBody.querySelector('[data-act="restartCurrentBattle"]');
    expect(button.textContent).toBe('重新开始本场战斗');
    expect(button.dataset.confirm).toBeUndefined();
    expect(actions.restartCurrentBattle()).toEqual({ ok: true });
    await settle();
    const restarted = BattleSession.getSnapshot();
    expect(restarted.battleToken).not.toBe(initial.battleToken);
    expect(restarted).toMatchObject({ turn: 1, energy: 3, busy: false, hand: initial.hand, consumed: [], played: [] });
    expect(restarted.foes[0].hp).toBe(80); expect(game.hp).toBe(100); expect(game.coins).toBe(8);
    expect(game.inventory[0].count).toBe(2); expect(Random.snapshot()).toEqual(rng);
    expect(game.discoveredPairs).toBe(identity); expect(game.runActive).toBe(true);
    expect(game.onBattleEnd).not.toHaveBeenCalled(); expect(game.persistSave).not.toHaveBeenCalled();
    expect(saveSession).not.toHaveBeenCalled(); expect(clearAllSlots).not.toHaveBeenCalled();
    expect(UI.hideOverlay).not.toHaveBeenCalled();
    expect(UI.el.ovBody.querySelector('.settings-page')).toBeNull();
    expect(UI.el.ovBody.querySelector('.battle-stage')).not.toBeNull();
  });

  it('restarts a boss battle with the already confirmed deck instead of asking for a new formation', async () => {
    start({ isBoss: true });
    BattleSession.commands.selectDeckCard('owned-0'); BattleSession.commands.selectDeckCard('owned-1');
    BattleSession.commands.confirmDeck(); await settle();
    const checkpoint = BattleSession.serialize(), initial = BattleSession.getSnapshot();
    expect(checkpoint.selectedDeck).toEqual(['owned-0', 'owned-1']);
    game.hp = 7; game.persistSave.mockClear();
    openSettings(); expect(actions.restartCurrentBattle()).toEqual({ ok: true }); await settle();
    const restarted = BattleSession.getSnapshot();
    expect(restarted.deckSelection).toBeNull(); expect(restarted.turn).toBe(1);
    expect(restarted.hand).toEqual(initial.hand); expect(restarted.drawPile).toEqual(initial.drawPile);
    expect([...restarted.hand, ...restarted.drawPile]).not.toContain('owned-2');
    expect(BattleSession.serialize().selectedDeck).toEqual(checkpoint.selectedDeck);
    expect(game.hp).toBe(100); expect(game.onBattleEnd).not.toHaveBeenCalled();
    expect(game.persistSave).not.toHaveBeenCalled();
  });

  it.each(['outside-battle', 'missing-checkpoint', 'invalid-checkpoint'])('hides the button for %s', variant => {
    if (variant === 'outside-battle') game.battleActive = false;
    else SDT.Battle = { ...BattleSession, serialize: () => variant === 'missing-checkpoint' ? null : { restartVersion: 0 } };
    openSettings();
    expect(UI.el.ovBody.querySelector('[data-act="restartCurrentBattle"]')).toBeNull();
    expect(actions.restartCurrentBattle).toBeUndefined();
    game.battleActive = true;
  });

  it('rejects an old page and a different battle before attempting restore', async () => {
    const restore = vi.fn(BattleSession.restore); SDT.Battle = { ...BattleSession, restore };
    const { controller } = openSettings(), oldPageAction = actions.restartCurrentBattle;
    controller.openSettings();
    expect(oldPageAction()).toMatchObject({ ok: false, code: 'BATTLE_RESTART_STALE' });
    const otherBattleAction = actions.restartCurrentBattle;
    BattleSession.start(game, [{ id: 'new-target', name: '新场', hp: 50, atk: 1 }], { isBoss: false });
    expect(otherBattleAction()).toMatchObject({ ok: false, code: 'BATTLE_RESTART_STALE' });
    expect(restore).not.toHaveBeenCalled();
    await settle();
  });

  it('accepts one request only and rejects a repeated click on the same page', async () => {
    const restore = vi.fn(BattleSession.restore); SDT.Battle = { ...BattleSession, restore };
    openSettings(); const restart = actions.restartCurrentBattle;
    expect(restart()).toEqual({ ok: true });
    expect(restart()).toMatchObject({ ok: false, code: 'BATTLE_RESTART_ALREADY_USED' });
    expect(restore).toHaveBeenCalledOnce(); await settle();
  });

  it('keeps the current settings page and gives feedback when restoration fails', () => {
    SDT.Battle = { ...BattleSession, restore: () => false };
    const { page } = openSettings();
    expect(actions.restartCurrentBattle()).toMatchObject({ ok: false, code: 'BATTLE_RESTART_FAILED' });
    expect(page.isConnected).toBe(true);
    expect(page.querySelector('[data-battle-restart-feedback]').textContent).toContain('未能重新开始');
    expect(page.querySelector('[data-act="restartCurrentBattle"]').disabled).toBe(false);
    expect(UI.hideOverlay).not.toHaveBeenCalled();
  });

  it('uses the same action from a battle settings panel and cancels an older pending card queue', async () => {
    let resolve;
    const readiness = new Promise(done => { resolve = done; }); releaseAction = resolve;
    configureBattleRenderer(snapshot => snapshot.busy ? readiness
      : UI.showOverlay('', '<section class="battle-stage"></section>', 'battle'));
    BattleSession.commands.playCard('owned-0', 0); await flush();
    expect(BattleSession.getSnapshot().busy).toBe(true);
    UI.showOverlay('', `<section class="battle-decision"><div class="bt-settings">${battleRestartHTML({ SDT, game })}</div></section>`, 'settings');
    bindBattleRestart({ SDT, UI, game, page: UI.el.ovBody.querySelector('.battle-decision') });
    expect(actions.restartCurrentBattle()).toEqual({ ok: true });
    resolve(true); await flush(); await settle();
    const state = BattleSession.getSnapshot();
    expect(state).toMatchObject({ turn: 1, energy: 3, busy: false, played: [], consumed: [] });
    expect(state.foes[0].hp).toBe(80); expect(state.hand).toContain('owned-0');
    expect(game.onBattleEnd).not.toHaveBeenCalled();
  });
});
