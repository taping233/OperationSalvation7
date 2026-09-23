import { describe, expect, it } from 'vitest';
import { MECH_ALL } from '../game/src/cards/mech-sentences.js';
import { createEffectExecutor } from '../game/src/battle/battle.effects.js';

// 元测试（性质锁定）：制作坊的每一条机制句式，都必须能被
// applyTextEffects 的文本解释层识别并产生效果 —— 即「新卡零专属代码即可生效」。
// 若某条 tpl 改动后本测试红，说明规范句式与解释器失配，卡牌会静默失效。

function makeExecutor() {
  const calls = { curses: [], blessings: [], logs: [], effects: 0 };
  const hit = () => { calls.effects++; };
  const pstat = { status: {} };
  const pdef = { armor: 0, shield: 0, guard: false };
  const combat = {
    CURSE_META: {},
    addCurse(target, kind, n) { calls.curses.push([kind, n]); hit(); return true; },
    addBlessing(stat, kind, n) { stat.status[kind] = n || 1; calls.blessings.push([kind, n || 1]); hit(); },
    purify(stat) { const had = Object.keys(stat.status); stat.status = {}; hit(); return had; },
  };
  const applyTextEffects = createEffectExecutor({
    combat,
    getAlive: () => [{ name: '假敌', dead: false }],
    getPlayerStatus: () => pstat,
    getPlayerDefense: () => pdef,
    getMode: () => 'boss',
    log: message => { calls.logs.push(message); hit(); },
    escapeHtml: s => s,
    heal: () => {},
    pushFloat: () => {},
    drawCards: () => { hit(); return 2; },
    grantStarterAttack: () => { hit(); },
    markNoDrawNext: () => { hit(); },
    queueDiscover: () => { hit(); },
    randomDiscoverCard: () => ({ name: '临时卡' }),
    addTempCard: () => { hit(); },
    addDeckCard: () => { hit(); },
    allCards: () => [],
    shuffleDeck: () => { hit(); return 0; },
    addEnergy: n => { hit(); return n; },
    addEnergyCap: n => { hit(); return 3 + n; },
  });
  return { applyTextEffects, calls, pstat, pdef };
}

describe('机制句式 × 效果解释器（元测试）', () => {
  it('每条机制句式至少覆盖 19 项（防止清单被悄悄清空）', () => {
    expect(MECH_ALL.length).toBeGreaterThanOrEqual(19);
  });

  it.each(MECH_ALL.map(it => [it.k, it]))(
    '「$k」规范句式能被解释器识别并产生效果',
    (_k, item) => {
      const { applyTextEffects, calls } = makeExecutor();
      const desc = item.tpl(2);
      const res = applyTextEffects({ name: '测试卡' }, desc, null);
      expect(res.did, `句式「${desc}」未产生任何效果（did=false）`).toBe(true);
      expect(calls.effects, `句式「${desc}」未触发任何结算端口`).toBeGreaterThan(0);
    }
  );

  it('sen 正则必须匹配自己的 tpl 输出（制作坊整句移除依赖 sen）', () => {
    for (const item of MECH_ALL) {
      expect(item.sen.test(item.tpl(2)), `sen 未匹配「${item.tpl(2)}」`).toBe(true);
      if (item.cnt) {
        expect(item.cnt.test(item.tpl(3)), `cnt 未匹配「${item.tpl(3)}」`).toBe(true);
      }
    }
  });
});
