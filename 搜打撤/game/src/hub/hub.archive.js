import { esc, escAttr } from '../core/shared.js';
import { lastLampNarrative } from '../home/narrative.js';
import { validateLastLampState } from '../home/story.last-lamp.js';

let slot = null, status = 'all', query = '', storyRequest = 0;
export function achievementFiltersHTML(meta) {
  if (slot !== window.SDT.Base.slot) { slot = window.SDT.Base.slot; status = 'all'; query = ''; }
  const category = achievement => meta.isClaimed(achievement.id) ? 'done' : meta.isUnlocked(achievement) ? 'claimable' : 'progress';
  return `<div class="archive-toolbar"><nav class="archive-status" aria-label="成就状态">${[['all', '全部'], ['claimable', '可领取'], ['progress', '未达成'], ['done', '已领取']].map(([id, name]) => `<button class="mini-btn${status === id ? ' ok' : ''}" data-act="archiveStatus" data-status="${id}" aria-pressed="${status === id}">${name} <small>${meta.ACHIEVEMENTS.filter(a => id === 'all' || category(a) === id).length}</small></button>`).join('')}</nav><input class="archive-search" aria-label="搜索成就名称与目标" placeholder="搜索成就或目标" value="${escAttr(query)}"></div><div class="archive-empty" role="status" hidden></div>`;
}
// A presentation snapshot for one synchronous render, never retained between opens.
export function createAchievementProgressReader(base) {
  const d = base.data, s = d.stats || {}, pets = Object.values(d.pets || {}), max = values => Math.max(0, ...values);
  const targets = {
    firstExtract: [s.extracts || 0, 1], extract3: [s.extracts || 0, 3], kill10: [s.kills || 0, 10],
    firstBoss: [(s.bossKills || []).length, 1], allBoss: [(s.bossKills || []).length, 3], rich30: [s.bestRunCoins || 0, 30], stash20: [s.stashTotal || 0, 20],
    bagMax: [base.bagCap(), window.SDT.MAP.rules.bagMax], safeMax: [base.safeCap(), window.SDT.MAP.rules.safeMax],
    class3: [max(Object.values(d.characters || d.classes || {}).map(c => c.lv || 1)), 3], collectGold: [d.collection?.['tt-gold'] ? 1 : 0, 1], collectLegend: [Object.values(d.collection || {}).filter(c => c.rarity === '传说').length, 1], collect5: [Object.keys(d.collection || {}).length, 5],
    petHatch1: [Math.max(0, pets.length - 1), 1], petHatch3: [Math.max(0, pets.length - 1), 3], petMax: [max(pets.map(p => p.lv || 1)), 5], petAll: [pets.length, base.PETS.length],
    unlimitedEnergy: [s.turnMovesMax || 0, 10], weaponMaster: [s.battleEquipsMax || 0, 5], runeFan: [new Set((d.runes || []).flatMap(r => r.attrs || [])).size, 5], savior: [(s.nestBossKills || []).length, 2], beautifulVase: [(d.runes || []).some(r => r.attrs?.length >= 2 && r.kind === 'rainbow') ? 1 : 0, 1], excuseMe: [s.reviveKills || 0, 1],
    labScore1: [s.labTotalScore || 0, 500], labScore2: [s.labTotalScore || 0, 1500], labScore3: [s.labTotalScore || 0, 4000]
  };
  return id => {
    const progress = targets[id];
    return progress ? `${Math.min(progress[0], progress[1])} / ${progress[1]}` : '';
  };
}
export function achievementProgressText(id, base) {
  return createAchievementProgressReader(base)(id);
}
export function bindArchive(ui, { openAchievements = () => document.querySelector('#hubMain [data-act="hubCollectionView"][data-view="achievements"]')?.click() } = {}) {
  storyRequest++;
  const apply = () => {
    for (const row of document.querySelectorAll('#hubMain .ach-row[data-status]')) row.hidden = (status !== 'all' && row.dataset.status !== status) || (!!query.trim() && !row.textContent.includes(query.trim()));
    const empty = document.querySelector('#hubMain .archive-empty');
    if (empty) { empty.hidden = [...document.querySelectorAll('#hubMain .ach-row')].some(row => !row.hidden); empty.innerHTML = `<h3>${query.trim() ? '没有匹配的成就' : status === 'claimable' ? '当前没有待领取奖励' : status === 'done' ? '尚未领取成就奖励' : '当前分类没有成就'}</h3><p>${query.trim() ? '调整关键词，或查看全部目标。' : status === 'claimable' ? '完成下方目标后，奖励会出现在这里。' : '可以返回全部目标继续浏览。'}</p><button class="mini-btn" data-act="archiveReset">查看全部目标</button>`; }
    for (const button of document.querySelectorAll('#hubMain [data-act="archiveStatus"]')) { button.classList.toggle('ok', button.dataset.status === status); button.setAttribute('aria-pressed', String(button.dataset.status === status)); }
    // A local notification lets list/detail views reconcile after every filter path.
    document.querySelector('#hubMain .archive-toolbar')?.dispatchEvent(new Event('archive-filter-change', { bubbles: true }));
  };
  apply();
  document.querySelector('#hubMain .archive-search')?.addEventListener('input', event => { query = event.target.value; apply(); });
  ui.act('archiveReset', () => { status = 'all'; query = ''; const input = document.querySelector('#hubMain .archive-search'); if (input) input.value = ''; apply(); });
  ui.act('archiveStatus', data => { if (!['all', 'claimable', 'progress', 'done'].includes(data.status)) return; status = data.status; apply(); });
  ui.act('archiveLocate', data => {
    status = 'all'; query = '';
    openAchievements();
    const row = [...document.querySelectorAll('#hubMain .ach-row')].find(item => item.dataset.achievement === data.id);
    row?.scrollIntoView({ block: 'center', behavior: 'auto' }); row?.focus({ preventScroll: true });
  });
  ui.act('archiveStoryPick', async data => {
    const base = window.SDT.Base, checked = validateLastLampState(base.data.story), segment = Number(data.segment);
    if (!checked.ok || ![1, 2, 3].includes(segment) || segment > checked.value.stage) return;
    const reader = document.querySelector('#hubMain .story-reader'), currentSlot = base.slot, request = ++storyRequest;
    if (!reader) return;
    for (const button of document.querySelectorAll('#hubMain .story-entry')) button.classList.toggle('on', Number(button.dataset.segment) === segment);
    reader.innerHTML = '<p>正在打开已记录的见闻…</p>';
    let narrative;
    try { narrative = await lastLampNarrative(segment); } catch { narrative = null; }
    if (!reader.isConnected || base.slot !== currentSlot || request !== storyRequest) return;
    const ending = segment === 3 ? checked.value.ending === 'open_beacon' ? '你让灯光越过风雪，公共疏散线也随之暴露。' : '你让窄光留在墙边，近路仍隐蔽，远处却看不见出口。' : '';
    reader.innerHTML = `<small>CHAPTER 0${segment} / 已记录</small><h3>最后一盏引路灯</h3>${narrative?.intro ? narrative.intro.split(/\n+/).filter(Boolean).map(text => `<p>${esc(text)}</p>`).join('') : '<p>正文暂时无法载入，段落记录仍在。重新选取此段可以重试。</p>'}${ending ? `<blockquote>${ending}</blockquote>` : ''}`;
  });
}
