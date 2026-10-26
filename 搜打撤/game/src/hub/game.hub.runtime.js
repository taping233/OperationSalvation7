import { characterFor } from '../core/characters.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
import { linkedBackHTML } from '../ui/home-linked-interactions.js';
import { createOperationNotice } from '../ui/operation-notice.js';
import { MAP } from '../run/game.session.js';
import { game, getActiveSlot, setLobby, startNewGame } from '../run/game.session.js';
import { Sfx, configureCardNavigation, _set_cardPageOpen } from './game.cardslib.js';
import { readBase } from './base.commands.js';
import { selectSkin, stackKeyOf } from './collection.commands.js';
import { homeErrorMessage } from './command-errors.js';
import { createHubPreparationAdapter } from './game.hub.preparation-ports.js';
import '../../css/base-camp-rework.css';
import { presentHub, bindHubBrowse, restoreHubFocus, runHubOperation, holdHubOperationControls } from './hub.presentation.js';
import { afterOutcomeFeedback } from '../ui/outcome-feedback.js';
import { bindWarehouse, clearWarehouseFilters, focusWarehouseForCharacter } from './hub.warehouse.js';
import { resourceStripHTML } from './hub.materials.js';
import { bindArchiveV3, refreshArchiveBacks, selectArchiveBack } from './hub.archive-v3.js';
import { runRewardClaim } from './hub.reward-feedback.js';
import { courtyardV3HTML, mountCourtyardV3 } from './hub.courtyard-v3.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';
import '../../css/base-courtyard-v3.css';
import '../../css/base-panel-layout.css';
import '../../css/base-cohesion-v5.css';
import '../../css/base-framework-v7.css';
import '../../css/base-rooms-v7.css';
import '../../css/base-personnel-v12.css';
import '../../css/base-logistics-trade-v12.css';
import '../../css/base-archive-facilities-v12.css';
import { baseNavigationV7HTML } from './hub.navigation-v7.js';
import { bindBasePageMotionV7, animateBaseModeChangeV12 } from './base-page-motion-v7.js';
import { createTradeShopState, tradeShopV5HTML, bindTradeShopV5 } from './hub.trade-shop-v5.js';
import { bindPersonnel, setPersonnelGroup, setPersonnelSection, personnelViewKey, personnelPageKey, personnelBackTarget, upgradePetFromPersonnel } from './hub.personnel.js';
import { bindBaseMotion } from './base-motion-v4.js';
import { selectFacility } from './hub.facilities.js';
import { bindArchive } from './hub.archive.js';
import { cancelPendingPageEntries } from '../ui/page-entry-cancellation.js';
import { slots, homeRequestId } from './game.hub.bridge.js';
import { hubDeployHTML, openDepartPrep, setDeployPick } from './game.hub.depart.js';
import { hubStashHTML, openStashCardView, openRawItem, hubUpgradeHTML, hubClassesHTML, hubAchHTML, HUB_SHOP_GOODS } from './game.hub.pages.js';
slots.renderHub = renderHub;   // 切片经桥回调重绘（勿直接 import 壳，contracts 拒环）
let preparationFeature = null;
const disposePreparation = () => preparationFeature?.dispose();

