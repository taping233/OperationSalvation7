import { esc, escAttr } from '../core/shared.js';
import { lastLampNarrative } from '../home/narrative.js';
import { validateLastLampState } from '../home/story.last-lamp.js';

let slot = null, preview = '', status = 'all', query = '', storyRequest = 0;
export function cardBackGalleryHTML(base, cards) {
  if (slot !== base.slot) { slot = base.slot; preview = ''; status = 'all'; query = ''; }
  const backs = cards.CARD_BACKS || [];
  const selected = backs.find(back => back.id === preview) || backs.find(back => back.id === base.backSel()) || backs[0];
  if (!selected) return '<p>暂无卡背档案</p>';
  preview = selected.id;
  const unlocked = base.isBackUnlocked(selected.id), equipped = base.backSel() === selected.id;
  const achievement = window.SDT.Meta.ACHIEVEMENTS.find(item => item.back === selected.id);
  return `<div class="archive-backs-layout"><div class="back-grid">${backs.map(back => `<button type="button" class="back-card${back.id === preview ? ' on' : ''}${base.isBackUnlocked(back.id) ? '' : ' locked'}" data-act="previewBack" data-id="${escAttr(back.id)}" aria-pressed="${back.id === preview}" aria-label="预览${escAttr(back.name)}"><span class="back-thumb">${cards.cardBackHTML(back.id)}</span><b>${esc(back.name)}</b><span class="dim">${base.isBackUnlocked(back.id) ? base.backSel() === back.id ? '使用中' : '已解锁' : '[[icon:lock]] 未解锁'}</span></button>`).join('')}</div><aside class="archive-back-preview"><small>CARD BACK / 外观预览</small><div class="back-preview-art">${cards.cardBackHTML(selected.id)}</div><h3>${esc(selected.name)}</h3><p>${esc(selected.from || '默认卡背')}</p>${!unlocked && achievement ? `<div class="back-unlock-condition"><b>${esc(achievement.name)}</b><p>${esc(achievement.desc)}</p><button class="mini-btn" data-act="archiveLocate" data-id="${escAttr(achievement.id)}">查看解锁目标 →</button></div>` : ''}<button class="mini-btn ok" data-act="selBack" data-id="${escAttr(selected.id)}"${!unlocked || equipped ? ' disabled' : ''}>${equipped ? '当前使用' : unlocked ? '应用卡背' : '完成目标并领取奖励后解锁'}</button></aside></div>`;
}
export function achievementFiltersHTML(meta) {
  if (slot !== window.SDT.Base.slot) { slot = window.SDT.Base.slot; preview = ''; status = 'all'; query = ''; }
  const category = achievement => meta.isClaimed(achievement.id) ? 'done' : meta.isUnlocked(achievement) ? 'claimable' : 'progress';
  return `<div class="archive-toolbar"><nav class="archive-status" aria-label="成就状态">${[['all', '全部'], ['claimable', '可领取'], ['progress', '未达成'], ['done', '已领取']].map(([id, name]) => `<button class="mini-btn${status === id ? ' ok' : ''}" data-act="archiveStatus" data-status="${id}" aria-pressed="${status === id}">${name} <small>${meta.ACHIEVEMENTS.filter(a => id === 'all' || category(a) === id).length}</small></button>`).join('')}</nav><input class="archive-search" aria-label="搜索成就名称与目标" placeholder="搜索成就或目标" value="${escAttr(query)}"></div><div class="archive-empty" role="status" hidden></div>`;
}
export function achievementProgressText(id, base) {
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
  const progress = targets[id];
  return progress ? `${Math.min(progress[0], progress[1])} / ${progress[1]}` : '';
}
export function storyArchiveHTML(checked) {
  if (!checked.ok) return '<div class="camp-empty"><h3>见闻记录暂不可读</h3><p>原记录已保留。</p><button class="mini-btn" data-act="hubRetryView">重新读取</button></div>';
  const state = checked.value;
  return `<div class="story-library"><header><small>FIELD MEMORIES / 见闻档案</small><h3>最后一盏引路灯</h3><p>已记录 ${state.stage} / 3 段 · 在不同远征中续写</p></header><div class="story-workspace"><nav class="story-list" aria-label="故事段落">${[1, 2, 3].map(segment => `<button class="story-entry${segment <= state.stage ? ' recorded' : ''}" data-act="archiveStoryPick" data-segment="${segment}"${segment > state.stage ? ' disabled' : ''}><small>CHAPTER 0${segment}</small><b>${segment === 3 && state.stage === 3 ? state.ending === 'open_beacon' ? '北门远灯' : '遮光近照' : `第${['一', '二', '三'][segment - 1]}段记录`}</b><span>${segment <= state.stage ? '阅读已记录见闻 →' : segment === state.stage + 1 ? '等待下一次远征' : '尚未记录'}</span></button>`).join('')}</nav><article class="story-reader" aria-live="polite"><small>READING ROOM</small><h3>${state.stage ? '选择见闻' : '暂无见闻记录'}</h3><p>${state.stage ? '点击左侧已记录的段落阅读。' : '在远征途中遇到环境故事后，已记录内容会保存在这里。'}</p><span class="hint">见闻记录不改变地图与战力。</span></article></div></div>`;
}
export function bindArchive(ui, refresh) {
  storyRequest++;
  const apply = () => {
    for (const row of document.querySelectorAll('#hubMain .ach-row[data-status]')) row.hidden = (status !== 'all' && row.dataset.status !== status) || (!!query.trim() && !row.textContent.includes(query.trim()));
    const empty = document.querySelector('#hubMain .archive-empty');
    if (empty) { empty.hidden = [...document.querySelectorAll('#hubMain .ach-row')].some(row => !row.hidden); empty.innerHTML = `<h3>${query.trim() ? '没有匹配的成就' : status === 'claimable' ? '当前没有待领取奖励' : status === 'done' ? '尚未领取成就奖励' : '当前分类没有成就'}</h3><p>${query.trim() ? '调整关键词，或查看全部目标。' : status === 'claimable' ? '完成下方目标后，奖励会出现在这里。' : '可以返回全部目标继续浏览。'}</p><button class="mini-btn" data-act="archiveReset">查看全部目标</button>`; }
    for (const button of document.querySelectorAll('#hubMain [data-act="archiveStatus"]')) { button.classList.toggle('ok', button.dataset.status === status); button.setAttribute('aria-pressed', String(button.dataset.status === status)); }
  };
  apply();
  document.querySelector('#hubMain .archive-search')?.addEventListener('input', event => { query = event.target.value; apply(); });
  ui.act('archiveReset', () => { status = 'all'; query = ''; const input = document.querySelector('#hubMain .archive-search'); if (input) input.value = ''; apply(); });
  ui.act('archiveStatus', data => { if (!['all', 'claimable', 'progress', 'done'].includes(data.status)) return; status = data.status; apply(); });
  ui.act('previewBack', data => { preview = data.id; refresh(); });
  ui.act('archiveLocate', data => {
    status = 'all'; query = '';
    document.querySelector('[data-act="hubCollectionView"][data-view="achievements"]')?.click();
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
