/* 战斗运行态字段完整性守卫（治理批次 0，2026-09-29）。
 *
 * battle.runtime.* 五片持有全部战斗可变全局（基线 90 个 export let）。
 * 新增/删除一个字段的正确姿势是同步四处：声明、set$Xxx、重开检查点回填、快照输入。
 * 历史上漏同步只靠端到端用例偶然发现。本守卫把「动这份清单」变成显式步骤：
 * 改动任何 runtime 字段必须先更新下方白名单，逼着作者对齐其余同步点。
 *
 * 管辖范围：声明层（export let 名单 + set$ setter 覆盖）。
 * 不管辖：字段取值与语义（那是行为测试的事）。
 * 白名单源自治理批次 0 盘点（session 18 / piles 14 / interaction 16 / effects 35 / presentation 7）。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BATTLE_DIR = resolve(process.cwd(), 'game/src/battle/');

// 显式白名单：文件名 -> export let 名单。顺序不敏感，集合必须逐字一致。
const WHITELIST = {
  'runtime/battle.runtime.session.js': [
    'battleState', 'G', 'foes', 'opts', 'mode', 'energy', 'maxEnergy', 'turn',
    'pdef', 'pstat', 'busy', 'allies', 'battleRestartCheckpoint',
    'restoringRestartCheckpoint', 'tmpSeq', 'activeActionSignal', 'surgeWaiter',
    'lastPersistAt',
  ],
  'runtime/battle.runtime.piles.js': [
    'drawPile', 'hand', 'discard', 'granted', 'played', 'consumed', 'grave',
    'delayed', 'noDrawNext', 'lastDrawnUids', 'zeroFeeUntil', 'cardOverrides',
    'equipped', 'freeCast',
  ],
  'runtime/battle.runtime.interaction.js': [
    'infusing', 'discovering', 'discoverQueue', 'handSelecting', 'choosing',
    'interaction', 'pendingHint', 'viewingGrave', 'viewingDeck', 'viewingBag',
    'selPool', 'selShaN', 'sel', 'lastDeckSel', 'selectingDeck', 'selDeckMax',
  ],
  'runtime/battle.runtime.effects.js': [
    'stealthStrike', 'nextSpellTwice', 'spellCost1', 'meleeCost1',
    'shaTransform', 'consumeFireballN', 'lastPlayedType',
    'playedMartialThisTurn', 'playedMovesThisTurn', 'growthNames', 'growth',
    'infuseFuels', 'sealUnlocked', 'extraTurn', 'deathSave', 'killAtkUp',
    'poisonOnSpell', 'poisonLegacy', 'nestRunes', 'nestSyn', 'timeRune',
    'arrowRune', 'unyieldRune', 'ashRune', 'unlimitedRune', 'holyRune',
    'fireballRuneOn', 'freezeRuneOn', 'swiftRune', 'timeSpaceRune',
    'timeSpaceUsed', 'armorMul', 'sealDone', 'playerCurseImmune',
    'allSpellsInfused',
  ],
  'runtime/battle.runtime.presentation.js': [
    'renderBattle', 'floats', 'cardAnims', 'presentationActionSeq',
    'dreadShown', 'snapCache', 'snapSig',
  ],
};

// 顶层逗号切分：跳过 ()/[]/{}/字符串 内的逗号，再取每个声明符 `=` 前的标识符。
function splitDeclarators(stmt) {
  const parts = [];
  let depth = 0, cur = '', str = null;
  for (const ch of stmt) {
    if (str) { cur += ch; if (ch === str) str = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.map(p => p.split('=')[0].trim()).filter(Boolean);
}

function extractExportLets(src) {
  const names = [];
  for (const m of src.matchAll(/^export let (.+);$/gm)) names.push(...splitDeclarators(m[1]));
  return names.sort();
}

function extractSetters(src) {
  return new Set([...src.matchAll(/^export function set\$(\w+)/gm)].map(m => m[1]));
}

// 09-29 knip C 类批豁免（老板批删）：这些字段的 set$ 写入口全仓零调用（生产+测试+动态
// 拼接三重确认），已删除。字段本身保留——写入走文件内赋值（如 resetRuneFlags）或引用
// 变异（push/pop 等不经 setter 的通道）。新字段默认仍须带 setter，列入本清单要有据。
const SETTER_EXEMPT = new Set([
  // effects：growthNames/growth/timeRune/arrowRune/unyieldRune/ashRune/unlimitedRune/
  // holyRune/fireballRuneOn/freezeRuneOn/swiftRune/timeSpaceRune/armorMul（13，resetRuneFlags 内写入）
  'growthNames', 'growth', 'timeRune', 'arrowRune', 'unyieldRune', 'ashRune',
  'unlimitedRune', 'holyRune', 'fireballRuneOn', 'freezeRuneOn', 'swiftRune',
  'timeSpaceRune', 'armorMul',
  // piles：granted/played/zeroFeeUntil/cardOverrides（4，引用变异+存档回填写）
  'granted', 'played', 'zeroFeeUntil', 'cardOverrides',
  // presentation：renderBattle/floats/cardAnims/presentationActionSeq/dreadShown/
  // snapCache/snapSig（7，view 侧引用变异）
  'renderBattle', 'floats', 'cardAnims', 'presentationActionSeq', 'dreadShown',
  'snapCache', 'snapSig',
  // session：tmpSeq（1）
  'tmpSeq',
]);

describe('战斗运行态字段完整性守卫', () => {
  it('runtime 五片 export let 集合与白名单逐字一致', () => {
    for (const [file, expected] of Object.entries(WHITELIST)) {
      const src = readFileSync(resolve(BATTLE_DIR, file), 'utf8');
      const actual = extractExportLets(src);
      expect(actual, `${file} 的 export let 名单与白名单不一致`).toEqual([...expected].sort());
    }
  });

  it('每个 runtime 可变全局都有对应的 set$ 写入口（豁免清单除外）', () => {
    for (const [file, names] of Object.entries(WHITELIST)) {
      const src = readFileSync(resolve(BATTLE_DIR, file), 'utf8');
      const setters = extractSetters(src);
      const missing = names.filter(n => !setters.has(n) && !SETTER_EXEMPT.has(n));
      expect(missing, `${file} 缺少 set$ 写入口的字段`).toEqual([]);
    }
  });

  it('白名单总数 = 90（改动即红灯，防止静默增减）', () => {
    const total = Object.values(WHITELIST).reduce((n, list) => n + list.length, 0);
    expect(total).toBe(90);
  });
});
