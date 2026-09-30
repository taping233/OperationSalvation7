/* ============================================================
 * 搜打撤 —— 零依赖自测脚本（不进游戏页面，命令行直接跑）
 *
 * 运行方式（任一）：
 *   powershell -Command "$env:ELECTRON_RUN_AS_NODE=1; ..\..\desktop\electron\electron.exe selftest.js"
 *   或任何 node：node selftest.js
 *
 * v0.52（ESM 迁移后）：
 *   行为类检查（combat 自测 / cards 词条 / base 档位 / meta 成就）
 *   已迁移至 Vitest（../../tests/，npm test）。本脚本保留：
 *   1. 全部 src/*.js 的 ESM 语法解析（acorn）
 *   2. 源码契约的正则抽查（关卡/场景/音频/战斗/背包接线）
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// game.run.* 为架构批次 4 拆出的局内流程模块（scenes→altar→flow），与壳合并扫描；
// 2026-09-22 六文件重构批1-5 拆出的切片一并并入（effect-steps/cards/hub/bag/battle.view 各片）。
// 2026-10-01（ROOT-06）：路径按现行域目录更新（src/ 顶层平铺时代已结束）。
const GAME_PARTS = ['run/game.session.js', 'ui/game.menu.js', 'run/game.run.data.js', 'run/game.run.js', 'run/game.run.scenes.js', 'run/game.run.altar.js', 'run/game.run.flow.js',
  'battle/effects/effect-steps.ctx.js', 'battle/effects/effect-steps.gates.js', 'battle/effects/effect-steps.curse.js', 'battle/effects/effect-steps.damage.js', 'battle/effects/effect-steps.recovery.js', 'battle/effects/effect-steps.kills.js', 'battle/effects/effect-steps.deck.js', 'battle/effects/effect-steps.rules.js', 'battle/effects/effect-steps.audit.js', 'battle/effects/effect-steps.tail.js',
  'cards/cards.consts.js', 'cards/cards.rules.js', 'cards/cards.data.js', 'cards/cards.sync.js',
  'hub/game.hub.js', 'hub/game.hub.depart.js', 'hub/game.hub.pages.js', 'hub/game.hub.bridge.js',
  'hub/game.bag.js', 'hub/game.bag.drag.js', 'hub/game.bag.settle.js', 'hub/game.bag.bridge.js',
  'hub/game.notes.js', 'hub/game.cardslib.js', 'game.boot.js'];
const BATTLE_PARTS = ['battle/core/battle.core.js', 'battle/runtime/battle.runtime.js', 'battle/core/battle.engine.js', 'battle/core/battle.enemy-phase.js',
  'battle/view/battle.view.js', 'battle/view/battle.overlays.js', 'battle/view/battle.layers.js',
  'battle/view/battle.vfx.js', 'battle/view/battle.anim.view.js', 'battle/view/battle.aim.js', 'battle/view/battle.hover.js'];
const src = (p) => {
  if (p === 'game.js') return GAME_PARTS.map(f => fs.readFileSync(path.join(HERE, 'src', f), 'utf8')).join('\n');
  if (p === 'battle.js') return BATTLE_PARTS.map(f => fs.readFileSync(path.join(HERE, 'src', f), 'utf8')).join('\n');
  return fs.readFileSync(path.join(HERE, 'src', p), 'utf8');
};

let failed = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) { failed++; console.log(`✘ ${name}: 期望 ${want}，得到 ${got}`); }
  else console.log(`✔ ${name}`);
};

// 1: 全部 src/*.js ESM 语法解析
for (const f of fs.readdirSync(path.join(HERE, 'src')).filter(f => f.endsWith('.js'))) {
  try { parse(src(f), { ecmaVersion: 'latest', sourceType: 'module' }); console.log(`✔ ${f} 语法 OK`); }
  catch (e) { failed++; console.log(`✘ ${f} 语法错误：${e.message}`); }
}

// 2: 源码契约正则抽查（game.js 依赖完整 DOM，命令行只验接线与契约）
// 批次2（2026-09-11）：数据表已外置到 game/data/*.json，数据类契约改从 JSON 读取
const gameSource = src('game.js');
const mapSource = src('core/mapData.js');
const DATA_DIR = path.join(HERE, 'data');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
const mapJson = readJson('map.json');
const scenesJson = readJson('scenes.json');
const mapRisks = new Set(mapJson.encounters.map(e => e.risk));
check('关卡·三环风险梯度已声明', mapRisks.has('低') && mapRisks.has('中') && mapRisks.has('高'), true);
const eliteChances = mapJson.encounters.filter(e => e.elite).map(e => e.elite.chance);
check('关卡·巨兽精英概率已声明（第3层3% / 第4层10%）', eliteChances.includes(0.03) && eliteChances.includes(0.10), true);
const mapStrategies = mapJson.encounters.map(e => e.strategy || '');
check('遭遇·策略预告元数据', mapStrategies.some(s => s.startsWith('试探')) && mapStrategies.some(s => s.startsWith('核心区')), true);
const eventSceneIds = JSON.stringify(scenesJson.eventSceneMeta);
check('场景·10 张事件 sceneId 覆盖', ['timeskip','demondeal','bandits','mystery','goldmine','goldhammer','relief','airdrop','chestdraw','systemsupply'].every(k => eventSceneIds.includes(`event-${k}`)), true);
check('场景·标准节点与拾取契约', /scene-battle-bg/.test(gameSource) && /scene-extract-bg/.test(gameSource) && /scene-pickup-key/.test(gameSource), true);
check('场景·落脚进入全屏房间链', /UI\.beginRoom\(\)/.test(gameSource) && /_roomActive/.test(src('ui/ui.js')), true);
check('音频·Howler 指定 MP3 作为循环 BGM', /from 'howler'/.test(src('audio/sound.js')) && /bgm-sour-orange-earth\.mp3/.test(src('audio/sound.js')) && /new Howl\(\{[^}]*loop:\s*true/s.test(src('audio/sound.js')), true);
check('战斗·意图轮转与 DOM 接线', /function intentFor/.test(src('battle.js')) && /foe\.intent = intentFor\(foe, turn\)/.test(src('battle.js')) && /sts-intent/.test(src('battle.js')), true);
// 拖牌指向已从静态 data-aim 属性迁移为渲染后写入 dataset.aim；守护真实接线而非旧实现细节。
check('战斗·拖牌 Pointer Events 接线保留', /pointerdown/.test(src('battle.js')) && /dataset\.aim/.test(src('battle.js')) && /drag-over/.test(src('battle.js')), true);
// 2026-10-01（ROOT-06）：意图元数据已迁 battle/core/battle.enemy-intent.js 的 INTENT_META
//（军威强化文案改写为「回合末强化」），契约改指现行真源。
check('BOSS·三类独立意图模式', (() => {
  const intentSrc = src('battle/core/battle.enemy-intent.js');
  return /general:[^\n]*回合末强化/.test(intentSrc) && /orc_boss:[^\n]*双击/.test(intentSrc) && /element_boss:[^\n]*庇幕/.test(intentSrc);
})(), true);
check('敌人·全部图鉴具备行为钩子', Object.values(mapJson.monsters).length > 0
  && Object.values(mapJson.monsters).every(m => !!m.behavior), true);
check('事件·二选一与三选一分支', (() => {
  // v0.52 起事件分支文本真源在 narrative/events.ink（经 scripts/compile-narrative.mjs 编译）
  const ink = fs.readFileSync(path.join(HERE, '..', 'narrative', 'events.ink'), 'utf8');
  return /tt6_goldmine[\s\S]*?收下 3 币/.test(ink) && /tt6_airdrop[\s\S]*?应急处理/.test(ink) && /tt6_chestdraw[\s\S]*?密封物资箱/.test(ink);
})(), true);
check('兼容·未知事件仍走旧效果', /return null;/.test(gameSource) && /applyEventEffect\(card\)/.test(gameSource), true);
// 2026-10-01（ROOT-06）：bossCleanupPending 已随整理背包（Item 16）退役；现行契约是
// 09-09 定版「战斗中开背包转战斗背包」（hub/game.bag.js）。
check('BOSS·战斗阶段背包入口转战斗背包', /if \(game\.battleActive\) \{[\s\S]{0,200}?SDT\.Battle\.commands\.openBag\(\)/.test(src('hub/game.bag.js')), true);
check('BOSS·胜利直接结算（Item 16 定版：战后不再进入整理背包，showBossPackCleanup 退役备用）', /settle\(\);   \/\/ Item 16：BOSS 战后不再进入整理背包/.test(gameSource), true);
// 2026-10-01（ROOT-06）：「未选卡牌从 ownedCards 删除」属已退役的整理背包页契约；
// Item 16 后该页彻底移除，改守护「退役入口无残留调用」。
check('BOSS·整理背包页已彻底移除（showBossPackCleanup 零调用）', !/showBossPackCleanup\s*\(/.test(gameSource), true);
check('档位概览仅展示游玩时间与已解锁成就', /PLAYTIME/.test(gameSource) && /ACHIEVEMENTS/.test(gameSource), true);
check('背包入口支持再次点击关闭', /if \(!refreshOnly && backpackOpen/.test(gameSource), true);
check('背包缩略卡点击进入详情', /data-act="inspectStack"/.test(gameSource) && /function showBagCardDetail/.test(gameSource), true);
check('道具使用入口只在详情页生成', !/data-act="useStack"/.test(gameSource) && /data-act="useDetailCard"/.test(gameSource), true);
// 2026-10-01（ROOT-06）：丢弃确认现经 bagSlots 门面调用（hub/game.bag.drag.js）。
check('拖出背包弹出丢弃确认', /if \(!t\) \{ bagSlots\.showDiscardConfirm\(d\.name, d\.fromSafe\)/.test(gameSource), true);

console.log(failed ? `\n共 ${failed} 项失败` : '\n全部通过 ✅');
process.exit(failed ? 1 : 0);
