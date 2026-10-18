/* 游戏全书生成器（2026-09-16 留言「把游戏中的所有系统做成标准化分章节文档，与游戏一一对应」）。
 *
 * buildCompendium() 读取已装配的运行时卡牌库（window.SDT.Cards，须先 import cards.js 并
 * ensureTabletop）与 game/data/*.json，拼出 docs/game-compendium.md 的 Markdown 全文。
 *
 * 生成入口：tests/compendium.test.js（vitest 的 jsdom 环境才能加载 cards.js 的 JSON 数据链），
 * 也可 `npm run docs:compendium`。文档即快照，重跑即同步；手改会被下一次生成覆盖。
 */
import { RULE_CONFIG } from '../game/src/core/rule-config.js';

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
  const sceneDefinitions = Array.isArray(scenes) ? scenes : (scenes?.scenes ?? []);
  const sceneList = Array.isArray(sceneDefinitions) ? sceneDefinitions : Object.values(sceneDefinitions);
  const achList = Array.isArray(achievements) ? achievements : (achievements.achievements || []);
  const petList = Array.isArray(pets) ? pets : (pets.list || []);

  return `# 搜打撤 · 代号7 游戏全书（自动生成）

> 本文档由 \`scripts/generate-compendium.mjs\` 直接读取游戏运行时数据源生成（生成日期 ${generatedAt}），
> 卡牌表来自装配后的卡库，成就、宠物与场景计数来自传入数据；机制章节提供现行来源导航。
> 本文是生成时点的快照；通过 \`npm run docs:compendium\` 更新，详细行为在 \`docs/rules.md\` 维护，生成文件勿手改。
>
> 覆盖批次：cards-sync v${syncData.version}（退役 ${syncData.retire.length} 张）；全书卡牌共 **${total} 张**。
${ch('1', '游戏概览')}
- 玩法循环：**搜**（搜刮地图与物资）→ **打**（卡牌战斗）→ **撤**（携带战利品撤离入库）。
- 一局流程：基地出发整备 → 空降外圈 → 逐层深入（4 层定版地图）→ 第 4 层祭坛 → 首脑战 → 撤离整理入库。
- 局外成长：人物熟练度、仓库、收藏图鉴、宠物、成就（\`game/src/hub/meta.js\`、\`base.js\`）。
${ch('2', '对局规则与常量')}
- 玩家规则文档：\`docs/rules.md\`；基础数值源为 \`game/src/core/rule-config.js\`，\`game/src/core/rules.js\` 提供兼容门面。
- 基础战斗规则：每回合 ${RULE_CONFIG.battle.energy} 能量，手牌上限 ${RULE_CONFIG.battle.handMax}；首脑战初始抽 ${RULE_CONFIG.battle.startDraw} 张、每回合抽 ${RULE_CONFIG.battle.turnDraw} 张，编组 ${RULE_CONFIG.battle.bossDeckSize} 张并加入 ${RULE_CONFIG.battle.starterAttack} 张初始攻击。具体效果与例外查玩家规则。
- 新局地图由 \`game/src/run/map-generator-v4.js\` 按种子生成，第1/3层仅火堆、第2/4层仅商店，恢复使用已校验快照；\`game/data/map.json\` 提供内容配置（${Object.keys(mapData?.monsters || {}).length} 个敌人模板），旧棋盘元数据不描述当前地图几何。
${ch('3', '战斗系统')}
- 流程入口：\`game/src/battle/core/battle.core.js\` 提供命令与快照；\`game/src/battle/effects/battle.target-rules.js\` 提供目标及打出限制，\`game/src/battle/bag/battle.deck.js\` 管理牌堆。
- 伤害与防御计算：\`game/src/battle/core/combat.js\`；详细伤害类型、诅咒、祝福与例外见 \`docs/rules.md\`。
- 诅咒与祝福：\`combat.js\` CURSES/BUFFS（中毒、流血、冰冻、沉默、破甲、禁疗、攻击降低等）。
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
| 四层首脑战 | \`game/src/battle/core/battle.core.js\`、\`game/src/battle/core/battle.lifecycle.js\` | 编组、战斗、首脑奖励与战后整理；完成状态查对应任务证据 |
| 研究所兼容玩法 | \`game/src/run/game.nest.js\` | 既有兼容实现；开发与验收范围见制作章程 |
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
