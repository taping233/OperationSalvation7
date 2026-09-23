import { sdtDefine } from './sdt-facade.js';
import { recordDiagnostic } from './diagnostics.local.js';

// 战斗域按需加载边界。
// 标题、基地与地图不解析战斗核心；首次开战或恢复存档时才拉取完整战斗模块。
let battlePromise = null;

async function ensureBattleReady() {
  const ready = window.SDT?.Battle;
  if (ready?.start && ready?.restore) return ready;
  if (!battlePromise) {
    performance.mark?.('sdt:battle-load-start');
    battlePromise = import('./battle.view.js').then(() => {
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
  try {
    const battle = await ensureBattleReady();
    return battle.start(game, foes, options);
  } catch (error) {
    recordDiagnostic('battle-loader', error);
    console.error('[battle-loader] 战斗模块加载失败', error);
    if (game) game.state = 'idle';
    window.SDT?.UI?.log?.('[[icon:cross]] 战斗模块加载失败，请重试', 'warn');
    window.SDT?.UI?.refresh?.(game);
    return false;
  }
}

sdtDefine('BattleLoader', Object.freeze({ ensure: ensureBattleReady, start: startBattle }));

export { ensureBattleReady, startBattle };
