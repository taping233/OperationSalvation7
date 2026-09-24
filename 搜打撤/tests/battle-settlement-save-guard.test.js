import { beforeEach, describe, expect, it } from 'vitest';

const ctx = new Proxy({}, { get: () => () => ctx, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => ctx;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, battleEnergy: 2, battleHandMax: 10, bossDeckSize: 10, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
};
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
const session = await import('../game/src/run/game.session.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const Base = window.SDT.Base;

beforeEach(() => {
  localStorage.clear();
  for (let slot = 1; slot <= 5; slot++) RunStorage.remove(slot);
  session._set_active_slot(null);
  session.game.pendingBattleSettlement = false;
  session.game.pendingExtraction = null;
  session.game.extractionPending = null;
  session.game.terminalPending = null;
  session.game.runActive = false;
  session.game.nestActive = false;
  session.game.battleActive = false;
  session.game.state = 'title';
  Object.assign(window.SDT.UI, { log() {}, refresh() {}, hideOverlay() {}, hideScreen() {}, showScreen() {}, showOverlay() {}, act() {}, registerHelp() {}, helpBtn() { return ''; } });
});

describe('战后配对提交期间的常规保存保护', () => {
  it('开箱结算锁定时拒绝普通 Run 写入，事务完成后恢复保存', () => {
    const slot = 1;
    Base.use(slot);
    session._set_active_slot(slot);
    session.buildDerived('battle-settlement-save-guard');
    session.game.runActive = true;
    session.game.state = 'idle';
    session.game.layerIdx = 0;
    session.game.trackPos = session.game.layerData[0].entrances[0];
    expect(session.saveGame()).toBe(true);
    const before = localStorage.getItem(RunStorage.key(slot));

    session.game.state = 'modal';
    session.game.pendingBattleSettlement = 'battle:run:request-1';
    session.game.coins += 1;
    expect(session.saveGame()).toBe(false);
    expect(localStorage.getItem(RunStorage.key(slot))).toBe(before);

    session.game.pendingBattleSettlement = false;
    expect(session.saveGame()).toBe(true);
    expect(localStorage.getItem(RunStorage.key(slot))).not.toBe(before);

    session.game.pendingBattleSettlement = 'stale-battle-request';
    session.newRun('standard', [], { skipClassChoice: true });
    expect(session.game.pendingBattleSettlement).toBe(false);
  });
});
