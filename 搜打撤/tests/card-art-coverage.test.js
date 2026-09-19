/* 卡面实装守卫（2026-09-12 盗宝落错名事故后老板令"永久解决"）：
 *
 * 坑的成因：cards.js 多池并存（旧职业池 + TABLETOP11 现役池），同一张卡可能换过 id
 * （cc-treasure → cmtn1i64j7y7 这类），而 art.js 按 `cards/<族>-<cardId>.webp` 找图。
 * 出图批次如果按旧 id 落地，文件成了死图、现役 id 反而缺图，玩家看到的还是旧图。
 *
 * 双层守卫：
 *   1. 孤儿检测 —— assets/cards 下三族专属图（martial-/spell-/equip-<id>.webp）的 id
 *      必须存在于现役卡库；不在 = 落错名的死图（KNOWN_ORPHANS 白名单 = 已获批/待批的
 *      历史遗留，新孤儿直接红灯）。
 *   2. 定稿卡面清单 —— LANDMARK_ART 显式登记"老板已验收必须有专属图"的卡 id。
 *      每实装一批新图就把 id 登记进来；清单里有 id 缺文件 = 直接红灯。
 *
 * 同步链与 battle-all-cards.test.js 同口径（ensureSha/Starters/Tabletop 含 TT11 退役替换），
 * all() 结果即实机现役卡库。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
await import('../game/src/cards.js');
const C = window.SDT.Cards;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARDS_DIR = path.join(ROOT, 'game', 'assets', 'cards');
const FAMILIES = ['martial', 'spell', 'equip'];

// 已知历史死图白名单（退役 id 的旧文件）。删除需老板批准；批准后从数组移除并删文件。
const KNOWN_ORPHANS = [
  'martial-cc-treasure',      // 盗宝旧 id（现役=cmtn1i64j7y7 已有图），2026-09-12 落错名事故遗留
  'martial-cc-jianghu',       // 江湖救急旧 id（现役=cmtn1wnhhym 已有图），同上
  'spell-cc-manasupply',      // 法力补给旧 id 死图（现役 tt7-maxsupply 已有图）
  'martial-melee',            // art.js 通用兜底图（按卡名规则引用，非按 id），合法非死图
  'martial-ranged',           // 同上
  'equip-tt3-dark-blade',     // 灭魔之剑整卡退役（2026-09-16 留言「删除灭魔之剑」），专属图成为已批死图
  'martial-builtin-sha',      // 「杀」改名 starter-attack（2026-09-20 affecbc）后暴露的旧 id 图，待老板批去留
];

// 老板已验收定稿、必须有专属图的卡（现役 id）。每实装一批新图在此登记。
const LANDMARK_ART = [
  // 侠客职业卡重做批次（2026-09-12 验收实装）
  'martial-tt7-throwblade',      // 飞刃偷袭（F 版特写）
  'martial-cmtn1i64j7y7',        // 盗宝（半身抱金箱；旧 id cc-treasure）
  'martial-cmtn1wnhhym',         // 江湖救急（半身接瓶；旧 id cc-jianghu）
  'martial-tt7-sneak',           // 偷袭
  'martial-tt7-thundergrudge',   // 快意恩仇
  'martial-tt7-meteorrain',      // 流星箭雨
  'martial-tt7-stealth',         // 潜匿
  'martial-tt7-swordimmortal',   // 剑仙形态
  // 装备卡横版重出（2026-09-12 整剑入画口径）
  'equip-tt8-demonslay',         // 诛魔剑
  'equip-tt8-archdemon',         // 天启诛魔剑
  // 无专属新定（2026-09-12 老板拍板 cls=侠客 + 专属卡面）
  'martial-tt7-imitate',         // 不变应万变（静立环刃）
];

let allCards;
beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
  allCards = C.all();
});

describe('卡面实装守卫：孤儿检测', () => {
  it('三族专属图文件的 id 必须存在于现役卡库（或已知死图白名单）', () => {
    const ids = new Set(allCards.map(c => c.id));
    const orphans = [];
    for (const fam of FAMILIES) {
      for (const name of readdirSync(CARDS_DIR)) {
        if (!name.startsWith(`${fam}-`) || !name.endsWith('.webp')) continue;
        const id = name.slice(fam.length + 1, -'.webp'.length);
        if (!ids.has(id) && !KNOWN_ORPHANS.includes(`${fam}-${id}`)) orphans.push(`${fam}-${id}`);
      }
    }
    expect(orphans, `发现落错名的死图（现役卡库无此 id）: ${orphans.join(', ')}——` +
      `应改名为现役 id 文件，或确认后加入 KNOWN_ORPHANS 白名单（删除需老板批准）`).toEqual([]);
  });
});

describe('卡面实装守卫：定稿卡面清单', () => {
  it('LANDMARK_ART 登记的每张卡都有对应专属图文件', () => {
    const missing = LANDMARK_ART.filter(key => !existsSync(path.join(CARDS_DIR, `${key}.webp`)));
    expect(missing, `定稿卡面缺文件: ${missing.join(', ')}`).toEqual([]);
  });

  it('LANDMARK_ART 的 id 都能在现役卡库找到（防登记时又用旧 id）', () => {
    const ids = new Set(allCards.map(c => c.id));
    const stale = LANDMARK_ART.filter(key => {
      const id = key.replace(/^(martial|spell|equip)-/, '');
      return !ids.has(id);
    });
    expect(stale, `清单里登记的是退役/不存在 id: ${stale.join(', ')}——请改用现役 id 登记`).toEqual([]);
  });
});
