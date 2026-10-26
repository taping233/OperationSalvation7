import { mountCollectionView, collectionItemHTML, collectionWorkspaceHTML } from '../ui/collection-view.js';
import { linkedCostsHTML } from '../ui/home-linked-interactions.js';
import { esc, escAttr } from '../core/shared.js';
import { characterFor } from '../core/characters.js';
import { getCharacter } from './collection.commands.js';
import { MAP } from '../run/game.session.js';
import { partnerPortrait } from './hub.visuals.js';
import { bindCardNavigation, holdHubOperationControls, runHubOperation } from './hub.presentation.js';
import { cardBrowserHTML } from '../ui/card-browser.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';
import { animateBaseRefresh } from './base-motion-v4.js';
import { partnerInteractionHTML, mountPartnerInteraction } from '../ui/partner-interaction.js';
import { displayCardDescription } from '../cards/card-description-text.js';

// 默认立绘与选人共用Art.skinUrl；统一画布完整展示，不沿用旧图裁切边界。
const avatarBounds = {
  wu:[101,4,1016,1019], heixiang:[232,165,847,922],
  xingyue:[35,17,1004,1017], baita:[40,18,1015,1010], changwuyu:[31,8,1010,1017],
};
function personnelAvatarStyle(id) {
  const bounds = avatarBounds[id];
  if (!bounds) return '';
  const [left,top,right,bottom] = bounds, height = bottom - top;
  return `--avatar-height:${(.94 * 1024 / height).toFixed(6)};--avatar-bottom:${(3 - 94 * (1024 - bottom) / height).toFixed(6)}%;--avatar-center:${(-50 * (left + right) / 1024).toFixed(6)}%;`;
}

