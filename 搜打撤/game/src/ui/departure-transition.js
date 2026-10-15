import { createCityCut, playPreparedCut } from './camp-entry.js';
import { waitPageVisual } from './page-visual-ready.js';
import { motionReduced } from './motion-presets.js';
import '../../css/expedition-transitions.css';

let handoff = null;
// 遮层先于 newRun 挂载，地图初始化与整备关层都在遮层下发生。
export function startDepartureHandoff(start, source) {
  if (handoff) return handoff.promise;
  const curtain = document.createElement('div');
  curtain.className = 'departure-handoff';
  curtain.setAttribute('role', 'status');
  curtain.setAttribute('aria-label', '正在出发');
  curtain.innerHTML = '<i aria-hidden="true"></i>';
  document.body.append(curtain);
  const block = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  window.addEventListener('keydown', block, true);
  const operation = { promise: null };
  handoff = operation;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  operation.promise = (async () => {
    try {
      if (!motionReduced()) await delay(160);
      if (source && !source.isConnected) return false;
      const result = await start();
      if (result !== false) {
        await waitPageVisual(document.getElementById('viewport'), { background: window.SDT?.UI?._pageBgReady });
        const game = window.SDT?.game;
        if (game?.runActive && game.state === 'idle' && !game.battleActive && !game.nestActive) {
          await window.SDT.Renderer?.prepare?.(game, () => handoff === operation);
        }
      }
      // 给已挂载过场/地图两个绘制机会；后台窗口仍有时间上限。
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 160);
        requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); resolve(); }));
      });
      curtain.classList.add('leaving');
      if (!motionReduced()) await delay(140);
      return result !== false;
    } finally {
      curtain.remove();
      window.removeEventListener('keydown', block, true);
      if (handoff === operation) handoff = null;
    }
  })();
  return operation.promise;
}

// 整备页立即打开，切幕只负责入口反馈，不等待或接管业务输入。
export function enterDepartureCut(page) {
  const overlay = page?.closest('#overlay');
  const card = page?.closest('.card');
  if (motionReduced() || !overlay || !card) return;
  const cut = createCityCut({ archive: '出征档案', title: '出征整备',
    subtitle: 'DEPARTURE / 人物与携带准备', destination: 'DEPARTURE', watermark: 'PREPARE' });
  playPreparedCut(page, cut);
}
