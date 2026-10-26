/* ui.transitions-director.js —— 页面转场三件套编排（2026-10-04 · 计划 D9 T1/T3）。
 * 零越线挂钩：只消费既有事件（sdt-overlay-mode 广播，overlay.js:66）与
 * document 级 click 捕获 + MutationObserver，不 import、不修改任何 run/hub 流程文件。
 *
 * T1 斜纹闸门：#t1Gate 单例层（本模块注入 body），--hazard 渐变臂 transform
 * 斜向扫过 0.55s --ease-pop；进行时 #overlay 挂 gate-live（关 backdrop-filter
 * 同帧叠加，计划 R1）与 gate-squeeze（仅保留生命周期标记，不挤压内容）；will-change 只在
 * .on 动画期存在（CSS 侧），animationend/兜底 timer 摘类即除。
 *
 * T3 界面即过场：闸门盖住切换瞬间的三类链路——
 *   ① flow-transition 短过场的「点击继续/超时自动结束」（click 捕获先行起闸，
 *      hidden 兜底覆盖超时路径；game.run.scenes.js:143 data-act="flowContinue"）；
 *   ② hub 主页 #hubMain ↔ 出发整备 #depMain 的 page 模式互切（ovBody 首子标识比对）；
 *   ③ #depMain 关闭出击（overlay 瞬隐→画布地图，hidden 观察兜底）。
 *   新面板展开复用 T4 的 t4PageIn(.3s)，全程 0.55s ≤ 0.8s；
 *   「旧面板压缩淡出 0.2s」在内容即时替换架构下无先于替换的时序窗口，
 *   以闸门盖切替代（记 deferred，见 CSS 头注）。
 *
 * 战斗域零接触：lastMode==='battle'（sdt-overlay-mode 广播）一律不起闸门；
 * 弹层标识不命中链路集合自然排除。reduce（core/motion.js 权威口径）下整体直出。 */
import { reduceMotion } from '../core/motion.js';
import { completeSurfaceMotion } from './motion-completion.js';

// ── T1 闸门单例 ──
let gateBusy = false;

function ensureGate() {
  let gate = document.getElementById('t1Gate');
  if (!gate) {
    gate = document.createElement('div');
    gate.id = 't1Gate';
    gate.innerHTML = '<div class="t1-arm" aria-hidden="true"></div>';
    document.body.appendChild(gate);
  }
  return gate;
}

export function gateSweep() {
  if (document.body.classList.contains('interface-motion') || gateBusy || reduceMotion()) return;
  const gate = ensureGate();
  const overlay = document.getElementById('overlay');
  const arm = gate.firstElementChild;
  gateBusy = true;
  overlay?.classList.add('gate-live', 'gate-squeeze');
  gate.classList.add('on');
  completeSurfaceMotion(arm, () => {
    gate.classList.remove('on');
    overlay?.classList.remove('gate-live', 'gate-squeeze');
    gateBusy = false;
  }, { duration: 700, slack: 0 });
}

// ── 链路标识与观测 ──
const GATE_PAGES = new Set(['#hubMain', '#depMain']);
const FLOW_MARK = 'flow-transition';

// ovBody 首子元素识别串：id 优先，否则取前两个类（.scene.flow-transition / .pg.node-pg …）
function markOf() {
  const first = document.getElementById('ovBody')?.firstElementChild;
  if (!first) return '';
  if (first.id) return `#${first.id}`;
  const cls = String(first.className || '').trim().split(/\s+/);
  return `.${cls.slice(0, 2).join('.')}`;
}

let lastMark = '';
let lastMode = null;
let commDemoPromise = null;

function maybeGateOnSwap(next) {
  // 战斗与弹层模式不进闸门；只有链路页互切（hubMain↔depMain）触发
  if (lastMode === 'battle') return false;
  if (GATE_PAGES.has(lastMark) && GATE_PAGES.has(next) && next !== lastMark) return true;
  return false;
}

function start() {
  const overlay = document.getElementById('overlay');
  const ovBody = document.getElementById('ovBody');
  if (!overlay || !ovBody) return;
  lastMark = markOf();

  document.addEventListener('sdt-overlay-mode', (e) => { if (e instanceof CustomEvent) lastMode = e.detail; });

  // 当前界面控制器拥有页面转场；旧闸门仅供未安装它的独立宿主使用。
  if (!document.body.classList.contains('interface-motion')) {
    // ① 捕获点击继续，不拦截或延迟业务流程。
    document.addEventListener('click', (e) => {
      if (e.target instanceof Element && e.target.closest('[data-act="flowContinue"]')) gateSweep();
    }, true);

    // ② 基地与整备互切；先比较旧标识，再记录新页。
    new MutationObserver(() => {
      const next = markOf();
      if (next === lastMark) return;
      const prev = lastMark;
      const shouldGate = maybeGateOnSwap(next);
      lastMark = next;
      if (prev.includes(FLOW_MARK)) return;
      if (shouldGate) gateSweep();
    }).observe(ovBody, { childList: true });

    // ③ 关闭过场或出击页时，为没有点击事件的路径提供兜底。
    new MutationObserver(() => {
      if (gateBusy || reduceMotion()) return;
      const flowOrDeploy = lastMark.includes(FLOW_MARK) || lastMark === '#depMain';
      if (!flowOrDeploy) return;
      if (!overlay.hidden && overlay.classList.contains('closing')) { gateSweep(); lastMark = ''; return; }
      if (overlay.hidden) { gateSweep(); lastMark = ''; }
    }).observe(overlay, { attributes: true, attributeFilter: ['hidden', 'class'] });
  }

  // D10 demo：URL 参数触发，去参即无痕
  try {
    if (new URLSearchParams(location.search).has('commDemo') && !commDemoPromise) {
      commDemoPromise = import('./comm-feed.js').then(({ mountCommDemo }) => {
        mountCommDemo();
        // Cold loading may cross a battle entry before the demo subscribes.
        const panel = document.getElementById('commDemoPanel');
        if (panel && lastMode === 'battle') panel.style.display = 'none';
      }).catch(error => {
        commDemoPromise = null;
        console.warn('[comm-demo] 演示载入失败', error);
      });
    }
  } catch { /* 非浏览器环境（测试 jsdom 无 location.search 解析失败）：忽略 */ }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
