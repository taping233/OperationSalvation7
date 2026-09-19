/* ============================================================
 * game.run.js —— 局内流程装配壳（架构批次 4）
 *
 * 原 1419 行的 God module 已按依赖方向拆成三个文件：
 *   game.run.scenes.js（L0）场景壳/节点词汇/拾取开箱/发牌/商店装配
 *   game.run.altar.js （L1）祭坛/层间门/BOSS 门/火堆/职业选择/撤离整理
 *   game.run.flow.js  （L2）移动事务/落脚结算/即时与事件节点
 * 本文件只保留：跨模块装配（grantCard 兼容挂载）与 devTools 调试入口，
 * 并对外维持原有导出面（game.boot.js / game.bag.js / 测试照旧 import）。
 * ============================================================ */
import { esc } from './shared.js';
import { MAP, game, newRun, scaledEnemy } from './game.session.js';
import { buildEncounter, grantEventCard, openChestsOnCell, openShop, showRunTransition } from './game.run.scenes.js';
import { openAltarRitual, openClassChoice, openFireRest } from './game.run.altar.js';
import { moveTo, runEventDeck } from './game.run.flow.js';

/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;

// ESM：循环导入下本模块体可能先于 game.session 执行，顶层读 game 会 TDZ，延迟到 boot 统一绑定
function bindRunMixins() {
  // 兼容挂载面：chests.js / game.bag.js / game.hub.js 仍按 game.grantCard 取用；
  // 局内各流程模块已改为直接 import grantEventCard，不再经过这个全局属性。
  game.grantCard = grantEventCard;   // 宝箱等模块发卡（同名并入 / 容量满拒绝）
}

// —— 开发者工具：devTools 面板一键强制进战斗，跳过走格子（2026-09-09 老板任务）——
// BOSS 战自动编满牌库并开打；仅开发调试用，不改变战斗本身的任何规则
function devForceBattle(isBoss) {
  if (game.battleActive || game.state === 'modal') { UI.log('[[icon:lock]] 当前状态无法直接开战，先回到棋盘', 'warn'); return; }
  if (!game.ownedCards || !game.ownedCards.length) { UI.log('[[icon:cards]] 还没有随身卡牌，先开一局再试', 'warn'); return; }
  if (isBoss) {
    const b = MAP.altar.bosses[0];
    SDT.Battle.start(game, scaledEnemy(b), { isBoss: true, returnTo: 'altar', name: b.name });
    UI.log(`[[icon:tools]] 开发者：强制进入 BOSS 战【${esc(b.name)}】`, 'sys');
    const snap = SDT.Battle.getSnapshot();
    if (snap.deckSelection) {
      const cap = Math.min(snap.deckSelection.need, snap.deckSelection.cards.length);
      while (SDT.Battle.getSnapshot().deckSelection.selected.length < cap) {
        const next = SDT.Battle.getSnapshot().deckSelection.cards.find(c => !SDT.Battle.getSnapshot().deckSelection.selected.includes(c.uid));
        if (!next) break;
        SDT.Battle.commands.selectDeckCard(next.uid);
      }
      SDT.Battle.commands.confirmDeck();
    }
  } else {
    const list = buildEncounter(game.layerIdx);
    SDT.Battle.start(game, list, { isBoss: false, layer: game.layerIdx, name: list[0].name,
      risk: list.risk, strategy: list.strategy });
    UI.log('[[icon:tools]] 开发者：强制进入遭遇战', 'sys');
  }
}

// —— 开发者工具：首页节点测试面板一键跳节点（2026-09-13 老板任务）——
// 面板 DOM 在 index.html（#titleDev，仅开发者模式可见），点击绑定在 game.boot.js。
// 从标题页进节点需要一局在跑：没有对局时先起一局「测试局」——
// 不占档位（activeSlot 为空 → saveGame 直接返回），所以不会写坏任何真实存档。
const DEV_NODE_LABEL = {
  battle: '遭遇战', boss: 'BOSS 战', shop: '商店', 'chest-small': '小宝箱', 'chest-medium': '中宝箱',
  'chest-large': '大宝箱', event: '事件', fire: '火堆', altar: '祭坛',
};

function devEnsureRun() {
  if (game.battleActive) { UI.log('[[icon:lock]] 战斗进行中——先打完或退出战斗再跳节点', 'warn'); return false; }
  if (game.runActive) return true;
  document.getElementById('title').hidden = true;   // 与「开始探索」同口径：进棋盘前收起标题页
  newRun('standard');
  UI.log('[[icon:tools]] 开发者：已开一局<b>测试局</b>（不占档位、不写存档）', 'sys');
  return true;
}

function devJumpNode(kind) {
  const label = DEV_NODE_LABEL[kind];
  if (!label) { UI.log(`[[icon:question]] 未知节点类型：${esc(kind)}`, 'warn'); return; }
  if (!devEnsureRun()) return;
  if (!UI.el.overlay.hidden) UI.hideOverlay();   // 已有节点页/BOSS 门等着：先收干净再进新节点
  game.state = 'idle';
  UI.beginRoom();   // 与真实落脚一致：节点页铺满整屏房间
  UI.log(`[[icon:tools]] 开发者：跳转节点【<b>${label}</b>】`, 'sys');
  switch (kind) {
    case 'battle': devForceBattle(false); break;
    case 'boss': devForceBattle(true); break;
    case 'shop': openShop('dev'); break;
    case 'event': runEventDeck(); break;
    case 'fire': openFireRest(); break;
    case 'altar': openAltarRitual(); break;   // def 参数仅供重进递归用，直接进不需要格子定义
    default: openChestsOnCell([{ kind: kind.replace('chest-', '') }], `开发者测试：${label}`); break;
  }
}

export { bindRunMixins, moveTo, openAltarRitual, openClassChoice, openShop, showRunTransition, devForceBattle, devJumpNode };
