import { bindRewardFeedback } from './hub.reward-feedback.js';
import { esc, escAttr } from '../core/shared.js';
import { achievementMedalHTML } from '../ui/achievement-medals.js';
import { achievementFiltersHTML, createAchievementProgressReader } from './hub.archive.js';
import { validateLastLampState } from '../home/story.last-lamp.js';
import { collectionCardsHTML, bindCollectionCards } from './hub.collection-v4.js';
import { animateBaseSwitch } from './base-motion-v4.js';

// The legacy classes route now represents shared collection milestones, not a second character library.
const SECTIONS = [['cards', '已收藏'], ['rewards', '奖励'], ['achievements', '成就目标'], ['classes', '收藏里程碑'], ['backs', '卡背'], ['stories', '故事']];
let slot, medalId = '', backId = '';
const stateLabel = (unlocked, claimed) => claimed ? '已领取' : unlocked ? '可领取' : '未达成';
const resetForSlot = base => {
  if (slot === base.slot) return;
  slot = base.slot; medalId = ''; backId = '';
};
const progressBar = (value, total, label) => `<div class="av3-progress" role="progressbar" aria-label="${escAttr(label)}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${value}"><i style="width:${total ? Math.min(100, value / total * 100).toFixed(1) : 0}%"></i></div>`;

function rewardHTML(achievement, cardById, backById) {
  const reward = achievement.reward || {};
  const card = reward.card && cardById.get(reward.card);
  const back = achievement.back && backById.get(achievement.back);
  return [reward.wood ? `[[icon:wood]] 木材 ×${reward.wood}` : '', reward.rations ? `[[icon:bread]] 口粮 ×${reward.rations}` : '', reward.keys ? `[[icon:key]] 钥匙 ×${reward.keys}` : '', reward.card ? `[[icon:cards]] ${esc(card?.name || '稀有卡牌')}` : '', back ? `[[icon:card-back]] 卡背 · ${esc(back.name)}` : ''].filter(Boolean).map(item => `<span>${item}</span>`).join('') || '<span>成就纪念</span>';
}

function medalDetailHTML(achievement, progressText, meta, cardById, backById) {
  const unlocked = meta.isUnlocked(achievement), claimed = meta.isClaimed(achievement.id);
  const progress = progressText(achievement.id);
  return `<div class="av3-medal-art">${achievementMedalHTML(achievement.id, 'detail', 'painted')}</div><div class="av3-detail-copy"><span class="av3-eyebrow">${stateLabel(unlocked, claimed)}</span><h3>${esc(achievement.name)}</h3><p class="av3-condition">${esc(achievement.desc)}</p>${progress ? `<p class="av3-detail-progress"><span>当前进度</span><strong>${progress}</strong></p>` : ''}<div class="av3-detail-rewards"><span>奖励预览</span>${rewardHTML(achievement, cardById, backById)}</div>${claimed ? '<span class="av3-seal">[[icon:check]] 已领取</span>' : unlocked ? `<button type="button" class="mini-btn ok base-command base-command-primary av3-primary" data-act="claimAch" data-id="${escAttr(achievement.id)}">领取奖励</button>` : '<span class="av3-seal pending">待完成</span>'}</div>`;
}

function inboxRewardHTML(label, name, condition, reward, action, id) {
  return `<article class="av3-inbox-reward"><div><small>${label} · 可领取</small><h3>${name}</h3>${condition}<span class="av3-prize-label">奖励预览</span><div class="av3-inbox-prize">${reward}</div></div><button class="mini-btn ok base-command base-command-primary" data-act="${action}" data-id="${escAttr(id)}">领取奖励</button></article>`;
}
function recordHTML(index, label, name, status, detail) {
  return `<button type="button" class="av12-record${index === 0 ? ' on' : ''}" data-act="archiveV12Record" data-index="${index}" aria-pressed="${index === 0}"><small>${label}</small><b>${name}</b><span>${status} ›</span></button><template data-record-source="${index}">${detail}</template>`;
}

