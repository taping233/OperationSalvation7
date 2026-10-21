import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 生命周期回归：实际战斗入口、UID、延迟队列、只读快照和取消边界。
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 8, starterSha: 0,
    battleStartDraw: 99, battleTurnDraw: 1, diceSides: 6 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const Combat = await import('../game/src/battle/core/combat.js');
const evidenceDir = path.resolve('docs/evidence/2026-10-19-card-description-audit');
const catalog = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'catalog.json'), 'utf8')).cards;
const byId = id => { const c = catalog.find(c => c.id === id); if (!c) throw Error(`缺卡 ${id}`); return c; };
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();

const gameFor = cards => ({ ownedCards: cards.map((card, i) => ({ uid: `audit-${i}`, card })), inventory: [], usedPocket: [],
  hp: 50, maxHp: 50, atk: 5, spellPower: 0, coins: 0, state: 'idle', battleActive: false, myClass: '战士',
  log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, onBattleEnd() {} });
async function drain() {
  for (let n = 0; n < 300; n++) {
    await new Promise(r => setTimeout(r, 0));
    const s = BattleSession.getSnapshot();
    if (!s.busy && s.actionQueueLength === 0) {
      await new Promise(r => setTimeout(r, 30));
      const f = BattleSession.getSnapshot(); if (!f.busy && f.actionQueueLength === 0) return f;
    }
  }
  throw Error('审查战斗动作未收口');
}
async function start(cards, { boss = false } = {}) {
  const g = gameFor(cards);
  BattleSession.start(g, [{ id: 'audit-foe', name: '审查靶', hp: 1000, atk: 0 }], { isBoss: boss, nest: boss });
  await drain(); return g;
}
async function play(uid, target = 0) { BattleSession.commands.playCard(uid, target); return drain(); }

