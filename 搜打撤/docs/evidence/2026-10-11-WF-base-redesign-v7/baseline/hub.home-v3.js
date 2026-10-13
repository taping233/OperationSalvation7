import { esc } from '../core/shared.js';
import '../../css/base-home-v3.css';

export function actionModeName(id) { return id === 'elite' ? '直入敌腹' : '正常入城'; }
export function baseHomeV3HTML({ base, meta, modes, mode, prepared, character, picks }) {
  const pendingRewards = meta.pendingColl().length + meta.pendingAch().length;
  const restore = (base.data.pocket || []).reduce((sum, item) => sum + item.count, 0);
  return `<div class="base-home-v3">
    <div class="base-room-art" aria-hidden="true"><img src="${new URL('../../assets/scenes/base-operations-v5.webp', import.meta.url).href}" alt="" draggable="false" fetchpriority="high"></div>
    <header class="base-home-title"><span aria-hidden="true">WINTER BASE</span><h2>冬日基地</h2></header>
    ${restore || pendingRewards ? `<aside class="base-home-tasks" aria-label="待办">${restore ? `<button type="button" data-act="hubTab" data-tab="stash" data-view="pocket"><span>待复原</span><b>${restore}</b><i aria-hidden="true">→</i></button>` : ''}${pendingRewards ? `<button type="button" data-act="hubTab" data-tab="ach" data-view="rewards"><span>可领取奖励</span><b>${pendingRewards}</b><i aria-hidden="true">→</i></button>` : ''}</aside>` : ''}
    <footer class="base-home-departure">
      <div class="base-home-briefing"><span class="base-briefing-label">行动准备</span><h3>${prepared ? '整备继续' : '下一次出征'}</h3><p>${prepared ? `${esc(character.name)} <span>·</span> ${picks} 张卡牌` : '选择队员，配置携行卡牌'}</p></div>
      <div class="base-home-difficulty"><div role="group" aria-label="行动难度">${Object.values(modes).map(item => `<button type="button" class="${item.id === mode ? 'on' : ''}" data-act="selMode" data-mode="${item.id}" aria-pressed="${item.id === mode}">${actionModeName(item.id)}</button>`).join('')}</div>${mode === 'elite' ? `<details class="base-difficulty-detail"><summary aria-label="直入敌腹说明">i</summary><div><h3>直入敌腹</h3><dl><div><dt>敌人强度</dt><dd>×${modes.elite.enemyMul}</dd></div><div><dt>战斗金币</dt><dd>×${modes.elite.coinMul}</dd></div><div><dt>人物经验</dt><dd>×${modes.elite.xpMul}</dd></div><div><dt>高稀有度掉率</dt><dd>+20%</dd></div></dl></div></details>` : ''}</div>
      <div class="base-home-launch"><button type="button" id="btnDeploy" data-act="deploy"><b>${prepared ? '继续整备' : '出征整备'}</b><span class="base-command-arrow" aria-hidden="true">→</span></button>${base.data.nestUnlocked ? '<button type="button" id="btnNest" class="base-home-nest" data-act="nestDeploy">研究所远征 <span aria-hidden="true">↗</span></button>' : ''}</div>
    </footer></div>`;
}