function rewardInboxHTML(meta, cards) {
  const cardById = new Map(cards.all().map(card => [card.id, card]));
  const backById = new Map((cards.CARD_BACKS || []).map(back => [back.id, back]));
  const achievements = (meta.ACHIEVEMENTS || []).filter(item => meta.isUnlocked(item) && !meta.isClaimed(item.id));
  const collection = (meta.COLL_MILESTONES || []).filter(item => meta.collMsReached(item) && !meta.isCollClaimed(item.id));
  const rows = achievements.map(item => inboxRewardHTML('成就', esc(item.name), `<p class="av3-condition">${esc(item.desc)}</p>`, rewardHTML(item, cardById, backById), 'claimAch', item.id))
    .concat(collection.map(item => inboxRewardHTML('收藏', meta.collMsNeed(item) === meta.collTotal() ? '收集完成' : `收集 ${meta.collMsNeed(item)} 张`, '', meta.collRewardText(item), 'claimColl', item.id)));
  const records = [...achievements.map(item => ({ name:item.name, label:'成就奖励' })), ...collection.map(item => ({ name:meta.collMsNeed(item) === meta.collTotal() ? '收集完成' : `收集 ${meta.collMsNeed(item)} 张`, label:'收藏奖励' }))];
  return `<section class="av3-reward-inbox av12-record-workspace" data-empty="${rows.length === 0}"><div class="av12-record-list"><header><h3>待领取</h3><b>${rows.length}</b></header>${records.map((item, index) => recordHTML(index, item.label, esc(item.name), '可领取', rows[index])).join('')}<nav class="av3-reward-browse"><button class="base-link" data-act="hubCollectionView" data-view="achievements">成就目标 ›</button><button class="base-link" data-act="hubCollectionView" data-view="classes">收藏里程碑 ›</button></nav></div><aside class="av12-record-detail" aria-live="polite">${rows[0] || '<div class="av3-inbox-empty"><h3>当前没有待领取奖励</h3><p>奖励领完后仍可在成就目标与收藏里程碑查看记录。</p></div>'}</aside></section>`;
}

function achievementsHTML(base, meta, cards) {
  const rank = achievement => meta.isClaimed(achievement.id) ? 2 : meta.isUnlocked(achievement) ? 0 : 1;
  const cardById = new Map(cards.all().map(card => [card.id, card]));
  const backById = new Map((cards.CARD_BACKS || []).map(back => [back.id, back]));
  const entries = [...meta.ACHIEVEMENTS].sort((a, b) => rank(a) - rank(b));
  const progressText = entries.length ? createAchievementProgressReader(base) : () => '';
  const selected = entries.find(item => item.id === medalId) || entries[0];
  medalId = selected?.id || '';
  const pendingN = entries.filter(item => meta.isUnlocked(item) && !meta.isClaimed(item.id)).length;
  return `${pendingN ? `<div class="av3-honours-heading"><span class="av3-pending-count">${pendingN} 项待领取</span></div>` : ''}<div class="av3-honours-layout"><section class="av3-cabinet">${achievementFiltersHTML(meta)}<div class="av3-medals">${entries.map(achievement => {
    const unlocked = meta.isUnlocked(achievement), claimed = meta.isClaimed(achievement.id);
    return `<article class="ach-row av3-medal${unlocked ? ' done' : ''}${unlocked && !claimed ? ' claimable' : ''}${medalId === achievement.id ? ' selected' : ''}" data-status="${claimed ? 'done' : unlocked ? 'claimable' : 'progress'}" data-achievement="${escAttr(achievement.id)}" tabindex="-1"><button type="button" data-act="archiveV3Medal" data-id="${escAttr(achievement.id)}" aria-pressed="${medalId === achievement.id}" aria-label="${escAttr(achievement.name)}，${stateLabel(unlocked, claimed)}"><span class="av3-medal-thumb">${achievementMedalHTML(achievement.id, 'tile', 'painted')}</span><span class="av3-medal-label"><b>${esc(achievement.name)}</b><small>${progressText(achievement.id)}</small></span><span class="av3-medal-state">${stateLabel(unlocked, claimed)}</span></button><template class="av3-detail-source">${medalDetailHTML(achievement, progressText, meta, cardById, backById)}</template></article>`;
  }).join('')}</div></section><aside class="av3-medal-detail" aria-live="polite">${selected ? medalDetailHTML(selected, progressText, meta, cardById, backById) : '<h3>暂无成就档案</h3>'}</aside></div>`;
}

