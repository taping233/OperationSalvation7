import { esc } from '../core/shared.js';
import '../../css/base-home-v3.css';

export function actionModeName(id) { return id === 'elite' ? '直入敌腹' : '正常入城'; }
export function baseHomeV3HTML({ base, meta, modes, mode, prepared, character, picks }) {
  const pendingAchievements = meta.pendingAch().length, pendingCollection = meta.pendingColl().length;
  const restore = (base.data.pocket || []).reduce((sum, item) => sum + item.count, 0);
  const places = [
    ['stash', '仓库'], ['classes', '队员'], ['shop', '补给'], ['upgrade', '扩建'], ['ach', '归档室'],
  ];
  return `<div class="base-home-v3"><header class="base-home-title"><span aria-hidden="true">WINTER BASE</span><h2>冬日基地</h2></header>
    <nav class="base-home-places" aria-label="基地房间">${places.map(([tab, name]) => `<button type="button" class="base-home-place" data-act="hubTab" data-tab="${tab}"><b>${name}</b>${tab === 'stash' ? `<small>${base.stashUsed()} / ${base.stashCap()}</small>` : ''}${tab === 'ach' && pendingAchievements + pendingCollection ? `<em>${pendingAchievements + pendingCollection}</em>` : ''}<i aria-hidden="true">↗</i></button>`).join('')}${restore ? `<button class="base-home-pending" data-act="hubTab" data-tab="stash" data-view="pocket">待复原 <b>${restore}</b> →</button>` : ''}</nav>
    <nav class="base-home-leisure" aria-label="庭院休憩"><button data-act="hubTab" data-tab="courtyard" data-view="rain">听雨</button><span aria-hidden="true">/</span><button data-act="hubTab" data-tab="courtyard" data-view="koi">观鱼</button></nav>
    <footer class="base-home-departure"><div class="base-home-difficulty"><div role="group" aria-label="行动难度">${Object.values(modes).map(item => `<button class="${item.id === mode ? 'on' : ''}" data-act="selMode" data-mode="${item.id}" aria-pressed="${item.id === mode}">${actionModeName(item.id)}</button>`).join('')}</div>${mode === 'elite' ? `<details class="base-difficulty-detail"><summary aria-label="直入敌腹说明">i</summary><div><h3>直入敌腹</h3><dl><div><dt>敌人强度</dt><dd>×${modes.elite.enemyMul}</dd></div><div><dt>战斗金币</dt><dd>×${modes.elite.coinMul}</dd></div><div><dt>人物经验</dt><dd>×${modes.elite.xpMul}</dd></div><div><dt>高稀有度掉率</dt><dd>+20%</dd></div></dl></div></details>` : ''}</div>
    <div class="base-home-launch">${prepared ? `<span class="base-home-draft">${esc(character.name)} · ${picks} 张卡牌</span>` : ''}<button id="btnDeploy" data-act="deploy"><b>${prepared ? '继续整备' : '出征整备'}</b><span aria-hidden="true">→</span></button>${base.data.nestUnlocked ? '<button id="btnNest" class="base-home-nest" data-act="nestDeploy">研究所远征 →</button>' : ''}</div></footer></div>`;
}
