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
import { presentHub, bindHubBrowse, restoreHubFocus } from './hub.presentation.js';
import { afterOutcomeFeedback } from '../ui/outcome-feedback.js';
import { bindWarehouse, clearWarehouseFilters, focusWarehouseForCharacter } from './hub.warehouse.js';
import { resourceStripHTML } from './hub.materials.js';
import { bindArchiveV3, refreshArchiveBacks } from './hub.archive-v3.js';
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
  returnToBase: () => { hubTab = 'deploy'; renderHub(); },
  applyPicks: setDeployPick,
  openDeparture: openDepartPrep,
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
    Promise.resolve(SDT.Meta.checkUnlocks()).catch(() => {
      if (SDT.Base === openedBase && openedBase.slot === openedSlot) UI.log('成就进度检查未完成，可重新进入基地重试。', 'warn');
    });
    renderHub();
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

  function renderHub() {
    const renderRevision = ++hubRenderRevision;
    const previousPage = /** @type {HTMLElement} */ (document.querySelector('#hubMain .hub-page'));
    if (previousPage) hubScroll.set(previousPage.dataset.view, previousPage.scrollTop);
    const focused = document.activeElement?.closest?.('#hubMain [data-act], #hubMain [data-browser-key]');
    const currentFocus = focused ? { .../** @type {HTMLElement} */ (focused).dataset } : null;
    disposeCourtyard(); disposeCourtyard = () => {};
    disposeTrade(); disposeTrade = () => {}; disposePersonnel(); disposePersonnel = () => {};
    disposePreparation();
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
        ${hubNotice.html({ className:`camp-notice${hubNotice.tone === 'warn' ? ' warning' : ''}`, tag:'div' })}
      </div>`, SDT.Icons);
    const root = document.getElementById('hubMain'), slotId = B.slot;
    const currentHub = () => hubRenderRevision === renderRevision && SDT.Base === B && B.slot === slotId &&
      !!root && document.getElementById('hubMain') === root && !UI.el?.overlay?.hidden && !UI.el?.overlay?.classList.contains('closing');
    const hubAct = (name, action) => UI.act(name, (...args) => {
      if (!currentHub()) return;
      return action(...args);
    });
    let writing = false;
    const hubWrite = (name, action) => hubAct(name, async (...args) => {
      if (writing) return false;
      writing = true;
      try { return await action(...args); }
      catch { if (currentHub()) UI.log('基地操作未保存，请重试。', 'warn'); return false; }
      finally { writing = false; }
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
      if (d.view === hubCollectionView) return;
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
    let skinPending = false;
    hubAct('selectCharacterSkin', async (d) => {
      if (skinPending) return;
      const read = readBase(slotId);
      if (!read.ok) { UI.log(homeErrorMessage(read), 'warn'); return; }
      skinPending = true;
      let result;
      try { result = await selectSkin({ slotId, requestId: homeRequestId('skin'), expectedRevision: read.revision }, { characterId: d.character, skinId: d.skin }); }
      catch { result = { ok: false, message: '皮肤选择未保存，请重试' }; }
      finally { skinPending = false; }
      if (!currentHub()) return;
      if (!result.ok) { UI.log(result.message || '皮肤选择失败', 'warn'); return; }
      UI.log(result.value.assetFallback ? '皮肤选择已保存；当前素材缺失，暂用默认立绘。' : '人物皮肤已保存。', result.value.assetFallback ? 'warn' : 'ok');
      renderHub();
    });
    hubWrite('selMode', async (d) => {
      const previousMode = B.data.selMode;
      const result = await B.selectMode(d.mode);
      if (!currentHub()) return false;
      if (!result.ok) {
        UI.log(/** @type {Extract<typeof result, {ok:false}>} */ (result).code === 'INVALID_MODE' ? '玩法选项无效，未保存。' : '玩法保存失败，请稍后重试。', 'warn');
        renderHub();
        return;
      }
      renderHub();
      animateBaseModeChangeV12(document.getElementById('hubMain'), previousMode);
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
    hubWrite('upBag', async () => {
      const upgraded = await B.upgradeBag();
      if (!currentHub()) return false;
      if (!upgraded) { UI.log('背包扩建未保存或材料不足，请重试。', 'warn'); return false; }
      notice(`背包 ${B.bagCap() - 1} → ${B.bagCap()} 格 · 木材 −${MAP.rules.bagUpgradeWood}`);
      Sfx.ding();
      UI.log(`[[icon:bag]] 背包扩建完成：容量 <b>${B.bagCap()}</b> 格（- [[icon:wood]]×${MAP.rules.bagUpgradeWood}）`, 'ok');
      await SDT.Meta.checkUnlocks();
      if (!currentHub()) return false;
      renderHub();
    });
    hubWrite('upPet', d => upgradePetFromPersonnel({ base:SDT.Base, id:d.id, notice, sound:Sfx, ui:UI, meta:SDT.Meta, refresh:renderHub, isCurrent:currentHub }));
    hubWrite('selPet', async (d) => {
      const selected = await B.setPet(d.id);
      if (!currentHub()) return false;
      if (!selected) { UI.log('伙伴选择未保存，请重试。', 'warn'); return false; }
      const pet = SDT.Base.petById(d.id);
      notice(`已携带${pet.name} · 安全格 ${SDT.Base.safeCap()} 格`);
      Sfx.ding();
      UI.log(`[[icon:paw]] 已携带宠物<b>「${esc(pet.name)}」</b>：${esc(pet.desc)} · 安全格 <b>${SDT.Base.safeCap()}</b> 格`, 'ok');
      renderHub();
    });
    hubWrite('upStash', async () => {
      const upgraded = await B.upgradeStash();
      if (!currentHub()) return false;
      if (!upgraded) { UI.log('仓库扩建未保存或材料不足，请重试。', 'warn'); return false; }
      notice(`仓库扩建完成 · ${B.stashCap()} 张 · 木材 −${MAP.rules.stashUpgradeWood}`);
      Sfx.ding();
      UI.log(`[[icon:archive]] 仓库扩建完成：容量 <b>${B.stashCap()}</b> 张（- [[icon:wood]]×${MAP.rules.stashUpgradeWood}）`, 'ok');
      renderHub();
    });
    hubAct('stashItem', (d) => openStashCardView(+d.i));   // 点卡 = 大卡特写操作台：看牌 + 卖出/收藏/使用/孵化都在页脚（2026-10-06 老板二次改版）
    hubAct('rawItem', (d) => openRawItem(d.kind, { from:document.querySelector(`[data-act="rawItem"][data-kind="${d.kind}"]`) }));
    hubWrite('restoreCard', async (d) => {
      const candidates = d.stackKey ? B.data.pocket.filter(stack => stackKeyOf(stack) === d.stackKey)
        : d.name ? B.data.pocket.filter(stack => stack.card.name === d.name) : [B.data.pocket[+d.i]].filter(Boolean);
      if (candidates.length !== 1) { UI.log('消耗区库存已变化，请重新打开详情', 'warn'); return; }
      const index = B.data.pocket.indexOf(candidates[0]);
      const stack = B.data.pocket[index];
      if (!stack) return;
      if (d.count && Number(d.count) !== (stack.count || 1)) { UI.log('消耗区数量已变化，请重新打开详情', 'warn'); return; }
      /** @type {HTMLElement & {_closeCardZoom?: (immediate?: boolean) => void}} */ (document.getElementById('cardZoom'))?._closeCardZoom?.(true);
      const restoreCost = B.pocketKeyCost(stack), restoredCards = Array.from({length:stack.count || 1},()=>({...stack.card}));
      const r = await B.restore(index);
      if (!currentHub()) return false;
      if (r === true) { Sfx.ding(); UI.log(`[[icon:key]] 消耗 <b>${B.pocketKeyCost(stack)}</b> 把钥匙，卡牌已复原，回到卡牌仓库`, 'ok'); }
      else if (r === 'sha') UI.log('[[icon:cards]] 初始牌「初始攻击」无需入库——每局自动携带，已直接消耗', 'dim');
      else if (r === 'full') UI.log(`[[icon:archive]] 仓库容量不足（${B.stashUsed()}/${B.stashCap()} 张），先卖出或升级仓库`, 'warn');
      else if (r && /** @type {typeof r & {why?:string,cost?:number}} */ (r).why === 'nokey') UI.log(`[[icon:key]] 钥匙不足：复原这堆卡牌需要 <b>${/** @type {typeof r & {cost?:number}} */ (r).cost}</b> 把钥匙（现有 ${B.keyCount ? B.keyCount() : 0}）——可在仓库把钥匙材料卡「使用」折入储备`, 'warn');
      else if (!r) UI.log('卡牌复原未保存，请重试。', 'warn');
      if (r === true) return afterOutcomeFeedback(UI.el?.ovBody,{kind:'restore',destination:'仓库',blocking:true,
        cards:restoredCards,cost:`钥匙 −${restoreCost}`,
        source:'基地复原',cardHTML:card=>SDT.Cards.cardHTML(card,'sm'),isCurrent:currentHub},()=>renderHub());
      if (r) renderHub();
    });
    hubWrite('claimAch', async (d) => {
      const r = await M.claim(d.id);
      if (!currentHub()) return false;
      if (r.ok) { notice('成就奖励已入账'); Sfx.ding(); renderHub(); }
      // meta.claim 失败时带 msg（仓库满/存档写失败）——静默丢弃会让「领取」看起来像坏按钮
      else if (r && r.msg) UI.log(`[[icon:cross]] ${r.msg}`, 'warn');
    });
    hubWrite('selBack', async (d) => {
      const B2 = SDT.Base;
      if (!B2.isBackUnlocked(d.id)) {
        const bd = (SDT.Cards.CARD_BACKS || []).find(b => b.id === d.id);
        UI.log(`[[icon:lock]] 卡背未解锁：${bd ? bd.from : d.id}`, 'warn');
        return;
      }
      if (B2.backSel() === d.id) return;
      const selected = await B2.setBack(d.id);
      if (!currentHub()) return false;
      if (!selected) { UI.log('卡背选择未保存，请重试。', 'warn'); return false; }
      const bd = (SDT.Cards.CARD_BACKS || []).find(b => b.id === d.id);
      Sfx.ding();
      UI.log(`[[icon:card-back]] 已装备卡背【<b>${bd ? bd.name : d.id}</b>】——背包翻面与牌库堆即刻生效`, 'ok');
      if (!refreshArchiveBacks({ base:B2, meta:M, cards:SDT.Cards })) renderHub();
    });
    hubWrite('claimColl', async (d) => {
      const r = await M.claimColl(d.id);
      if (!currentHub()) return false;
      if (r.ok) { notice('收藏奖励已入账'); Sfx.ding(); renderHub(); }
      else if (r && /** @type {typeof r & {why?:string,cost?:number}} */ (r).why === 'full') UI.log(`[[icon:archive]] ${r.msg}`, 'warn');
      else if (r && r.msg) UI.log(`[[icon:cross]] ${r.msg}`, 'warn');
    });
    hubAct('collZoom', (d) => {
      const card = M.collectPool().find(c => c.id === d.id);
      const from = /** @type {HTMLElement} */ ([...document.querySelectorAll('[data-act="collZoom"]')].find(button => /** @type {HTMLElement} */ (button).dataset.id === d.id && !/** @type {HTMLElement} */ (button).hidden));
      if (card) { UI.showCardZoom(card, { presentation:'inventory', from }); decorateInventoryZoom(card); }
    });
    hubAct('campFacility', d => { selectFacility(d.id); renderHub(); });
    /** @type {(options: Parameters<typeof bindWarehouse>[0] & {cards?:unknown,meta?:unknown,notify?:unknown}) => ReturnType<typeof bindWarehouse>} */ (bindWarehouse)({ ui: hubUI, base: B, cards: SDT.Cards, meta: M, sound: Sfx, refresh: renderHub, notify: notice, openCard:openStashCardView });
    disposePersonnel = bindPersonnel({ ui: hubUI, sound: Sfx, refresh: renderHub });
    bindArchive(hubUI, { openAchievements:() => { achievementReturn = hubCollectionView === 'backs' ? 'backs' : 'rewards'; hubCollectionView = 'achievements'; renderHub(); } });
    /** @type {(options: Parameters<typeof bindArchiveV3>[0] & {refresh?:unknown}) => ReturnType<typeof bindArchiveV3>} */ (bindArchiveV3)({ ui:hubUI, base:B, meta:M, cards:SDT.Cards, refresh:renderHub });
    bindBaseMotion(document.getElementById('hubMain'));
    if (hubTab === 'shop') disposeTrade = /** @type {(options: Parameters<typeof bindTradeShopV5>[0] & {preview?:(card: import('./game.store.types.js').CardSnapshot, options:{from?:HTMLElement}) => void}) => ReturnType<typeof bindTradeShopV5>} */ (bindTradeShopV5)({ root:page.querySelector('.trade-v5'), ui:hubUI, base:B, cards:SDT.Cards, goods:HUB_SHOP_GOODS, state:tradeState, render:renderHub, notice, sound:Sfx,
      preview:(card, { from }) => { UI.showCardZoom(card, { presentation:'inventory', from, returnFocus:from }); decorateInventoryZoom(card); } });
    if (hubTab === 'courtyard') disposeCourtyard = /** @type {(root: Parameters<typeof mountCourtyardV3>[0], view?: unknown) => ReturnType<typeof mountCourtyardV3>} */ (mountCourtyardV3)(document.querySelector('.courtyard-v3'), courtyardView);
    hubAct('closeBase', closeBase);
  }

  function openPreparationPanel() {
    preparationFeature.open();
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

export { closeBase, openBaseHub, renderHub, renderHomeScene };
configureCardNavigation({
  closeBase: () => {
    const back = /** @type {HTMLElement} */ (document.querySelector('#hubMain .hub-back'));
    const action = back && UI._acts[back.dataset.act];
    if (action) action({ ...back.dataset }); else closeBase();
  },
  renderHub,
  resetDeployPick: () => setDeployPick(null),
});
