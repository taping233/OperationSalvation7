/* 游戏全书生成器（2026-09-16 留言「把游戏中的所有系统做成标准化分章节文档，与游戏一一对应」）。
 *
 * buildCompendium() 读取已装配的运行时卡牌库（window.SDT.Cards，须先 import cards.js 并
 * ensureTabletop）与 game/data/*.json，拼出 docs/game-compendium.md 的 Markdown 全文。
 *
 * 生成入口：tests/compendium.test.js（vitest 的 jsdom 环境才能加载 cards.js 的 JSON 数据链），
 * 也可 `npm run docs:compendium`。文档即快照，重跑即同步；手改会被下一次生成覆盖。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function buildCompendium({ Cards, syncData, achievements, pets, scenes, mapData, generatedAt }) {
  const all = Cards.all();
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|');
  const byType = {};
  for (const c of all) (byType[c.type] = byType[c.type] || []).push(c);
  const RAR_ORDER = ['传说', '史诗', '稀有', '职业', '棱彩', '古朴', '初始', '衍生'];
  const rarOf = (c) => (Cards.rarityOf ? Cards.rarityOf(c) : (c.rarity || '—'));
  const rarRank = (c) => { const i = RAR_ORDER.indexOf(rarOf(c)); return i < 0 ? 99 : i; };

  const ch = (n, t) => `\n## ${n} ${t}\n`;
  const cardRow = (c) => {
    const cls = c.cls ? esc(c.cls) : '通用';
    const cost = c.cost != null ? c.cost : '—';
    return `| ${esc(c.name)} | ${cost} | ${esc(rarOf(c))} | ${cls} | ${esc(String(c.desc || '').replace(/\n/g, ' '))} |`;
  };
  const cardTable = (list) =>
    `| 卡牌 | 费用 | 稀有度 | 职业 | 描述 |\n| --- | --- | --- | --- | --- |\n` +
    list.slice().sort((a, b) => rarRank(a) - rarRank(b) || String(a.name).localeCompare(b.name, 'zh')).map(cardRow).join('\n');

  const TYPE_TITLES = { '武术': '招式（武术）', '法术': '法术', '装备': '装备', '道具': '道具', '资源': '资源', '能力卡': '能力卡', '事件': '事件', '生物': '生物（敌人图鉴）' };
  const typeOrder = Object.keys(TYPE_TITLES).filter(t => byType[t]?.length);
  const total = all.length;
  const sceneList = Array.isArray(scenes) ? scenes : (scenes.scenes || []);
  const achList = Array.isArray(achievements) ? achievements : (achievements.achievements || []);
  const petList = Array.isArray(pets) ? pets : (pets.list || []);

  return `# 搜打撤 · 代号7 游戏全书（自动生成）

> 本文档由 \`scripts/generate-compendium.mjs\` 直接读取游戏运行时数据源生成（生成日期 ${generatedAt}），
> 卡牌表、敌人表、成就、宠物均与代码一一对应；重跑 \`npm run docs:compendium\` 即重新同步。
> 请勿手改本文件——机制疑义以 \`game/src/\` 源码为准，本文给出每章的数据出处。
>
> 覆盖批次：cards-sync v${syncData.version}（退役 ${syncData.retire.length} 张）；全书卡牌共 **${total} 张**。
${ch('1', '游戏概览')}
- 玩法循环：**搜**（搜刮地图与物资）→ **打**（卡牌战斗）→ **撤**（携带战利品撤离入库）。
- 一局流程：基地出发整备 → 空降外圈 → 逐层深入（4 层定版地图）→ 第 4 层祭坛 → 首脑战 → 撤离整理入库。
- 局外成长：人物熟练度、仓库、收藏图鉴、宠物、成就（\`game/src/hub/meta.js\`、\`base.js\`）。
${ch('2', '对局规则与常量')}
- 玩家规则文档：\`docs/rules.md\`；数值常量真源：\`game/src/core/rules.js\`（能量、手牌上限、初始攻击数量、抽牌节奏、骰子面数）。
- 地图定版：\`game/src/run/map-generator.js\`（layoutVersion 配额：每层战斗/宝箱/事件/物资格上下限、火堆与补给站恒 1；第 4 层固定「祭坛 → 首脑 → 终局撤离点」纵深，撤离点须击败首脑解锁）。
- 地图静态表：\`game/data/map.json\`（棋盘 ${esc(mapData.boardName || mapData.boardId || '')} · ${mapData.cols || '?'}×${mapData.rows || '?'} 格）。
${ch('3', '战斗系统')}
- 流程实现：\`game/src/battle/battle.core.js\`（状态机 + 动作队列，异步演出在动作内等待）、\`battle.rules.js\`（打出校验）、\`battle.deck.js\`（牌库/墓地，仅 BOSS 战有牌库）。
- 伤害口径：\`game/src/battle/combat.js\`（攻击 = 角色攻击 + 卡面修正；法术受法伤加成；固定伤害无视强化；护甲/格挡/护盾减免）。
- 诅咒与祝福：\`combat.js\` CURSES/BUFFS（中毒、流血、灼烧、冰冻、沉默、破甲、禁疗等；灼烧同为诅咒口径）。
- 注能：卡面「注能」角标主动进入（消耗 N 张手牌强化打出；镭射等可不注能直接打出）；「被注能时」句随注能结算。
- 指向卡：拖拽 / 点击点选目标；群体卡自动全体；背包砸击为手牌左侧按钮（2 费 · 4 点固定伤害）。
${ch('4', '卡牌系统')}
- 卡牌总注册表（含全部播种批次与实机同步覆盖）：共 **${total} 张**。
- 数据链路：\`game/src/cards/cards.js\` 各 TABLETOP/BESTIARY 批次 → \`game/data/cards-sync.json\`（v${syncData.version}）按 id 整卡覆盖 / 补种 / 退役，旧档按版本号重播刷新。
- 稀有度：${RAR_ORDER.join('、')}（衍生牌不进任何随机/发现/商店池；「初始」「职业」同样被随机池排除）。
- 退役名单（旧档自动清理）：${syncData.retire.map(esc).join('、')}。
- 装备「主动技能：」句穿戴后由角色信息区技能按钮每场发动一次（旧措辞「限定技能」兼容识别）。
${ch('5', '卡牌全表')}
${typeOrder.map(t => `### ${TYPE_TITLES[t]}（${byType[t].length} 张）\n\n${cardTable(byType[t])}\n`).join('\n')}
${ch('6', '局外系统索引')}
| 系统 | 实现 | 说明 |
| --- | --- | --- |
| 基地/仓库/升级/商店 | \`game/src/hub/game.hub.js\`、\`base.js\` | 出发整备、仓库卖/藏、木材口粮升级、口袋钥匙复原、局外商店（储备币购基础卡） |
| 背包/安全格/容器 | \`game/src/hub/game.bag.js\` | 背包格、安全格（抢运保护，界面位于消耗口袋下方）、消耗口袋、珍珠盒（3×3 资源空间）、锦囊（存 3 法术）、放大界面点击移动 |
| 对局地图 | \`game/src/run/game.run.flow.js\`、\`map-generator.js\`、\`expedition.view.js\` | 节点行军、物资格/宝箱/事件/商店/火堆/祭坛/撤离点 |
| 商店（局内） | \`game/src/run/game.run.shop.js\` | 战术补给站、收购台、神秘货箱（问号卡面、面板内不重复刷新、买后亮卡） |
| 祭坛 | \`game/src/run/game.run.altar.js\` | 碎片兑换能力卡、献祭、复原、撤离整理（全部入库 / 智能整理） |
| 首脑战 | \`game/src/battle/battle.core.js\`、\`game.nest.js\` | 开战装备勾选制、首脑死亡立即结束、保险柜、战后整理（全部带走 / 智能选择） |
| 存档 | \`game/src/hub/game.storage.js\` | 五档位、战斗快照随对局存档、旧档卡库刷新与 retire 清理 |
${ch('7', '事件与场景')}
- 场景数据真源：\`game/data/scenes.json\`（${sceneList.length} 个场景定义）；事件叙事真源 \`narrative/\`（编译脚本 \`scripts/compile-narrative.mjs\`）。
${ch('8', '成就')}
- 数据真源：\`game/data/achievements.json\`（共 ${achList.length} 项；解锁与奖励逻辑 \`game/src/hub/meta.js\`）。

| 成就 | 说明 |
| --- | --- |
${achList.map(a => `| ${esc(a.name || a.title || a.id)} | ${esc(a.desc || a.hint || a.condition || '')} |`).join('\n')}
${ch('9', '宠物')}
- 数据真源：\`game/data/pets.json\`（共 ${petList.length} 只；携带效果与升级 \`game/src/hub/base.js\`）。

| 宠物 | 说明 |
| --- | --- |
${petList.map(p => `| ${esc(p.name || p.id)} | ${esc(p.desc || p.perk || '')} |`).join('\n')}
`;
}
