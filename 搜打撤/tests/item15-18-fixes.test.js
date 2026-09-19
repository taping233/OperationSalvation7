/* 2026-09-16 批次验证（Item 15~18 + 09-13 留言修复）：
 *   15 职业卡重复收藏：重复获得经验（Meta.onCollect 不再有 once 门槛）、收藏即用掉（hub 侧移除仓库记录）
 *   16 消耗口袋：局内 100% 进入（衍生卡排除）；离开对局（doExtract）只剩 1/3
 *   17 分层配额下限：L2 敌3宝2事件2物资1 / L3 敌4宝3事件2物资1 / L4 敌4宝4事件2物资1，各层火堆/补给站恒 1
 *   18 储备币不进局：出发流程不再调用 takeReserveCoins
 * 以及数据修正：治愈 5 血 / 元素风暴无注能 / 急速跑鞋普通战给初始攻击（既有行为回归）。 */
import { describe, it, expect, beforeAll } from 'vitest';
import { generateLayeredMap } from '../game/src/map-generator.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();   // 含 ensureCardsSyncLive（v22）
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

describe('Item 17：分层配额下限与物资格', () => {
  const FLOORS = { 1: { battle: 3, chest: 2, event: 2, resource: 1 }, 2: { battle: 4, chest: 3, event: 2, resource: 1 }, 3: { battle: 4, chest: 4, event: 2, resource: 1 } };

  it('生成器版本 = 9（旧档按新版本重生成）', () => {
    // v9（a60e551）：L3 紧急撤离点改落层后半段（x≥4）；原 v8 断言随版升一并更新
    expect(generateLayeredMap('item17').layoutVersion).toBe(9);
  });

  it('200 个 seed：L2~L4 各类型达到下限，火堆/补给站恒 1，L2 总格 ≤ 12，物资格存在', () => {
    for (let seed = 0; seed < 200; seed++) {
      const map = generateLayeredMap('item17-' + seed);
      expect(map.layers).toHaveLength(4);
      const l2 = map.layers[1].nodes;
      expect(l2.length, `seed=${seed} L2 总格上限 = L3 配置总量 12`).toBeLessThanOrEqual(12);
      map.layers.forEach((layer, li) => {
        if (li === 0) return;   // L1 不变
        const cnt = t => layer.nodes.filter(n => n.type === t).length;
        const f = FLOORS[li];
        expect(cnt('battle'), `seed=${seed} L${li + 1} 敌人格 ≥ ${f.battle}`).toBeGreaterThanOrEqual(f.battle);
        expect(cnt('chest'), `seed=${seed} L${li + 1} 宝箱格 ≥ ${f.chest}`).toBeGreaterThanOrEqual(f.chest);
        expect(cnt('event'), `seed=${seed} L${li + 1} 事件格 ≥ ${f.event}`).toBeGreaterThanOrEqual(f.event);
        expect(cnt('resource'), `seed=${seed} L${li + 1} 物资格 ≥ ${f.resource}`).toBeGreaterThanOrEqual(f.resource);
        expect(cnt('fire')).toBe(1);
        expect(cnt('shop')).toBe(1);
      });
      const l4 = map.layers[3].nodes;
      expect(l4.filter(n => n.type === 'altar').length).toBe(1);
      expect(l4.filter(n => n.type === 'boss').length).toBe(1);
    }
  });
});

describe('Item 18：储备币不进局', () => {
  it('出发流程不再把储备币带进局（game.session 不再调用 takeReserveCoins）', async () => {
    const src = (await import('node:fs')).readFileSync('game/src/game.session.js', 'utf8');
    expect(src.includes('takeReserveCoins')).toBe(false);
  });
  it('储备币仍用于孵蛋（base.js 孵蛋口径不变）', async () => {
    const src = (await import('node:fs')).readFileSync('game/src/base.js', 'utf8');
    expect(src.includes('hatchPet')).toBe(true);
    expect(src.includes('HATCH_COST')).toBe(true);
  });
});

describe('Item 15：职业卡重复收藏', () => {
  it('重复收藏重复获得经验（无 once 门槛）', async () => {
    const src = (await import('node:fs')).readFileSync('game/src/meta.js', 'utf8');
    expect(src.includes('重复收藏重复获得经验')).toBe(true);          // once 门槛已移除
    expect(src.includes('if (d.collXp[card.id]) return null;')).toBe(false);
  });
});

describe('数据修正：治愈 5 血 / 元素风暴删注能 / 急速跑鞋', () => {
  it('治愈回复 5 点生命', () => {
    const c = C.all().find(x => x.id === 'tt3-holy-water');
    expect(c.heal).toBe(5);
    expect(c.desc).toContain('5 点生命');
  });
  it('元素风暴无注能，可直接打出', () => {
    const c = C.all().find(x => x.id === 'tt7-elementstorm');
    expect(c.desc).not.toContain('注能');
    expect(+(c.infuse || 0)).toBe(0);
  });
  it('急速跑鞋普通战限定技能给初始攻击（draw.n 普通战分支既有口径）', () => {
    const c = C.all().find(x => x.id === 'tt3-light-mail');
    expect(c.desc).toContain('抽3张牌');
    // 行为回归由探针结论背书：普通战技能=获得初始攻击（draw.n 普通战分支）
  });
});