describe('卡面描述修复：生命周期', () => {
  it('射线按UID记录在手事件，离手暂停，回手继续，晚入手不继承全局历史', async () => {
    await start([byId('tt12-chargeray'), byId('tt12-chargeray')]);
    runtime.set$infuseFuels(30);
    runtime.recordHandInfusion(runtime.hand);
    runtime.hand.splice(runtime.hand.indexOf('audit-0'), 1);
    runtime.recordHandInfusion(runtime.hand);
    runtime.hand.push('audit-0');
    const late = engine.addTempCard(byId('tt12-chargeray'));
    runtime.recordHandInfusion(runtime.hand);
    const old = BattleSession.getSnapshot();
    expect(old.handInfuseCounts).toMatchObject({ 'audit-0': 2, 'audit-1': 3, [late]: 1 });
    await play('audit-0');
    await play('audit-1');
    const final = await play(late);
    expect(final.foes[0].hp).toBe(1000 - 9 - 11 - 7);
    expect(Object.isFrozen(old.handInfuseCounts)).toBe(true);
    runtime.recordHandInfusion([late]);
    expect(old.handInfuseCounts[late]).toBe(1);
    expect(BattleSession.getSnapshot().handInfuseCounts[late]).toBe(2);
  });

  it('实际注能只给当时在手副本计数，不包括消耗钩随后新获得的牌', async () => {
    const fuel = { id: 'lifecycle-fuel', name: '注能燃料', type: '法术', cost: 0, desc: '被注能时，获得 1 张初始攻击。' };
    const main = { id: 'lifecycle-main', name: '注能主牌', type: '法术', cost: 0, infuse: 1, dmg: 1, dmgType: 'fixed', desc: '造成 1 点固定伤害。' };
    await start([main, fuel, byId('tt12-chargeray')]);
    engine.queueCardExecution('audit-0', main, ['audit-1'], runtime.foes[0], true);
    await drain();
    expect(runtime.handInfuseCounts['audit-2']).toBe(1);
    expect(runtime.handInfuseCounts['audit-0']).toBeUndefined();
    expect(runtime.handInfuseCounts['audit-1']).toBeUndefined();
    for (const entry of runtime.granted) expect(runtime.handInfuseCounts[entry.uid]).toBeUndefined();
  });

  it('新战斗清空计数；旧状态缺字段默认0，新状态恢复按UID隔离', async () => {
    await start([byId('tt12-chargeray')]);
    runtime.recordHandInfusion(runtime.hand);
    await start([byId('tt12-chargeray')]);
    expect(runtime.handInfuseCounts).toEqual({});
    runtime.restoreEffectRules({ infuseFuels: 40 });
    expect(runtime.handInfuseCounts).toEqual({});
    const saved = { handInfuseCounts: { 'audit-0': 2 } };
    runtime.restoreEffectRules(saved);
    saved.handInfuseCounts['audit-0'] = 999;
    expect(runtime.handInfuseCounts['audit-0']).toBe(2);
    expect((await play('audit-0')).foes[0].hp).toBe(991);
  });

  it('火球首次打出前按回合成长，各UID只增一次', async () => {
    await start([byId('cmtn1lbhbqi4'), byId('cmtn1lbhbqi4')]);
    runtime.discard.push('audit-0'); // 重复牌区记账也只按UID成长一次。
    runtime.set$extraTurn(true);
    BattleSession.commands.endTurn(); await drain();
    expect(runtime.growth['audit-0']).toBe(1);
    expect(runtime.growth['audit-1']).toBe(1);
    expect((await play('audit-0')).foes[0].hp).toBe(995);
  });

  it.each([false, true])('正午决战保留第二目标；死亡才回退（死亡=%s）', async dead => {
    await start([byId('tt3-noon-duel')]);
    runtime.foes.push(Combat.ensureStatus({ id: 'lifecycle-second', name: '第二靶', hp: 1000, maxHp: 1000, atk: 0 }));
    await play('audit-0', 1);
    const pending = runtime.delayed.find(q => q.special === 'triggerOps');
    expect(pending.targetIndex).toBe(1);
    runtime.restorePilesBookkeeping({ delayed: JSON.parse(JSON.stringify(runtime.delayed)) });
    if (dead) { runtime.foes[1].dead = true; runtime.foes[1].hp = 0; }
    runtime.set$turn(2); await engine.processDelayed(); await drain();
    expect(runtime.foes.map(f => f.hp)).toEqual(dead ? [992, 0] : [1000, 992]);
    expect(runtime.delayed.some(q => q.special === 'triggerOps')).toBe(false);
  });

  it.each([
    ['tt2-wreck', 'acquire', 2], ['tt3-azure-sword', 'damage', 5],
    ['tt3-sapper-bomb', 'damage', 4], ['tt7-arcanescroll', 'acquire', 3],
  ])('%s到期执行普通消耗钩；重复UID/重复任务只触发一次', async (id, effect, amount) => {
    await start([byId('starter-attack')]);
    const uid = engine.addTempCard(byId(id));
    const before = runtime.granted.length;
    const beforeHand = runtime.hand.length;
    let randomPool;
    if (id === 'tt2-wreck') {
      // 基础2张的数量检查不混入获取派生奖励；阿猫组合由 audit-battle 的精确回归覆盖。
      const plain = byId('tt3-ice-spike');
      expect(C.isRandomObtainable(plain)).toBe(true);
      expect(plain.rules?.triggers?.onAcquire?.length || 0).toBe(0);
      randomPool = vi.spyOn(C, 'all').mockReturnValue([plain]);
    }
    try {
      runtime.delayed.push({ special: 'consumeTemps', uids: [uid, uid], cardName: '江湖救急' });
      runtime.delayed.push({ special: 'consumeTemps', uids: [uid], cardName: '江湖救急' });
      await engine.processDelayed(); await drain();
      expect(runtime.consumed.filter(u => u === uid)).toHaveLength(1);
      expect(effect === 'acquire' ? id === 'tt7-arcanescroll' ? runtime.hand.length - beforeHand + 1 : runtime.granted.length - before : 1000 - runtime.foes[0].hp).toBe(amount);
      expect(runtime.infuseFuels).toBe(0);
    } finally {
      randomPool?.mockRestore();
    }
  });

  it('到期不误触发被注能钩；取消前不消耗；终局后不处理后续UID', async () => {
    await start([byId('starter-attack')]);
    const uid = engine.addTempCard({ id: 'lifecycle-infuse-guard', name: '注能守卫', type: '法术', cost: 0,
      desc: '被注能时，获得 9 点能量。' });
    const before = runtime.energy;
    runtime.delayed.push({ special: 'consumeTemps', uids: [uid] });
    const abort = new AbortController(); abort.abort();
    await expect(engine.processDelayed(abort.signal)).rejects.toBeTruthy();
    expect(runtime.hand).toContain(uid);
    await engine.processDelayed(); await drain();
    expect(runtime.energy).toBe(before);
    const terminalUid = engine.addTempCard(byId('tt3-sapper-bomb'));
    runtime.delayed.push({ special: 'consumeTemps', uids: [terminalUid] });
    runtime.G.battleActive = false;
    await engine.processDelayed();
    expect(runtime.hand).toContain(terminalUid);
    expect(runtime.consumed).not.toContain(terminalUid);
  });
});
