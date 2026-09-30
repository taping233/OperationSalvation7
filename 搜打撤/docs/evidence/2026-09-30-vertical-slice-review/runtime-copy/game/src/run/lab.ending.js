/* ============================================================
 * 经典生命研究所 · 通关演出（2026-09-24 老板定版：方舟级多页演出）
 *   撤离成功 → 三页插画+打字机字幕（所主崩解 → 无人机送回情报与资源 → 深处钩子）
 *   → 行动结算页收尾（game.nest.showLabSettlement）。
 *   插画 assets/scenes/lab-ending/ending-{1,2,3}.webp（NAI 出图后补）；
 *   缺图时背景层 404 透明，露出页底基调渐变——框架不依赖图片即可完整演示。
 *   交互：点击/回车/空格=打字中补全本页、已完进下一页；Esc 或「跳过」直达结算。
 * ============================================================ */
import { assetUrl } from '../core/asset-url.js';
import SDT from '../core/sdt-facade.js';
import { isTurbo } from '../agent/agent.turbo.js';

const PAGES = [
  {
    img: 'assets/scenes/lab-ending/ending-1.webp',
    tone: 'crisis',
    text: '研究所深处，巨大的身影在白光中崩解。所主的生命信号归零——感染源的核心样本，到手了。',
  },
  {
    img: 'assets/scenes/lab-ending/ending-2.webp',
    tone: 'flight',
    text: '满载情报与样本的无人机脱离建筑群，穿过污染云层向基地飞去。这一次，带回的不只是物资。',
  },
  {
    img: 'assets/scenes/lab-ending/ending-3.webp',
    tone: 'abyss',
    text: '解析出的坐标指向更深处——那里还有一扇门，门后的感染远比这里古老。下一层，见。',
  },
];

export function playLabEnding(onDone) {
  // 快进模式跳过通关演出（Agent/批量跑用）：直接进结算，与「跳过」按钮同出口
  if (isTurbo()) { onDone?.(); return; }
  const root = document.createElement('div');
  root.id = 'labEnding';
  root.innerHTML = `
    ${PAGES.map((p, i) => `
      <div class="lab-end-page lab-tone-${p.tone}${i === 0 ? ' on' : ''}" data-page="${i}">
        <div class="lab-end-art" style="background-image:url('${assetUrl(p.img)}')"></div>
        <div class="lab-end-shade"></div>
        <div class="lab-end-text"><span class="lab-end-typed"></span><i class="lab-end-cue">▼</i></div>
      </div>`).join('')}
    <button class="lab-end-skip" type="button">跳过 »</button>`;
  document.body.appendChild(root);

  const pages = [...root.querySelectorAll('.lab-end-page')];
  const sfx = (n) => { try { if (SDT.Sound) SDT.Sound.sfx(n); } catch { /* 静音环境忽略 */ } };
  let idx = 0, timer = null, typed = false;

  const stopType = () => { if (timer) { clearInterval(timer); timer = null; } };
  const completePage = () => {
    stopType();
    const el = pages[idx].querySelector('.lab-end-typed');
    el.textContent = PAGES[idx].text;
    typed = true;
    el.parentElement.classList.add('done');
  };
  const type = (el, full) => {
    stopType();
    typed = false;
    el.parentElement.classList.remove('done');
    el.textContent = '';
    let i = 0;
    timer = setInterval(() => {
      el.textContent = full.slice(0, ++i);
      if (i >= full.length) completePage();
    }, 30);
  };
  const show = (i) => {
    idx = i;
    pages.forEach((pg, k) => pg.classList.toggle('on', k === i));
    type(pages[i].querySelector('.lab-end-typed'), PAGES[i].text);
    sfx(i === 0 ? 'victory' : 'legend');
  };
  const finish = () => {
    stopType();
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    if (onDone) onDone();
  };
  const advance = () => { if (typed) { idx + 1 < PAGES.length ? show(idx + 1) : finish(); } else completePage(); };
  const onKey = (e) => {
    if (e.key === 'Escape') { finish(); return; }
    if (e.key === 'Enter' || e.key === ' ') { advance(); }
  };

  root.addEventListener('click', (e) => {
    if (e.target.closest('.lab-end-skip')) { finish(); return; }
    advance();
  });
  document.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => root.classList.add('on'));   // 触发淡入
  show(0);
}
