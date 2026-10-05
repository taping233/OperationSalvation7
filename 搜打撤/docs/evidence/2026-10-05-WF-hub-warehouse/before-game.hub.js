import { CHARACTERS, characterFor, characterName } from '../core/characters.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
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
import { slots, homeRequestId } from './game.hub.bridge.js';
import { hubDeployHTML, openDepartPrep, deployPick, setDeployPick } from './game.hub.depart.js';
import { hubShopHTML, hubStashHTML, openStashItem, openRawItem, hubUpgradeHTML, hubClassesHTML, hubAchHTML, HUB_SHOP_GOODS, hubShopGoodsCard } from './game.hub.pages.js';
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
let hubCollectionView = 'backs';
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
      UI.showOverlay('', '<div class="preparation-shell"><button class="ov-btn" data-act="preparationBack">← 返回基地出发页</button><div id="preparationRoot"></div></div>', 'page');
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
          hubTab = ({ collection: 'ach', characters: 'classes', pets: 'stash' }[intent.panel] || intent.panel);
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

  function renderHub() {
    homeSceneRequest++;
    disposeHome();
    disposePreparation();
    const B = SDT.Base;
    const M = SDT.Meta;
    _set_cardPageOpen(true);      // Hub 页面：Esc / 点击背景可关闭
    const pending = M.pendingAch().length + M.pendingColl().length;
    // 页签切换时才播放入场动画（页内操作重渲染不闪）
    const tabChanged = renderHub._lastTab !== hubTab;
    renderHub._lastTab = hubTab;
    // v0.22 图标页签：大图标为主 + 小字注记（仓库=木房子）
    const TABS = [
      { id: 'deploy', icon: 'flag', name: '出发' },
      { id: 'stash', icon: 'home', name: '仓库' },
      { id: 'shop', icon: 'coin', name: '商店' },
      { id: 'upgrade', icon: 'tools', name: '升级' },
      { id: 'classes', icon: 'medal', name: '人物' },
      { id: 'ach', icon: 'trophy', name: '成就·收藏' },   // 09-25 A 组：页签缩写防折行（page-hub.css 配 nowrap）
    ];
    const body = hubTab === 'deploy' ? hubDeployHTML()
      : hubTab === 'stash' ? hubStashHTML()
      : hubTab === 'shop' ? hubShopHTML()
      : hubTab === 'upgrade' ? hubUpgradeHTML()
      : hubTab === 'classes' ? hubClassesHTML()
      : hubAchHTML(hubCollectionView);
    UI.showOverlay('', `
      <div class="pg hub hub-${hubTab} hub-cover" id="hubMain">
       <header class="hub-head hub-head-min">
          <h2>远征基地</h2><span class="hub-slot-label">${getActiveSlot() ? `档位 0${getActiveSlot()}` : '未选档'}</span>
         <button class="hub-back" data-act="closeBase" title="返回选档界面（Esc）">← 返回</button>
          <span class="pg-spacer"></span>
          <span class="hub-res">
            <span class="res-chip">[[icon:wood]] 木材 <b>${B.data.wood}</b></span>
            <span class="res-chip">[[icon:bread]] 口粮 <b>${B.data.rations}</b></span>
            <span class="res-chip" title="真实钥匙储备 + 仓库钥匙卡（宝藏大门计数）">[[icon:key]] 钥匙 <b>${B.keyCount ? B.keyCount() : 0}</b></span>
            <span class="res-chip" title="卖出仓库物品所得 · 不进局，用于孵蛋与基地建设">[[icon:coin]] 储备 <b>${B.data.coins}</b> 币</span>
          </span>
        </header>
        <div class="hub-body">
          <nav class="hub-tabs">${TABS.map(t =>
            `<button class="hub-tab${hubTab === t.id ? ' on' : ''}" data-act="hubTab" data-tab="${t.id}">` +
            `<span class="tab-ico">${SDT.Icons.img(t.icon)}</span>` +
            `<span class="tab-txt">${t.name}</span>` +
            `${t.id === 'ach' && pending ? '<span class="dot"></span>' : ''}</button>`).join('')}
          </nav>
          <div class="hub-page${tabChanged ? ' page-in' : ''}">${body}</div>
        </div>
      </div>`, 'page');
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
        Sfx.ding();
        UI.log(`[[icon:coin]] 购入<b>${esc(g.name)}</b> ×1 → 基地物资（${esc(g.name)} ${B.data[g.material]} · 储备余 ${B.data.coins} 币）`, 'loot');
        renderHub();
        return;
      }
      Sfx.ding();
      UI.log(`[[icon:coin]] 购入【<b>${esc(card.name)}</b>】×1 → 卡牌仓库（储备余 ${B.data.coins} 币）`, 'loot');
      renderHub();
    });
    UI.act('hubTab', (d) => {
      const next = d.tab === 'home' ? 'deploy' : d.tab;
      if (next !== hubTab) SDT.Sound.sfx('switch');   // W6-03：页签切换挂既有 switch 音（hub 最高频操作的静区补声）
      hubTab = next;
      renderHub();
    });
    UI.act('hubCollectionView', (d) => {
      if (!['backs', 'achievements', 'classes'].includes(d.view)) return;
      hubCollectionView = d.view;
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
      Sfx.ding();
      UI.log(`[[icon:bag]] 背包扩建完成：容量 <b>${B.bagCap()}</b> 格（- [[icon:wood]]×${MAP.rules.bagUpgradeWood}）`, 'ok');
      SDT.Meta.checkUnlocks();
      renderHub();
    });
    UI.act('upPet', (d) => {
      const pet = SDT.Base.petById(d.id);
      if (!SDT.Base.upgradePet(d.id)) return;
      Sfx.ding();
      UI.log(`[[icon:paw]] <b>「${esc(pet.name)}」</b>升级到 <b>Lv.${SDT.Base.petLevel(d.id)}</b>：安全格 <b>${B.safeCap()}</b> 格`, 'ok');
      SDT.Meta.checkUnlocks();
      renderHub();
    });
    UI.act('selPet', (d) => {
      if (!SDT.Base.setPet(d.id)) return;
      const pet = SDT.Base.petById(d.id);
      Sfx.ding();
      UI.log(`[[icon:paw]] 已携带宠物<b>「${esc(pet.name)}」</b>：${esc(pet.desc)} · 安全格 <b>${SDT.Base.safeCap()}</b> 格`, 'ok');
      renderHub();
    });
    UI.act('upStash', () => {
      if (!B.upgradeStash()) return;
      Sfx.ding();
      UI.log(`[[icon:archive]] 仓库扩建完成：容量 <b>${B.stashCap()}</b> 张（- [[icon:wood]]×${MAP.rules.stashUpgradeWood}）`, 'ok');
      renderHub();
    });
    UI.act('stashItem', (d) => openStashItem(+d.i));
    UI.act('rawItem', (d) => openRawItem(d.kind));
    UI.act('restoreCard', (d) => {
      const stack = B.data.pocket[+d.i];
      const r = B.restore(+d.i);
      if (r === true) { Sfx.ding(); UI.log(`[[icon:key]] 消耗 <b>${B.pocketKeyCost(stack)}</b> 把钥匙，卡牌已复原，回到卡牌仓库`, 'ok'); }
      else if (r === 'sha') UI.log('[[icon:cards]] 初始牌「初始攻击」无需入库——每局自动携带，已直接消耗', 'dim');
      else if (r === 'full') UI.log(`[[icon:archive]] 仓库容量不足（${B.stashUsed()}/${B.stashCap()} 张），先卖出或升级仓库`, 'warn');
      else if (r && r.why === 'nokey') UI.log(`[[icon:key]] 钥匙不足：复原这堆卡牌需要 <b>${r.cost}</b> 把钥匙（现有 ${B.keyCount ? B.keyCount() : 0}）——可在仓库把钥匙材料卡「使用」折入储备`, 'warn');
      if (r) renderHub();
    });
    UI.act('claimAch', (d) => {
      const r = M.claim(d.id);
      if (r.ok) { Sfx.ding(); renderHub(); }
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
      if (r.ok) { Sfx.ding(); renderHub(); }
      else if (r && r.why === 'full') UI.log(`[[icon:archive]] ${r.msg}`, 'warn');
      else if (r && r.msg) UI.log(`[[icon:cross]] ${r.msg}`, 'warn');
    });
    UI.act('collZoom', (d) => {
      const card = M.collectPool().find(c => c.id === d.id);
      if (card) UI.showCardZoom(card);
    });
    UI.act('closeBase', closeBase);
  }

  function openPreparationPanel() {
    disposeHome();
    preparationFeature.open();
  }

  function closeBase() {
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
  closeBase,
  renderHub,
  resetDeployPick: () => setDeployPick(null),
});

