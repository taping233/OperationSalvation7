import { esc } from '../core/shared.js';
import { baseHomeIconV10 } from './hub.home-icons-v10.js';
import '../../css/base-home-v7.css';

export function actionModeName(id) { return id === 'elite' ? '直入敌腹' : '正常入城'; }
function baseAffairsHTML(base, pendingRewards) {
  const rows = [];
  if (!base.data.ammoTaught) rows.push(`<button type="button" class="base-home-affair base-home-first-objective" data-act="deploy"><span class="base-home-affair-copy"><b>首次目标：带回一份收获</b><small>撤离带回资源卡 → 后勤使用 → 建设扩建。背包留空格。</small></span><span aria-hidden="true">→</span></button>`);
  const facilities = [
    { id:'stash', name:'基地仓库', ready:base.canUpgradeStash?.(), have:base.stashCap?.() || 0 },
    { id:'bag', name:'出征背包', ready:base.canUpgradeBag?.(), have:base.bagCap?.() || 0 },
  ].filter(item => item.ready);
  if (facilities.length) {
    const facility = facilities[0];
    rows.push(`<button type="button" class="base-home-affair" data-act="hubTab" data-tab="upgrade" data-facility="${facility.id}"><span class="base-home-affair-icon">${baseHomeIconV10('upgrade')}</span><span class="base-home-affair-copy"><b><i aria-hidden="true"></i>可扩建 <em>${facilities.length}</em></b><small>${facility.name} · 当前 ${facility.have} 格</small></span><span class="base-home-affair-arrow" aria-hidden="true">›</span></button>`);
  }
  const eggs = (base.data.stash || []).filter(stack => stack.card.id === base.PET_EGG_ID).reduce((sum, stack) => sum + stack.count, 0);
  if (eggs && base.data.coins >= base.HATCH_COST && base.ownedPets().length < base.PETS.length) {
    rows.push(`<button type="button" class="base-home-affair" data-act="hubTab" data-tab="classes" data-group="pets"><span class="base-home-affair-icon">[[icon:paw]]</span><span class="base-home-affair-copy"><b><i aria-hidden="true"></i>可孵化 <em>${eggs}</em></b><small>伙伴蛋 × ${eggs}</small></span><span class="base-home-affair-arrow" aria-hidden="true">›</span></button>`);
  }
  if (pendingRewards) rows.push(`<button type="button" class="base-home-affair" data-act="hubTab" data-tab="ach" data-view="rewards"><span class="base-home-affair-icon">${baseHomeIconV10('ach')}</span><span class="base-home-affair-copy"><b><i aria-hidden="true"></i>待领取 <em>${pendingRewards}</em></b><small>收藏与成就奖励</small></span><span class="base-home-affair-arrow" aria-hidden="true">›</span></button>`);
  return `<aside class="base-home-affairs" aria-label="基地事务"><h3>基地事务</h3>${rows.length ? rows.join('') : '<p class="base-home-affairs-empty">暂无待处理事务</p>'}</aside>`;
}
export function baseHomeV3HTML({ base, meta, modes, mode, prepared, character, picks }) {
  const pendingRewards = meta.pendingColl().length + meta.pendingAch().length;
  const restore = (base.data.pocket || []).reduce((sum, item) => sum + item.count, 0);
  return `<div class="base-home-v7" data-mode="${mode === 'elite' ? 'elite' : 'standard'}" data-pending-rewards="${pendingRewards}">
    <div class="base-room-art" aria-hidden="true"><img src="${new URL('../../assets/scenes/base-operations-v5.webp', import.meta.url).href}" alt="" draggable="false" fetchpriority="high"></div>
    ${baseAffairsHTML(base, pendingRewards)}
    <div class="base-home-launch${prepared ? ' has-draft' : ''}">${prepared ? `<span class="base-home-action-caption">${esc(character.name)} · ${picks} 张卡牌</span>` : ''}<button type="button" id="btnDeploy" data-act="deploy">${baseHomeIconV10('deploy')}<b>${prepared ? '继续整备' : '出征整备'}</b><span class="base-command-arrow" aria-hidden="true">→</span></button></div>
    <footer class="base-home-utility">
      <div class="base-home-mode"><div role="group" aria-label="行动难度"><span class="base-mode-indicator" aria-hidden="true"></span>${Object.values(modes).map(item => `<button type="button" class="${item.id === mode ? 'on' : ''}" data-act="selMode" data-mode="${item.id}" aria-pressed="${item.id === mode}">${actionModeName(item.id)}</button>`).join('')}</div>${mode === 'elite' ? `<p>四层探索 · 敌人与首脑 ×${modes.elite.enemyMul} · 战斗金币 ×${modes.elite.coinMul} · 人物经验 ×${modes.elite.xpMul} · 高稀有度掉率 +20%。</p>` : '<p>四层探索 · 基础难度</p>'}</div>
      ${base.data.nestUnlocked || restore ? `<nav class="base-home-services" aria-label="基地其他操作">${base.data.nestUnlocked ? '<button type="button" id="btnNest" data-act="nestDeploy">研究所远征 →</button>' : ''}${restore ? `<button type="button" class="base-home-pending" data-act="hubTab" data-tab="stash" data-view="pocket">待复原 <b>${restore}</b> →</button>` : ''}</nav>` : ''}
    </footer></div>`;
}
