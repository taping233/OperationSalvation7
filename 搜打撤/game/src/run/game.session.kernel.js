/* ============================================================
 * game.session.kernel.js —— 会话内核（自 game.session.js 拆出，2026-09-25）
 *
 * 全会话共享的最底层状态与工具：运行时钩子（反向注入 run 页面入口）、
 * GameStore/game 单例、主画布与相机活绑定、通用小工具。
 * 只被其他 game.session.* 模块与 game.session.js 依赖，自身不依赖任何会话模块。
 * 对外仍统一从 game.session.js 具名导出，本模块导出面是会话内部属地。
 * ============================================================ */
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { GameStore } from '../hub/game.store.js';
import { Random } from '../core/random.js';

export const MAP = SDT.MAP;
export const FX = SDT.FX; // 顿帧反馈（hitStop；2D 飘字/脉冲/震屏已废弃，见 renderer.fx.js）

// ---------- 运行时钩子（基地出发整备/选角页等 run 页面入口反向注入） ----------
export const runtime = {
  openClassChoice: () => {},
  openBaseHub: () => {},
  rebuildNotes: () => {},
  resize: () => {},
  showRunTransition: async () => {},
  syncDevVisibility: () => {},
  resumeExtraction: () => ({ ok: false, code: 'EXTRACTION_UNAVAILABLE', message: '撤离整理界面尚未就绪' }),
};

export function configureGameRuntime(hooks) {
  Object.assign(runtime, hooks || {});
}
// 供基地出发整备在确认带入卡牌后打开选角页；通过运行时注入保持 session 不反向依赖 run 模块。
export function requestClassChoice(options) {
  return runtime.openClassChoice(options);
}

// ---------- 会话单例状态 ----------
export const store = new GameStore(MAP);
export const game = store.state;
game.getSnapshot = () => store.getSnapshot();

// ---------- 工具 ----------
// curLayer 返回运行时层数据（layerData，由生成器按种子产出，含逻辑格/门/入口）
export const curLayer = () => game.layerData[game.layerIdx];
// 结点地图：pos 与结点坐标一律为世界像素（几何唯一来源见 buildDerived 的 nodePos）
export const cellCenter = (li, idx) => ({ ...game.nodePos[li][idx] });
export const pick = (arr) => arr[Math.floor(Random.random('gameplay') * arr.length)];

export const weighted = (arr) => {
  const total = arr.reduce((a, b) => a + b.w, 0);
  let r = Random.random('gameplay') * total;
  for (const e of arr) { r -= e.w; if (r <= 0) return e; }
  return arr[0];
};
game.curLayer = curLayer;
game.log = (m, c) => UI.log(m, c);
game.debug = {}; // 调试入口由 game.run.dev.js 等开发工具填充
SDT.game = game;

// ---------- 主画布与相机（活绑定：渲染侧经 _set_cam/_set_dpr 回写） ----------
export const canvas = document.getElementById('game');
// alpha:false——每帧都会整屏铺背景，不透明画布可让合成器跳过透明混合。
// 不启用 desynchronized：本机混合显卡 A/B 中它会让交换链吞吐明显下降。
export const ctx = canvas.getContext('2d', { alpha: false });
export let cam;
export let dpr = 1;

export const _set_dpr = (v) => { dpr = v; };
export const _set_cam = (v) => { cam = v; };
