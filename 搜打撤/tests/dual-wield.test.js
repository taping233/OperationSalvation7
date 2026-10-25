import { battleRules } from './helpers/environment-fixtures.js';
/* 二刀流（cc-dual-wield，2026-09-10 需求）真实战斗实打：
 * 1 费稀有武术——发现一张招式卡并额外获得1张复制。
 * 覆盖：入库字段 / 打出后三选一发现招式 / 本体+复制共 2 张同名置入手牌。 */
import { createBattleGameFactory, drainBattle } from './helpers/battle-fixtures.js';
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { ...battleRules(99, 99, 1, 0, 5, 2) },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle/core/battle.core.js');

const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();   // 含 ensureCardsSyncLive（v10：二刀流入库）
  C.ensureDmgTypes();
  C.ensureEffectFields();
});


const makeGame = createBattleGameFactory();
const foeDef = () => ({ id: 'infantry', name: '双刀靶子', hp: 99999, atk: 1 });
const snap = () => BattleSession.getSnapshot();

const drain = (maxLoops = 300) => drainBattle(BattleSession, maxLoops);

const dual = () => C.all().find(c => c.id === 'cc-dual-wield');

describe('二刀流（cc-dual-wield）', () => {
  it('卡牌已入库：1费稀有武术', () => {
    const c = dual();
    expect(c).toBeTruthy();
    expect(c.cost).toBe(1);
    expect(c.rarity).toBe('稀有');
    expect(c.type).toBe('武术');
  });

  it('打出 → 三选一发现招式 → 本体+复制共 2 张同名置入手牌', async () => {
    const g = makeGame([dual()]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '双刀测试' });
    await drain();
    // A3 迁移后本卡为结构化 self 卡：side='self' 直接结算（v1 结构化 self 卡既有口径）
    BattleSession.commands.playCard(g.ownedCards[0].uid, 'self');
    await drain(500);

    // 本体+复制共 2 张（A3 acquire discover+dup：同名走 addTempCard，可能堆叠展示）
    const nonSlam = snap().hand.map(u => viewApi.findCard(u)).filter(o => o && o.card.name !== '背包砸击');
    const totalCount = nonSlam.reduce((acc, o) => acc + (o.count || 1), 0);
    expect(totalCount, `本体+复制应共 2 张，实际条目 ${nonSlam.length}：${JSON.stringify(nonSlam.map(o => o.card.name))}`).toBe(2);
    expect(nonSlam[0].card.name).toBe(nonSlam[nonSlam.length - 1].card.name);   // 复制=同名
    expect(['武术', '法术']).toContain(nonSlam[0].card.type);
    // 发现的是候选项之一（三选一面板第一项），且为招式限制池（acquire 日志池括注在中段）
    expect(g.logs.some(l => l.includes('发现 1 张【招式】')), 'acquire discover 日志').toBe(true);
    BattleSession.commands.flee();
    await drain(100);
    expect(g.battleActive).toBe(false);
    expect(g.ownedCards.length).toBe(1);                   // 临时卡战后消散，背包不变
  });
});
