/* 游戏全书生成（2026-09-16 留言「所有系统做成标准化分章节文档，与游戏一一对应」）：
 * 在 vitest jsdom 环境装配真实卡牌库后重建 docs/game-compendium.md，
 * 并校验文档与运行时数据一致（卡牌计数、退役卡不出现、时点词条样例存在）。 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCompendium } from '../scripts/generate-compendium.mjs';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const Cards = window.SDT.Cards;
const DATA = (await import('../game/src/data-loader.js')).DATA;

const OUT = join(process.cwd(), 'docs', 'game-compendium.md');

let md = '';
beforeAll(() => {
  Cards.ensureTabletop();
  md = buildCompendium({
    Cards,
    syncData: DATA.cardsSync,
    achievements: DATA.achievements,
    pets: DATA.pets,
    scenes: DATA.scenes,
    mapData: DATA.map,
    generatedAt: new Date().toISOString().slice(0, 10),
  });
  writeFileSync(OUT, md, 'utf-8');
});

describe('游戏全书与运行时数据一一对应', () => {
  it('文档已重建且含全部类型章节', () => {
    expect(md).toContain('# 搜打撤 · 代号7 游戏全书');
    for (const t of ['招式（武术）', '法术', '装备', '道具', '资源', '能力卡']) expect(md).toContain(t);
  });

  it('卡牌计数与 Cards.all() 一致', () => {
    const m = md.match(/全书卡牌共 \*\*(\d+) 张\*\*/);
    expect(+m[1]).toBe(Cards.all().length);
  });

  it('退役卡不再出现（灭魔之剑/桃；恶魔之力为 cc-demon 正式卡仍应在册）', () => {
    expect(md).not.toContain('灭魔之剑');
    expect(md).not.toContain('| 桃 ');
    expect(md).toContain('恶魔之力');
  });

  it('新定版样例入册：火球衍生、自然法杖/灵符稀有、主动技能措辞、时点词条', () => {
    expect(md).toMatch(/\| 火球 \| 1 \| 衍生 \|/);
    expect(md).toMatch(/\| 自然法杖 \| 0 \| 稀有 \|/);
    expect(md).toMatch(/\| 灵符 \| 0 \| 稀有 \|/);
    expect(md).toContain('主动技能：选择 1 张卡牌');
    expect(md).toContain('对战开始时，额外抽 2 张牌。');
  });
});
