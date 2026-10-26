import { sdtDefine } from '../core/sdt-facade.js';
import { recordDiagnostic } from '../core/diagnostics.local.js';
import { nodeContentEndedAt } from '../run/node-reward-state.js';

// 战斗域按需加载边界。
// 标题、基地与地图不解析战斗核心；首次开战或恢复存档时才拉取完整战斗模块。
let battlePromise = null;
const contextVersions = new WeakMap();
const startRequests = new WeakMap();

// newRun/loadGame 替换 discoveredPairs，巢穴开局/撤离替换 nestRunes。
// 标题退出另行失效，避免离开后回到同一对象/位置的等待请求复活。
export function invalidateBattleContext(game) {
  contextVersions.set(game, (contextVersions.get(game) || 0) + 1);
}

export function captureBattleContext(game, getSlot = () => window.SDT?.Base?.slot) {
  // window 不存在 = 宿主环境已拆除（如测试 teardown 后挂起定时器仍触发），上下文必然失效；
  // 谓词安全返回 false 而非抛 ReferenceError。浏览器内此分支不可达，行为逐字不变。
  if (typeof window === "undefined") return () => false;
  const version = contextVersions.get(game) || 0;
  const registeredGame = window.SDT?.game;
  const slot = getSlot();
  const keys = ['seed', 'discoveredPairs', 'nestRunes', 'runActive', 'nestActive', 'layerIdx', 'trackPos', 'nestPos'];
  const values = keys.map(key => game[key]);
  return () => {
    if (typeof window === "undefined") return false;
    return (contextVersions.get(game) || 0) === version &&
      (!registeredGame || registeredGame === game) && window.SDT?.game === registeredGame && getSlot() === slot &&
      keys.every((key, index) => game[key] === values[index]);
  };
}

async function ensureBattleReady() {
  // window 不存在 = 宿主环境已拆除（如测试 teardown 后挂起的调用仍触发）。
  // 与 captureBattleContext（9d7b871）同一定式：给出可预期的失败而非裸 window
  // 的 ReferenceError。本函数为 async，throw 即 rejection，调用方
  // （startBattle try / 选角页 .catch / 菜单外层 try）均有捕获姿势。
  // 浏览器内此分支不可达，行为逐字不变。
  if (typeof window === "undefined") throw new Error('战斗模块加载失败：宿主环境已拆除（window 不存在）');
  const ready = window.SDT?.Battle;
  if (ready?.start && ready?.restore) return ready;
  if (!battlePromise) {
    performance.mark?.('sdt:battle-load-start');
    battlePromise = import('./view/battle.view.js').then(() => {
      // 动态 import 期间环境被拆除：注册结果不可读，同样给可读 Error 而非裸引用。
      if (typeof window === "undefined") throw new Error('战斗模块加载失败：宿主环境已拆除（window 不存在）');
      const battle = window.SDT?.Battle;
      if (!battle?.start || !battle?.restore) throw new Error('战斗模块加载后未注册 SDT.Battle');
      performance.mark?.('sdt:battle-load-end');
      performance.measure?.('sdt:battle-load', 'sdt:battle-load-start', 'sdt:battle-load-end');
      return battle;
    }).catch(error => {
      battlePromise = null; // 瞬时读取失败允许下一次交互重试
      throw error;
    });
  }
  return battlePromise;
}

async function startBattle(game, foes, options) {
  const currentContext = captureBattleContext(game);
  // 离开前发起的节点战斗不再复活；已结束地点上的显式命令仍沿原条件。
  const endedAtRequest = nodeContentEndedAt(game);
  const request = {};
  startRequests.set(game, request);
  const isCurrent = () => currentContext() && startRequests.get(game) === request && game.state !== 'title'
    && (endedAtRequest || !nodeContentEndedAt(game));
  try {
    const battle = await ensureBattleReady();
    if (!isCurrent()) return false;
    return battle.start(game, foes, options);
  } catch (error) {
    if (!isCurrent()) return false;
    recordDiagnostic('battle-loader', error);
    console.error('[battle-loader] 战斗模块加载失败', error);
    if (game) game.state = 'idle';
    window.SDT?.UI?.log?.('[[icon:cross]] 战斗模块加载失败，请重试', 'warn');
    window.SDT?.UI?.refresh?.(game);
    return false;
  }
}

export const BattleLoader = Object.freeze({ ensure: ensureBattleReady, start: startBattle });
sdtDefine('BattleLoader', BattleLoader);

export { ensureBattleReady, startBattle };