function collectionHTML(meta) {
  const progress = meta.collProgress(), total = meta.collTotal();
  const entries = meta.COLL_MILESTONES.map((milestone, index) => {
    const need = meta.collMsNeed(milestone), reached = meta.collMsReached(milestone), claimed = meta.isCollClaimed(milestone.id);
    const name = need === total ? '收集完成' : `收集 ${need} 张`;
    const detail = `<div class="av12-milestone-detail"><span class="av3-eyebrow">收藏里程碑 ${String(index + 1).padStart(2, '0')} · ${stateLabel(reached, claimed)}</span><h3>${name}</h3><div class="av12-milestone-value">${Math.min(progress, need)}<small> / ${need}</small></div>${progressBar(Math.min(progress, need), need, name)}<div class="av3-detail-rewards"><span>奖励预览</span>${meta.collRewardText(milestone)}</div>${claimed ? '<span class="av3-seal">[[icon:check]] 已领取</span>' : reached ? `<button type="button" class="mini-btn ok base-command base-command-primary" data-act="claimColl" data-id="${escAttr(milestone.id)}">领取奖励</button>` : '<span class="av3-seal pending">待完成</span>'}</div>`;
    return { name, detail, status:claimed ? '已领取' : reached ? '可领取' : `未达成 · ${Math.min(progress, need)} / ${need}` };
  });
  return `<section class="av3-collection-overview" aria-label="全员收藏奖励"><div class="av12-summary"><span>已收藏</span><strong>${progress}<small> / ${total}</small></strong>${progressBar(progress, total, '全员收藏进度')}</div><div class="av12-record-workspace"><div class="av12-record-list">${entries.map((item, index) => recordHTML(index, String(index + 1).padStart(2, '0'), item.name, item.status, item.detail)).join('')}</div><aside class="av12-record-detail" aria-live="polite">${entries[0]?.detail || '<h3>暂无收藏里程碑</h3>'}</aside></div></section>`;
}

function backsHTML(base, meta, cards) {
  const backs = cards.CARD_BACKS || [];
  const selected = backs.find(back => back.id === backId) || backs.find(back => back.id === base.backSel()) || backs[0];
  if (!selected) return '<p class="av3-empty">暂无卡背档案</p>';
  backId = selected.id;
  const unlocked = base.isBackUnlocked(selected.id), equipped = base.backSel() === selected.id;
  const achievement = meta.ACHIEVEMENTS.find(item => item.back === selected.id);
  return `<div class="av3-backs"><div class="av12-back-stage"><div class="av3-back-display">${cards.cardBackHTML(selected.id)}</div></div><div class="av3-back-shelves">${backs.map(back => `<button type="button" class="av3-back${back.id === selected.id ? ' on' : ''}${base.isBackUnlocked(back.id) ? '' : ' locked'}" data-act="archiveV3Back" data-id="${escAttr(back.id)}" aria-pressed="${back.id === selected.id}" aria-label="预览${escAttr(back.name)}"><span>${cards.cardBackHTML(back.id)}</span><b>${esc(back.name)}</b><small>${base.isBackUnlocked(back.id) ? base.backSel() === back.id ? '使用中' : '已解锁' : '未解锁'}</small></button>`).join('')}</div><aside class="av3-back-detail"><span class="av3-eyebrow">外观预览</span><h3>${esc(selected.name)}</h3><p>${esc(selected.from || '默认卡背')}</p><p class="av3-preview-note">${equipped ? '用于背包与牌库。' : unlocked ? '应用后用于背包与牌库。' : '完成目标并领取奖励后解锁。'}</p>${!unlocked && achievement ? `<div class="av3-back-condition"><b>${esc(achievement.name)}</b><p>${esc(achievement.desc)}</p><button type="button" class="mini-btn base-command" data-act="archiveLocate" data-id="${escAttr(achievement.id)}">查看解锁目标 →</button></div>` : ''}<button type="button" class="mini-btn ok base-command base-command-primary av3-primary" data-act="selBack" data-id="${escAttr(selected.id)}"${!unlocked || equipped ? ' disabled' : ''}>${equipped ? '使用中' : unlocked ? '应用卡背' : '未解锁'}</button></aside></div>`;
}

