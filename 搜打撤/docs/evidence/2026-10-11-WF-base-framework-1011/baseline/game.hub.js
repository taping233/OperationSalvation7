import { CHARACTERS, characterFor, characterName } from '../core/characters.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
import { linkedBackHTML } from '../ui/home-linked-interactions.js';
import { MAP } from '../run/game.session.js';
import { game, getActiveSlot, setLobby, startNewGame } from '../run/game.session.js';
import { Sfx, configureCardNavigation, _set_cardPageOpen } from './game.cardslib.js';
import { readBase, readBaseReceipt, commitBase } from './base.commands.js';
import { getCollection, selectSkin } from './collection.commands.js';
import { createHomeCommands } from '../home/home.commands.js';
import { presentHome, homeErrorMessage } from '../home/home.presenter.js';
import { getM04VisualPack } from '../home/home.visuals.js';
import { createHubPreparationFeature } from './game.hub.preparation.js';
import '../../css/preparation.css';
import '../../css/base-camp-rework.css';
import { presentHub, bindHubBrowse, restoreHubFocus } from './hub.presentation.js';
import { bindWarehouse, clearWarehouseFilters, focusWarehouseForCharacter } from './hub.warehouse.js';
import { resourceStripHTML } from './hub.materials.js';
import { bindArchiveV3 } from './hub.archive-v3.js';
import { courtyardV3HTML, mountCourtyardV3 } from './hub.courtyard-v3.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';
import '../../css/base-courtyard-v3.css';
import '../../css/base-panel-layout.css';
import '../../css/base-cohesion-v5.css';
import { createTradeShopState, tradeShopV5HTML, bindTradeShopV5 } from './hub.trade-shop-v5.js';
import { bindPersonnel, setPersonnelGroup, setPersonnelSection, personnelViewKey, personnelBackTarget } from './hub.personnel.js';
import { bindBaseMotion } from './base-motion-v4.js';
import { selectFacility } from './hub.facilities.js';
import { bindArchive } from './hub.archive.js';
import { slots, homeRequestId } from './game.hub.bridge.js';
import { hubDeployHTML, openDepartPrep, deployPick, setDeployPick } from './game.hub.depart.js';
import { hubStashHTML, openStashCardView, openRawItem, hubUpgradeHTML, hubClassesHTML, hubAchHTML, HUB_SHOP_GOODS, hubShopGoodsCard } from './game.hub.pages.js';
slots.renderHub = renderHub;   // 切片经桥回调重绘（勿直接 import 壳，contracts 拒环）
export { deployPick };         // 对外导出五件套之一（实现在 depart 片，此处转出）

const homeCommands = createHomeCommands({
  readBase, readBaseReceipt, commitBase,
  getCollection: snapshot => getCollection(snapshot, SDT.Cards),
});
let homeController = null;
let homeSceneRequest = 0;
const disposeHome = () => { homeController?.dispose(); homeController = null; };
let preparationFeature = null;
const disposePreparation = () => preparationFeature?.dispose();

