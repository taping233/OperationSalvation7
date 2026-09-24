import { CHARACTERS, characterFor, characterName } from '../core/characters.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
import { MAP } from '../run/game.session.js';
import { game, getActiveSlot, setLobby, showTitle } from '../run/game.session.js';
import { Sfx, configureCardNavigation, _set_cardPageOpen } from './game.cardslib.js';
import { readBase, readBaseReceipt, commitBase } from './base.commands.js';
import { getCollection, selectSkin } from './collection.commands.js';
import { createHomeCommands } from '../home/home.commands.js';
import { presentHome, homeErrorMessage } from '../home/home.presenter.js';
import { getM04VisualPack } from '../home/home.visuals.js';
import { createPreparationCommands, getPreparation, previewDeployment } from './preparation.commands.js';
import { buildPreparationViewModel, mountPreparationView } from './preparation.view.js';
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
let preparationController = null;
let homeSceneRequest = 0;
const disposeHome = () => { homeController?.dispose(); homeController = null; };
const disposePreparation = () => { preparationController?.dispose(); preparationController = null; };
const preparationCommands = createPreparationCommands({ readBase, readBaseReceipt, commitBase });

// 基地当前页签（原为隐式全局，ESM 严格模式下必须显式声明）
let hubTab = 'deploy';
let hubCollectionView = 'backs';
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
      { id: 'ach', icon: 'trophy', name: '成就·收藏室' },
    ];
    const body = hubTab === 'deploy' ? hubDeployHTML()
      : hubTab === 'stash' ? hubStashHTML()
      : hubTab === 'shop' ? hubShopHTML()
      : hubTab === 'upgrade' ? hubUpgradeHTML()
      : hubTab === 'classes' ? hubClassesHTML()
      : hubAchHTML(hubCollectionView);
    registerHubHelp(hubTab);
    UI.showOverlay('', `
      <div class="pg hub hub-${hubTab}" id="hubMain">
       <header class="hub-head hub-head-min">
          <h2>远征基地</h2><span class="hub-slot-label">${getActiveSlot() ? `档位 0${getActiveSlot()}` : '未选档'}</span>
         <button class="hub-back" data-act="closeBase" title="返回主菜单（Esc）">← 返回</button>
          ${UI.helpBtn('hub-' + hubTab)}
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
      if (B.data.coins < g.price) { UI.log('[[icon:coin]] 储备币不足，无法购买', 'warn'); return; }
      B.data.coins -= g.price;
      if (g.material) {
        B.data[g.material] = (B.data[g.material] || 0) + 1;
        B.save();
        Sfx.ding();
        UI.log(`[[icon:coin]] 购入<b>${esc(g.name)}</b> ×1 → 基地物资（${esc(g.name)} ${B.data[g.material]} · 储备余 ${B.data.coins} 币）`, 'loot');
        renderHub();
        return;
      }
      const card = hubShopGoodsCard(g);
      if (!card) { B.data.coins += g.price; return; }
      if (B.stashRoom() <= 0) { B.data.coins += g.price; UI.log('[[icon:archive]] 仓库已满，无法入库', 'warn'); return; }
      B.depositCards([{ card: { ...card }, count: 1 }]);
      Sfx.ding();
      UI.log(`[[icon:coin]] 购入【<b>${esc(card.name)}</b>】×1 → 卡牌仓库（储备余 ${B.data.coins} 币）`, 'loot');
      renderHub();
    });
    UI.act('hubTab', (d) => { hubTab = d.tab === 'home' ? 'deploy' : d.tab; renderHub(); });
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
    UI.act('selMode', (d) => { B.data.selMode = d.mode; B.save(); renderHub(); });
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
    UI.act('upSafe', () => { renderHub(); });   // 保险升级已改为宠物升级（见 upgrade 页每只宠物的按钮）
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
    });
    UI.act('selBack', (d) => {
      const B2 = SDT.Base;
      if (!B2.isBackUnlocked(d.id)) {
        const bd = (SDT.Cards.CARD_BACKS || []).find(b => b.id === d.id);
        UI.log(`[[icon:lock]] 卡背未解锁：${bd ? bd.from : d.id}`, 'warn');
        return;
      }
      if (B2.backSel() === d.id) return;
      B2.setBack(d.id);
      const bd = (SDT.Cards.CARD_BACKS || []).find(b => b.id === d.id);
      Sfx.ding();
      UI.log(`[[icon:cards]] 已装备卡背【<b>${bd ? bd.name : d.id}</b>】——背包翻面与牌库堆即刻生效`, 'ok');
      renderHub();
    });
    UI.act('claimColl', (d) => {
      const r = M.claimColl(d.id);
      if (r.ok) { Sfx.ding(); renderHub(); }
      else if (r && r.why === 'full') UI.log(`[[icon:archive]] ${r.msg}`, 'warn');
    });
    UI.act('collZoom', (d) => {
      const card = M.collectPool().find(c => c.id === d.id);
      if (card) UI.showCardZoom(card);
    });
    UI.act('closeBase', closeBase);
  }

  function preparationModel(snapshot, error = '') {
    const state = getPreparation(snapshot);
    const cards = SDT.Cards.all();
    const pets = (SDT.Base.PETS || []).map(pet => ({ id: pet.id, name: pet.name }));
    const characterOptions = CHARACTERS.map(character => ({ id: character.id, name: character.name }));
    return buildPreparationViewModel({ baseSnapshot: snapshot, preparation: state, cardCatalog: cards, characters: characterOptions, pets, catalogVersion: 'm06-v1', bagCapacity: SDT.Base.bagCap(), error });
  }

  function openPreparationPanel() {
    disposeHome(); disposePreparation();
    const current = readBase(SDT.Base.slot);
    if (!current.ok) { UI.log(homeErrorMessage(current), 'warn'); return; }
    UI.showOverlay('', '<div class="preparation-shell"><button class="ov-btn" data-act="preparationBack">← 返回基地出发页</button><div id="preparationRoot"></div></div>', 'page');
    UI.act('preparationBack', () => { hubTab = 'deploy'; renderHub(); });
    const root = document.getElementById('preparationRoot');
    const repaint = (error = '') => {
      const fresh = readBase(SDT.Base.slot);
      if (fresh.ok) preparationController?.update(preparationModel(fresh.value, error));
      return fresh;
    };
    preparationController = mountPreparationView(root, {
      model: preparationModel(current.value),
      onIntent: async ({ type, payload }) => {
        const fresh = readBase(SDT.Base.slot);
        if (!fresh.ok) { repaint(homeErrorMessage(fresh)); return; }
        const context = { slotId: SDT.Base.slot, requestId: homeRequestId(`prep-${type}`), expectedRevision: fresh.revision };
        const state = getPreparation(fresh.value);
        const preset = state.presets.find(item => item.id === payload.presetId);
        let result = null;
        if (type === 'goal-add' || type === 'goal-remove') {
          const tracked = type === 'goal-add' ? [...state.tracked, payload.targetId] : state.tracked.filter(id => id !== payload.targetId);
          result = await preparationCommands.setTrackedGoals(context, { targetIds: tracked.filter(Boolean) });
        } else if (type === 'preset-field' && preset) {
          result = await preparationCommands.savePreset(context, { ...preset, presetId: preset.id, [payload.field]: payload.value });
        } else if ((type === 'preset-pick-add' || type === 'preset-pick-remove') && preset) {
          const existing = preset.picks.filter(item => item.card.cardId !== payload.cardId);
          const picks = type === 'preset-pick-add' && payload.cardId ? existing.concat({ card: { cardId: payload.cardId }, count: payload.count }) : existing;
          result = await preparationCommands.savePreset(context, { ...preset, presetId: preset.id, picks });
        } else if (type === 'preset-preview') {
          repaint(); return;
        } else if (type === 'preset-apply' && preset) {
          const preview = previewDeployment({ baseSnapshot: fresh.value, preset, cardCatalog: SDT.Cards.all(), characters: CHARACTERS, pets: SDT.Base.PETS || [], bagCapacity: SDT.Base.bagCap() });
          if (!preview.canStart) { repaint('库存或资格已变化，预设无法应用。'); return; }
          setDeployPick({});
          for (const item of preview.resolvedPicks.filter(item => item.status === 'ready' && item.appliedCount === item.requestedCount)) {
            const stack = fresh.value.stash.find(entry => entry.card?.id === item.card.cardId);
            if (stack) deployPick[stack.card.name] = item.appliedCount;
          }
          disposePreparation(); openDepartPrep(); return;
        } else if (type === 'preset-start' && preset) {
          result = await preparationCommands.startDeployment(context, { presetId: preset.id, mode: 'standard', expectedRunRevision: 0 });
        }
        repaint(result?.ok ? '' : (result?.message || '操作失败'));
      },
    });
  }

  // —— 基地各页签的 ? 帮助主题（说明文字统一收进二级界面，不在页面直铺） ——
  function registerHubHelp(tab) {
    const R = MAP.rules;
    const T = {
      deploy: { title: '出发说明', items: [
        ['玩法选择', '出发后会随机空降到外圈入口，并从全部人物中自由选择 1 个本局人物（熟练度提供常驻加成）。'],
        ['出征预报', '点击「出发」后会打开出征整备：选择要从仓库携带的卡牌——只有带上的卡才能在战斗中使用。撤离成功后也会出现整理界面，让你把背包战利品放回仓库。'],
        ['宝藏大门', '在棋盘的钥匙格收集钥匙，集齐 ' + (SDT.Base.KEY_NEEDED || 10) + ' 把可开启特殊关卡（关卡制作中）。'],
      ] },
      shop: { title: '商店说明', items: [
        ['基础卡牌', '用储备币购买基础招式 / 装备 / 资源卡，买下直接放入卡牌仓库，出发前勾选带入。'],
        ['储备币', '卖出仓库物品所得；不进局、不随对局增减，只用于基地消费（孵蛋、商店）。'],
      ] },
      stash: { title: '仓库说明', items: [
        ['卡牌仓库', '点击物品可卖出换储备币，或收藏进图鉴（收藏职业卡 +10、能力卡 +50 对应人物熟练度经验，重复收藏重复获得经验（进度只记首次）；收藏即用掉这张卡，不再占仓库格；收藏进度可在「成就·收藏室」领一次性奖励。传说卡与桌游珍宝是特殊收藏品，收藏期间不可卖出）。出发时自选携带（职业卡带出后无法带入）。'],
        ['材料卡 / 宠物蛋', '木材/口粮/钥匙材料卡可直接「使用」折入真实物资；宠物蛋 + 50 币可孵化随机宠物（宝箱 0.7% 起掉落：每开箱未出 +3%、每打赢一场战斗再 +0.2%）。'],
        ['消耗口袋', '战斗中消耗的卡牌有 1/3 概率随撤离回到这里（职业卡与初始牌除外）；用钥匙按稀有度复原：古朴1 / 稀有2 / 史诗3 / 传说4。下一次出发后口袋清空。'],
        ['宠物', '初始宠物「汪汪狗」自动获得，携带 1 只出战（出发页可切换）；其余用宠物蛋孵化。宠物在「升级」页用口粮升级（2-3-4-5）。'],
        ['物资', '木材/口粮/钥匙是基地建设材料（木材扩建背包与仓库、口粮升级宠物、钥匙复原口袋与开启宝藏大门），不可卖出换币。储备币只留在基地消费，不随对局带走。'],
      ] },
      upgrade: { title: '升级说明', items: [
        ['背包扩建', '每消耗木材 ×' + R.bagUpgradeWood + ' 扩建 1 格，上限 ' + R.bagMax + ' 格。'],
        ['仓库扩建', '每消耗木材 ×' + R.stashUpgradeWood + ' 扩建 ' + R.stashUpgradeSlots + ' 张容量，上限 ' + R.stashMax + ' 张。'],
        ['宠物升级', '每只宠物独立升级，口粮消耗递增 2-3-4-5，上限 Lv.5；Lv.1 起每级 +1 安全格。携带不同宠物安全格数量不同（小企鹅咕嘎 4-8 格）。'],
      ] },
      classes: { title: '人物说明', items: [
        ['熟练度', '每局出发时从全部角色中自由选择 1 个；击败敌人、撤离成功都会累积所选角色的熟练度经验，升级获得常驻加成（下一局出征生效）。'],
      ] },
      ach: { title: '成就与职业收藏室', items: [
        ['卡背图鉴', '牌库堆 / 背包翻面使用的卡背；领取对应成就奖励解锁，点击即可装备。'],
        ['成就', '达成条件后自动解锁（页内显示奖励内容），回基地点击「领取」获得物资与卡背奖励。'],
        ['职业收藏室', '仓库中收藏的职业卡与能力卡会陈列在此：每次收藏都转化为人物熟练度经验（职业卡 +10、能力卡 +50，重复收藏重复获得），卡牌收藏即用掉、不再占仓库格。收藏不同的职业卡与能力卡推进进度，5 / 15 / 30 / 45 / 全收集各有一次奖励，达成后点击「领取」。'],
      ] },
    };
    const t = T[tab];
    if (!t) return;
    UI.registerHelp('hub-' + tab, {
      title: t.title,
      html: t.items.map(([k, v]) => `<p class="help-item"><b>${k}</b>${v}</p>`).join(''),
      back: () => renderHub(),
    });
  }



  function closeBase() {
    homeSceneRequest++;
    disposeHome();
    _set_cardPageOpen(false);
    UI.hideOverlay();
    showTitle();   // 基地只在局外（标题/撤离结算后）可达，关闭即回主菜单
  }

  // ---------- 背包（物资+卡牌混占格 · 安全格 · 消耗口袋） ----------
  // 设计者 2026-09-02 定版：从背包丢弃的牌无法取回；消耗的牌可在火堆复原

export { closeBase, openBaseHub, renderHub, renderHomeScene };
configureCardNavigation({
  closeBase,
  renderHub,
  resetDeployPick: () => setDeployPick(null),
});

