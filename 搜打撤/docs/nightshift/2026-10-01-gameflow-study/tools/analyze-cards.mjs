/* analyze-cards.mjs —— 夜班 R8 卡牌库数值分析工具（只读，零依赖）
 *
 * 用途：对搜打撤 Vite 卡牌库做静态数值分析，对应老板 18 节流程第 10 节
 * 「内容与数值制作」的观察问题（弱替代品、费用曲线、敌人威胁、深层收益）。
 *
 * 边界（重要）：
 * - 只读项目文件，不修改、不写入任何 game/ 路径；报告写本目录上级。
 * - 零 npm 依赖，只用 Node 内置模块；node analyze-cards.mjs 直跑。
 * - 通过 module.registerHooks 把项目里的裸 JSON import 映射为模块导出，
 *   使 cards.data.js → cards.catalog.js → data-loader.js 的真实导入链可用，
 *   从而分析的是与运行时同一份数据，而不是自己解析的第二份副本。
 * - 弱卡候选是纯数值信号（同费同型内全维度被压制且无特殊机制关键词），
 *   不是定论；规则文本是否等价需要人工复核（老板 18 节：自动模拟发现极端，
 *   理解与公平感靠真人）。
 *
 * 运行：node analyze-cards.mjs [--json]
 *   --json  额外输出机器可读汇总到 stdout（人类报告照常写文件）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';

/* ---------- 定位项目根（向上找含 package.json 的目录） ---------- */

const here = path.dirname(fileURLToPath(import.meta.url));
let projectRoot = path.resolve(here, '..', '..', '..', '..');
while (!fs.existsSync(path.join(projectRoot, 'package.json'))) {
  const up = path.resolve(projectRoot, '..');
  if (up === projectRoot) throw new Error('未找到项目根（package.json）');
  projectRoot = up;
}
const rel = (p) => path.relative(projectRoot, p).replaceAll('\\', '/');