// 基地当前页签（原为隐式全局，ESM 严格模式下必须显式声明）
let hubTab = 'deploy';
let hubCollectionView = 'cards';
let achievementReturn = 'rewards';
let stashFromPersonnel = false;
let shopParent = 'stash', facilityParent = 'stash';
let tradeState = createTradeShopState();
let disposeTrade = () => {};
let hubStashView = 'cards';
let hubPersonView = 'wu';
let courtyardView = 'rain';
let disposeCourtyard = () => {};
// 浏览位置仅属于界面；页内操作和详情返回不打断当前浏览。
const hubScroll = new Map();
const hubFocus = new Map();
let hubBrowseSlot = null;
let zoomFocusObserver = null;
let hubNotice = '';
let hubNoticeType = 'ok';
const notice = (text, type = 'ok') => {
  const plain = document.createElement('template'); plain.innerHTML = String(text);
  hubNotice = plain.content.textContent || ''; hubNoticeType = type;
};
preparationFeature = createHubPreparationFeature({
  data: {
    readBase,
    readBaseReceipt,
    commitBase,
    slotId: () => SDT.Base.slot,
    cardCatalog: () => SDT.Cards.all(),
    characters: () => CHARACTERS.map(character => ({ id: character.id, name: character.name })),
    pets: () => SDT.Base.PETS || [],
    bagCapacity: () => SDT.Base.bagCap(),
  },
  view: {
    openPanel: () => {
      UI.showOverlay('', '<div class="preparation-shell camp-detail"><button class="ov-btn" data-act="preparationBack">← 返回基地出发页</button><div id="preparationRoot"></div></div>', 'page');
      UI.act('preparationBack', () => preparationFeature.returnToBase());
      return document.getElementById('preparationRoot');
    },
  },
  navigation: {
    returnToBase: () => { hubTab = 'deploy'; renderHub(); },
    applyPicks: setDeployPick,
    openDeparture: () => { disposeHome(); openDepartPrep(); },
  },
  reportError: message => UI.log(message, 'warn'),
  formatError: homeErrorMessage,
  requestId: homeRequestId,
});
  function openBaseHub(tab) {
    hubNotice = '';
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
    SDT.Meta.checkUnlocks();   // 进基地时补播新解锁的成就
    renderHub();
  }

  function readHomeView() {
    const result = readBase(SDT.Base.slot);
    if (!result.ok) return result;
    return { ok: true, value: presentHome(result.value, { cardCatalog: SDT.Cards.all(), revision: result.revision }), revision: result.revision };
  }

  function renderHomeScene() {
    const request = ++homeSceneRequest;
    disposePreparation();
    disposeHome();
    const read = readHomeView();
    if (!read.ok) { UI.log(homeErrorMessage(read), 'warn'); renderHub(); return; }
    UI.showOverlay('', '<div id="homeSceneHost" class="home-scene-host"></div>', 'page');
    const host = document.getElementById('homeSceneHost');
    const refresh = () => {
      const next = readHomeView();
      if (next.ok && homeController) homeController.update(next.value);
      return next;
    };
    const visualPack = getM04VisualPack();
    import('../home/home.scene.js').then(({ mountHome }) => {
      if (request !== homeSceneRequest || !host.isConnected) return;
      homeController = mountHome({
      host, view: read.value, assets: {
        ...visualPack,
        characterHTML: characterId => SDT.Art.classArt(characterFor(characterId)?.rulesetId || characterId),
        characterLabel: characterId => characterName(characterId),
        cardHTML: cardId => {
          const card = SDT.Cards.all().find(item => item.id === cardId);
          return card ? SDT.Cards.cardHTML(card, 'sm') : '';
        },
      },
      onIntent: async intent => {
        if (request !== homeSceneRequest) return null;
        if (intent.type === 'close') { closeBase(); return { ok: true }; }
        if (intent.type === 'openPanel') {
          hubTab = ({ collection: 'ach', characters: 'classes', pets: 'classes' }[intent.panel] || intent.panel);
          if (intent.panel === 'pets') setPersonnelGroup('pets');
          renderHub(); return { ok: true };
        }
        if (intent.type === 'previewPlacement') return { ok: true, value: intent.placement };
        const context = { slotId: SDT.Base.slot, requestId: homeRequestId(intent.type), expectedRevision: intent.expectedRevision };
        let result;
        if (intent.type === 'buyFurniture') result = await homeCommands.buyFurniture(context, intent);
        else if (intent.type === 'submitLayout') result = await homeCommands.saveLayout(context, intent);
        else if (intent.type === 'selectDisplay') result = await homeCommands.setDisplay(context, intent);
        else return { ok: false, code: 'INVALID_ARGUMENT', message: '未知基地操作' };
        if (result.ok) {
          if (request === homeSceneRequest) refresh();
        } else result = { ...result, message: homeErrorMessage(result) };
        return result;
      },
      });
    }).catch(error => {
      if (request !== homeSceneRequest) return;
      disposeHome();
      UI.log(`基地场景加载失败：${error?.message || error}；可切换页签后重试。`, 'warn');
      renderHub();
    });
  }

  function hubBackTarget() {
    if (hubTab === 'classes') return personnelBackTarget();
    if (hubTab === 'stash' && hubStashView === 'pocket') return { action:'warehouseMain', label:'返回仓库' };
    if (hubTab === 'stash' && stashFromPersonnel) return { action:'stashOrigin', label:'返回队员' };
    if (hubTab === 'shop' || hubTab === 'upgrade') {
      const parent = hubTab === 'shop' ? shopParent : facilityParent;
      return { action:'logisticsParent', label:parent === 'classes' ? '返回队员' : parent === 'shop' ? '返回交易所' : parent === 'deploy' ? '返回基地' : parent === 'ach' ? '返回收藏室' : '返回后勤' };
    }
    if (hubTab === 'ach' && hubCollectionView !== 'cards') {
      if (hubCollectionView === 'achievements') return { action:'archiveParent', label:achievementReturn === 'backs' ? '返回卡背' : '返回奖励' };
      if (hubCollectionView === 'classes') return { action:'rewardMain', label:'返回奖励' };
      return { action:'archiveMain', label:'返回收藏室' };
    }
    return null;
  }

  function renderHub() {
    const previousPage = document.querySelector('#hubMain .hub-page');
    if (previousPage) hubScroll.set(previousPage.dataset.view, previousPage.scrollTop);
    const focused = document.activeElement?.closest?.('#hubMain [data-act], #hubMain [data-browser-key]');
    const currentFocus = focused ? { ...focused.dataset } : null;
    disposeCourtyard(); disposeCourtyard = () => {};
    disposeTrade(); disposeTrade = () => {};
    homeSceneRequest++;
    disposeHome();
    disposePreparation();
    const B = SDT.Base;
    const M = SDT.Meta;
    _set_cardPageOpen(true);      // Hub 页面：Esc / 点击背景可关闭
    // 页签切换时才播放入场动画（页内操作重渲染不闪）
    const viewKey = `${hubTab}/${hubTab === 'stash' ? hubStashView : hubTab === 'classes' ? `${hubPersonView}/${personnelViewKey()}` : hubTab === 'ach' ? hubCollectionView : hubTab === 'courtyard' ? courtyardView : hubTab === 'shop' ? tradeState.mode : ''}`;
    const tabChanged = renderHub._lastView !== viewKey;
    renderHub._lastView = viewKey;
    renderHub._lastTab = hubTab;
    const pages = ['deploy', 'stash', 'classes', 'shop', 'ach', 'upgrade', 'courtyard'];
    const body = hubTab === 'deploy' ? hubDeployHTML()
      : hubTab === 'stash' ? hubStashHTML(hubStashView)
      : hubTab === 'shop' ? tradeShopV5HTML({ base:B, cards:SDT.Cards, art:SDT.Art, goods:HUB_SHOP_GOODS, state:tradeState })
      : hubTab === 'upgrade' ? hubUpgradeHTML()
      : hubTab === 'classes' ? hubClassesHTML(hubPersonView)
      : hubTab === 'courtyard' ? courtyardV3HTML(courtyardView)
      : hubAchHTML(hubCollectionView);
    const back = hubBackTarget();
    presentHub(UI, `
      <div class="pg hub hub-${hubTab} base-camp ${hubTab === 'deploy' ? 'base-home' : 'base-subpage'}" id="hubMain" data-page="${hubTab}">
       <header class="hub-head hub-head-min">
          ${linkedBackHTML(back?.action || (hubTab === 'deploy' ? 'closeBase' : 'hubHome'), back?.label || (hubTab === 'deploy' ? '返回选档' : '返回基地'), 'hub-back')}
          <div class="camp-brand"><h2>基地</h2></div>
          <span class="hub-slot-label">${getActiveSlot() ? `档案 / 0${getActiveSlot()}` : '未选档'}</span>
          <span class="hub-res">${hubTab === 'deploy' ? resourceStripHTML(B) : ''}</span>
        </header>
        <div class="hub-body">
          <main class="hub-page${tabChanged ? ' page-in' : ''}" data-view="${viewKey}">${body}</main>
        </div>
        ${hubNotice ? `<div class="camp-notice${hubNoticeType === 'warn' ? ' warning' : ''}" role="status">[[icon:${hubNoticeType === 'warn' ? 'question' : 'check'}]] ${esc(hubNotice)}</div>` : ''}
      </div>`, SDT.Icons);
    const page = document.querySelector('#hubMain .hub-page');
    if (page) {
      page.scrollTop = hubScroll.get(viewKey) || 0;
      bindHubBrowse(document.getElementById('hubMain'), hubScroll, hubFocus);
    }
    if (currentFocus) hubFocus.set(viewKey, currentFocus);
    zoomFocusObserver?.disconnect();
    zoomFocusObserver = restoreHubFocus(viewKey, hubFocus);
    // 局外商店购买（2026-09-16 留言「局外商店提供基础卡牌」）：储备币直购，货入卡牌仓库
    UI.act('shopBuy', (d) => {
      const g = HUB_SHOP_GOODS[+d.i];
      if (!g) return;
      const B = SDT.Base;
      const card = g.material ? null : hubShopGoodsCard(g);
      const result = B.purchase({ price: g.price, material: g.material, card });
      if (!result.ok) {
        UI.log(result.why === 'poor' ? '[[icon:coin]] 储备币不足，无法购买'
          : result.why === 'full' ? '[[icon:archive]] 仓库已满，无法入库'
            : result.msg || '商品暂不可购买', 'warn');
        return;
      }
      if (g.material) {
        notice(`购入${g.name} ×1 · 储备 −${g.price} 币`);
        Sfx.ding();
        UI.log(`[[icon:coin]] 购入<b>${esc(g.name)}</b> ×1 → 基地物资（${esc(g.name)} ${B.data[g.material]} · 储备余 ${B.data.coins} 币）`, 'loot');
        renderHub();
        return;
      }
      Sfx.ding();
      notice(`已入库：${card.name} ×1 · 储备 −${g.price} 币`);
      UI.log(`[[icon:coin]] 购入【<b>${esc(card.name)}</b>】×1 → 卡牌仓库（储备余 ${B.data.coins} 币）`, 'loot');
      renderHub();
    });
    UI.act('hubTab', (d) => {
      const next = d.tab === 'home' ? 'deploy' : d.tab;
      if (!pages.includes(next)) return;
      document.getElementById('cardZoom')?._closeCardZoom?.(true);
      if (next === 'courtyard' && ['rain', 'koi'].includes(d.view)) { if (hubTab === 'courtyard' && d.view === courtyardView) return; courtyardView = d.view; }
      if (next === 'shop' && hubTab !== 'shop') shopParent = ['deploy', 'classes', 'ach', 'stash'].includes(hubTab) ? hubTab : 'stash';
      if (next === 'shop' && ['buy', 'sell'].includes(d.tradeMode)) tradeState.mode = d.tradeMode;
      if (next === 'shop' && d.tradeKey) tradeState.sellKey = d.tradeKey;
      if (next === 'upgrade' && hubTab !== 'upgrade') facilityParent = hubTab === 'shop' ? 'shop' : 'stash';
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
      hubNotice = '';
      if (next !== hubTab) SDT.Sound.sfx('switch');   // W6-03：页签切换挂既有 switch 音（hub 最高频操作的静区补声）
      hubTab = next;
      renderHub();
    });
    UI.act('hubStashView', (d) => {
      if (d.view === 'pets') { hubTab = 'classes'; setPersonnelGroup('pets'); renderHub(); return; }
      if (!['cards', 'pocket'].includes(d.view) || d.view === hubStashView) return;
      hubStashView = d.view;
      SDT.Sound.sfx('switch');
      renderHub();
    });
    UI.act('hubHome', () => { hubTab = 'deploy'; renderHub(); });
    UI.act('hubRetryView', () => renderHub());
    UI.act('shopPreview', d => {
      const goods = HUB_SHOP_GOODS[Number(d.i)];
      const card = goods && hubShopGoodsCard(goods);
      const from = document.querySelector(`[data-act="shopPreview"][data-i="${Number(d.i)}"]`);
      if (card) { UI.showCardZoom(card, { presentation:'inventory', from }); decorateInventoryZoom(card); }
    });
    UI.act('hubCollectionView', (d) => {
      if (!['cards', 'rewards', 'backs', 'achievements', 'classes', 'stories'].includes(d.view)) return;
      if (d.view === hubCollectionView) return;
      SDT.Sound.sfx('switch');
      if (d.view === 'achievements') achievementReturn = hubCollectionView === 'backs' ? 'backs' : 'rewards';
      hubCollectionView = d.view;
      renderHub();
    });
    UI.act('warehouseMain', () => { hubStashView = 'cards'; SDT.Sound.sfx('switch'); renderHub(); });
    UI.act('logisticsParent', () => { hubTab = hubTab === 'shop' ? shopParent : facilityParent; SDT.Sound.sfx('switch'); renderHub(); });
    UI.act('stashOrigin', () => { hubTab = 'classes'; setPersonnelGroup('people'); setPersonnelSection('profile'); renderHub(); });
    UI.act('rewardMain', () => { hubCollectionView = 'rewards'; renderHub(); });
    UI.act('archiveParent', () => { hubCollectionView = achievementReturn; renderHub(); });
    UI.act('archiveMain', () => { hubCollectionView = 'cards'; SDT.Sound.sfx('switch'); renderHub(); });
    UI.act('hubPersonView', (d) => {
      const character = characterFor(d.character);
      if (!character || character.id === hubPersonView) return;
      hubPersonView = character.id;
      SDT.Sound.sfx('switch');
      renderHub();
    });
    UI.act('openPreparation', () => openPreparationPanel());
    UI.act('selectCharacterSkin', async (d) => {
      const read = readBase(B.slot);
      if (!read.ok) { UI.log(homeErrorMessage(read), 'warn'); return; }
      const result = await selectSkin({ slotId: B.slot, requestId: homeRequestId('skin'), expectedRevision: read.revision }, { characterId: d.character, skinId: d.skin });
      if (!result.ok) { UI.log(result.message || '皮肤选择失败', 'warn'); return; }
      UI.log(result.value.assetFallback ? '皮肤选择已保存；当前素材缺失，暂用默认立绘。' : '人物皮肤已保存。', result.value.assetFallback ? 'warn' : 'ok');
      renderHub();
    });
    UI.act('selMode', (d) => {
      const result = B.selectMode(d.mode);
      if (!result.ok) {
        UI.log(result.code === 'INVALID_MODE' ? '玩法选项无效，未保存。' : '玩法保存失败，请稍后重试。', 'warn');
        renderHub();
        return;
      }
      renderHub();
    });
    UI.act('nestDeploy', () => { SDT.Nest.openNestPrep(); });
    UI.act('deploy', () => { openDepartPrep(); });
    UI.act('gateInfo', () => {
      const n = B.keyCount ? B.keyCount() : 0;
      if (n >= (B.KEY_NEEDED || 10)) {
        Sfx.ding();
        UI.log('[[icon:door]] 宝藏大门已在酝酿——特殊关卡制作中，敬请期待', 'sys');
      } else {
        UI.log(`[[icon:key]] 钥匙不足（${n}/${B.KEY_NEEDED || 10}）——在棋盘的钥匙格收集更多钥匙吧`, 'dim');
      }
    });
    UI.act('upBag', () => {
      if (!B.upgradeBag()) return;
      notice(`背包 ${B.bagCap() - 1} → ${B.bagCap()} 格 · 木材 −${MAP.rules.bagUpgradeWood}`);
      Sfx.ding();
      UI.log(`[[icon:bag]] 背包扩建完成：容量 <b>${B.bagCap()}</b> 格（- [[icon:wood]]×${MAP.rules.bagUpgradeWood}）`, 'ok');
      SDT.Meta.checkUnlocks();
      renderHub();
    });
    UI.act('upPet', (d) => {
      const pet = SDT.Base.petById(d.id);
      if (!SDT.Base.upgradePet(d.id)) return;
      notice(`${pet.name}已升级 · Lv.${SDT.Base.petLevel(d.id)}`);
      Sfx.ding();
      UI.log(`[[icon:paw]] <b>「${esc(pet.name)}」</b>升级到 <b>Lv.${SDT.Base.petLevel(d.id)}</b>：安全格 <b>${B.safeCap()}</b> 格`, 'ok');
      SDT.Meta.checkUnlocks();
      renderHub();
    });
    UI.act('selPet', (d) => {
      if (!SDT.Base.setPet(d.id)) return;
      const pet = SDT.Base.petById(d.id);
      notice(`已携带${pet.name} · 安全格 ${SDT.Base.safeCap()} 格`);
      Sfx.ding();
      UI.log(`[[icon:paw]] 已携带宠物<b>「${esc(pet.name)}」</b>：${esc(pet.desc)} · 安全格 <b>${SDT.Base.safeCap()}</b> 格`, 'ok');
      renderHub();
    });
    UI.act('upStash', () => {
      if (!B.upgradeStash()) return;
      notice(`仓库扩建完成 · ${B.stashCap()} 张 · 木材 −${MAP.rules.stashUpgradeWood}`);
      Sfx.ding();
      UI.log(`[[icon:archive]] 仓库扩建完成：容量 <b>${B.stashCap()}</b> 张（- [[icon:wood]]×${MAP.rules.stashUpgradeWood}）`, 'ok');
      renderHub();
    });
    UI.act('stashItem', (d) => openStashCardView(+d.i));   // 点卡 = 大卡特写操作台：看牌 + 卖出/收藏/使用/孵化都在页脚（2026-10-06 老板二次改版）
    UI.act('rawItem', (d) => openRawItem(d.kind));
    UI.act('restoreCard', (d) => {
      const index = d.name ? B.data.pocket.findIndex(stack => stack.card.name === d.name) : +d.i;
      const stack = B.data.pocket[index];
      if (!stack) return;
      document.getElementById('cardZoom')?._closeCardZoom?.(true);
      const r = B.restore(index);
      if (r === true) { Sfx.ding(); UI.log(`[[icon:key]] 消耗 <b>${B.pocketKeyCost(stack)}</b> 把钥匙，卡牌已复原，回到卡牌仓库`, 'ok'); }
      else if (r === 'sha') UI.log('[[icon:cards]] 初始牌「初始攻击」无需入库——每局自动携带，已直接消耗', 'dim');
      else if (r === 'full') UI.log(`[[icon:archive]] 仓库容量不足（${B.stashUsed()}/${B.stashCap()} 张），先卖出或升级仓库`, 'warn');
      else if (r && r.why === 'nokey') UI.log(`[[icon:key]] 钥匙不足：复原这堆卡牌需要 <b>${r.cost}</b> 把钥匙（现有 ${B.keyCount ? B.keyCount() : 0}）——可在仓库把钥匙材料卡「使用」折入储备`, 'warn');
      if (r) renderHub();
    });
    UI.act('claimAch', (d) => {
      const r = M.claim(d.id);
      if (r.ok) { notice('成就奖励已入账'); Sfx.ding(); renderHub(); }
      // meta.claim 失败时带 msg（仓库满/存档写失败）——静默丢弃会让「领取」看起来像坏按钮
      else if (r && r.msg) UI.log(`[[icon:cross]] ${r.msg}`, 'warn');
    });
    UI.act('selBack', (d) => {
      const B2 = SDT.Base;
      if (!B2.isBackUnlocked(d.id)) {
        const bd = (SDT.Cards.CARD_BACKS || []).find(b => b.id === d.id);
        UI.log(`[[icon:lock]] 卡背未解锁：${bd ? bd.from : d.id}`, 'warn');
        return;
      }
      if (B2.backSel() === d.id) return;
      if (!B2.setBack(d.id)) return;
      const bd = (SDT.Cards.CARD_BACKS || []).find(b => b.id === d.id);
      Sfx.ding();
      UI.log(`[[icon:cards]] 已装备卡背【<b>${bd ? bd.name : d.id}</b>】——背包翻面与牌库堆即刻生效`, 'ok');
      renderHub();
    });
    UI.act('claimColl', (d) => {
      const r = M.claimColl(d.id);
      if (r.ok) { notice('收藏奖励已入账'); Sfx.ding(); renderHub(); }
      else if (r && r.why === 'full') UI.log(`[[icon:archive]] ${r.msg}`, 'warn');
      else if (r && r.msg) UI.log(`[[icon:cross]] ${r.msg}`, 'warn');
    });
    UI.act('collZoom', (d) => {
      const card = M.collectPool().find(c => c.id === d.id);
      const from = [...document.querySelectorAll('[data-act="collZoom"]')].find(button => button.dataset.id === d.id && !button.hidden);
      if (card) { UI.showCardZoom(card, { presentation:'inventory', from }); decorateInventoryZoom(card); }
    });
    UI.act('campFacility', d => { selectFacility(d.id); renderHub(); });
    bindWarehouse({ ui: UI, base: B, cards: SDT.Cards, meta: M, sound: Sfx, refresh: renderHub, notify: notice, openCard:openStashCardView });
    bindPersonnel({ ui: UI, sound: Sfx, refresh: renderHub });
    bindArchive(UI, renderHub, { openAchievements:() => { achievementReturn = hubCollectionView === 'backs' ? 'backs' : 'rewards'; hubCollectionView = 'achievements'; renderHub(); } });
    bindArchiveV3({ ui:UI, base:B, meta:M, cards:SDT.Cards, refresh:renderHub });
    bindBaseMotion(document.getElementById('hubMain'));
    if (hubTab === 'shop') disposeTrade = bindTradeShopV5({ root:page.querySelector('.trade-v5'), ui:UI, base:B, cards:SDT.Cards, goods:HUB_SHOP_GOODS, state:tradeState, render:renderHub, notice, sound:Sfx,
      preview:(card, { from }) => { UI.showCardZoom(card, { presentation:'inventory', from, returnFocus:from }); decorateInventoryZoom(card); } });
    if (hubTab === 'courtyard') disposeCourtyard = mountCourtyardV3(document.querySelector('.courtyard-v3'), courtyardView);
    UI.act('closeBase', closeBase);
  }

  function openPreparationPanel() {
    disposeHome();
    preparationFeature.open();
  }

  function closeBase() {
    disposeCourtyard(); disposeCourtyard = () => {};
    disposeTrade(); disposeTrade = () => {};
    zoomFocusObserver?.disconnect();
    zoomFocusObserver = null;
    homeSceneRequest++;
    disposeHome();
    _set_cardPageOpen(false);
    UI.hideOverlay();
    startNewGame();   // 基地返回选档，不触碰当前档案或对局存档
  }

  // ---------- 背包（物资+卡牌混占格 · 安全格 · 消耗口袋） ----------
  // 设计者 2026-09-02 定版：从背包丢弃的牌无法取回；消耗的牌可在火堆复原

export { closeBase, openBaseHub, renderHub, renderHomeScene };
configureCardNavigation({
  closeBase: () => {
    const back = document.querySelector('#hubMain .hub-back');
    const action = back && UI._acts[back.dataset.act];
    if (action) action({ ...back.dataset }); else closeBase();
  },
  renderHub,
  resetDeployPick: () => setDeployPick(null),
});

