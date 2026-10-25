import { createLegacyBagUse } from './bag-legacy-use.js';
import { createBagContainerPages } from './bag-container-pages.js';
import { discardInventoryCard, craftInventoryToken } from './bag-inventory-commands.js';
import { sameStoredCard } from './stored-card-identity.js';
import { patchBackpackPane, captureBackpackPosition, restoreBackpackPosition } from './bag-pane-view.js';
import { deriveBagRenderState, syncBagCardOrder } from '../core/bag-render-derivation.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const UI = window.SDT.UI;
const SDT = window.SDT;
import { esc } from '../core/shared.js';
import { MAP, bagCap, safeCap } from '../run/game.session.js';
import { escAttr } from '../core/shared.js';
import { cardStacks, game, newUid, safeUsed, saveGame, usedSlots } from '../run/game.session.js';
import { Random } from '../core/random.js';
import { setBagReturnHook as _setBagReturnHook, takeBagReturnHook } from './bag-return-hook.js';
import { _set_cardPageOpen } from './game.cardslib.js';
import { bagSlots } from './game.bag.bridge.js';
import { bagDrag, resetBagDrag } from './game.bag.drag.js';
import { bagUseStatus } from './game.bag.rules.js';
import { pageHTML as bagV2PageHTML, rarityOf as bagV2Rarity } from './game.bag.view2.js';
import { captureBattleContext } from '../battle/battle-loader.js';
import { createRewardOrganizer } from './game.reward-organizer.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';
import { createOperationNotice } from '../ui/operation-notice.js';
import { createSafeTransfer } from './game.bag.safe-transfer.js';
function closeBagZoom() {
  const zoom = document.getElementById('cardZoom');
  // Finish the old detail before new page actions capture their view owner.
  if (typeof /** @type {HTMLElement & {_closeCardZoom?: (immediate?: boolean) => void}} */ (zoom)?._closeCardZoom === 'function') /** @type {HTMLElement & {_closeCardZoom?: (immediate?: boolean) => void}} */ (zoom)._closeCardZoom(true);
  else /** @type {HTMLElement} */ (zoom?.querySelector('.cz-backdrop'))?.click();
}
function captureBagView(rootFor = null) {
  const sameRun = captureBattleContext(game), cards = game.ownedCards, body = UI.el.ovBody;
  const root = body?.firstElementChild, zoom = document.getElementById('cardZoom');
  return () => sameRun() && !game.battleActive && game.ownedCards === cards && game.runActive && game.state === 'modal'
    && !UI.el.overlay.hidden && !UI.el.overlay.classList?.contains('closing')
    && (!body || (UI.el.ovBody === body && body.firstElementChild === (rootFor ? rootFor() : root)))
    && (rootFor || document.getElementById('cardZoom') === zoom);
}
function bagAct(name, handler, current = captureBagView()) {
  UI.act(name, data => { if (current()) return handler(data); });
}
bagSlots.showBackpack = showBackpack;
bagSlots.closeBackpack = closeBackpack;
let requestedBagSection = null;
let bagZone = 'bag', bagFilter = 'all', bagSortKey = 'rarity';
let bagReceipt = null;
const bagNotice = createOperationNotice();
const { button:safeTransferButton, move:moveStackSafe } = createSafeTransfer({
  UI, game, shaName:SDT.Cards.SHA.name, bagCap, safeCap, usedSlots, safeUsed,
  baseCap:() => SDT.Base.bagCap(), refresh:showBackpack, save:saveGame, closeZoom:closeBagZoom,
  captureContext:() => captureBattleContext(game), beforeSelection:rememberBagPosition,
  cardHTML:card => SDT.Cards.cardHTML(card), sound:kind => SDT.Sound.sfx(kind), receipt:setBagReceipt,
});
function setBagReceipt(text) {
  bagReceipt = { cards:game.ownedCards };
  bagNotice.set(text);
}
let bagReturnPosition = null;
function rememberBagPosition(name) {
  const position = captureBackpackPosition(UI.el.ovBody, name);
  if (position) bagReturnPosition = { position, current:captureBattleContext(game), cards:game.ownedCards };
}
function showBackpackSection(section) {
  if (game.battleActive) return;
  requestedBagSection = ['safe', 'pocket'].includes(section) ? section : 'main';
  showBackpack();
}
bagSlots.moveStackOrder = moveStackOrder;
bagSlots.moveStackSafe = moveStackSafe;
bagSlots.showDiscardConfirm = showDiscardConfirm;
bagSlots.organizeReward = createRewardOrganizer({ UI, game, shaName:SDT.Cards.SHA.name,
  usedSlots, bagCap, safeUsed, safeCap, moveStackSafe, discardOwnedCard });