function storiesHTML(base) {
  const checked = validateLastLampState(base.data.story);
  if (!checked.ok) return '<div class="av3-empty"><h3>见闻记录暂不可读</h3><p>原记录已保留。</p><button type="button" class="mini-btn base-command" data-act="hubRetryView">重新读取</button></div>';
  const state = checked.value;
  return `<section class="av3-story-room"><header><h3>北门灯标</h3><span>${state.stage} / 3 段已记录</span></header><div class="story-workspace av3-story-layout"><nav class="story-list" aria-label="见闻段落">${[1, 2, 3].map(segment => `<button type="button" class="story-entry${segment <= state.stage ? ' recorded' : ''}" data-act="archiveStoryPick" data-segment="${segment}"${segment > state.stage ? ' disabled' : ''}><small>0${segment}</small><b>${segment === 3 && state.stage === 3 ? state.ending === 'open_beacon' ? '北门远灯' : '遮光近照' : `第${['一', '二', '三'][segment - 1]}段记录`}</b><span>${segment <= state.stage ? '已记录' : segment === state.stage + 1 ? '待续' : '未记录'}</span></button>`).join('')}</nav><article class="story-reader" aria-live="polite">${state.stage ? '<p>正在打开见闻…</p>' : '<h3>尚无见闻</h3><p>远征途中留下的见闻会收入这里。</p>'}</article></div></section>`;
}

/** Presentation only. Rewards, card-back application and card preview stay in the parent hub. */
export function archiveV3HTML({ base, meta, cards, view = 'cards' }) {
  resetForSlot(base);
  const currentView = SECTIONS.some(([key]) => key === view) ? view : 'cards';
  const content = currentView === 'cards' ? collectionCardsHTML(base, cards) : currentView === 'rewards' ? rewardInboxHTML(meta, cards) : currentView === 'classes' ? collectionHTML(meta) : currentView === 'backs' ? backsHTML(base, meta, cards) : currentView === 'stories' ? storiesHTML(base) : achievementsHTML(base, meta, cards);
  const heading = SECTIONS.find(([key]) => key === currentView)[1];
  const navigation = `<nav class="av12-directory" aria-label="收藏室目录">${SECTIONS.map(([key, title], index) => `<button type="button" class="${currentView === key ? 'on' : ''}" data-act="hubCollectionView" data-view="${key}" aria-pressed="${currentView === key}"><small>${String(index + 1).padStart(2, '0')}</small><b>${title}</b><span aria-hidden="true">›</span></button>`).join('')}</nav>`;
  return `<section class="hub-archive-v3 archive-v12" data-archive-view="${currentView}"><header class="av3-header"><h2>收藏室</h2><span>${heading}</span></header><div class="av12-workspace">${navigation}<main class="av12-content">${content}</main></div></section>`;
}

/** Update card-back contents without remounting the archive's glass panels. */
export function refreshArchiveBacks({ base, meta, cards, direction = 0 }) {
  const root = document.querySelector('#hubMain .hub-archive-v3[data-archive-view="backs"]');
  if (!root) return false;
  const source = document.createElement('template');
  source.innerHTML = backsHTML(base, meta, cards);
  // Retain the glass panels and directory; only their changing contents are replaced.
  for (const selector of ['.av3-back-display', '.av3-back-detail']) {
    const target = root.querySelector(selector), next = source.content.querySelector(selector);
    if (target && next && target.innerHTML !== next.innerHTML) {
      target.innerHTML = next.innerHTML;
      if (direction && selector === '.av3-back-display') animateBaseSwitch(target, direction);
    }
  }
  root.querySelectorAll('[data-act="archiveV3Back"]').forEach(button => {
    const on = /** @type {HTMLElement} */ (button).dataset.id === backId;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
    button.querySelector('small').textContent = base.isBackUnlocked(/** @type {HTMLElement} */ (button).dataset.id)
      ? base.backSel() === /** @type {HTMLElement} */ (button).dataset.id ? '使用中' : '已解锁' : '未解锁';
  });
  return true;
}

