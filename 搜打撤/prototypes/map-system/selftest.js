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

const GAME_PARTS = ['game.core.js', 'game.run.js', 'game.hub.js', 'game.bag.js', 'game.notes.js', 'game.cardslib.js', 'game.boot.js'];
const BATTLE_PARTS = ['battle.core.js', 'battle.view.js'];
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
const gameSource = src('game.js');
const mapSource = src('mapData.js');
check('关卡·三环风险梯度已声明', /risk:\s*'低'/.test(mapSource) && /risk:\s*'中'/.test(mapSource) && /risk:\s*'高'/.test(mapSource), true);
check('关卡·内层精英概率保持 25%', /chance:\s*0\.25/.test(mapSource), true);
check('遭遇·策略预告元数据', /strategy:\s*'试探/.test(mapSource) && /strategy:\s*'压迫/.test(mapSource), true);
check('场景·10 张事件 sceneId 覆盖', ['timeskip','demondeal','bandits','mystery','goldmine','goldhammer','relief','airdrop','chestdraw','systemsupply'].every(k => new RegExp(`event-${k}`).test(gameSource)), true);
check('场景·标准节点与拾取契约', /scene-battle-bg/.test(gameSource) && /scene-extract-bg/.test(gameSource) && /scene-pickup-key/.test(gameSource), true);
check('场景·落脚进入全屏房间链', /UI\.beginRoom\(\)/.test(gameSource) && /_roomActive/.test(src('ui.js')), true);
check('音频·指定 MP3 作为循环 BGM', /bgm-black-stream-sea\.mp3/.test(src('sound.js')) && /bgm\.loop\s*=\s*true/.test(src('sound.js')), true);
check('战斗·意图轮转与 DOM 接线', /function intentFor/.test(src('battle.js')) && /foe\.intent = intentFor\(foe, turn\)/.test(src('battle.js')) && /sts-intent/.test(src('battle.js')), true);
check('战斗·拖牌 Pointer Events 接线保留', /pointerdown/.test(src('battle.js')) && /data-aim/.test(src('battle.js')) && /drag-over/.test(src('battle.js')), true);
check('BOSS·三类独立意图模式', /general.*军威强化/.test(src('battle.js')) && /orc_boss.*双击/.test(src('battle.js')) && /element_boss.*元素庇幕/.test(src('battle.js')), true);
check('敌人·全部图鉴具备行为钩子', ['infantry','archer','bandit','cavalry','orc_jav','orc_axe','wolf_rider','fire_el','water_el','grass_el','dragon'].every(k => new RegExp(`${k}[^\n]*behavior:`).test(mapSource)), true);
check('事件·二选一与三选一分支', /tt6-goldmine[\s\S]*?收下 3 币/.test(gameSource) && /tt6-airdrop[\s\S]*?应急处理/.test(gameSource) && /tt6-chestdraw[\s\S]*?中宝箱/.test(gameSource), true);
check('兼容·未知事件仍走旧效果', /return null;/.test(gameSource) && /applyEventEffect\(card\)/.test(gameSource), true);
check('BOSS·战斗/整理阶段锁住背包入口', /if \(game\.battleActive \|\| game\.bossCleanupPending\)/.test(gameSource), true);
check('BOSS·胜利进入整理背包状态', /showBossPackCleanup\(consumedUids \|\| \[\], settle\)/.test(gameSource), true);
check('BOSS·未选卡牌在确认时从 ownedCards 删除', /game\.ownedCards = game\.ownedCards\.filter\(o => !discardedUids\.has\(o\.uid\)\)/.test(gameSource), true);
check('档位概览仅展示游玩时间与已解锁成就', /PLAYTIME/.test(gameSource) && /ACHIEVEMENTS/.test(gameSource), true);
check('背包入口支持再次点击关闭', /if \(!refreshOnly && backpackOpen/.test(gameSource), true);
check('背包缩略卡点击进入详情', /data-act="inspectStack"/.test(gameSource) && /function showBagCardDetail/.test(gameSource), true);
check('道具使用入口只在详情页生成', !/data-act="useStack"/.test(gameSource) && /data-act="useDetailCard"/.test(gameSource), true);
check('拖出背包弹出丢弃确认', /if \(!t\) \{ showDiscardConfirm\(d\.name, d\.fromSafe\)/.test(gameSource), true);

console.log(failed ? `\n共 ${failed} 项失败` : '\n全部通过 ✅');
process.exit(failed ? 1 : 0);