/* ---------- JSON import 钩子：让 data-loader.js 的裸 JSON import 可用 ---------- */

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.json')) {
      const source = fs.readFileSync(new URL(url), 'utf8');
      return { format: 'module', source: `export default ${source}`, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const cardsDataUrl = pathToFileURL(path.join(projectRoot, 'game/src/cards/cards.data.js')).href;
const ruleConfigUrl = pathToFileURL(path.join(projectRoot, 'game/src/core/rule-config.js')).href;

const { dataSlice } = await import(cardsDataUrl);
let RULES = {};
try {
  const mod = await import(ruleConfigUrl);
  RULES = mod.RULES ?? mod.default ?? {};
} catch {
  console.error('（rule-config.js 导入失败，宝箱/撤离部分将只依据 map.json 与硬编码规则摘录）');
}

/* ---------- 展平卡池 ---------- */

const cards = [];
const seenId = new Map();
for (const [pool, list] of Object.entries(dataSlice)) {
  if (!Array.isArray(list)) continue;
  for (const c of list) {
    if (!c?.id) continue;
    const rec = { ...c, pools: [pool] };
    if (seenId.has(c.id)) {
      seenId.get(c.id).pools.push(pool); // 同 id 多池（TT10/TT11 定版并读）：记录来源不重复计数
      continue;
    }
    seenId.set(c.id, rec);
    cards.push(rec);
  }
}

const isCardLike = (c) => c.type !== '事件'; // 事件卡无费用语义，单独计数

/* ---------- 分析函数 ---------- */

const countBy = (arr, fn) => {
  const m = new Map();
  for (const x of arr) {
    const k = fn(x) ?? '(无)';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const pct = (n, total) => (total ? `${n} (${((n / total) * 100).toFixed(1)}%)` : '0 (0%)');

// 特殊机制关键词：命中即从「纯数值弱卡」候选中豁免（文本效果无法静态比较）。
// 首版跑出 29 候选中大量误报（格挡/吞噬/影蛊等机制卡），二版扩充后收紧。
const SPECIAL = ['发现', '注能', '诅咒', '随机', '若', '每', '消耗', '复活', '交换', '变为', '选择', '全部', '全体', '所有', '附加', '免疫', '复制', '获得', '回复', '抽',
  '降为', '避开', '消灭', '偷取', '迫使', '斗殴', '应对', '翻倍', '净化', '弃', '段', '次', '形态', '吸血', '叠加', '损失', '上限', '复原', '释放', '斗', '潜行', '沉默', '冰冻', '眩晕', '护盾', '格挡', '无视'];

// 文本效果一致性疑点：desc 写了数值效果但对应结构化字段缺失（roadmap M1 逐张校对的机器预筛）。
function findFieldDescMismatches() {
  const out = [];
  for (const c of cards) {
    if (!isCardLike(c)) continue;
    const desc = c.desc ?? '';
    const issues = [];
    const armorM = [...desc.matchAll(/(?:\+|获得)\s*(\d+)\s*(?:点)?(?:甲|护甲)/g)];
    if (armorM.length && (c.armor ?? 0) === 0) {
      issues.push(`desc 写「${armorM.map((m) => m[0]).join('/')}」但 armor 字段=${c.armor ?? '缺'}`);
    }
    const healM = [...desc.matchAll(/(?:回复|恢复)\s*(\d+)\s*点?(?:生命|血)/g)];
    if (healM.length && (c.heal ?? 0) === 0) {
      issues.push(`desc 写「${healM.map((m) => m[0]).join('/')}」但 heal 字段=${c.heal ?? '缺'}`);
    }
    const multiHit = /\d+\s*(?:段|次|×|×)\s*(?:伤害)?/.test(desc) && /\d+\s*段|\d+\s*次|×\s*\d|2\s*回/.test(desc);
    if ((c.dmg ?? 0) > 0 && /(\d+)\s*段|\d+\s*次伤害|连续/.test(desc)) {
      issues.push(`desc 疑似多段伤害但 dmg=${c.dmg}（单段数值）`);
    }
    if (issues.length) out.push({ id: c.id, name: c.name, desc, issues });
  }
  return out;
}

function findWeakCandidates() {
  // 分组键：类型+费用；组内比较可量化维度 dmg/armor/heal/draw
  const groups = new Map();
  for (const c of cards) {
    if (!isCardLike(c) || c.cost == null) continue;
    const key = `${c.type}/${c.cost}费`;
    (groups.get(key) ?? groups.set(key, []).get(key)).push(c);
  }
  const out = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const dims = (c) => [c.dmg ?? 0, c.armor ?? 0, c.heal ?? 0, c.draw ?? 0];
    // 豁免：特殊关键词/结构化 rules/随机区间伤害（未入 dmg 字段的文本伤害无法比较）
    const hasSpecial = (c) => SPECIAL.some((k) => (c.desc ?? '').includes(k)) || c.rules || /\d+\s*[-–~]\s*\d+\s*点/.test(c.desc ?? '');
    for (const a of group) {
      if (hasSpecial(a)) continue;
      for (const b of group) {
        if (a === b || hasSpecial(b)) continue;
        const da = dims(a);
        const db = dims(b);
        const dominated = da.every((v, i) => v <= db[i]) && da.some((v, i) => v < db[i]);
        if (dominated) {
          out.push({ group: key, weaker: a, stronger: b, dimsA: da, dimsB: db });
          break;
        }
      }
    }
  }
  return out;
}

function damageEfficiency() {
  // 只统计有明确 dmg 数值字段的卡；随机/条件伤害在 desc 里，另计数量
  const rows = cards
    .filter((c) => isCardLike(c) && typeof c.dmg === 'number' && c.dmg > 0 && c.cost > 0)
    .map((c) => ({ id: c.id, name: c.name, cost: c.cost, dmg: c.dmg, dmgType: c.dmgType ?? '(无)', per: +(c.dmg / c.cost).toFixed(2), rarity: c.rarity }))
    .sort((a, b) => b.per - a.per);
  const textual = cards.filter((c) => isCardLike(c) && /\d+(-\d+)?点(伤害|法伤)/.test(c.desc ?? '') && c.dmg == null).length;
  return { rows, textualCount: textual };
}

function enemyThreat() {
  // BESTIARY 池：攻血组合与重复度；敌人数值层配在 map.json 遭遇表
  const best = Object.entries(dataSlice).find(([k]) => /BESTIARY|ENEMY|MONSTER/i.test(k));
  if (!best) return null;
  const list = best[1].filter((e) => e?.id);
  const atkHp = list.map((e) => `${e.atk ?? '?'}-${e.hp ?? '?'}`);
  const dup = countBy(atkHp, (s) => s).filter(([, n]) => n > 1);
  return { pool: best[0], total: list.length, dupAtkHp: dup, sample: list.slice(0, 8).map((e) => ({ name: e.name, atkHp: `${e.atk ?? '?'}-${e.hp ?? '?'}` })) };
}

function chestExpectation() {
  // rules.md §1 遭遇定版（2026-10-01 摘录，规则变更须同步更新）：
  // 各层胜利宝箱分布 → 单场战斗期望卡牌数与期望掉币
  const layers = [
    { name: '第1层', dist: [['小', 0.7, 1, 1], ['中', 0.3, 1, 1]] },
    { name: '第2层', dist: [['小', 0.4, 1, 1], ['中', 0.4, 1, 1], ['大', 0.2, 1, 1]] },
    { name: '第3层', dist: [['中', 0.7, 1, 2], ['大', 0.3, 1, 2]] },
    { name: '第4层', dist: [['大', 1.0, 1, 1], ['中', 1.0, 1, 1]] },
    // 注:R7 复审修正——首版给「大」配了 1-2 张区间,误用了第 3 层的掉箱数规则
    // (rules.md:「第 3 层…70% 掉 1 个、30% 掉 2 个」;第 4 层是「固定 1 大 + 1 中」)。
  ];
  const coinBySize = { 小: [1, 1], 中: [1, 2], 大: [2, 3] };
  return layers.map(({ name, dist }) => {
    let cardsExp = 0;
    let coinExp = 0;
    for (const [size, p, cMin, cMax] of dist) {
      const avgCards = (cMin + cMax) / 2;
      const [lo, hi] = coinBySize[size];
      cardsExp += p * avgCards;
      coinExp += p * ((lo + hi) / 2);
    }
    return { layer: name, cardsExp: +cardsExp.toFixed(2), coinExp: +coinExp.toFixed(2) };
  });
}

/* ---------- 输出 ---------- */

const args = process.argv.slice(2);
const total = cards.length;
const eventCards = cards.filter((c) => c.type === '事件').length;
const playable = cards.filter(isCardLike).length;
const costDist = countBy(cards.filter(isCardLike), (c) => (c.cost == null ? '(无费用字段)' : `${c.cost}费`));
const typeDist = countBy(cards.filter(isCardLike), (c) => c.type);
const rarityDist = countBy(cards.filter(isCardLike), (c) => c.rarity);
const pools = Object.entries(dataSlice).map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : '?'}张`).join('、');
const weak = findWeakCandidates();
const mismatches = findFieldDescMismatches();
const dmg = damageEfficiency();
const threat = enemyThreat();
const chests = chestExpectation();
const noRandom = cards.filter((c) => c.unrandom || c.rarity === '衍生' || c.rarity === '传说');

const lines = [];
lines.push('# R8 · 卡牌库数值分析报告');
lines.push('');
lines.push(`> 生成：${new Date().toLocaleString('zh-CN')} · 工具：tools/analyze-cards.mjs（零依赖，只读）`);
lines.push(`> 数据源：${rel(path.join(projectRoot, 'game/src/cards/cards.data.js'))}（运行时同源导入，非手抄副本）+ map.json + rule-config.js`);
lines.push('');
lines.push('## A. 构成与费用曲线');
lines.push('');
lines.push(`- 卡池：${pools}`);
lines.push(`- 去重后共 **${total}** 张：可打牌 ${playable} 张，事件卡 ${eventCards} 张。`);
lines.push(`- 类型分布：${typeDist.map(([k, n]) => `${k} ${n}`).join('、')}`);
lines.push(`- 稀有度分布：${rarityDist.map(([k, n]) => `${k} ${n}`).join('、')}`);
lines.push(`- 费用分布：${costDist.map(([k, n]) => `${k} ${n}`).join('、')}`);
const c2 = costDist.find(([k]) => k === '2费')?.[1] ?? 0;
lines.push(`- 观察：2 费占可打牌 ${pct(c2, playable)}——回合基础能量 2（rules.md §3），2 费 = 整回合只打这一张的「全回合牌」，该档位拥挤意味着多数回合没有第二次出牌决策，值得在试玩中观察。`);
lines.push('');
lines.push('## B. 伤害效率（有明确 dmg 字段、cost>0）');
lines.push('');
lines.push(`- 榜单（每费伤害前 12）：${dmg.rows.slice(0, 12).map((r) => `${r.name} ${r.dmg}/${r.cost}费=${r.per}`).join('、')}`);
lines.push(`- 尾部（每费伤害最低 5）：${dmg.rows.slice(-5).map((r) => `${r.name} ${r.per}`).join('、')}`);
lines.push(`- 另有 ${dmg.textualCount} 张卡的伤害是随机区间/文本描述（如「4-6点」），未入效率榜——这类卡的期望值需要跑局模拟或人工换算。`);
lines.push('');
lines.push('## C. 疑似弱卡候选（纯数值信号，需人工复核）');
lines.push('');
if (weak.length === 0) {
  lines.push('- 无候选：所有同类型同费用组内都不存在纯数值全维度压制。');
} else {
  lines.push('| 组 | 候选弱卡 | 被谁压制 | 数值对比 dmg/armor/heal/draw | 弱卡描述 |');
  lines.push('|---|---|---|---|---|');
  for (const w of weak) {
    lines.push(`| ${w.group} | ${w.weaker.name} (${w.weaker.id}) | ${w.stronger.name} | ${w.dimsA.join('/')} vs ${w.dimsB.join('/')} | ${(w.weaker.desc ?? '').slice(0, 40)} |`);
  }
  lines.push('');
  lines.push('豁免规则说明：desc 含特殊机制关键词（发现/注能/诅咒/随机/无视/条件等）或带 rules 结构化字段的卡不参与比较——文本效果无法静态判定强弱。上表是「数值面被同类全面覆盖」的信号，**不是删除建议**；注意 F 节字段缺失的卡在本表维度可能被低估（如包扎 desc 有 +3血+3甲 但字段全 0），两节须合读；风格化差异（名称/流派归属）也可能是设计意图。');
}
lines.push('');
lines.push('## D. 敌人池与宝箱期望（对应「深层收益是否支撑冒险」）');
lines.push('');
if (threat) {
  lines.push(`- 敌人池 ${threat.pool}：${threat.total} 种；重复攻血组合 ${threat.dupAtkHp.length} 组${threat.dupAtkHp.length ? '（' + threat.dupAtkHp.map(([k]) => k).join('、') + '）' : ''}——同攻血的不同敌人若文本差异也小，遭遇辨识度会打折，实页值得抽查。`);
}
lines.push('');
lines.push('| 层 | 单场战斗期望卡牌 | 期望掉币 |');
lines.push('|---|---|---|');
for (const c of chests) lines.push(`| ${c.layer} | ${c.cardsExp} | ${c.coinExp} |`);
lines.push('');
lines.push('期望按 rules.md §1 宝箱分布计算（小=1卡/1币、中=1卡/1-2币、大=1卡/2-3币；第3层起单箱掉 1-2 个，第4层固定大+中）。深层每战期望卡牌收益更高，但三层以上死亡损失随携带价值上升——「期望收益 × 存活概率」的真实曲线需要 agent 批跑数据，属 R4 假设清单的可验证项。');
lines.push('');
lines.push(`## E. 不可随机获得卡（unrandom/衍生/传说）：${noRandom.length} 张`);
lines.push('');
lines.push(`${noRandom.slice(0, 20).map((c) => c.name).join('、')}${noRandom.length > 20 ? ' 等' : ''}——这些卡只从事件/祭坛/BOSS 等指定途径获得（rules.md §5），是构筑多样性的调节阀：途径曝光率不足时玩家感知不到它们存在。`);
lines.push('');
lines.push(`## F. 字段-文本一致性疑点：${mismatches.length} 张（roadmap M1「逐张校对」的机器预筛）`);
lines.push('');
if (mismatches.length === 0) {
  lines.push('- 未发现疑点。');
} else {
  lines.push('| 卡 | 疑点 | desc 原文 |');
  lines.push('|---|---|---|');
  for (const m of mismatches) {
    lines.push(`| ${m.name} (${m.id}) | ${m.issues.join('；')} | ${m.desc.slice(0, 50)} |`);
  }
  lines.push('');
  lines.push('定性（重要，勿当 bug 清单）：architecture.md 载明卡牌效果存在「文本解释器 + schema v2 结构化」双轨，且“schema 接受形状不等于全部效果已接线”；道具/药水卡（急救合剂等）另有战斗内道具处理路径，可能本来就不消费 heal/dmg 字段。因此本表反映的是**双轨并存的历史分层现状**，不是数据缺陷认定；每一行需人工裁决走的是哪条轨、该补字段还是该改文本。这恰是 roadmap.md M1「逐张校对自然语言词条与结构化字段」的预筛入口——把人工逐张 259 张缩减为人工复核 25 行。');
}
lines.push('');
lines.push('## 方法限制');
lines.push('');
lines.push('- 静态分析：看不到组合强度（老板观察问题②「哪些组合过强」无法静态判定）、随机伤害期望、实际曝光率。');
lines.push('- 弱卡候选是信号不是结论；删除/调整任何卡必须走正规规格流程并留证据。');
lines.push('- 宝箱期望的分布摘自 rules.md（2026-10-01 时点）；规则文档更新后本工具的硬编码表需同步。');
lines.push('');

const reportPath = path.join(here, '..', 'R8-cards-analysis.md');
fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
console.log(`报告已写：${reportPath}`);
console.log(`合计 ${total} 张（可打 ${playable}/事件 ${eventCards}）；弱卡候选 ${weak.length}；效率榜首位 ${dmg.rows[0]?.name ?? '无'}。`);
if (args.includes('--json')) {
  console.log(JSON.stringify({ total, playable, eventCards, costDist, typeDist, rarityDist, weakCount: weak.length, chests }, null, 2));
}