// 基地当前页签（原为隐式全局，ESM 严格模式下必须显式声明）
let hubTab = 'deploy';
const hubRoomTitles = Object.freeze({ deploy:'基地', classes:'人物', stash:'后勤', shop:'交易所', ach:'收藏室', upgrade:'建设', courtyard:'庭院' });
let hubRenderRevision = 0;
let hubCollectionView = 'cards';
let achievementReturn = 'rewards';
let stashFromPersonnel = false;
let shopParent = 'stash', facilityParent = 'stash';
let tradeState = createTradeShopState();
let disposeTrade = () => {}, disposePersonnel = () => {};
let hubStashView = 'cards';
let hubPersonView = 'wu';
let courtyardView = 'rain';
let disposeCourtyard = () => {};
// 浏览位置仅属于界面；页内操作和详情返回不打断当前浏览。
const hubScroll = new Map();
const hubFocus = new Map();
let hubBrowseSlot = null;
let zoomFocusObserver = null;
const hubNotice = createOperationNotice();
const notice = (text, type = 'ok') => {
  const plain = document.createElement('template'); plain.innerHTML = String(text);
  hubNotice.set(plain.content.textContent || '', type);
};
preparationFeature = createHubPreparationAdapter({
  SDT, UI,
  returnToBase: ({ isCurrent = () => true, commit = render => render() } = {}) => {
    if (!isCurrent()) return false;
    const previousTab = hubTab;
    hubTab = 'deploy';
    try {
      const result = commit(() => renderHub({ preservePreparation:true }));
      if (result === false) hubTab = previousTab;
      return result;
    } catch (error) { hubTab = previousTab; throw error; }
  },
  applyPicks: setDeployPick,
  openDeparture: ({ isCurrent = () => true } = {}) => isCurrent() ? openDepartPrep({ isCurrent }) : false,
});
  function openBaseHub(tab) {
    hubNotice.clear();
    if (hubBrowseSlot !== getActiveSlot()) {
      hubBrowseSlot = getActiveSlot();
      hubScroll.clear();
      hubFocus.clear();
      stashFromPersonnel = false; shopParent = facilityParent = 'stash'; achievementReturn = 'rewards';
      tradeState = createTradeShopState();
    }
    disposePreparation();
    game.state = 'modal';
    _set_cardPageOpen(true);
    setLobby(true);           // 基地也属于非对局界面：隐藏左侧栏
    hubTab = tab === 'home' ? 'deploy' : (tab || 'deploy');
    SDT.Sound.music('base');   // 基地氛围
    SDT.Art.hydrateSelectedSkins(SDT.Base.data.appearance?.selectedSkins);
    const openedBase = SDT.Base, openedSlot = openedBase.slot;
    Promise.resolve().then(() => SDT.Meta.checkUnlocks()).catch(() => {
      if (SDT.Base === openedBase && openedBase.slot === openedSlot) UI.log('成就进度检查未完成，可重新进入基地重试。', 'warn');
    });
    return renderHub();
  }

  function openDepartureFromBase() {
    const root = document.getElementById('hubMain'), revision = hubRenderRevision;
    const base = SDT.Base, slot = getActiveSlot();
    return openDepartPrep({ isCurrent:() => hubRenderRevision === revision &&
      SDT.Base === base && base.slot === slot && getActiveSlot() === slot && document.getElementById('hubMain') === root &&
      !!root && root.dataset.page === 'deploy' && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing') });
  }

  // Retained import compatibility only; the furniture room is retired.
  function renderHomeScene() { return false; }

  function hubBackTarget() {
    if (hubTab === 'classes') return personnelBackTarget();
    if (hubTab === 'stash' && hubStashView === 'pocket') return { action:'warehouseMain', label:'返回仓库' };
    if (hubTab === 'stash' && stashFromPersonnel) return { action:'stashOrigin', label:'返回角色' };
    if (hubTab === 'shop' || hubTab === 'upgrade') {
      const parent = hubTab === 'shop' ? shopParent : facilityParent;
      return { action:'logisticsParent', label:parent === 'classes' ? '返回角色' : parent === 'shop' ? '返回交易所' : parent === 'deploy' ? '返回基地' : parent === 'ach' ? '返回收藏室' : '返回后勤' };
    }
    if (hubTab === 'ach' && hubCollectionView !== 'cards') {
      if (hubCollectionView === 'achievements') return { action:'archiveParent', label:achievementReturn === 'backs' ? '返回卡背' : '返回奖励' };
      if (hubCollectionView === 'classes') return { action:'rewardMain', label:'返回奖励' };
      return { action:'archiveMain', label:'返回收藏室' };
    }
    return null;
  }

  function renderHub({ preservePreparation = false } = {}) {
    const renderRevision = ++hubRenderRevision;
    const previousPage = /** @type {HTMLElement} */ (document.querySelector('#hubMain .hub-page'));
    if (previousPage) hubScroll.set(previousPage.dataset.view, previousPage.scrollTop);
    const focused = document.activeElement?.closest?.('#hubMain [data-act], #hubMain [data-browser-key]');
    const currentFocus = focused ? { .../** @type {HTMLElement} */ (focused).dataset } : null;
    disposeCourtyard(); disposeCourtyard = () => {};
    disposeTrade(); disposeTrade = () => {}; disposePersonnel(); disposePersonnel = () => {};
    const B = SDT.Base;
    const M = SDT.Meta;
    _set_cardPageOpen(true);      // Hub 页面：Esc / 点击背景可关闭
    // 页签切换时才播放入场动画（页内操作重渲染不闪）
    const viewKey = `${hubTab}/${hubTab === 'stash' ? hubStashView : hubTab === 'classes' ? `${hubPersonView}/${personnelViewKey()}` : hubTab === 'ach' ? hubCollectionView : hubTab === 'courtyard' ? courtyardView : hubTab === 'shop' ? tradeState.mode : ''}`;
    const motionViewKey = hubTab === 'classes' ? `classes/${personnelPageKey()}` : viewKey;
    const tabChanged = /** @type {(() => void) & {_lastMotionView?: string, _lastView?: string, _lastTab?: string}} */ (renderHub)._lastMotionView !== motionViewKey;
    /** @type {(() => void) & {_lastMotionView?: string, _lastView?: string, _lastTab?: string}} */ (renderHub)._lastMotionView = motionViewKey;
    /** @type {(() => void) & {_lastMotionView?: string, _lastView?: string, _lastTab?: string}} */ (renderHub)._lastView = viewKey;
    /** @type {(() => void) & {_lastMotionView?: string, _lastView?: string, _lastTab?: string}} */ (renderHub)._lastTab = hubTab;
    const pages = ['deploy', 'stash', 'classes', 'shop', 'ach', 'upgrade', 'courtyard'];
    const body = hubTab === 'deploy' ? hubDeployHTML()
      : hubTab === 'stash' ? hubStashHTML(hubStashView)
      : hubTab === 'shop' ? tradeShopV5HTML({ base:B, cards:SDT.Cards, art:SDT.Art, goods:HUB_SHOP_GOODS, state:tradeState })
      : hubTab === 'upgrade' ? hubUpgradeHTML()
      : hubTab === 'classes' ? hubClassesHTML(hubPersonView)
      : hubTab === 'courtyard' ? /** @type {(view?: unknown) => ReturnType<typeof courtyardV3HTML>} */ (courtyardV3HTML)(courtyardView)
      : hubAchHTML(hubCollectionView);
    const back = hubBackTarget();
    presentHub(UI, `
      <div class="pg hub hub-${hubTab} base-camp base-frame-v7 ${hubTab === 'deploy' ? 'base-home' : 'base-subpage'}" id="hubMain" data-page="${hubTab}" data-base-layout="open-menu">
       <header class="hub-head hub-head-min">
          ${linkedBackHTML(back?.action || (hubTab === 'deploy' ? 'closeBase' : 'hubHome'), back?.label || (hubTab === 'deploy' ? '返回选档' : '返回基地'), 'hub-back')}
          <div class="camp-brand"><h2>${esc(hubRoomTitles[hubTab] || '基地')}</h2></div>
          <span class="hub-slot-label">${getActiveSlot() ? `档案 / 0${getActiveSlot()}` : '未选档'}</span>
          <span class="hub-res">${resourceStripHTML(B)}</span>
        </header>
        <div class="hub-body">
          <main class="hub-page${tabChanged ? ' page-in' : ''}" data-view="${viewKey}" data-motion-view="${motionViewKey}">${body}</main>
          ${baseNavigationV7HTML({ tab:hubTab, pendingRewards:M.pendingColl().length + M.pendingAch().length })}
        </div>
        ${hubNotice.html({ className:`camp-notice${hubNotice.tone === 'warn' ? ' warning' : ''}`, tag:'div', keepEmpty:true })}
      </div>`, SDT.Icons);
    if (!preservePreparation) disposePreparation();
    const root = document.getElementById('hubMain'), slotId = B.slot, baseGeneration = B._selectionGeneration;
    const currentHub = () => hubRenderRevision === renderRevision && SDT.Base === B && B.slot === slotId && B._selectionGeneration === baseGeneration &&
      !!root && document.getElementById('hubMain') === root && !UI.el?.overlay?.hidden && !UI.el?.overlay?.classList.contains('closing');
    const hubAct = (name, action) => UI.act(name, (...args) => {
      if (!currentHub()) return;
      return action(...args);
    });
    let writing = false;
    const hubWrite = (name, action) => hubAct(name, async (...args) => {
      if (writing) return false;
      writing = true;
      const release = holdHubOperationControls(document.querySelectorAll(`#hubMain [data-act="${name}"], #cardZoom .cz-foot [data-act="${name}"]`));
      try { return await action(...args); }
      catch {
        if (currentHub()) { notice('当前操作未完成，请重试。', 'warn'); UI.log('当前操作未完成，请重试。', 'warn'); }
        return false;
      }
      finally { release(); writing = false; }
    });
    const hubUI = { act: hubAct, isCurrent: currentHub, showCardZoom: (...args) => UI.showCardZoom(...args), log: /** @param {Parameters<typeof UI.log>} args */ (...args) => UI.log(...args) };
    const page = document.querySelector('#hubMain .hub-page');
    if (page) {
      page.scrollTop = hubScroll.get(viewKey) || 0;
      bindHubBrowse(document.getElementById('hubMain'), hubScroll, hubFocus);
      bindBasePageMotionV7(document.getElementById('hubMain'), { changed:tabChanged });
    }
    if (currentFocus) hubFocus.set(viewKey, currentFocus);
    zoomFocusObserver?.disconnect();
    zoomFocusObserver = restoreHubFocus(viewKey, hubFocus);
    hubAct('hubTab', (d) => {
      const next = d.tab === 'home' ? 'deploy' : d.tab;
      if (!pages.includes(next)) return;
      /** @type {HTMLElement & {_closeCardZoom?: (immediate?: boolean) => void}} */ (document.getElementById('cardZoom'))?._closeCardZoom?.(true);
      if (next === 'courtyard' && ['rain', 'koi'].includes(d.view)) { if (hubTab === 'courtyard' && d.view === courtyardView) return; courtyardView = d.view; }
      if (next === 'shop' && hubTab !== 'shop') shopParent = ['deploy', 'classes', 'ach', 'stash'].includes(hubTab) ? hubTab : 'stash';
      if (next === 'shop' && ['buy', 'sell'].includes(d.tradeMode)) tradeState.mode = d.tradeMode;
      if (next === 'shop' && d.tradeKey) tradeState.sellKey = d.tradeKey;
      if (next === 'upgrade' && hubTab !== 'upgrade') facilityParent = ['deploy', 'classes', 'ach', 'shop', 'stash'].includes(hubTab) ? hubTab : 'stash';
      const resumeStash = next === 'stash' && hubTab === 'shop' && shopParent === 'stash';
      if (next === 'stash' && hubTab !== 'stash' && !resumeStash) stashFromPersonnel = hubTab === 'classes' && !!d.character;
      if (next === hubTab && !d.view && !d.group && !d.character && !d.section && !d.facility && !d.tradeMode && !d.tradeKey) return;
      if (next === 'stash' && hubTab === 'deploy' && !d.character) { if (!d.view) hubStashView = 'cards'; clearWarehouseFilters(); }
      if (d.view && next === 'stash') { hubStashView = d.view; if (d.view === 'cards') { if (d.character) focusWarehouseForCharacter(d.character); else if (!resumeStash) clearWarehouseFilters(); } }
      if (next === 'ach') hubCollectionView = ['cards', 'rewards', 'backs', 'achievements', 'classes', 'stories'].includes(d.view) ? d.view : 'cards';
      if (d.character && next === 'classes') hubPersonView = characterFor(d.character)?.id || hubPersonView;

      if (next === 'classes' && !d.group && !d.character && !d.section) { setPersonnelGroup('people'); setPersonnelSection('profile'); }
      if (d.group && next === 'classes') setPersonnelGroup(d.group);
      if (d.section && next === 'classes') setPersonnelSection(d.section);
      if (d.facility && next === 'upgrade') selectFacility(d.facility);
      hubNotice.clear();
      if (next !== hubTab) SDT.Sound.sfx('navigate');
      hubTab = next;
      renderHub();
    });
    hubAct('hubStashView', (d) => {
      if (d.view === 'pets') { hubTab = 'classes'; setPersonnelGroup('pets'); renderHub(); return; }
      if (!['cards', 'pocket'].includes(d.view) || d.view === hubStashView) return;
      hubStashView = d.view;
      SDT.Sound.sfx('navigate');
      renderHub();
    });
    hubAct('hubHome', () => { hubTab = 'deploy'; renderHub(); });
    hubAct('hubRetryView', () => renderHub());
    hubAct('hubCollectionView', (d) => {
      if (!['cards', 'rewards', 'backs', 'achievements', 'classes', 'stories'].includes(d.view)) return;
      if (d.view === hubCollectionView && !(d.view === 'backs' && d.id)) return;
      if (d.view === 'backs' && d.id) selectArchiveBack(d.id, B, SDT.Cards);
      SDT.Sound.sfx('navigate');
      if (d.view === 'achievements') achievementReturn = hubCollectionView === 'backs' ? 'backs' : 'rewards';
      hubCollectionView = d.view;
      renderHub();
    });
    hubAct('warehouseMain', () => { hubStashView = 'cards'; SDT.Sound.sfx('navigate'); renderHub(); });
    hubAct('logisticsParent', () => { hubTab = hubTab === 'shop' ? shopParent : facilityParent; SDT.Sound.sfx('navigate'); renderHub(); });
    hubAct('stashOrigin', () => { hubTab = 'classes'; setPersonnelGroup('people'); setPersonnelSection('profile'); renderHub(); });
    hubAct('rewardMain', () => { hubCollectionView = 'rewards'; renderHub(); });
    hubAct('archiveParent', () => { hubCollectionView = achievementReturn; renderHub(); });
    hubAct('archiveMain', () => { hubCollectionView = 'cards'; SDT.Sound.sfx('navigate'); renderHub(); });
    hubAct('hubPersonView', (d) => {
      const character = characterFor(d.character);
      if (!character || character.id === hubPersonView) return;
      hubPersonView = character.id;
      SDT.Sound.sfx('navigate');
      renderHub();
    });
    hubAct('openPreparation', () => openPreparationPanel());
    hubWrite('selectCharacterSkin', (d) => {
      const read = readBase(slotId);
      if (!read.ok) { notice(homeErrorMessage(read), 'warn'); return false; }
      return runHubOperation({
        run: () => selectSkin({ slotId, requestId: homeRequestId('skin'), expectedRevision: read.revision }, { characterId: d.character, skinId: d.skin }),
        isCurrent:currentHub, notice, pending:'正在保存人物外观…',
        success:result => result.ok && result.value.assetFallback ? '外观已保存，当前使用默认立绘。' : '人物外观已保存。',
        failure:result => result && !result.ok ? result.message || '人物外观未保存，请重试。' : '人物外观未保存，请重试。',
        refresh:renderHub,
      });
    });
    hubWrite('selMode', (d) => {
      const previousMode = B.data.selMode;
      return runHubOperation({
        run:() => B.selectMode(d.mode), isCurrent:currentHub, notice, pending:'正在保存出征玩法…', success:'出征玩法已保存。',
        failure:result => result && result.ok === false && result.code === 'INVALID_MODE' ? '请选择现有出征玩法。' : '玩法未保存，请重试。',
        refreshOnFailure:true,
        refresh:() => { renderHub(); if (B.data.selMode !== previousMode) animateBaseModeChangeV12(document.getElementById('hubMain'), previousMode); },
      });
    });
    hubAct('nestDeploy', () => { SDT.Nest.openNestPrep(); });
    hubAct('deploy', () => { openDepartPrep(); });
    hubAct('gateInfo', () => {
      const n = B.keyCount ? B.keyCount() : 0;
      if (n >= (B.KEY_NEEDED || 10)) {
        Sfx.ding();
        UI.log('[[icon:door]] 宝藏大门已在酝酿——特殊关卡制作中，敬请期待', 'sys');
      } else {
        UI.log(`[[icon:key]] 钥匙不足（${n}/${B.KEY_NEEDED || 10}）——在棋盘的钥匙格收集更多钥匙吧`, 'dim');
      }
    });
    hubWrite('upBag', () => {
      const before = B.bagCap(), wood = MAP.rules.bagUpgradeWood;
      return runHubOperation({
        run:() => B.upgradeBag(), isCurrent:currentHub, notice, pending:'正在保存背包扩建…',
        success:() => `背包 ${before} → ${B.bagCap()} 格 · 木材 −${wood}`,
        failure:() => before >= MAP.rules.bagMax ? '出征背包已达容量上限。'
          : B.data.wood < wood ? `还需 ${wood - B.data.wood} 木材，补充后可扩建。` : '背包扩建未保存，请重试。',
        onSuccess:() => {
          void Promise.resolve().then(() => M.checkUnlocks()).catch(() => {});
          Sfx.ding();
          UI.log(`[[icon:bag]] 背包扩建完成：容量 <b>${B.bagCap()}</b> 格（- [[icon:wood]]×${wood}）`, 'ok');
        },
        refresh:renderHub,
      });
    });
    hubWrite('upPet', d => upgradePetFromPersonnel({ base:SDT.Base, id:d.id, notice, sound:Sfx, ui:UI, meta:SDT.Meta, refresh:renderHub, isCurrent:currentHub }));
    hubWrite('selPet', (d) => {
      const pet = B.petById(d.id);
      return runHubOperation({
        run:() => B.setPet(d.id), isCurrent:currentHub, notice, pending:'正在保存携带伙伴…',
        success:() => `已携带${pet.name} · 安全格 ${B.safeCap()} 格`,
        failure:'伙伴选择未保存，请重试。',
        onSuccess:() => {
          Sfx.ding();
          UI.log(`[[icon:paw]] 已携带伙伴<b>「${esc(pet.name)}」</b>：${esc(pet.desc)} · 安全格 <b>${B.safeCap()}</b> 格`, 'ok');
        },
        refresh:renderHub,
      });
    });
    hubWrite('upStash', () => {
      const before = B.stashCap(), wood = MAP.rules.stashUpgradeWood;
      const runes = before >= (MAP.rules.stashRuneSlotFrom || 50) ? (MAP.rules.stashRuneSlotCost || 2) : 0;
      const cost = `木材 −${wood}${runes ? ` · 符文 −${runes}` : ''}`;
      return runHubOperation({
        run:() => B.upgradeStash(), isCurrent:currentHub, notice, pending:'正在保存仓库扩建…',
        success:() => `仓库 ${before} → ${B.stashCap()} 格 · ${cost}`,
        failure:() => before >= MAP.rules.stashMax ? '基地仓库已达容量上限。'
          : B.data.wood < wood ? `还需 ${wood - B.data.wood} 木材，补充后可扩建。`
          : (B.data.runes?.length || 0) < runes ? `还需 ${runes - (B.data.runes?.length || 0)} 符文，补充后可扩建。`
          : '仓库扩建未保存，请重试。',
        onSuccess:() => {
          Sfx.ding();
          UI.log(`[[icon:archive]] 仓库扩建完成：容量 <b>${B.stashCap()}</b> 格（${cost}）`, 'ok');
        },
        refresh:renderHub,
      });
    });
    hubAct('stashItem', (d) => openStashCardView(+d.i));   // 点卡 = 大卡特写操作台：看牌 + 卖出/收藏/使用/孵化都在页脚（2026-10-06 老板二次改版）
    hubAct('rawItem', (d) => openRawItem(d.kind, { from:document.querySelector(`[data-act="rawItem"][data-kind="${d.kind}"]`) }));
    hubWrite('restoreCard', async (d) => {
      const zoom = /** @type {import('../ui/ui.dom.types.js').CardZoomElement} */ (document.getElementById('cardZoom'));
      const currentRestore = () => currentHub() && !!zoom && document.getElementById('cardZoom') === zoom && !zoom.classList.contains('cz-out');
      if (!currentRestore()) return false;
      const warn = message => { notice(message, 'warn'); UI.log(message, 'warn'); return false; };
      const candidates = d.stackKey ? B.data.pocket.filter(stack => stackKeyOf(stack) === d.stackKey)
        : d.name ? B.data.pocket.filter(stack => stack.card.name === d.name) : [B.data.pocket[+d.i]].filter(Boolean);
      if (candidates.length !== 1) return warn('待复原库存已变化，请重新选择卡牌。');
      const index = B.data.pocket.indexOf(candidates[0]);
      const stack = B.data.pocket[index];
      if (!stack) return;
      if (d.count && Number(d.count) !== (stack.count || 1)) return warn('待复原数量已变化，请重新选择卡牌。');
      const restoreCount = stack.count || 1, restoreCost = B.pocketKeyCost(stack);
      const restoredCards = Array.from({length:restoreCount},()=>({...stack.card}));
      const button = /** @type {HTMLButtonElement} */ (zoom.querySelector('[data-act="restoreCard"]'));
      const label = button?.textContent;
      if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = '复原中…'; }
      zoom._refreshCardZoomBrowse?.();
      let r;
      try { r = await B.restore(index); }
      catch { r = false; }
      finally {
        if (currentRestore() && button?.isConnected) {
          button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = label;
          zoom._refreshCardZoomBrowse?.();
        }
      }
      if (!currentHub()) return r === true || r === 'sha';
      const detailCurrent = currentRestore();
      if (r === 'full') return warn(`仓库容量不足（${B.stashUsed()}/${B.stashCap()} 张），先卖出或扩建仓库。`);
      if (r && /** @type {typeof r & {why?:string,cost?:number}} */ (r).why === 'nokey') return warn(`钥匙不足：复原需要 ${/** @type {typeof r & {cost?:number}} */ (r).cost} 把，现有 ${B.keyCount ? B.keyCount() : 0} 把。`);
      if (r !== true && r !== 'sha') return warn('卡牌复原未保存，请重试。');
      if (detailCurrent) zoom._closeCardZoom?.(true);
      if (r === true) {
        notice(`复原${stack.card.name} ×${restoreCount} · 钥匙 −${restoreCost}`);
        Sfx.ding(); UI.log(`[[icon:key]] 消耗 <b>${restoreCost}</b> 把钥匙，${restoreCount} 张卡牌已复原，回到卡牌仓库`, 'ok');
      } else { notice('初始攻击已处理，每局自动携带'); UI.log('[[icon:cards]] 初始牌「初始攻击」无需入库——每局自动携带，已直接消耗', 'dim'); }
      if (!detailCurrent) {
        if (!refreshWarehouse?.(true)) renderHub();
        return true;
      }
      if (r === true) return afterOutcomeFeedback(UI.el?.ovBody,{kind:'restore',destination:'仓库',blocking:true,
        cards:restoredCards,cost:`钥匙 −${restoreCost}`,
        source:'基地复原',cardHTML:card=>SDT.Cards.cardHTML(card,'sm'),isCurrent:currentHub},()=>renderHub());
      if (r) renderHub();
    });
    const claimReward = async (action, id, run, message) => {
      const r = await runRewardClaim({ root, base:B, meta:M, cards:SDT.Cards, action, id, run, isCurrent:currentHub });
      if (!currentHub()) return false;
      if (r.ok) {
        try { notice(message); Sfx.ding(); renderHub(); }
        catch { notice(`${message}，请重新进入收藏室查看。`); }
      }
      return r;
    };
    hubWrite('claimAch', d => claimReward('claimAch', d.id, () => M.claim(d.id), '成就奖励已入账'));
    hubWrite('selBack', (d) => {
      const B2 = SDT.Base;
      if (!B2.isBackUnlocked(d.id)) {
        const bd = (SDT.Cards.CARD_BACKS || []).find(b => b.id === d.id);
        notice(`卡背尚未解锁：${bd ? bd.from : d.id}`, 'warn');
        return false;
      }
      if (B2.backSel() === d.id) return;
      const bd = (SDT.Cards.CARD_BACKS || []).find(b => b.id === d.id);
      return runHubOperation({
        run:() => B2.setBack(d.id), isCurrent:currentHub, notice, pending:'正在保存卡背…',
        success:`已装备卡背「${bd ? bd.name : d.id}」。`, failure:'卡背未保存，请重试。',
        onSuccess:() => {
          Sfx.ding();
          UI.log(`[[icon:card-back]] 已装备卡背【<b>${bd ? esc(bd.name) : esc(d.id)}</b>】——背包翻面与牌库堆即刻生效`, 'ok');
        },
        refresh:() => { if (!refreshArchiveBacks({ base:B2, meta:M, cards:SDT.Cards })) renderHub(); },
      });
    });
    hubWrite('claimColl', d => claimReward('claimColl', d.id, () => M.claimColl(d.id), '收藏奖励已入账'));
    hubAct('collZoom', (d) => {
      const card = M.collectPool().find(c => c.id === d.id);
      const from = /** @type {HTMLElement} */ ([...document.querySelectorAll('[data-act="collZoom"]')].find(button => /** @type {HTMLElement} */ (button).dataset.id === d.id && !/** @type {HTMLElement} */ (button).hidden));
      if (card) { UI.showCardZoom(card, { presentation:'inventory', from }); decorateInventoryZoom(card); }
    });
    hubAct('campFacility', d => { selectFacility(d.id); renderHub(); });
    const refreshWarehouse = /** @type {(options: Parameters<typeof bindWarehouse>[0] & {cards?:unknown,meta?:unknown}) => ReturnType<typeof bindWarehouse>} */ (bindWarehouse)({ ui: hubUI, base: B, cards: SDT.Cards, meta: M, sound: Sfx, refresh: renderHub, notify: notice, openCard:openStashCardView,
      noticeHTML:() => hubNotice.html({ keepEmpty:true }),
      refreshResources:() => { if (currentHub()) root.querySelector('.hub-res').innerHTML = resourceStripHTML(B); },
    });
    disposePersonnel = bindPersonnel({ ui: hubUI, sound: Sfx, refresh: renderHub, notice });
    bindArchive(hubUI, { openAchievements:() => { achievementReturn = hubCollectionView === 'backs' ? 'backs' : 'rewards'; hubCollectionView = 'achievements'; renderHub(); } });
    /** @type {(options: Parameters<typeof bindArchiveV3>[0] & {refresh?:unknown}) => ReturnType<typeof bindArchiveV3>} */ (bindArchiveV3)({ ui:hubUI, base:B, meta:M, cards:SDT.Cards, refresh:renderHub });
    bindBaseMotion(document.getElementById('hubMain'));
    if (hubTab === 'shop') disposeTrade = /** @type {(options: Parameters<typeof bindTradeShopV5>[0] & {preview?:(card: import('./game.store.types.js').CardSnapshot, options:{from?:HTMLElement}) => void}) => ReturnType<typeof bindTradeShopV5>} */ (bindTradeShopV5)({ root:page.querySelector('.trade-v5'), ui:hubUI, base:B, cards:SDT.Cards, goods:HUB_SHOP_GOODS, state:tradeState, render:renderHub, notice, sound:Sfx,
      preview:(card, { from }) => { UI.showCardZoom(card, { presentation:'inventory', from, returnFocus:from }); decorateInventoryZoom(card); } });
    if (hubTab === 'courtyard') disposeCourtyard = /** @type {(root: Parameters<typeof mountCourtyardV3>[0], view?: unknown) => ReturnType<typeof mountCourtyardV3>} */ (mountCourtyardV3)(document.querySelector('.courtyard-v3'), courtyardView);
    hubAct('closeBase', closeBase);
    return true;
  }

  function openPreparationPanel() {
    return preparationFeature.open();
  }

  function closeBase() {
    hubRenderRevision++;
    cancelPendingPageEntries();
    disposeCourtyard(); disposeCourtyard = () => {};
    disposeTrade(); disposeTrade = () => {}; disposePersonnel(); disposePersonnel = () => {};
    zoomFocusObserver?.disconnect();
    zoomFocusObserver = null;
    _set_cardPageOpen(false);
    UI.hideOverlay();
    startNewGame();   // 基地返回选档，不触碰当前档案或对局存档
  }

  // ---------- 背包（物资+卡牌混占格 · 安全格 · 消耗区） ----------
  // 设计者 2026-09-02 定版：从背包丢弃的牌无法取回；消耗的牌可在火堆复原

export { closeBase, openBaseHub, openDepartureFromBase, renderHub, renderHomeScene };
configureCardNavigation({
  closeBase: () => {
    const back = /** @type {HTMLElement} */ (document.querySelector('#hubMain .hub-back'));
    const action = back && UI._acts[back.dataset.act];
    if (action) action({ ...back.dataset }); else closeBase();
  },
  renderHub,
  resetDeployPick: () => setDeployPick(null),
});