const browse = { slot: null, group: 'people', section: 'profile', pet: '', skins: new Map(), hatch: false, poolCharacter: '', poolPick: '' };
export const personnelPageKey = () => `${browse.group}/${browse.section}/${browse.hatch ? 'hatch' : 'browse'}`;
export const personnelViewKey = () => `${browse.group}/${browse.section}/${browse.pet}/${browse.hatch ? "hatch" : "browse"}`;
export function setPersonnelGroup(group) { browse.group = group === 'pets' ? 'pets' : 'people'; }
export function setPersonnelSection(section) { if (['profile', 'pool', 'appearance'].includes(section)) browse.section = section; }
export function petSafeSlots(pet, level) {
  return Math.min(MAP.rules.safeMax, MAP.rules.safeStart + level - 1) + (pet?.effect?.safeBonus || 0);
}
function holdPersonnelButton(action, id) {
  const button = typeof document === 'undefined' ? null : [...document.querySelectorAll(`#hubMain [data-act="${action}"]`)]
    .find(element => id === undefined || /** @type {HTMLElement} */ (element).dataset.id === id);
  return holdHubOperationControls(button ? [/** @type {HTMLButtonElement} */ (button)] : []);
}
function checkPersonnelUnlocks(meta, ui, isCurrent, message) {
  void Promise.resolve().then(() => meta.checkUnlocks()).catch(() => {
    if (isCurrent()) ui.log(message, 'warn');
  }).catch(() => {});
}
export async function upgradePetFromPersonnel({ base, id, notice = message => ui.log(message, 'warn'), sound, ui, meta, refresh, isCurrent = () => true }) {
  const pet = base.petById(id);
  const beforeLevel = pet ? base.petLevel(id) : 1;
  const beforeSafe = petSafeSlots(pet, beforeLevel);
  const cost = pet ? base.petUpCost(id) : 0;
  const release = holdPersonnelButton('upPet', id);
  try {
    return await runHubOperation({
      run: () => pet ? base.upgradePet(id) : false,
      isCurrent, notice, pending: '正在保存伙伴培养…',
      success: () => `${pet.name} Lv.${beforeLevel} → Lv.${base.petLevel(id)} · 安全格 ${beforeSafe} → ${petSafeSlots(pet, base.petLevel(id))} · 口粮 −${cost}`,
      failure: () => !pet ? '伙伴资料已更新，请重新选择伙伴后重试。'
        : beforeLevel >= base.PET_LEVEL_MAX ? '伙伴已达培养上限。'
        : base.data.rations < cost ? `还需 ${cost - base.data.rations} 口粮，补充后可培养。`
        : '伙伴培养未保存，口粮未消耗，请重试。',
      onSuccess: () => {
        checkPersonnelUnlocks(meta, ui, isCurrent, '伙伴培养已保存，成就检查未完成，可重新进入基地重试。');
        sound.ding();
        ui.log(`[[icon:paw]] <b>「${esc(pet.name)}」</b> Lv.${beforeLevel} → <b>Lv.${base.petLevel(id)}</b>：携带时安全格 ${beforeSafe} → <b>${petSafeSlots(pet, base.petLevel(id))}</b> 格（口粮 −${cost}）`, 'ok');
      },
      refresh,
    });
  } finally { release(); }
}
export function personnelBackTarget() {
  if (browse.group === 'pets' && browse.hatch) return { action:'personHatchView', label:'返回伙伴' };
  return browse.group === 'pets' || browse.section !== 'profile' ? { action:'personnelHome', label:'返回角色' } : null;
}
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
  const safe = petSafeSlots(selected, lv);
  const nextSafe = petSafeSlots(selected, lv + 1);
  const carried = base.carriedPet()?.id === selected.id;
  const eggs = base.data.stash.filter(stack => stack.card.id === base.PET_EGG_ID).reduce((n, stack) => n + stack.count, 0);
  const hatchReady = eggs > 0 && base.data.coins >= base.HATCH_COST && owned.length < pets.length;
  const missing = [eggs ? '' : '缺少 1 枚伙伴蛋', base.data.coins >= base.HATCH_COST ? '' : `还需 ${base.HATCH_COST - base.data.coins} 储备币`].filter(Boolean).join(' · ');
  if (browse.hatch) {
    const egg = window.SDT.Cards?.all?.()?.find(card => card.id === base.PET_EGG_ID);
    return `<div class="companion-hatch-scene"><div class="companion-hatch-art">${egg && window.SDT.Art?.cardIcon ? window.SDT.Art.cardIcon(egg) : '[[icon:paw]]'}</div><section class="companion-hatch"><div><h3>伙伴孵化</h3><button class="mini-btn" data-act="personHatchView">返回伙伴</button><p>随机获得一位尚未拥有的伙伴。</p></div>${linkedCostsHTML([{name: "伙伴蛋", have: eggs, need: 1}, {name: "储备币", have: base.data.coins, need: base.HATCH_COST}])}<div><button class="mini-btn ok base-command base-command-primary" data-act="personHatch"${hatchReady ? '' : ' disabled'}>孵化伙伴</button>${owned.length >= pets.length || missing ? `<p class="hint" role="status">${owned.length >= pets.length ? '所有伙伴已相遇' : missing}</p>` : ''}</div></section></div>`;
  }
  return `<div class="companion-toolbar"><button class="mini-btn" data-act="personnelHome">返回角色</button><span>已相遇 <b>${owned.length}/${pets.length}</b></span><button class="mini-btn${browse.hatch ? ' ok' : ''}" data-act="personHatchView" aria-expanded="${browse.hatch}">[[icon:paw]] 孵化新伙伴 <small>${eggs} 枚蛋</small></button></div>

    <div class="person-stage partner-stage"><nav class="person-roster" aria-label="伙伴档案切换">${pets.map(pet => `<button class="person-face${pet.id === selected.id ? ' on' : ''}${owned.includes(pet.id) ? '' : ' unowned'}" data-act="personPet" data-id="${pet.id}" aria-label="查看${escAttr(pet.name)}" aria-pressed="${pet.id === selected.id}">${partnerPortrait(pet.id)}<b>${esc(pet.name)}</b><small>${base.carriedPet()?.id === pet.id ? '随行中' : owned.includes(pet.id) ? `Lv.${base.petLevel(pet.id)}` : '未相遇'}</small></button>`).join('')}</nav>
    <div class="partner-display${have ? '' : ' unowned'}"><small>伙伴 / 0${pets.indexOf(selected) + 1}</small>${have ? partnerInteractionHTML(partnerPortrait(selected.id), selected) : partnerPortrait(selected.id)}<h3>${esc(selected.name)}</h3><span class="partner-state${carried ? ' carried' : ''}">${carried ? '随行中' : have ? '已相遇' : '未相遇'}</span></div>
    <article class="person-details partner-details"><header><h3>随行能力</h3></header><p class="partner-perk">${esc(selected.desc.replace(/^携带效果：/, ''))}</p><dl class="warehouse-facts"><div><dt>等级</dt><dd>${have ? `Lv.${lv}` : '未相遇'}</dd></div><div><dt>${have ? '携带时安全格' : '初次携带安全格'}</dt><dd>${safe} 格</dd></div></dl>
    <button class="mini-btn ok base-command base-command-primary" data-act="selPet" data-id="${selected.id}"${!have || carried ? ' disabled' : ''}>${carried ? '当前随行伙伴' : have ? '携带出征' : '相遇后可携带'}</button>
    <section><h4>${have ? '本次培养' : '相遇途径'}</h4>${have ? `<div class="companion-growth"><span>Lv.${lv}<b>→</b>${maxed ? 'MAX' : `Lv.${lv + 1}`}</span><span>安全格 ${safe}<b>→</b>${maxed ? safe : nextSafe}</span></div>${linkedCostsHTML([{name: "口粮", have: base.data.rations, need: maxed ? null : cost}])}<button class="mini-btn ok base-command base-command-primary" data-act="upPet" data-id="${selected.id}"${maxed || base.data.rations < cost ? ' disabled' : ''}>${maxed ? '已达培养上限' : '培养伙伴'}</button>${maxed ? '' : `<p class="hint">${base.data.rations < cost ? `还需 ${cost - base.data.rations} 口粮` : '安全格加成在携带时生效'}</p>`}${!maxed && base.data.rations < cost ? '<button class="base-link source-link" data-act="hubTab" data-tab="shop" data-trade-mode="buy">交易所补充口粮 →</button>' : ''}` : '<p>远征搜刮点获取伙伴蛋，回基地孵化。</p><button class="mini-btn" data-act="personHatchView">查看孵化条件</button>'}</section></article></div>`;
}
function poolRecord(card, base) {
  return !window.SDT.Meta.isCollectible(card) ? { id: 'excluded', label: '不计入人物归档' } : base.isCollected(card) ? { id: 'recorded', label: '已归档' } : { id: 'unrecorded', label: '未归档' };
}
function poolCatalogHTML(pool,base) {
  return collectionWorkspaceHTML('personnel',{className:'pv12-pool-catalog',attrs:{'aria-label':'招式卡牌目录'},
    list:cardBrowserHTML(`person-pool-${browse.poolCharacter}`,'人物专属招式',pool.map(card => { const record = poolRecord(card,base);return collectionItemHTML(card.id,record.label,{
      className:'person-pool-card',artClass:'pool-card-art',ariaLabel:`放大查看${card.name}`,
      attrs:{'data-id':card.id,'data-search':card.name + ' ' + displayCardDescription(card.desc,card.id,card),'data-recorded':record.id,'data-type':card.type || ''},
    });}).join(''),{rows:1,columns:4}),
    empty:'<div class="pool-empty" hidden><h4>暂无招式</h4></div>',
  });
}
export function personnelHTML(view) {
  const { Base: base, Meta: meta, Art: art, Cards: cards } = window.SDT;
  if (browse.slot !== base.slot) { browse.slot = base.slot; browse.skins.clear(); browse.pet = ''; browse.hatch = false; browse.poolCharacter = ''; }
  const title = browse.group === 'pets' ? browse.hatch ? '孵化伙伴' : '远征伙伴' : browse.section === 'pool' ? '人物招式' : browse.section === 'appearance' ? '人物外观' : '角色';
  const header = `<header class="pv12-page-head"><h2>${title}</h2></header>`;
  if (browse.group === 'pets') return `<div class="personnel-v2 personnel-v12" data-section="companions">${header}${petsHTML(base)}</div>`;
  const roster = meta.classSummary().map(stats => ({ stats, character: characterFor(stats.cls) })).filter(entry => entry.character);
  const selected = roster.find(entry => entry.character.id === view) || roster[0];
  if (!selected) return `${header}<div class="camp-empty">暂无人物档案</div>`;
  const { stats, character } = selected;
  if (browse.poolCharacter !== character.id) { browse.poolCharacter = character.id; browse.poolPick = ''; }
  const owned = getCharacter(base.data, character.id);
  const equipped = owned?.selectedSkinId || 'default';
  const skin = browse.skins.get(character.id) || equipped;
  const alphaPortrait = false;
  const skins = owned?.availableSkinIds || ['default'];
  const skinNames = new Map(art.listSkins(stats.cls).map(item => [item.id, item.name]));
  const pool = cards.classPool(stats.cls);
  const pct = stats.maxed ? 100 : Math.min(100, stats.need ? stats.xp / stats.need * 100 : 0);
  const actions = browse.section === 'appearance' ? `<button class="mini-btn ok appearance-apply base-command base-command-primary" data-act="selectCharacterSkin" data-character="${character.id}" data-skin="${escAttr(skin)}"${skin === equipped ? ' disabled' : ''}>${skin === equipped ? '已装备' : '应用外观'}</button>` : browse.section === 'profile' && !stats.maxed ? `<button class="mini-btn ok base-command base-command-primary" data-act="hubTab" data-tab="stash" data-view="cards" data-character="${character.id}"><span class="base-command-label">选择培养卡牌</span><span class="base-command-arrow" aria-hidden="true">→</span></button>` : '';
  let content;
  if (browse.section === 'appearance') content = `<h4>${esc(skinNames.get(skin) || '默认外观')}</h4>${skin === equipped ? '' : `<p class="appearance-current">当前：${esc(skinNames.get(equipped) || '默认外观')}</p>`}<div class="person-skin-grid">${skins.map(id => `<button class="person-skin${id === skin ? ' on' : ''}${id === equipped ? ' equipped' : ''}" data-act="personPreviewSkin" data-character="${character.id}" data-skin="${escAttr(id)}" aria-pressed="${id === skin}"><img src="${escAttr(art.skinUrl(stats.cls, id))}" alt="${escAttr(skinNames.get(id) || '默认外观')}" loading="lazy"><b>${esc(skinNames.get(id) || '默认')}</b><small>${id === equipped ? '已装备' : id === skin ? '预览中' : ''}</small></button>`).join('')}</div>`;
  else if (browse.section === 'pool') content = '';
  else content = `<section class="person-growth-summary"><h4>出征加成</h4><div class="person-perk-value"><div class="person-perk-step"><small>当前</small><strong>${esc(meta.perkText(stats.lv))}</strong></div>${stats.maxed ? '' : `<span class="person-perk-arrow" aria-hidden="true">→</span><div class="person-perk-step"><small>下一级</small><strong>${esc(meta.perkText(stats.lv + 1))}</strong></div>`}</div></section><section class="person-growth-progress"><div class="person-progress-heading"><h4>熟练度</h4><span>${stats.maxed ? '熟练度已满' : `${stats.xp} / ${stats.need} XP`}</span></div><div class="person-progress-track" role="progressbar" aria-label="人物熟练度" aria-valuemin="0" aria-valuemax="${stats.maxed ? 100 : stats.need}" aria-valuenow="${stats.maxed ? 100 : stats.xp}"><i style="width:${pct}%"></i></div></section>`;
  return `<div class="personnel-v2 personnel-v12" data-section="${browse.section}"><div class="pv12-agent-workspace">${browse.section === 'pool' ? poolCatalogHTML(pool,base) : '<div class="pv12-pool-catalog collection-workspace" data-collection-variant="personnel" hidden></div>'}<figure class="pv12-agent-art" data-skin="${escAttr(skin)}" data-portrait-alpha="${alphaPortrait}"${browse.section === 'pool' ? ' hidden' : ''}><div class="pv12-agent-image-stage"><img src="${escAttr(art.skinUrl(stats.cls, skin))}" alt="${escAttr(character.name)}完整立绘" decoding="async" data-portrait-fit="canvas"></div><figcaption><h2>${esc(character.name)}</h2><span>${esc(skinNames.get(skin) || '默认外观')}</span></figcaption></figure><nav class="pv12-agent-strip" aria-label="人物切换">${roster.map(entry => `<button class="pv12-agent-choice${entry.character.id === character.id ? ' on' : ''}" data-act="hubPersonView" data-character="${entry.character.id}" aria-label="查看${escAttr(entry.character.name)}" aria-pressed="${entry.character.id === character.id}"><span class="pv12-agent-avatar" style="${personnelAvatarStyle(entry.character.id)}">${art.classAvatarArt(entry.character.id)}</span><b>${esc(entry.character.name)}</b></button>`).join('')}</nav>${browse.section === 'pool' ? '' : `<article class="pv12-agent-data"><header class="pv12-identity"><h3>${browse.section === 'appearance' ? '外观预览' : '人物培养'}</h3><span class="person-level">Lv.${stats.lv}${stats.maxed ? ' · MAX' : ''}</span></header><div class="pv12-data-content">${content}</div>${actions ? `<footer class="pv12-data-actions">${actions}</footer>` : ''}</article>`}<nav class="pv12-sections" aria-label="角色操作">${[['profile','培养'],['pool','招式'],['appearance','外观']].map(([id,label]) => `<button data-act="personSection" data-section="${id}" class="${browse.section === id ? 'on' : ''}" aria-pressed="${browse.section === id}">${label}</button>`).join('')}<button data-act="personGroup" data-group="pets">伙伴</button></nav></div></div>`;
}
export function bindPersonnel({ ui, refresh, sound, notice = message => ui.log(message, 'warn') }) {
  ui.act('personnelHome', () => { browse.group = 'people'; browse.section = 'profile'; browse.hatch = false; sound.tick(); refresh(); });
  ui.act('personGroup', data => { setPersonnelGroup(data.group); browse.hatch = false; sound.tick(); refresh(); });
  ui.act('personSection', data => { if (!['profile', 'pool', 'appearance'].includes(data.section) || data.section === browse.section) return; setPersonnelSection(data.section); sound.tick(); refresh(); });
  ui.act('personPet', data => { browse.pet = data.id; browse.hatch = false; sound.tick(); refresh(); });
  ui.act('personHatchView', () => { browse.hatch = !browse.hatch; sound.tick(); refresh(); });
  ui.act('personPreviewSkin', data => { browse.skins.set(data.character, data.skin); sound.tick(); refresh(); });
  const poolRoot = document.querySelector('.personnel-v2[data-section="pool"]');
  const browser = /** @type {HTMLElement} */ (poolRoot?.querySelector('[data-card-browser]'));
  mountCollectionView({root:poolRoot,browser,state:browse,selection:'poolPick',key:'id',
    results:({visible}) => {
      /** @type {HTMLElement} */ (poolRoot.querySelector('.pool-empty')).hidden = visible.length > 0;
    },motion:animateBaseRefresh,
    prepareArt:() => {
      const cards = new Map();
      for (const card of window.SDT.Cards.classPool(characterFor(browse.poolCharacter)?.rulesetId)) if (!cards.has(card.id)) cards.set(card.id,card);
      return item => {const card = cards.get(item.dataset.id);return card ? window.SDT.Cards.cardHTML(card,'sm') : null;};
    },
    onPage:() => {sound.tick();animateBaseRefresh(browser.querySelector('.card-browser-track'));},
    onOpen:(id,from,view) => {
      const card = window.SDT.Cards.classPool(characterFor(browse.poolCharacter)?.rulesetId).find(item => item.id === id);
      if (!card) return;
      view.select(card.id);sound.tick();ui.showCardZoom(card,{presentation:'inventory',from});decorateInventoryZoom(card);
    },
  });

  bindCardNavigation(browser?.querySelector('.card-browser-track'), '.person-pool-card', { activate: false });
  let hatching = false;
  ui.act('personHatch', async () => {
    if (hatching) return false;
    const base = window.SDT.Base, slot = base.slot;
    const current = () => window.SDT.Base === base && base.slot === slot && (ui.isCurrent?.() ?? true);
    hatching = true;
    const release = holdPersonnelButton('personHatch');
    try {
      return await runHubOperation({
        run: () => base.hatchPet(), isCurrent: current, notice,
        pending: '正在保存伙伴孵化…',
        success: result => result.ok === true ? `孵化成功：${result.pet.name}` : '',
        failure: result => ({
          noegg: '仓库中没有伙伴蛋，获得后可重新孵化。',
          poor: `储备币不足 ${base.HATCH_COST}，补充后可重新孵化。`,
          all: '所有伙伴已相遇。',
          save: '孵化未保存，伙伴蛋与储备币均未消耗，请重试。',
        })[result?.ok === false ? result.why : ''] || '孵化未保存，请重试。',
        onSuccess: result => {
          if (result.ok !== true) return;
          browse.pet = result.pet.id; browse.hatch = false;
          checkPersonnelUnlocks(window.SDT.Meta, ui, current, '伙伴已保存，成就检查未完成，可重新进入基地重试。');
          sound.ding();
          ui.log(`孵化成功：${esc(result.pet.name)}`, 'ok');
        },
        refresh,
      });
    } finally { hatching = false; release(); }
  });
  return mountPartnerInteraction(document.querySelector('.partner-display [data-partner-play]'));
}
