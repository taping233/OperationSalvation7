import { linkedCostsHTML } from '../ui/home-linked-interactions.js';
import { esc, escAttr } from '../core/shared.js';
import { characterFor } from '../core/characters.js';
import { getCharacter } from './collection.commands.js';
import { MAP } from '../run/game.session.js';
import { partnerPortrait } from './hub.visuals.js';
import { bindCardNavigation } from './hub.presentation.js';
import { cardBrowserHTML, bindCardBrowser, refreshCardBrowser } from '../ui/card-browser.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';

const browse = { slot: null, group: 'people', section: 'profile', pet: '', skins: new Map(), hatch: false, poolCharacter: '', poolPick: '', query: '', poolStatus: '', poolType: '' };
export const personnelViewKey = () => `${browse.group}/${browse.section}/${browse.pet}`;
export function setPersonnelGroup(group) { browse.group = group === 'pets' ? 'pets' : 'people'; }
const tab = (action, field, value, label, selected) => `<button type="button" class="mini-btn${selected ? ' ok' : ''}" data-act="${action}" data-${field}="${value}" aria-pressed="${selected}">${label}</button>`;
function petsHTML(base) {
  const pets = base.PETS || [];
  const owned = base.ownedPets();
  const selected = pets.find(pet => pet.id === browse.pet) || base.carriedPet() || pets[0];
  if (!selected) return '<div class="camp-empty"><h3>暂无伙伴档案</h3></div>';
  browse.pet = selected.id;
  const have = owned.includes(selected.id);
  const lv = have ? base.petLevel(selected.id) : 1;
  const maxed = lv >= base.PET_LEVEL_MAX;
  const cost = base.petUpCost(selected.id);
  const safe = Math.min(MAP.rules.safeMax, MAP.rules.safeStart + lv - 1) + (selected.effect?.safeBonus || 0);
  const nextSafe = Math.min(MAP.rules.safeMax, MAP.rules.safeStart + lv) + (selected.effect?.safeBonus || 0);
  const carried = base.carriedPet()?.id === selected.id;
  const eggs = base.data.stash.filter(stack => stack.card.id === base.PET_EGG_ID).reduce((n, stack) => n + stack.count, 0);
  const hatchReady = eggs > 0 && base.data.coins >= base.HATCH_COST && owned.length < pets.length;
  const missing = [eggs ? '' : '缺少 1 枚伙伴蛋', base.data.coins >= base.HATCH_COST ? '' : `还需 ${base.HATCH_COST - base.data.coins} 储备币`].filter(Boolean).join(' · ');
  return `<div class="companion-toolbar"><span>已相遇 <b>${owned.length}/${pets.length}</b> · 当前随行 <b>${esc(base.carriedPet()?.name || '未携带')}</b></span><button class="mini-btn${browse.hatch ? ' ok' : ''}" data-act="personHatchView" aria-expanded="${browse.hatch}">[[icon:paw]] 孵化新伙伴 <small>${eggs} 枚蛋</small></button></div>
    ${browse.hatch ? `<section class="companion-hatch"><div><small>NEW COMPANION</small><h3>伙伴孵化</h3><p>随机获得一位尚未拥有的伙伴。</p></div>${linkedCostsHTML([{name: "伙伴蛋", have: eggs, need: 1}, {name: "储备币", have: base.data.coins, need: base.HATCH_COST}])}<div><button class="mini-btn ok" data-act="personHatch"${hatchReady ? '' : ' disabled'}>孵化伙伴</button>${owned.length >= pets.length || missing ? `<p class="hint" role="status">${owned.length >= pets.length ? '所有伙伴已相遇' : missing}</p>` : ''}</div></section>` : ''}
    <div class="person-stage partner-stage"><nav class="person-roster" aria-label="伙伴档案切换">${pets.map(pet => `<button class="person-face${pet.id === selected.id ? ' on' : ''}${owned.includes(pet.id) ? '' : ' unowned'}" data-act="personPet" data-id="${pet.id}" aria-label="查看${escAttr(pet.name)}" aria-pressed="${pet.id === selected.id}">${partnerPortrait(pet.id)}<b>${esc(pet.name)}</b><small>${base.carriedPet()?.id === pet.id ? '随行中' : owned.includes(pet.id) ? `Lv.${base.petLevel(pet.id)}` : '未相遇'}</small></button>`).join('')}</nav>
    <div class="partner-display${have ? '' : ' unowned'}"><small>EXPEDITION COMPANION / 0${pets.indexOf(selected) + 1}</small>${partnerPortrait(selected.id)}<h3>${esc(selected.name)}</h3><span class="partner-state${carried ? ' carried' : ''}">${carried ? '随行中' : have ? '已相遇' : '未相遇'}</span><p>${esc(selected.desc.replace(/^携带效果：/, ''))}</p></div>
    <article class="person-details partner-details"><header><small>COMPANION DOSSIER</small><h3>随行能力</h3></header><dl class="warehouse-facts"><div><dt>等级</dt><dd>${have ? `Lv.${lv}` : '未相遇'}</dd></div><div><dt>${have ? '携带时安全格' : '初次携带安全格'}</dt><dd>${safe} 格</dd></div></dl>
    <button class="mini-btn ok" data-act="selPet" data-id="${selected.id}"${!have || carried ? ' disabled' : ''}>${carried ? '当前随行伙伴' : have ? '携带出征' : '相遇后可携带'}</button>
    <section><h4>${have ? '本次培养' : '相遇途径'}</h4>${have ? `<div class="companion-growth"><span>Lv.${lv}<b>→</b>${maxed ? 'MAX' : `Lv.${lv + 1}`}</span><span>安全格 ${safe}<b>→</b>${maxed ? safe : nextSafe}</span></div>${linkedCostsHTML([{name: "口粮", have: base.data.rations, need: maxed ? null : cost}])}<button class="mini-btn ok" data-act="upPet" data-id="${selected.id}"${maxed || base.data.rations < cost ? ' disabled' : ''}>${maxed ? '已达培养上限' : '培养伙伴'}</button><p class="hint">${maxed ? '伙伴已完成培养' : base.data.rations < cost ? `还需 ${cost - base.data.rations} 口粮` : '安全格加成在携带时生效'}</p>` : '<p>在远征宝箱中取得伙伴蛋，回到基地孵化，与尚未拥有的伙伴相遇。</p><button class="mini-btn" data-act="personHatchView">查看孵化条件</button>'}</section></article></div>`;
}
function poolRecord(card, base) {
  return !window.SDT.Meta.isCollectible(card) ? { id: 'excluded', label: '不计入人物归档' } : base.isCollected(card) ? { id: 'recorded', label: '已归档' } : { id: 'unrecorded', label: '未归档' };
}
function poolHTML(pool, base, cards) {
  return `<div class="pool-controls"><div class="person-pool-toolbar"><nav class="pool-type-tabs" aria-label="招式类型">${[['', '全部'], ...[...new Set(pool.map(card => card.type).filter(Boolean))].map(type => [type, type])].map(([type, label]) => `<button class="mini-btn${browse.poolType === type ? ' ok' : ''}" data-act="personPoolType" data-type="${escAttr(type)}" aria-pressed="${browse.poolType === type}">${esc(label)}</button>`).join('')}</nav><input data-person-pool="query" value="${escAttr(browse.query)}" placeholder="搜索招式" aria-label="搜索人物卡池"><select data-person-pool="status" aria-label="筛选人物卡池归档状态"><option value="">全部归档状态</option><option value="recorded"${browse.poolStatus === 'recorded' ? ' selected' : ''}>已归档</option><option value="unrecorded"${browse.poolStatus === 'unrecorded' ? ' selected' : ''}>未归档</option><option value="excluded"${browse.poolStatus === 'excluded' ? ' selected' : ''}>不计入归档</option></select><span data-person-pool-count></span></div></div>${cardBrowserHTML(`person-pool-${browse.poolCharacter}`, '人物专属招式', pool.map(card => `<button class="person-pool-card" data-browser-key="${escAttr(card.id)}" data-id="${escAttr(card.id)}" data-search="${escAttr(card.name + ' ' + card.desc)}" data-recorded="${poolRecord(card, base).id}" data-type="${escAttr(card.type || '')}" aria-label="放大查看${escAttr(card.name)}"><span class="pool-card-art">${cards.cardHTML(card, 'sm')}</span><b>${esc(card.name)}</b><span>${poolRecord(card, base).label}</span></button>`).join(''))}<div class="pool-empty" hidden><h4>没有匹配的招式</h4><button class="mini-btn" data-act="personPoolReset">显示全部</button></div>`;
}
export function personnelHTML(view) {
  const { Base: base, Meta: meta, Art: art, Cards: cards } = window.SDT;
  if (browse.slot !== base.slot) { browse.slot = base.slot; browse.skins.clear(); browse.pet = ''; browse.hatch = false; browse.poolCharacter = ''; }
  const header = `<header class="camp-section-head"><h2>队员</h2><nav class="person-groups" aria-label="远征者分类">${tab('personGroup', 'group', 'people', '人物档案', browse.group === 'people')}${tab('personGroup', 'group', 'pets', '远征伙伴', browse.group === 'pets')}</nav></header>`;
  if (browse.group === 'pets') return `<div class="personnel-v2" data-section="companions">${header}${petsHTML(base)}</div>`;
  const roster = meta.classSummary().map(stats => ({ stats, character: characterFor(stats.cls) })).filter(entry => entry.character);
  const selected = roster.find(entry => entry.character.id === view) || roster[0];
  if (!selected) return `${header}<div class="camp-empty">暂无人物档案</div>`;
  const { stats, character } = selected;
  if (browse.poolCharacter !== character.id) { browse.poolCharacter = character.id; browse.poolPick = ''; browse.query = ''; browse.poolStatus = ''; browse.poolType = ''; }
  const owned = getCharacter(base.data, character.id);
  const equipped = owned?.selectedSkinId || 'default';
  const skin = browse.skins.get(character.id) || equipped;
  const skins = owned?.availableSkinIds || ['default'];
  const skinNames = new Map(art.listSkins(stats.cls).map(item => [item.id, item.name]));
  const pool = cards.classPool(stats.cls);
  const pct = stats.maxed ? 100 : Math.min(100, stats.need ? stats.xp / stats.need * 100 : 0);
  let content;
  if (browse.section === 'appearance') content = `<small>WARDROBE / 外观</small><h4>${esc(skinNames.get(skin) || '默认外观')}</h4><p class="appearance-current">${skin === equipped ? '当前已装备' : '预览中'}</p><div class="person-skin-grid">${skins.map(id => `<button class="person-skin${id === skin ? ' on' : ''}${id === equipped ? ' equipped' : ''}" data-act="personPreviewSkin" data-character="${character.id}" data-skin="${escAttr(id)}" aria-pressed="${id === skin}"><img src="${escAttr(art.skinUrl(stats.cls, id))}" alt="${escAttr(skinNames.get(id) || '默认外观')}" loading="lazy"><b>${esc(skinNames.get(id) || '默认')}</b><small>${id === equipped ? '已装备' : id === skin ? '预览中' : ''}</small></button>`).join('')}</div><button class="mini-btn ok appearance-apply" data-act="selectCharacterSkin" data-character="${character.id}" data-skin="${escAttr(skin)}"${skin === equipped ? ' disabled' : ''}>${skin === equipped ? '当前外观已装备' : '应用此外观'}</button>`;
  else if (browse.section === 'pool') content = poolHTML(pool, base, cards);
  else content = `<dl class="warehouse-facts"><div><dt>熟练度</dt><dd>Lv.${stats.lv}${stats.maxed ? ' · MAX' : ''}</dd></div><div><dt>专属招式</dt><dd>${stats.pool} 张</dd></div></dl><section><h4>出征加成</h4><p class="person-perk-value">${esc(meta.perkText(stats.lv))}</p>${stats.maxed ? '' : `<p class="hint">下一级 · ${esc(meta.perkText(stats.lv + 1))}</p>`}</section><section><h4>代表招式</h4><p>${pool.slice(0, 3).map(card => esc(card.name)).join(' / ') || '暂无招式'}</p></section><section><h4>熟练度进度</h4><div class="person-progress-track"><i style="width:${pct}%"></i></div><p>${stats.maxed ? '熟练度已满' : `${stats.xp} / ${stats.need} XP`}</p><p class="hint">归档培养会消耗职业卡或能力卡，获得该人物的经验。</p><div class="person-growth-actions"><button class="mini-btn ok" data-act="hubTab" data-tab="stash" data-view="cards" data-character="${character.id}">归档培养${esc(character.name)} →</button><button class="mini-btn" data-act="personSection" data-section="pool">查看专属招式</button><button class="mini-btn" data-act="hubTab" data-tab="ach" data-view="classes">查看全员归档进度</button></div></section>`;
  const sections = `<nav class="person-sections" aria-label="人物内容">${[['profile', '培养'], ['pool', '招式'], ['appearance', '外观']].map(([id, label]) => tab('personSection', 'section', id, label, browse.section === id)).join('')}</nav>`;
  if (browse.section === 'pool') return `<div class="personnel-v2 personnel-skills" data-section="pool">${header}${sections}<div class="skills-layout"><nav class="skills-roster" aria-label="人物招式切换">${roster.map(entry => `<button class="skills-person${entry.character.id === character.id ? ' on' : ''}" data-act="hubPersonView" data-character="${entry.character.id}" aria-label="查看${escAttr(entry.character.name)}的招式">${art.classAvatarArt(entry.character.id)}<b>${esc(entry.character.name)}</b></button>`).join('')}</nav><section class="skills-content"><header class="skills-heading"><div><h3>${esc(character.name)}</h3><span>${esc(character.rulesetId)} · 专属招式</span></div><button class="mini-btn ok" data-act="hubTab" data-tab="stash" data-view="cards" data-character="${character.id}">培养 →</button></header>${content}</section></div></div>`;
  return `<div class="personnel-v2" data-section="${browse.section}">${header}${sections}<div class="person-stage"><nav class="person-roster" aria-label="人物档案切换">${roster.map(entry => `<button class="person-face${entry.character.id === character.id ? ' on' : ''}" data-act="hubPersonView" data-character="${entry.character.id}" aria-label="查看${escAttr(entry.character.name)}的档案" aria-pressed="${entry.character.id === character.id}"><span class="person-face-art">${art.classAvatarArt(entry.character.id)}</span><b>${esc(entry.character.name)}</b><small>${esc(entry.character.rulesetId)}</small></button>`).join('')}</nav><figure class="person-hero" data-skin="${escAttr(skin)}"><img src="${escAttr(art.skinUrl(stats.cls, skin))}" alt="${escAttr(character.name)}立绘" decoding="async"><figcaption><small>${esc(character.rulesetId)}</small><h3>${esc(character.name)}</h3><span>${browse.section === 'appearance' ? esc(skinNames.get(skin) || '默认外观') : `专属招式 ${pool.length} 张`}</span></figcaption></figure><article class="person-details">${browse.section === 'pool' ? '' : `<header><small>${esc(character.rulesetId)} / PERSONNEL</small><h3>${browse.section === 'appearance' ? '衣着档案' : '人物培养'}</h3></header>`}${content}</article></div></div>`;
}
export function bindPersonnel({ ui, refresh, sound }) {
  ui.act('personGroup', data => { setPersonnelGroup(data.group); sound.tick(); refresh(); });
  ui.act('personSection', data => { if (!['profile', 'pool', 'appearance'].includes(data.section)) return; browse.section = data.section; sound.tick(); refresh(); });
  ui.act('personPet', data => { browse.pet = data.id; sound.tick(); refresh(); });
  ui.act('personHatchView', () => { browse.hatch = !browse.hatch; sound.tick(); refresh(); });
  ui.act('personPreviewSkin', data => { browse.skins.set(data.character, data.skin); sound.tick(); refresh(); });
  ui.act('personCardZoom', data => { const card = window.SDT.Cards.all().find(c => c.id === data.id); const from = [...document.querySelectorAll('.person-pool-card')].find(button => button.dataset.id === data.id && !button.hidden); if (card) { ui.showCardZoom(card, { presentation:'inventory', from }); decorateInventoryZoom(card); } });
  const poolRoot = document.querySelector('.personnel-v2[data-section="pool"]');
  const browser = poolRoot?.querySelector('[data-card-browser]');
  const applyPoolFilter = () => {
    if (!poolRoot) return;
    let count = 0;
    for (const card of poolRoot.querySelectorAll('.person-pool-card')) {
      const filtered = !!(browse.query.trim() && !card.dataset.search.toLowerCase().includes(browse.query.trim().toLowerCase())) || !!(browse.poolStatus && card.dataset.recorded !== browse.poolStatus) || !!(browse.poolType && card.dataset.type !== browse.poolType);
      card.dataset.browseFiltered = String(filtered);
      if (!filtered) count++;
    }
    poolRoot.querySelector('[data-person-pool-count]').textContent = `${count} / ${poolRoot.querySelectorAll('.person-pool-card').length} 张`;
    poolRoot.querySelector('.pool-empty').hidden = count > 0;
    const visible = [...poolRoot.querySelectorAll('.person-pool-card')].filter(button => button.dataset.browseFiltered !== 'true');
    refreshCardBrowser(browser, { reset: true });
    if (!visible.some(button => button.dataset.id === browse.poolPick)) browse.poolPick = visible[0]?.dataset.id || '';
    for (const button of poolRoot.querySelectorAll('.person-pool-card')) { button.classList.toggle('on', button.dataset.id === browse.poolPick); button.setAttribute('aria-pressed', String(button.dataset.id === browse.poolPick)); }
  };
  for (const input of poolRoot?.querySelectorAll('[data-person-pool]') || []) input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => { if (input.dataset.personPool === 'query') browse.query = input.value; else browse.poolStatus = input.value; applyPoolFilter(); });
  bindCardBrowser(browser, { onPage: () => sound.tick(), onOpen: (id, from) => {
    const card = window.SDT.Cards.classPool(characterFor(browse.poolCharacter)?.rulesetId).find(item => item.id === id);
    if (!card) return;
    browse.poolPick = card.id;
    for (const button of poolRoot.querySelectorAll('.person-pool-card')) { button.classList.toggle('on', button.dataset.id === id); button.setAttribute('aria-pressed', String(button.dataset.id === id)); }
    ui.showCardZoom(card, { presentation:'inventory', from }); decorateInventoryZoom(card); sound.tick();
  } });
  applyPoolFilter();

  bindCardNavigation(browser?.querySelector('.card-browser-track'), '.person-pool-card', { activate: false });
  ui.act('personPoolType', data => { if (!poolRoot) return; browse.poolType = data.type; for (const button of poolRoot.querySelectorAll('[data-act="personPoolType"]')) { const on = button.dataset.type === browse.poolType; button.classList.toggle('ok', on); button.setAttribute('aria-pressed', String(on)); } applyPoolFilter(); sound.tick(); });
  ui.act('personPoolReset', () => { browse.query = ''; browse.poolStatus = ''; browse.poolType = ''; for (const button of poolRoot?.querySelectorAll('[data-act="personPoolType"]') || []) { const on = !button.dataset.type; button.classList.toggle('ok', on); button.setAttribute('aria-pressed', String(on)); } for (const input of poolRoot?.querySelectorAll('[data-person-pool]') || []) input.value = ''; applyPoolFilter(); });
  ui.act('personPoolPick', data => {
    const card = window.SDT.Cards.classPool(characterFor(browse.poolCharacter)?.rulesetId).find(item => item.id === data.id);
    if (!card || !poolRoot) return;

    browse.poolPick = card.id;
    for (const button of poolRoot.querySelectorAll('.person-pool-card')) { button.classList.toggle('on', button.dataset.id === card.id); button.setAttribute('aria-pressed', String(button.dataset.id === card.id)); }

    sound.tick();
  });
  ui.act('personHatch', () => {
    const result = window.SDT.Base.hatchPet();
    ui.log(result.ok ? `孵化成功：${result.pet.name}` : result.msg || '孵化条件不足，资源未改变。', result.ok ? 'ok' : 'warn');
    if (result.ok) { sound.ding(); window.SDT.Meta.checkUnlocks(); browse.pet = result.pet.id; }
    refresh();
  });
}