bagSlots.pocketAdd = pocketAdd;   // 本体函数经桥供 drag/settle 片调用（contracts 拒环）
const { useOwnedCard } = createLegacyBagUse({ UI, game, readCards:() => SDT.Cards, baseCap:() => SDT.Base.bagCap(),
  items:MAP.items, Random, newUid, saveGame, showBackpack, usedSlots, bagCap,
  captureContext:() => captureBattleContext(game), setBagReceipt });
const { openPouchStore, openPearlStore } = createBagContainerPages({ UI, game, readCards:() => SDT.Cards,
  sound:kind => SDT.Sound.sfx(kind), baseCap:() => SDT.Base.bagCap(), cardStacks,
  usedSlots, bagCap, saveGame, showBackpack, rememberBagPosition, captureBagView, bagAct, decorateInventoryZoom });


  function pocketAdd(card) {
    const s = game.usedPocket.find(p => sameStoredCard(p, {card}));
    if (s) s.count++;
    else game.usedPocket.push({ card: { ...card }, count: 1 });
  }

  function bagUseButton(card, uid) {
    const status = bagUseStatus(card, uid, { game, usedSlots, bagCap, baseCap: () => SDT.Base.bagCap() });
    return `<button class="ov-btn ok" data-act="useDetailCard"${status.reason ? ` disabled title="${escAttr(status.reason)}"` : ''}>${esc(status.label)}</button>`;
  }

  // ---------- 背包显示顺序（v0.21：卡牌堆可拖拽排序，随存档保存） ----------
  // cardOrder = 卡名列表；新出现的堆追加到末尾，已消失的堆自动移除
  function syncCardOrder(bagStacks = cardStacks(false), safeStacks = cardStacks(true)) {
    game.cardOrder = syncBagCardOrder(bagStacks, safeStacks, game.cardOrder || []);
  }

  function sortStacksByOrder(stacks, orderIndex) {
    const idx = n => orderIndex.get(n) ?? -1;
    return stacks.slice().sort((a, b) => idx(a.card.name) - idx(b.card.name));
  }

  // 把 srcName 的堆移到 beforeName 之前（beforeName 缺省 = 移到末尾）
  function moveStackOrder(srcName, beforeName) {
    if (game.battleActive) return false;
    syncCardOrder();
    const ord = game.cardOrder.filter(n => n !== srcName);
    const di = beforeName ? ord.indexOf(beforeName) : -1;
    ord.splice(di < 0 ? ord.length : di, 0, srcName);
    game.cardOrder = ord;
  }

  function closeBackpack() {
    bagReturnPosition = null;
    rememberBagPosition();
    backpackOpen = false;
    resetBagDrag();
    UI.hideOverlay();
    // 从搜刮界面打开的背包：关闭后回到当前搜刮面板继续开箱（2026-09-09 留言 #13）
    if (bagOverChest) {
      bagOverChest = false;
      game.state = 'modal';
      if (SDT.Chests && SDT.Chests.resume) SDT.Chests.resume();
      UI.refresh(game);
      return;
    }
    // 从其他页面（商店/事件/物资格页等）打开的背包：关闭后调用返回钩子回到原页面（2026-09-12 留言 #31；
    // 来源恢复协议 09-20——钩子消费即清空，由 bag-return-hook.js 中立模块承载）
    const returnHook = takeBagReturnHook();
    if (returnHook) {
      returnHook();
      return;
    }
    game.state = 'idle';
    UI.refresh(game);
  }

  function discardOwnedCard(name, fromSafe, uid = null) {
    const result = discardInventoryCard(game, { name, fromSafe, uid }, SDT.Cards.SHA);
    if (result.ok === false) {
      if (result.code === 'protected') UI.log('[[icon:lock]] 初始牌「初始攻击」不可丢弃', 'warn');
      if (result.code === 'container-not-empty') UI.log('[[icon:bag]] 请先取出容器内所存卡牌，再丢弃最后一个容器', 'warn');
      return false;
    }
    const { card } = result;
    UI.log(`[[icon:trash]] 已丢弃【<b>${esc(card.name)}</b>】×1（无法取回）`, 'warn');
    saveGame();
    return true;
  }
  // Agent 接口面：跳过拖拽直接丢弃（背包满腾格）——docs/agent-protocol.md
  game.discardCard = discardOwnedCard;

  function showDiscardConfirm(name, fromSafe) {
    rememberBagPosition(name);
    backpackOpen = false;
    game.state = 'modal';
    // 2026-09-19 留言 #25：确认页背景透明——走 fx-glass 暗纱 + 中性玻璃面板
    UI.showOverlay('[[icon:question]] 丢弃卡牌？', `
      <div class="glass-panel">
        <p class="ov-note">确认后将永久丢弃【<b>${esc(name)}</b>】1 张，无法从消耗区或消耗牌堆取回。</p>
        <div class="ov-btns">
          <button class="ov-btn" data-act="cancelDragDiscard" data-cancel="true">取消，放回背包</button>
          <button class="ov-btn danger" data-act="confirmDragDiscard" data-cancel="false">确认丢弃</button>
        </div>
      </div>`, 'glass', { initialFocus: '[data-act="cancelDragDiscard"]' });
    bagAct('confirmDragDiscard', () => { discardOwnedCard(name, fromSafe); showBackpack(true); });
    bagAct('cancelDragDiscard', () => showBackpack(true));
  }

  function craftBagToken(kind, sourceUid) {
    const result = craftInventoryToken(game, { kind, sourceUid }, { cards:() => SDT.Cards.all(), newUid, baseCap:() => SDT.Base.bagCap() });
    if (result.ok === false) { if ('reason' in result) UI.log(result.reason, 'warn'); return; }
    UI.log(result.message, 'loot');
    saveGame();
    showBackpack(true);
  }



  // —— 需求（2026-09-13 老板）：背包按稀有度 / 按种类一键排序 ——
  // 排序直接重写 cardOrder（与拖拽排序共用同一持久化通道），背包 + 安全格的所有堆一起参与
  const RARITY_RANK = { '传说': 5, '史诗': 4, '稀有': 3, '古朴': 2, '初始': 1 };
  function rarityRank(card) {
    const r = card && (SDT.Cards.rarityOf ? SDT.Cards.rarityOf(card) : card.rarity);
    return RARITY_RANK[r] || 0;
  }
  function typeRank(card) {
    const i = (SDT.Cards.TYPES || []).indexOf(card && card.type);
    return i < 0 ? 99 : i;
  }
  function sortBagBy(kind) {
    const bagStacks = cardStacks(false), safeStacks = cardStacks(true);
    syncCardOrder(bagStacks, safeStacks);
    const all = bagStacks.concat(safeStacks);
    all.sort((a, b) => {
      const first = kind === 'rarity' ? rarityRank(b.card) - rarityRank(a.card) : typeRank(a.card) - typeRank(b.card);
      if (first) return first;
      const second = kind === 'rarity' ? typeRank(a.card) - typeRank(b.card) : rarityRank(b.card) - rarityRank(a.card);
      if (second) return second;
      return String(a.card.name).localeCompare(String(b.card.name), 'zh');
    });
    game.cardOrder = all.map(s => s.card.name);
    saveGame();
    showBackpack(true);
  }

  // —— v2 玻璃界面（2026-10-15 WF-bag-redesign-1015 实装，老板拍板绝区零方向）：
  // 表现层在纯渲染切片 game.bag.view2.js（架构门：壳行数不上浮、切片不得 import 壳）；
  // 壳负责数据组装（bagZoneTiles）与动作注册，跨区移动 = 拖到左栏分区钮或点详情按钮。
  function bagZoneTiles(renderState) {
    const { bagStacks, safeStacks, orderIndex } = renderState;
    if (bagZone === 'safe') {
      return sortStacksByOrder(safeStacks, orderIndex).map(st => ({ uids:st.uids, name: st.card.name, card: st.card, rarity: bagV2Rarity(st.card), type: st.card.type, cost: st.card.cost, count: st.count, safe: 1, zone: 'safe' }));
    }
    if (bagZone === 'pocket') {
      return game.usedPocket.map(p => ({ name: p.card.name, card: p.card, rarity: bagV2Rarity(p.card), type: p.card.type, cost: p.card.cost, count: p.count, zone: 'pocket' }));
    }
    const supplies = game.inventory.flatMap(it => Array.from({ length:Math.ceil((it.count || 1) / 3) }, (_, index) =>
      ({ name:it.name, value:it.value, tier:it.tier, count:Math.min(3, (it.count || 1) - index * 3), supply:1, zone:'bag' })));
    let cards = sortStacksByOrder(bagStacks, orderIndex).map(st => ({ uids:st.uids, name: st.card.name, card: st.card, rarity: bagV2Rarity(st.card), type: st.card.type, cost: st.card.cost, count: st.count, safe: 0, zone: 'bag', useStatus:st.card.type === '道具' ? bagUseStatus(st.card, st.uids[0], { game, usedSlots, bagCap, renderState }) : null }));
    if (bagFilter === 'supply') return supplies;
    if (bagFilter !== 'all') cards = cards.filter(c => bagFilter === 'move' ? ['武术', '法术', '能力卡'].includes(c.type) : c.type === bagFilter);
    return bagFilter === 'all' ? [...supplies, ...cards] : cards;
  }
  function findBagStack(name, safe, uid = null) {
    return cardStacks(safe).find(st => uid ? st.uids.includes(uid) : st.card.name === name)
      || (!safe ? game.inventory.find(it => it.name === name) : null);
  }
  // 看卡操作台（2026-10-15 老板定向：右侧复用基地仓库同款 inventory-zoom 界面）：
  // 点格子直接开 presentation:'inventory' 特写——大真卡面 + camp-card-actions 页脚。
  function openBagZoom(name, safe, pocket = false, returnFocus = null, uid = null) {
    const tiles = [.../** @type {NodeListOf<HTMLElement>} */ (UI.el.ovBody?.querySelectorAll('.bag-tile[data-stack]') || [])];
    const source = tiles.find(tile => uid ? tile.dataset.uid === uid : tile.dataset.stack === name);
    const focus = returnFocus || source;
    let browseCurrent = () => false;
    const liveStacks = pocket ? game.usedPocket : cardStacks(!!safe);
    const displayed = tiles.map(tile => liveStacks.find(stack => tile.dataset.uid ? stack.uids?.includes(tile.dataset.uid) : stack.card.name === tile.dataset.stack)).filter(Boolean);
    const onBrowse = (card, index) => { if (browseCurrent()) openBagZoom(card.name, safe, pocket, focus, displayed[index]?.uids?.[0]); };
    if (pocket) {
      const entry = game.usedPocket.find(item => item.card.name === name);
      if (entry) {
        UI.showCardZoom(entry.card, { items:game.usedPocket.map(item => item.card), onBrowse, presentation: 'inventory', from: source, returnFocus: focus,
          footer: `<div class="camp-detail"><p>已消耗 ${entry.count} 张 · ${['道具', '装备'].includes(entry.card.type) ? '火堆不可复原；能源结晶可按顺序复原' : '可在火堆或使用复原道具取回'}。</p></div>` });
        decorateInventoryZoom(entry.card);
        browseCurrent = captureBagView();
      }
      return;
    }
    const st = findBagStack(name, safe, uid);
    if (!st || !st.card) return;   // 物资格不开浮层：名称/等级/价值在格子与 tooltip 上
    const card = st.card, safeFlag = !!safe;
    const usable = !safeFlag && card.type === '道具';
    const isSha = card.id === SDT.Cards.SHA.id;
    const closeZoom = closeBagZoom;
    const btns = [];
    if (usable) btns.push(bagUseButton(card, st.uids[0]));
    if (card.id === 'tt2-pearlbox') btns.push('<button class="ov-btn ok" data-act="pearlStoreZoom">[[icon:pearl-box]] 打开珍珠盒</button>');
    if (card.id === 'tt7-stratagem' && !safeFlag) btns.push('<button class="ov-btn ok" data-act="pouchStoreZoom">[[icon:spell-pouch]] 打开锦囊（存放法术 ×3）</button>');
    if (card.id === 'tt-token-gold' && st.count >= 3) btns.push('<button class="ov-btn ok" data-act="craftColorToken">合成员工通行证A（3 张 B → 1 张 A）</button>');
    if (card.id === 'tt-token-color' && (game.fragments || 0) >= 2) btns.push('<button class="ov-btn ok" data-act="craftColorTokenByFragments">合成员工通行证A（2 碎片 + 1 通行证A）</button>');
    if (safeFlag) btns.push(safeTransferButton(card.name, false, 'zoomMoveToBag'));
    else if (!isSha) btns.push(safeTransferButton(card.name, true, 'zoomMoveToSafe'));
    if (!isSha) btns.push('<button class="ov-btn danger" data-act="detailDiscard">丢弃 1 张</button>');
    const zoneLabel = safeFlag ? '安全格押运中' : '随身背包';
    const material = SDT.Base.materialInfo?.(card);
    const hint = safeFlag ? '撤离失败也能带回基地。'
      : material ? '不计入散装物资估值；带回后在仓库使用，计入基地库存。'
      : card.type === '道具' ? '治疗、复原与通行证B/C可在背包使用；其余道具依效果在战斗使用。'
      : '';
    UI.showCardZoom(card, {
      items:displayed.map(stack => stack.card), index:displayed.findIndex(stack => stack.uids.includes(st.uids[0])),
      onBrowse,
      presentation: 'inventory',
      from: source, returnFocus: focus,
      footer: `<div class="camp-detail camp-card-actions"><div class="inspect-meta"><span class="inspect-count">持有 <b>×${st.count}</b> 张</span><span class="inspect-collection-state">${zoneLabel}</span></div>${hint ? `<p class="inspect-collection-hint">${hint}</p>` : ''}${btns.length ? `<div class="ov-btns">${btns.join('')}</div>` : ''}</div>`,
    });
    // 特写页动作：特写打开时注册（旧守卫语义——特写被新详情替换即失效，生命周期测试锚定）
    bagAct('useDetailCard', () => { rememberBagPosition(card.name); closeZoom(); return useOwnedCard(st.uids[0]); });
    if (safeFlag) bagAct('zoomMoveToBag', () => moveStackSafe(card.name, false, { beforeMove:closeZoom }));
    else if (!isSha) bagAct('zoomMoveToSafe', () => moveStackSafe(card.name, true, { beforeMove:closeZoom, onCancel:() => openBagZoom(card.name, false) }));
    if (card.id === 'tt2-pearlbox') bagAct('pearlStoreZoom', () => { closeZoom(); openPearlStore(); });
    if (card.id === 'tt7-stratagem' && !safeFlag) bagAct('pouchStoreZoom', () => { closeZoom(); openPouchStore(); });
    bagAct('detailDiscard', () => { closeZoom(); showDiscardConfirm(card.name, safeFlag); });
    bagAct('craftColorToken', () => { closeZoom(); craftBagToken('gold'); });
    bagAct('craftColorTokenByFragments', () => { closeZoom(); craftBagToken('fragments'); });
    decorateInventoryZoom(card);
    browseCurrent = captureBagView();
  }
  function showBackpack(refreshOnly) {
    if (game.battleActive) {
      UI.log('[[icon:lock]] 战斗中无法打开背包；战斗结束后可回地图整理', 'warn');
      return;
    }
    // 卡牌特写浮层挂在 body（overlay 之外）：此时按 B / 点背包按钮 = 先收回特写，
    // 不动背包——否则背包关闭后特写残留在局内画面上
    if (!refreshOnly) {
      const zoom = document.getElementById('cardZoom');
      if (zoom) { /** @type {HTMLElement} */ (zoom.querySelector('.cz-backdrop'))?.click(); return; }
    }
    if (!game.runActive) return;   // v0.21：只有对局中才有背包（基地/标题界面不响应 B）
    // 选人页开着（myClass 为空）时背包会覆盖选人页，关闭时把状态还原成 idle——
    // 选角就此被跳过，能不选人物直接走进战斗格。直接禁掉（2026-09-09 老板实测）
    if (!game.myClass) {
      UI.log('[[icon:medal]] 先选择本局角色，再整理背包', 'warn');
      return;
    }
    // 2026-09-09 留言 #13：搜刮界面也能打开背包整理 / 丢弃卡牌——
    // 挂起开箱流程（作废搜索演出计时器），关闭背包时回到当前搜刮面板继续开箱。
    // 旧版直接拦截是因为关背包会吞掉后续奖励，现在用 Chests.suspend/resume 保住流程
    if (!refreshOnly && SDT.Chests && SDT.Chests.isOpen && SDT.Chests.suspend && SDT.Chests.isOpen()) {
      bagOverChest = SDT.Chests.suspend();
    }
    if (!refreshOnly && backpackOpen && game.state === 'modal' && !UI.el.overlay.hidden) {
      closeBackpack();
      return;
    }
    if (game.state !== 'idle' && game.state !== 'modal') {
      // 不再静默返回：状态卡死（如移动链中断停在 moving）时玩家点击无任何反馈，
      // 表现为「背包打不开」。给出提示便于定位；moveBy 看门狗会在数秒内自愈回 idle。
      if (!refreshOnly) UI.log(`[[icon:hourglass]] 当前动作进行中（${game.state}），稍候再打开背包`, 'warn');
      return;
    }
    // 拖拽进行中重开背包：清理浮影等残留状态
    if (bagDrag) resetBagDrag();
    game.state = 'modal';
    backpackOpen = true;
    _set_cardPageOpen(false);
    // This snapshot belongs to this render; actions keep using live capacity checks.
    const renderState = deriveBagRenderState(game, SDT.Base.bagCap());
    game.cardOrder = renderState.cardOrder;
    const { cap, baseCap, total, pearlStoredN, capacityText, used, bagCardN, safeCardN, supplyN } = renderState;
    const sCap = safeCap(), safeUsedN = renderState.safeStacks.length;
    const pkN = game.usedPocket.reduce((a, b) => a + b.count, 0);
    if (requestedBagSection) {
      bagZone = requestedBagSection === 'main' ? 'bag' : requestedBagSection;
      requestedBagSection = null;
    }
    const helpCurrent = captureBattleContext(game), helpCards = game.ownedCards;
    UI.registerHelp('bag', {
      title: '背包说明',
      html: `
        <p class="help-item"><b>随身背包</b>物资与卡牌混占格（装备每张占 1 格，其余同名卡每 3 张或同名物资每 3 件占 1 格）。点击格子看卡牌详情；按住拖动整理顺序，拖到左栏盾形按钮存入安全格。</p>
        <p class="help-item"><b>安全格</b>由${esc(SDT.Base.carriedPet?.()?.name || '随行伙伴')}看守：撤离失败或放弃对局时，只有安全格里的卡牌会被抢运回基地，其余全部丢失。在基地培养随行伙伴可提升容量。</p>
        <p class="help-item"><b>消耗区</b>战斗中用过的牌统一暂存在这里，包括初始攻击、职业卡和衍生卡，不占背包格。局内复原后，就能再用。</p>
        <p class="help-item"><b>去火堆复原</b>每次随机复原最多 2 张；道具和装备不能在火堆复原。</p>
        <p class="help-item"><b>用道具复原</b>能源结晶按消耗区顺序复原最多 3 张，也能复原道具和装备。背包要放得下。</p>
        <details><summary>撤离后怎么处理？</summary><p>成功撤离时，消耗区逐张以 1/3 概率结算；初始攻击和职业卡即使掷中也不带回基地消耗区，其余实际带回的牌可用钥匙复原。初始攻击和职业卡仍可在局内复原。下次出发时，基地消耗区中未复原的牌会消散。</p></details>
        <p class="help-item"><b>丢弃</b>把卡牌拖到背包页面外可申请丢弃 1 张——丢弃的牌无法取回，请谨慎操作。</p>`,
      back: () => { if (helpCurrent() && game.ownedCards === helpCards && UI.el.ovBody?.querySelector('.help-body')) {
        showBackpack(true);
      } },
    });
    const markup = bagV2PageHTML({
      bagZone, bagFilter, bagSortKey,
      cap, baseCap, pearlStoredN, capacityText, total, safeUsedN, sCap, pkN,
      petName: SDT.Base.carriedPet?.()?.name || '随行伙伴', receiptHTML: bagReceipt?.cards === game.ownedCards ? bagNotice.html({ className:'bag-receipt' }) : '',
      used, coins: game.coins, fragments: game.fragments || 0, bagCardN, safeCardN, supplyN,
      tiles: bagZoneTiles(renderState),
    });
    if (!patchBackpackPane(UI, SDT, markup, bagZone, refreshOnly)) {
      UI.showOverlay('[[icon:bag]] 背包', markup, 'bagpage');
      if (bagReturnPosition?.current() && bagReturnPosition.cards === game.ownedCards) {
        restoreBackpackPosition(UI.el.ovBody, bagReturnPosition.position);
      }
      bagReturnPosition = null;
    }
    // 分区 / 筛选 / 排序 / 点选详情：格子打开独立全文阅读与操作区，
    // inspectStack 契约与原有卡面特写返回路径不变。
    bagAct('bagZone', d => {
      if (!['bag', 'safe', 'pocket'].includes(d.zone)) return;
      bagZone = d.zone; bagFilter = 'all';
      showBackpack(true);
      /** @type {HTMLElement} */ (UI.el.ovBody?.querySelector(`.bag-rz[data-zone="${d.zone}"]`))?.focus();
    });
    bagAct('bagFilter', d => { bagFilter = d.f || 'all'; showBackpack(true); });
    bagAct('bagSortCycle', () => { bagSortKey = bagSortKey === 'rarity' ? 'type' : 'rarity'; sortBagBy(bagSortKey); });
    bagAct('bagTidy', () => { bagSortKey = 'rarity'; sortBagBy('rarity'); });
    bagAct('closeBag', closeBackpack);
    bagAct('inspectStack', d => openBagZoom(d.name, d.safe === '1', d.pocket === '1', null, d.uid));
    bagSlots.bindBagDrag();   // v0.21：拖拽排序 / 左栏分区钮拖放跨区 / 点格子开看卡操作台
  }

  let backpackOpen = false;   // 背包弹窗开关（必须声明：showBackpack 打开路径会读取它）
  let bagOverChest = false;   // 背包是否从搜刮界面打开（关闭时回搜刮面板，2026-09-09 留言 #13）
  // 来源页返回钩子迁移到 bag-return-hook.js 中立模块（迭代评审 09-20）：事件页/物资格页
  // 也要登记恢复路径，而 scenes/flow 不能反向 import 本模块（会经 game.run 成环）


function setBagReturnHook(fn) { _setBagReturnHook(fn); }   // 中立模块再导出（boot 商店运行时注入用）
export { showBackpack, showBackpackSection, setBagReturnHook };
export { bindBagMixins, resumeBattleRewards } from './game.bag.settle.js';