/** Call after bindArchive(ui), which owns filtering, target location and story loading. */
export function bindArchiveV3({ ui, base = window.SDT.Base, meta = window.SDT.Meta, cards }) {
  const root = /** @type {HTMLElement} */ (document.querySelector('#hubMain .hub-archive-v3'));
  if (!root) return;
  let recordMarkup = root.querySelector('.av12-record-detail')?.innerHTML || '';
  let medalMarkup = root.querySelector('.av3-medal-detail')?.innerHTML || '';
  bindRewardFeedback({ root, base, meta, cards, ui });
  bindCollectionCards({ root, base, cards, ui });
  ui.act('archiveV12Record', data => {
    const source = root.querySelector(`template[data-record-source="${Number(data.index)}"]`);
    const detail = root.querySelector('.av12-record-detail');
    if (!source || !detail) return;
    const records = [...root.querySelectorAll('[data-act="archiveV12Record"]')];
    const from = records.findIndex(button => button.getAttribute('aria-pressed') === 'true');
    const to = records.findIndex(button => button.getAttribute('data-index') === String(data.index));
    root.querySelectorAll('[data-act="archiveV12Record"]').forEach(button => {
      const on = /** @type {HTMLElement} */ (button).dataset.index === data.index;
      button.classList.toggle('on', on); button.setAttribute('aria-pressed', String(on));
    });
    if (recordMarkup !== source.innerHTML) {
      recordMarkup = source.innerHTML;
      detail.innerHTML = recordMarkup;
      animateBaseSwitch(detail, to - from);
    }
  });
  const selectMedal = data => {
    const row = [...root.querySelectorAll('.av3-medal')].find(item => /** @type {HTMLElement} */ (item).dataset.achievement === data.id);
    const source = row?.querySelector('.av3-detail-source'), detail = root.querySelector('.av3-medal-detail');
    if (!source || !detail || /** @type {HTMLElement} */ (row).hidden) return;
    const medals = [...root.querySelectorAll('.av3-medal')];
    const from = medals.findIndex(item => item.classList.contains('selected'));
    const to = medals.indexOf(row);
    medalId = data.id;
    root.querySelectorAll('.av3-medal').forEach(item => {
      const selected = item === row;
      item.classList.toggle('selected', selected);
      item.querySelector('[data-act="archiveV3Medal"]')?.setAttribute('aria-pressed', String(selected));
    });
    if (medalMarkup !== source.innerHTML) {
      medalMarkup = source.innerHTML;
      detail.innerHTML = medalMarkup;
      animateBaseSwitch(detail, to - from);
    }
  };
  const reconcileMedalSelection = () => {
    const detail = root.querySelector('.av3-medal-detail');
    if (!detail) return;
    const rows = [...root.querySelectorAll('.av3-medal')];
    const visible = rows.filter(row => !/** @type {HTMLElement} */ (row).hidden);
    // Match the collection-card directory: preserve an available selection,
    // otherwise choose the first result; never leave a hidden item's details.
    if (visible.some(row => /** @type {HTMLElement} */ (row).dataset.achievement === medalId && row.classList.contains('selected'))) return;
    if (visible.length) selectMedal({ id: /** @type {HTMLElement} */ (visible[0]).dataset.achievement });
    else {
      medalId = '';
      rows.forEach(row => {
        row.classList.remove('selected');
        row.querySelector('[data-act="archiveV3Medal"]')?.setAttribute('aria-pressed', 'false');
      });
      medalMarkup = '<h3>没有匹配的成就</h3>';
      if (detail.innerHTML !== medalMarkup) detail.innerHTML = medalMarkup;
    }
  };
  root.addEventListener('archive-filter-change', reconcileMedalSelection);
  reconcileMedalSelection(); // bindArchive applied retained filters before this view bound.
  ui.act('archiveV3Medal', selectMedal);
  // archiveLocate focuses the real target after changing sections; reveal its details with it.
  root.addEventListener('focusin', event => {
    if (/** @type {Element} */ (event.target).matches('.av3-medal[data-achievement]')) selectMedal({ id: /** @type {HTMLElement} */ (event.target).dataset.achievement });
  });
  ui.act('archiveV3Back', data => {
    if (!(cards.CARD_BACKS || []).some(back => back.id === data.id) || backId === data.id) return;
    const ids = (cards.CARD_BACKS || []).map(back => back.id);
    const direction = Math.sign(ids.indexOf(data.id) - ids.indexOf(backId)) || 1;
    backId = data.id;
    refreshArchiveBacks({ base, meta, cards, direction });
  });
  // Keep the reader useful immediately; the parent loader guards slot and async request identity.
  if (root.dataset.archiveView === 'stories') /** @type {HTMLElement} */ ([...root.querySelectorAll('.story-entry.recorded')].at(-1))?.click();
}
