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
import { useStructuredBagRule } from './game.bag.rules.js';
import { pageHTML as bagV2PageHTML, rarityOf as bagV2Rarity } from './game.bag.view2.js';
import { captureBattleContext } from '../battle/battle-loader.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';
function captureBagView(rootFor = null) {
  const sameRun = captureBattleContext(game), cards = game.ownedCards, body = UI.el.ovBody;
  const root = body?.firstElementChild, zoom = document.getElementById('cardZoom');
  return () => sameRun() && game.ownedCards === cards && game.runActive && game.state === 'modal'
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
function showBackpackSection(section) {
  requestedBagSection = ['safe', 'pocket'].includes(section) ? section : 'main';
  showBackpack();
}
bagSlots.moveStackOrder = moveStackOrder;
bagSlots.moveStackSafe = moveStackSafe;
bagSlots.showDiscardConfirm = showDiscardConfirm;
bagSlots.pocketAdd = pocketAdd;   // 本体函数经桥供 drag/settle 片调用（contracts 拒环）

  function cardHealAmount(card) {
    const m = /回复\s*(\d+)\s*点生命/.exec(card.desc || '');
    return m ? +m[1] : 0;
  }

  function pocketAdd(card) {
    const s = game.usedPocket.find(p => p.card.name === card.name);
    if (s) s.count++;
    else game.usedPocket.push({ card: { ...card }, count: 1 });
  }

  function useOwnedCard(uid) {
    const i = game.ownedCards.findIndex(o => o.uid === uid);
    if (i < 0) return;
    const card = game.ownedCards[i].card;
    if (card.type === '事件') { UI.log('[[icon:dice]] 事件卡只能在事件格中触发，无法在背包中使用（背包只记录触发历史）', 'warn'); return; }
    if (card.type !== '道具') { UI.log('只有道具卡可以直接使用', 'warn'); return; }
    if (useStructuredBagRule(card, i, { UI, SDT, game, Random, newUid, saveGame, showBackpack, usedSlots, bagCap, setReceipt: text => { bagReceipt = { text, cards: game.ownedCards }; } })) return;
    const desc = card.desc || '';
    // 能源结晶：就地复原消耗区中最多 3 张卡牌（2026-09-13 需求：背包满时不能复原出超容量的卡）
    if (card.id === 'tt-crystal' || /复活最多\s*3\s*张卡牌/.test(desc)) {
      if (!game.usedPocket.length) { UI.log('消耗区是空的，无需复原', 'warn'); return; }
      game.ownedCards.splice(i, 1);
      let cnt = 0;
      while (game.usedPocket.length && cnt < 3 && usedSlots() < bagCap()) {
        const p = game.usedPocket[0];
        game.ownedCards.push({ uid: newUid(), card: { ...p.card } });
        p.count--;
        if (p.count <= 0) game.usedPocket.shift();
        cnt++;
      }
      const leftN = game.usedPocket.reduce((a, b) => a + b.count, 0);
      UI.log(`[[icon:gem]] 使用【<b>${esc(card.name)}</b>】：复原了消耗区中的 <b>${cnt}</b> 张卡牌` +
        (leftN && usedSlots() >= bagCap() ? `（背包已满，剩 ${leftN} 张留在消耗区）` : ''), 'ok');
      showBackpack(true);
      return;
    }
    // 复原药水（2026-09-09 审计补实装）：背包中使用，复原消耗区至多 2 张
    if (card.name === '复原药水' || /复原.{0,4}(两|2).{0,3}张卡牌/.test(desc)) {
      if (!game.usedPocket.length) { UI.log('消耗区是空的，无需复原', 'warn'); return; }
      const restoreOne = () => {
        const p = game.usedPocket[0];
        if (!p) return;
        if (usedSlots() >= bagCap()) { UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()}），无法复原`, 'warn'); return; }
        p.count--;
        if (p.count <= 0) game.usedPocket.shift();
        game.ownedCards.push({ uid: newUid(), card: { ...p.card } });
      };
      game.ownedCards.splice(i, 1);
      restoreOne();
      restoreOne();
      UI.log(`[[icon:gem]] 使用【<b>${esc(card.name)}</b>】：复原了消耗区中的至多 <b>2</b> 张卡牌`, 'ok');
      saveGame();
      showBackpack(true);
      return;
    }
    // 资源卡：口粮 / 木材（直接转化为背包物资，可用于基地升级）
    const rm = desc.match(/获得\s*(\d+)\s*份?\s*口粮/) || desc.match(/口粮\s*[×x]\s*(\d+)/);
    const wm = desc.match(/木材\s*[×x]\s*(\d+)/);
    if (rm) {
      game.ownedCards.splice(i, 1);
      UI.log(`使用资源卡【<b>${esc(card.name)}</b>】`, 'sys');
      game.addItem(MAP.items.rations, +rm[1]);
      showBackpack(true);
      return;
    }
    if (wm) {
      game.ownedCards.splice(i, 1);
      UI.log(`使用资源卡【<b>${esc(card.name)}</b>】`, 'sys');
      game.addItem(MAP.items.wood, +wm[1]);
      showBackpack(true);
      return;
    }
    // 员工通行证B：直接随机获得，不进入「发现」候选页；棱彩牌明确排除。
    if (card.id === 'tt-token-gold' || /(?:抽取|随机获取)\s*1\s*张传说卡/.test(desc)) {
      const pool = SDT.Cards.all().filter(c => c.rarity === '传说' && c.rarity !== '棱彩' && SDT.Cards.isRandomObtainable(c));
      if (!pool.length) { UI.log('卡牌库中没有可获得的传说卡', 'warn'); return; }
      game.ownedCards.splice(i, 1);
      const got = pool[Math.floor(Random.random('loot') * pool.length)];
      game.ownedCards.push({ uid: newUid(), card: { ...got } });
      UI.log(`[[icon:sparkles]] 使用【<b>${esc(card.name)}</b>】：获得传说卡【<b>${esc(got.name)}</b>】`, 'loot');
      UI.showLegendGet(got);   // 2026-09-07 留言：传说获得要有提示界面
      saveGame();
      showBackpack(true);
      return;
    }
    // 2026-09-06 #10：员工通行证A（觉醒）→ 获得本职业能力卡
    if (card.id === 'tt-token-color' || /觉醒/.test(desc)) {
      const pool = SDT.Cards.classPool(game.myClass).filter(c => c.type === '能力卡');
      if (!pool.length) { UI.log('该职业没有可觉醒的能力卡', 'warn'); return; }
      game.ownedCards.splice(i, 1);
      const got = pool[Math.floor(Random.random('loot') * pool.length)];
      game.ownedCards.push({ uid: newUid(), card: { ...got } });
      UI.log(`[[icon:sparkles]] 使用【<b>${esc(card.name)}</b>】觉醒：获得本职业能力卡【<b>${esc(got.name)}</b>】`, 'loot');
      saveGame();
      showBackpack(true);
      return;
    }
    // 员工通行证C（发现 1 张传说卡 → 背包中使用直接获得，2026-09-09 留言 #11：
    // 此前没有使用入口，会落进「效果将在 M1 战斗中实装」的兜底提示）
    if (card.id === 'tt4-shine-token' || /发现\s*1\s*张传说卡/.test(desc)) {
      const pool = SDT.Cards.all().filter(c => c.rarity === '传说' && SDT.Cards.isRandomObtainable(c));
      if (!pool.length) { UI.log('卡牌库中没有可获得的传说卡', 'warn'); return; }
      game.ownedCards.splice(i, 1);
      const got = pool[Math.floor(Random.random('loot') * pool.length)];
      game.ownedCards.push({ uid: newUid(), card: { ...got } });
      UI.log(`[[icon:sparkles]] 使用【<b>${esc(card.name)}</b>】：发现传说卡【<b>${esc(got.name)}</b>】`, 'loot');
      UI.showLegendGet(got);
      saveGame();
      showBackpack(true);
      return;
    }
    // 2026-09-06 #15：神秘药水（随机神秘效果）→ 背包中随机三选一
    if (card.id === 'tt3-mystery-potion' || /随机神秘效果/.test(desc)) {
      game.ownedCards.splice(i, 1);
      const r = Random.random('loot');
      if (r < 1 / 3) {
        game.heal(8);
        UI.log('[[icon:flask]] 神秘药水：回复 <b>8</b> 点生命', 'ok');
      } else if (r < 2 / 3) {
        game.coins += 3;
        UI.log('[[icon:flask]] 神秘药水：获得 <b>3</b> 币', 'coin');
      } else {
        const canTake = (c) => (game.canReceiveCard ? game.canReceiveCard(c) : game.canAcceptCard(c));
        const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c));
        const got = pool.length ? pool[Math.floor(Random.random('loot') * pool.length)] : null;
        const took = !!got && canTake(got);
        if (took) {
          game.ownedCards.push({ uid: newUid(), card: { ...got } });
          // 阿猫的礼物（2026-09-12 实装）：随机获取该牌时附赠另 1 张随机卡牌
          if (got.id === 'tt2-apollo') {
            const pool2 = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c) && c.id !== 'tt2-apollo');
            const got2 = pool2.length ? pool2[Math.floor(Random.random('loot') * pool2.length)] : null;
            if (got2 && canTake(got2)) {
              game.ownedCards.push({ uid: newUid(), card: { ...got2 } });
              UI.log(`[[icon:bolt]] <b>阿猫的礼物</b>：随机获取触发，附赠【<b>${esc(got2.name)}</b>】`, 'loot');
            } else if (got2) {
              UI.log(`[[icon:bolt]] <b>阿猫的礼物</b>：背包已满，附赠的【${esc(got2.name)}】没能放进背包`, 'warn');
            }
          }
        }
        UI.log(`[[icon:flask]] 神秘药水：${took ? `随机获得【<b>${esc(got.name)}</b>】` : got ? `背包已满，【${esc(got.name)}】没能放进背包` : '没有可获得卡牌'}`, took ? 'loot' : 'warn');
      }
      saveGame();
      showBackpack(true);
      return;
    }
    const heal = cardHealAmount(card);
    if (heal <= 0) { UI.log(`道具卡【${card.name}】的效果将在 M1 战斗中实装`, 'warn'); return; }
    if (game.hp >= game.maxHp) { UI.log('生命值已满，暂时不需要使用', 'warn'); return; }
    game.ownedCards.splice(i, 1);
    UI.log(`使用道具卡【<b>${esc(card.name)}</b>】`, 'sys');
    game.heal(heal);
    saveGame();
    showBackpack(true); // 刷新背包
  }

  // 整堆移动：背包格 ⇄ 安全格（同名卡一起移动）
  function moveStackSafe(name, toSafe) {
    // 初始牌「初始攻击」不能带出背包：不入安全格（也就不会经宠物运回仓库）
    if (toSafe && name === SDT.Cards.SHA.name) {
      UI.log('[[icon:cross]] 初始牌「初始攻击」无法移出背包——每局固定携带，不入安全格 / 仓库', 'warn');
      return;
    }
    const list = game.ownedCards.filter(o => !!o.safe !== !!toSafe && o.card.name === name);
    if (!list.length) return;
    // 整堆移动按「格数增量」检查：同名合并按叠放上限切格（第 4 张起另占一格）。
    // 此前只查有无同名堆就整堆放行，9 张同名可越过安全格/背包容量（09-30 深审 ROOT-02）
    const cap = game.stackCapOf({ name });
    const sameSide = game.ownedCards.filter(o => !!o.safe === !!toSafe && !o.stored && o.card.name === name).length;
    const delta = Math.ceil((sameSide + list.length) / cap) - Math.ceil(sameSide / cap);
    if (toSafe) {
      if (safeUsed() + delta > safeCap()) {
        UI.log(`[[icon:lock]] 安全格放不下：本次整叠还需 ${delta} 格（现 ${safeUsed()}/${safeCap()} 格），可在基地用口粮升级`, 'warn');
        return;
      }
    } else {
      if (usedSlots() + delta > bagCap()) {
        UI.log(`[[icon:bag]] 背包放不下：本次整叠还需 ${delta} 格（现 ${usedSlots()}/${bagCap()} 格），取不出来`, 'warn');
        return;
      }
    }
    list.forEach(o => { o.safe = toSafe; });
    SDT.Sound.sfx(toSafe ? 'safeStore' : 'safeRetrieve');
    UI.log(toSafe
      ? `[[icon:lock]] 【${esc(name)}】×${list.length} 已存入安全格（撤离失败时安全运回）`
      : `[[icon:upload]] 【${esc(name)}】×${list.length} 已从安全格取出`, 'sys');
    showBackpack(true);
  }

  // ---------- 背包显示顺序（v0.21：卡牌堆可拖拽排序，随存档保存） ----------
  // cardOrder = 卡名列表；新出现的堆追加到末尾，已消失的堆自动移除
  function syncCardOrder() {
    const known = [];
    cardStacks(false).forEach(s => known.push(s.card.name));
    cardStacks(true).forEach(s => known.push(s.card.name));
    const ord = (game.cardOrder || []).filter(n => known.includes(n));
    known.forEach(n => { if (!ord.includes(n)) ord.push(n); });
    game.cardOrder = ord;
  }

  function sortStacksByOrder(stacks) {
    const ord = game.cardOrder || [];
    const idx = (n) => ord.indexOf(n);
    return stacks.slice().sort((a, b) => idx(a.card.name) - idx(b.card.name));
  }

  // 把 srcName 的堆移到 beforeName 之前（beforeName 缺省 = 移到末尾）
  function moveStackOrder(srcName, beforeName) {
    syncCardOrder();
    const ord = game.cardOrder.filter(n => n !== srcName);
    const di = beforeName ? ord.indexOf(beforeName) : -1;
    ord.splice(di < 0 ? ord.length : di, 0, srcName);
    game.cardOrder = ord;
  }

  function closeBackpack() {
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

  function discardOwnedCard(name, fromSafe) {
    if (name === SDT.Cards.SHA.id || name === SDT.Cards.SHA.name) {
      UI.log('[[icon:pen]] 初始牌「初始攻击」不可丢弃', 'warn');
      return false;
    }
    const i = game.ownedCards.findIndex(o => !!o.safe === !!fromSafe && o.card.name === name);
    if (i < 0) return false;
    const card = game.ownedCards[i].card;
    game.ownedCards.splice(i, 1);
    UI.log(`[[icon:trash]] 已丢弃【<b>${esc(card.name)}</b>】×1（无法取回）`, 'warn');
    saveGame();
    return true;
  }
  // Agent 接口面：跳过拖拽直接丢弃（背包满腾格）——docs/agent-protocol.md
  game.discardCard = discardOwnedCard;

  function showDiscardConfirm(name, fromSafe) {
    backpackOpen = false;
    game.state = 'modal';
    // 2026-09-19 留言 #25：确认页背景透明——走 fx-glass 暗纱 + 中性玻璃面板
    UI.showOverlay('[[icon:question]] 丢弃卡牌？', `
      <div class="glass-panel">
        <p class="ov-note">确认后将永久丢弃【<b>${esc(name)}</b>】1 张，无法从消耗区或墓地取回。</p>
        <div class="ov-btns">
          <button class="ov-btn danger" data-act="confirmDragDiscard">确认丢弃</button>
          <button class="ov-btn" data-act="cancelDragDiscard">取消，放回背包</button>
        </div>
      </div>`, 'glass', { initialFocus: '[data-act="cancelDragDiscard"]' });
    bagAct('confirmDragDiscard', () => { discardOwnedCard(name, fromSafe); showBackpack(true); });
    bagAct('cancelDragDiscard', () => showBackpack(true));
  }

  // eslint-disable-next-line no-unused-vars -- 局部豁免：被 game/selftest.js:87 源码正则 /function showBagCardDetail/ 锚定，删除会挂红自检；#27 改版后入口已由 inspectStack 承担，函数历史保留
  function showBagCardDetail(name, fromSafe) {
    const o = game.ownedCards.find(x => !!x.safe === !!fromSafe && x.card.name === name);
    if (!o) { showBackpack(true); return; }
    const usable = !fromSafe && o.card.type === '道具';
    // 2026-09-09 老板：点牌查看改成出发整备同款放大特写——背包页保持不动，
    // 不再切 overlay 弹窗（那会拆掉 opaque 背包页，露出局内战斗背景）
    const isSha = o.card.id === SDT.Cards.SHA.id;
    UI.showCardZoom(o.card, {
      footer: `
        <p class="ov-note">${esc(o.card.name)} · ${esc(o.card.type)} · ${esc(o.card.rarity || '')}${fromSafe ? ' · 位于安全格' : ''}${o.card.id === 'tt-token-color' ? ` · 员工通行证A碎片 <b>${game.fragments || 0} 枚／每次需 2 枚</b>` : ''}</p>
        <div class="ov-btns">
          ${usable ? '<button class="ov-btn ok" data-act="useDetailCard">使用这张道具</button>' : ''}
          ${o.card.id === 'tt-token-gold' && game.ownedCards.filter(x => x.card.id === 'tt-token-gold').length >= 3
            ? '<button class="ov-btn ok" data-act="craftColorToken">合成员工通行证A（3 张 B → 1 张 A）</button>' : ''}
          ${o.card.id === 'tt-token-color' && (game.fragments || 0) >= 2
            ? '<button class="ov-btn ok" data-act="craftColorTokenByFragments">合成员工通行证A（2 碎片 + 1 通行证A）</button>' : ''}
          ${o.card.id === 'tt2-pearlbox' ? '<button class="ov-btn ok" data-act="pearlStore">[[icon:gem]] 存入 / 取出资源卡</button>' : ''}
          ${o.card.id === 'tt7-stratagem' ? '<button class="ov-btn ok" data-act="pouchStore">[[icon:cards]] 打开锦囊（存放法术 ×3）</button>' : ''}
          ${fromSafe ? '<button class="ov-btn" data-act="detailFromSafe">移回背包</button>' :
            (isSha ? '' : '<button class="ov-btn" data-act="detailToSafe">移入安全格</button>')}
          ${isSha ? '' : '<button class="ov-btn danger" data-act="detailDiscard">丢弃 1 张</button>'}
        </div>`,
    });
    // 特写挂在 body（overlay 之外）：动作执行前先模拟点背景收回，回到背包页
    const closeZoom = () => document.getElementById('cardZoom')?.querySelector('.cz-backdrop')?.click();
    bagAct('useDetailCard', () => { closeZoom(); useOwnedCard(o.uid); });
    bagAct('craftColorToken', () => {
      closeZoom();
      // 2026-09-06 #10：3 张员工通行证B合成 1 张员工通行证A
      const golds = game.ownedCards.filter(x => x.card.id === 'tt-token-gold').slice(0, 3);
      if (golds.length < 3) { UI.log('员工通行证B不足 3 张，无法合成', 'warn'); return; }
      const goldIds = new Set(golds.map(g => g.uid));
      game.ownedCards = game.ownedCards.filter(x => !goldIds.has(x.uid));
      const color = SDT.Cards.all().find(c => c.id === 'tt-token-color');
      if (color) game.ownedCards.push({ uid: newUid(), card: { ...color } });
      UI.log('[[icon:sparkles]] 合成成功：3 张员工通行证B → 1 张<b>员工通行证A</b>', 'loot');
      saveGame();
      showBackpack(true);
    });
    bagAct('craftColorTokenByFragments', () => {
      closeZoom();
      // 2026-09-09 Q6 老板定向：隐藏计数器碎片——集齐 2 枚碎片 + 员工通行证A → 合成员工通行证A
      if ((game.fragments || 0) < 2) { UI.log('员工通行证A碎片不足 2 枚，无法合成', 'warn'); return; }
      game.ownedCards.splice(game.ownedCards.indexOf(o), 1);
      game.fragments -= 2;
      const token = SDT.Cards.all().find(c => c.id === 'cmtmvq6ss84l');
      if (token) game.ownedCards.push({ uid: newUid(), card: { ...token } });
      UI.log('[[icon:sparkles]] 合成成功：员工通行证A + 2 枚碎片 → 1 张<b>员工通行证A</b>（使用后获取本职业能力卡）', 'loot');
      saveGame();
      showBackpack(true);
    });
    bagAct('detailFromSafe', () => { closeZoom(); moveStackSafe(name, false); });
    bagAct('detailToSafe', () => { closeZoom(); moveStackSafe(name, true); });
    bagAct('detailDiscard', () => { closeZoom(); showDiscardConfirm(name, fromSafe); });
    bagAct('pearlStore', () => { closeZoom(); openPearlStore(); });
    bagAct('pouchStore', () => { closeZoom(); openPouchStore(); });
  }

  // —— 法师锦囊 · 存放法术牌（2026-09-16 留言 #4 定版）——
  // 点背包里的锦囊 → 存入/取出法术牌：上限 3 张，战斗中打出锦囊时从里面选 1 张直接释放
  function openPouchStore() {
    game.state = 'modal';
    let root; const current = captureBagView(() => root);
    const POUCH_ID = 'tt7-stratagem';
    // 口径与 storedStacks 一致：只按 pouchOf 判定。stored 是与珍珠盒共用的
    // 「不入背包格」标记，若在这里再查 !x.stored，锦囊计数恒为 0、3 张上限永久失效
    const stored = () => game.ownedCards.filter(x => x.pouchOf === POUCH_ID && x.card);
    const storedStacks = () => {
      const map = new Map();
      game.ownedCards.forEach(x => {
        if (x.pouchOf !== POUCH_ID || !x.card) return;
        if (!map.has(x.card.name)) map.set(x.card.name, { card: x.card, count: 0 });
        map.get(x.card.name).count++;
      });
      return [...map.values()];
    };
    const bagSpellStacks = () => cardStacks(false).filter(st => st.card.type === '法术' && !st.card.cls);
    const render = () => {
      const storedHTML = storedStacks().map(st => `
        <div class="bt-card" data-act="pouchTake" data-name="${escAttr(st.card.name)}"
          title="${escAttr(st.card.name + ' ×' + st.count + '——点击取出回背包')}">
          ${SDT.Cards.cardHTML(st.card, 'sm')}
          <span class="bt-count">×${st.count}</span>
        </div>`).join('') || '<p class="ov-empty">（锦囊是空的——存入法术牌后战斗中打出可释放）</p>';
      const bagHTML = bagSpellStacks().map(st => `
        <div class="bt-card" data-act="pouchPut" data-name="${escAttr(st.card.name)}"
          title="${escAttr(st.card.name + ' ×' + st.count + '——点击存入锦囊')}">
          ${SDT.Cards.cardHTML(st.card, 'sm')}
          <span class="bt-count">×${st.count}</span>
        </div>`).join('') || '<p class="ov-empty">（背包里没有法术卡）</p>';
      UI.showOverlay('[[icon:cards]] 法师锦囊 · 存放法术牌', `
        <p class="ov-note">锦囊中 <b>${stored().length}/3</b> 张法术——战斗中打出锦囊后，从这 ${stored().length} 张里选 1 张直接释放（锦囊为空则无效果）</p>
        <h3 class="set-h">锦囊中的法术（点击整叠取出）</h3>
        <div class="bt-hand">${storedHTML}</div>
        <h3 class="set-h">背包里的法术卡（点击整叠存入）</h3>
        <div class="bt-hand">${bagHTML}</div>
        <div class="ov-btns"><button class="ov-btn ok" data-act="pouchBack">[[icon:arrow]] 收好锦囊</button></div>`);
      root = UI.el.ovBody?.firstElementChild;
    };
    bagAct('pouchPut', (d) => {
      const stack = bagSpellStacks().find(st => st.card.name === d.name);
      if (!stack) return;
      // 整叠存入也受 3 张上限：已有数量 + 本次堆数超过即拒收（此前只查已有 ≥3，
      // 整叠 3 张可与已有 2 张叠成 5/3，09-30 深审 ROOT-04）
      if (stored().length + stack.count > 3) {
        UI.log(`[[icon:cards]] 锦囊装不下整叠：已有 ${stored().length}/3 张，本次 ${stack.count} 张`, 'warn');
        SDT.Sound.sfx('deny');
        return;
      }
      stack.uids.forEach(uid => { const o = game.ownedCards.find(x => x.uid === uid); if (o) { o.pouchOf = POUCH_ID; o.stored = 1; } });
      UI.log(`[[icon:cards]] 【<b>${esc(stack.card.name)}</b>】存入法师锦囊`, 'ok');
      saveGame();
      render();
    }, current);
    bagAct('pouchTake', (d) => {
      const stack = storedStacks().find(st => st.card.name === d.name);
      if (!stack) return;
      const cap = game.stackCapOf(stack.card);
      const sameBag = game.ownedCards.filter(x => !x.safe && !x.stored && x.card.name === stack.card.name).length;
      const delta = Math.ceil((sameBag + stack.count) / cap) - Math.ceil(sameBag / cap);
      // 取出整叠复用叠放增量；珍珠盒的额外格仍只收资源卡。
      const limit = stack.card.type === '资源' ? bagCap() : SDT.Base.bagCap();
      if (delta > 0 && usedSlots() + delta > limit) {
        UI.log(`[[icon:bag]] 背包放不下：本次整叠还需 ${delta} 格，请先腾出空间；珍珠盒额外格仅收资源卡`, 'warn');
        SDT.Sound.sfx('deny');
        return;
      }
      game.ownedCards.forEach(x => { if (x.pouchOf === POUCH_ID && x.card.name === d.name) { delete x.pouchOf; delete x.stored; } });
      UI.log(`[[icon:cards]] 【<b>${esc(stack.card.name)}</b>】已从锦囊取出`, 'ok');
      saveGame();
      render();
    }, current);
    bagAct('pouchBack', () => { UI.hideOverlay(); showBackpack(true); }, current);
    render();
  }

  // —— 珍珠盒 · 存放资源卡（2026-09-10 留言 #29）——
  // 点背包里的珍珠盒 → 存入/取出资源卡：存入的卡不占背包格（容量口径见 game.session.cardStacks
  // 排除 o.stored），盒子容量 = 个数 × 3×3 = 9 张；盒子放进安全格时盒中卡牌同样受宠物保护。
  function openPearlStore() {
    game.state = 'modal';
    let root; const current = captureBagView(() => root);
    const PEARL_ID = 'tt2-pearlbox';
    const boxes = game.ownedCards.filter(x => x.card && x.card.id === PEARL_ID).length;
    const cap = boxes * 9;
    // stored 与法师锦囊共用标记：pouchOf 非空的卡在锦囊里，不属于任何珍珠盒
    const storedN = () => game.ownedCards.filter(x => x.stored && !x.pouchOf).length;
    const storedStacks = () => {
      const map = new Map();
      game.ownedCards.forEach(x => {
        if (!x.stored || x.pouchOf || !x.card) return;
        if (!map.has(x.card.name)) map.set(x.card.name, { card: x.card, count: 0 });
        map.get(x.card.name).count++;
      });
      return [...map.values()];
    };
    const bagResStacks = () => cardStacks(false).filter(st => st.card.type === '资源');
    const render = () => {
      const focused = root?.contains(document.activeElement) ? document.activeElement.dataset : null;
      const stackHTML = (st, take) => `<button type="button" class="bt-card pearl-store-card" data-act="${take ? 'pearlTake' : 'pearlPut'}" data-name="${escAttr(st.card.name)}"
        aria-label="${escAttr(`${st.card.name}，${st.count} 张，${take ? '整叠取出回背包' : '整叠存入珍珠盒'}`)}"
        title="${escAttr(take ? '按所需背包空间整叠取出' : '整叠存入珍珠盒，腾出背包空间')}">
        <span class="pearl-store-art" aria-hidden="true">${SDT.Cards.cardHTML(st.card, 'sm')}</span>
        <span class="pearl-store-caption"><b>${esc(st.card.name)}</b><span>${take ? '整叠取出' : '整叠存入'} · ${st.count} 张</span></span></button>`;
      const storedHTML = storedStacks().map(st => stackHTML(st, true)).join('') || '<p class="ov-empty">盒子里还没有资源卡</p>';
      const bagHTML = bagResStacks().map(st => stackHTML(st, false)).join('') || '<p class="ov-empty">背包里没有资源卡。木材、口粮、货币卡等才是资源。</p>';
      UI.showOverlay('[[icon:gem]] 珍珠盒 · 存放资源卡', `<section class="battle-decision pearl-store" data-decision-kind="pearl-store">
        <header class="battle-decision-head"><h3>[[icon:gem]] 珍珠盒</h3><span>${boxes} 个珍珠盒 · 每个 3×3 空间</span></header>
        <div class="battle-decision-summary"><p class="ov-note" role="status" aria-live="polite" aria-atomic="true">盒中 <b>${storedN()}/${cap}</b> 张 · 存入的资源卡<b>不占背包格</b></p>
          <p class="ov-note">把珍珠盒放进安全格，盒中的卡撤离失败时也会被抢运回基地</p></div>
        <div class="battle-decision-content pearl-store-columns">
          <section><h4>盒中资源</h4><p class="pearl-store-hint">选择卡牌，整叠取出回背包</p><div class="pearl-store-list">${storedHTML}</div></section>
          <section><h4>背包里的资源卡</h4><p class="pearl-store-hint">选择卡牌，整叠存入珍珠盒</p><div class="pearl-store-list">${bagHTML}</div></section>
        </div>
        <footer class="battle-decision-actions"><div class="ov-btns"><button type="button" class="ov-btn ok" data-act="pearlBack" aria-label="收好珍珠盒，返回背包">[[icon:arrow]] 收好珍珠盒</button></div></footer>
        </section>`, 'bag');
      root = UI.el.ovBody?.firstElementChild;
      root?.querySelectorAll('.pearl-store-art [tabindex]').forEach(el => el.removeAttribute('tabindex'));
      if (focused) {
        const buttons = [...root.querySelectorAll('button[data-act]')];
        (buttons.find(b => b.dataset.act === focused.act && b.dataset.name === focused.name)
          || buttons.find(b => b.dataset.act === focused.act) || buttons.find(b => b.dataset.act === 'pearlBack'))?.focus({ preventScroll: true });
      }
    };
    bagAct('pearlPut', (d) => {
      const stack = bagResStacks().find(st => st.card.name === d.name);
      if (!stack) return;
      if (storedN() + stack.count > cap) {
        UI.log(`[[icon:gem]] 珍珠盒放不下了（${storedN()}/${cap} 张）——先取出一些`, 'warn');
        SDT.Sound.sfx('deny');
        return;
      }
      stack.uids.forEach(uid => { const o = game.ownedCards.find(x => x.uid === uid); if (o) o.stored = 1; });
      UI.log(`[[icon:gem]] 【<b>${esc(stack.card.name)}</b>】×${stack.count} 存入珍珠盒——腾出 1 个背包格`, 'ok');
      SDT.Sound.sfx('gain');
      saveGame();
      render();
    }, current);
    bagAct('pearlTake', (d) => {
      const stack = storedStacks().find(st => st.card.name === d.name);
      if (!stack) return;
      // 取出按「格数增量」检查：整叠 9 张按 3 张/格需 3 格，只查 1 个空格会越界
      // （09-30 深审 ROOT-03）；同名合并口径与 moveStackSafe 一致
      const cap = game.stackCapOf(stack.card);
      const sameBag = game.ownedCards.filter(x => !x.safe && !x.stored && x.card.name === stack.card.name).length;
      const delta = Math.ceil((sameBag + stack.count) / cap) - Math.ceil(sameBag / cap);
      if (usedSlots() + delta > bagCap()) {
        UI.log(`[[icon:bag]] 背包放不下：本次整叠还需 ${delta} 格（现 ${usedSlots()}/${bagCap()} 格），先腾出空间`, 'warn');
        SDT.Sound.sfx('deny');
        return;
      }
      // 只解除珍珠盒自己的标记：锦囊法术（pouchOf）不在盒中，跨容器取出会留下双份归属
      game.ownedCards.forEach(x => { if (x.stored && !x.pouchOf && x.card.name === stack.card.name) delete x.stored; });
      UI.log(`[[icon:bag]] 【<b>${esc(stack.card.name)}</b>】×${stack.count} 从珍珠盒取出，回到背包`, 'ok');
      saveGame();
      render();
    }, current);
    bagAct('pearlBack', () => { UI.hideOverlay(); showBackpack(true); }, current);
    render();
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
    syncCardOrder();
    const all = cardStacks(false).concat(cardStacks(true));
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
  function bagZoneTiles() {
    if (bagZone === 'safe') {
      return sortStacksByOrder(cardStacks(true)).map(st => ({ name: st.card.name, card: st.card, rarity: bagV2Rarity(st.card), type: st.card.type, cost: st.card.cost, count: st.count, safe: 1, zone: 'safe' }));
    }
    if (bagZone === 'pocket') {
      return game.usedPocket.map(p => ({ name: p.card.name, card: p.card, rarity: bagV2Rarity(p.card), type: p.card.type, cost: p.card.cost, count: p.count, zone: 'pocket' }));
    }
    const supplies = game.inventory.map(it => ({ name: it.name, value: it.value, tier: it.tier, count: it.count || 1, supply: 1, zone: 'bag' }));
    let cards = sortStacksByOrder(cardStacks(false)).map(st => ({ name: st.card.name, card: st.card, rarity: bagV2Rarity(st.card), type: st.card.type, cost: st.card.cost, count: st.count, safe: 0, zone: 'bag' }));
    if (bagFilter === 'supply') return supplies;
    if (bagFilter !== 'all') cards = cards.filter(c => bagFilter === 'move' ? ['武术', '法术', '能力卡'].includes(c.type) : c.type === bagFilter);
    return bagFilter === 'all' ? [...supplies, ...cards] : cards;
  }
  function findBagStack(name, safe) {
    return cardStacks(safe).find(st => st.card.name === name)
      || (!safe ? game.inventory.find(it => it.name === name) : null);
  }
  // 看卡操作台（2026-10-15 老板定向：右侧复用基地仓库同款 inventory-zoom 界面）：
  // 点格子直接开 presentation:'inventory' 特写——大真卡面 + camp-card-actions 页脚。
  function openBagZoom(name, safe, pocket = false) {
    const source = [...(UI.el.ovBody?.querySelectorAll('.bag-tile[data-stack]') || [])].find(tile => tile.dataset.stack === name);
    if (pocket) {
      const entry = game.usedPocket.find(item => item.card.name === name);
      if (entry) {
        UI.showCardZoom(entry.card, { presentation: 'inventory', from: source, returnFocus: source,
          footer: `<div class="camp-detail"><p>已消耗 ${entry.count} 张 · ${['道具', '装备'].includes(entry.card.type) ? '火堆不可复原；能源结晶可按顺序复原' : '可在火堆或使用复原道具取回'}。</p></div>` });
        decorateInventoryZoom(entry.card);
      }
      return;
    }
    const st = findBagStack(name, safe);
    if (!st || !st.card) return;   // 物资格不开浮层：名称/等级/价值在格子与 tooltip 上
    const card = st.card, safeFlag = !!safe;
    const usable = !safeFlag && card.type === '道具';
    const isSha = card.id === SDT.Cards.SHA.id;
    const closeZoom = () => document.getElementById('cardZoom')?.querySelector('.cz-backdrop')?.click();
    const btns = [];
    if (usable) btns.push('<button class="ov-btn ok" data-act="useDetailCard">使用这张道具</button>');
    if (card.id === 'tt2-pearlbox') btns.push('<button class="ov-btn ok" data-act="pearlStoreZoom">[[icon:gem]] 打开珍珠盒</button>');
    if (card.id === 'tt7-stratagem' && !safeFlag) btns.push('<button class="ov-btn ok" data-act="pouchStoreZoom">[[icon:cards]] 打开锦囊（存放法术 ×3）</button>');
    if (card.id === 'tt-token-gold' && st.count >= 3) btns.push('<button class="ov-btn ok" data-act="craftColorToken">合成员工通行证A（3 张 B → 1 张 A）</button>');
    if (card.id === 'tt-token-color' && (game.fragments || 0) >= 2) btns.push('<button class="ov-btn ok" data-act="craftColorTokenByFragments">合成员工通行证A（2 碎片 + 1 通行证A）</button>');
    if (safeFlag) btns.push('<button class="ov-btn" data-act="zoomMoveToBag">[[icon:bag]] 移回背包</button>');
    else if (!isSha) btns.push('<button class="ov-btn" data-act="zoomMoveToSafe">[[icon:lock]] 移入安全格</button>');
    if (!isSha) btns.push('<button class="ov-btn danger" data-act="detailDiscard">丢弃 1 张</button>');
    const zoneLabel = safeFlag ? '安全格押运中' : '随身背包';
    const material = SDT.Base.materialInfo?.(card);
    const hint = safeFlag ? '撤离失败也将运回基地；拖到左栏背包钮或点「移回背包」取出。'
      : material ? '这是资源卡，不计入散装物资估值。带回后勤仓库，使用材料卡折入基地库存。'
      : card.type === '道具' ? '治疗、复原与通行证B可在背包使用；其余道具依效果在战斗使用。'
      : '按住拖动整理顺序；拖到左栏盾钮存入安全格。';
    UI.showCardZoom(card, {
      presentation: 'inventory',
      from: source, returnFocus: source,
      footer: `<div class="camp-detail camp-card-actions"><div class="inspect-meta"><span class="inspect-count">持有 <b>×${st.count}</b> 张</span><span class="inspect-collection-state">${zoneLabel}</span></div><p class="inspect-collection-hint">${hint}</p>${btns.length ? `<div class="ov-btns">${btns.join('')}</div>` : ''}</div>`,
    });
    // 特写页动作：特写打开时注册（旧守卫语义——特写被新详情替换即失效，生命周期测试锚定）
    bagAct('useDetailCard', () => { closeZoom(); useOwnedCard(st.uids[0]); });
    if (safeFlag) bagAct('zoomMoveToBag', () => { closeZoom(); moveStackSafe(card.name, false); });
    else if (!isSha) bagAct('zoomMoveToSafe', () => { closeZoom(); moveStackSafe(card.name, true); });
    if (card.id === 'tt2-pearlbox') bagAct('pearlStoreZoom', () => { closeZoom(); openPearlStore(); });
    if (card.id === 'tt7-stratagem' && !safeFlag) bagAct('pouchStoreZoom', () => { closeZoom(); openPouchStore(); });
    bagAct('detailDiscard', () => { closeZoom(); showDiscardConfirm(card.name, safeFlag); });
    bagAct('craftColorToken', () => {
      closeZoom();
      const golds = game.ownedCards.filter(x => x.card && x.card.id === 'tt-token-gold').slice(0, 3);
      if (golds.length < 3) { UI.log('员工通行证B不足 3 张，无法合成', 'warn'); return; }
      const goldIds = new Set(golds.map(g => g.uid));
      game.ownedCards = game.ownedCards.filter(x => !goldIds.has(x.uid));
      const color = SDT.Cards.all().find(c => c.id === 'tt-token-color');
      if (color) game.ownedCards.push({ uid: newUid(), card: { ...color } });
      UI.log('[[icon:sparkles]] 合成成功：3 张员工通行证B → 1 张<b>员工通行证A</b>', 'loot');
      saveGame();
      showBackpack(true);
    });
    bagAct('craftColorTokenByFragments', () => {
      closeZoom();
      if ((game.fragments || 0) < 2) { UI.log('员工通行证A碎片不足 2 枚，无法合成', 'warn'); return; }
      const i = game.ownedCards.findIndex(x => x.card && x.card.id === 'tt-token-color');
      if (i < 0) return;
      game.ownedCards.splice(i, 1);
      game.fragments -= 2;
      const token = SDT.Cards.all().find(c => c.id === 'cmtmvq6ss84l');
      if (token) game.ownedCards.push({ uid: newUid(), card: { ...token } });
      UI.log('[[icon:sparkles]] 合成成功：员工通行证A + 2 枚碎片 → 1 张<b>员工通行证A</b>（使用后获取本职业能力卡）', 'loot');
      saveGame();
      showBackpack(true);
    });
    decorateInventoryZoom(card);
  }
  function showBackpack(refreshOnly) {
    // 卡牌特写浮层挂在 body（overlay 之外）：此时按 B / 点背包按钮 = 先收回特写，
    // 不动背包——否则背包关闭后特写残留在局内画面上
    if (!refreshOnly) {
      const zoom = document.getElementById('cardZoom');
      if (zoom) { zoom.querySelector('.cz-backdrop')?.click(); return; }
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
    if (game.battleActive) {
      // 2026-09-09 老板：战斗中也能开背包用道具——转给战斗背包（again 按 B = 关闭）
      if (SDT.Battle && SDT.Battle.commands && SDT.Battle.commands.openBag) {
        SDT.Battle.commands.openBag();
        return;
      }
      UI.log('[[icon:lock]] 战斗中无法打开背包；请使用手牌完成战斗或撤退', 'warn');
      return;
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
    syncCardOrder();
    const cap = bagCap(), sCap = safeCap(), baseCap = SDT.Base.bagCap();
    const total = game.inventory.reduce((a, b) => a + b.value * (b.count || 1), 0);
    const safeUsedN = cardStacks(true).length;
    const pkN = game.usedPocket.reduce((a, b) => a + b.count, 0);
    if (requestedBagSection) {
      bagZone = requestedBagSection === 'main' ? 'bag' : requestedBagSection;
      requestedBagSection = null;
    }
    // 说明文字统一收进 ? 帮助弹层
    const helpCurrent = captureBattleContext(game), helpCards = game.ownedCards;
    UI.registerHelp('bag', {
      title: '背包说明',
      html: `
        <p class="help-item"><b>随身背包</b>物资与卡牌混占格（同名通常每 3 张占 1 格，初始攻击／火球每 5 张占 1 格）。点击格子看卡牌详情；按住拖动整理顺序，拖到左栏盾形按钮存入安全格。</p>
        <p class="help-item"><b>安全格</b>由${esc(SDT.Base.carriedPet?.()?.name || '随行伙伴')}看守：撤离失败或放弃对局时，只有安全格里的卡牌会被抢运回基地，其余全部丢失。容量在基地「升级」页用口粮升级。</p>
        <p class="help-item"><b>消耗区</b>用过的普通牌暂存在这里，不占背包格。复原回背包后，就能再用。</p>
        <p class="help-item"><b>去火堆复原</b>每次随机复原最多 2 张；道具和装备不能在火堆复原。</p>
        <p class="help-item"><b>用道具复原</b>能源结晶按消耗区顺序复原最多 3 张，也能复原道具和装备。背包要放得下。</p>
        <details><summary>撤离后怎么处理？</summary><p>撤离时每张仅 1/3 概率带回基地消耗区（用钥匙复原）。下次出发时，未复原的牌会消散。</p></details>
        <p class="help-item"><b>丢弃</b>把卡牌拖到背包页面外可申请丢弃 1 张——丢弃的牌无法取回，请谨慎操作。</p>`,
      back: () => { if (helpCurrent() && game.ownedCards === helpCards && UI.el.ovBody?.querySelector('.help-body')) showBackpack(true); },
    });
    UI.showOverlay('[[icon:bag]] 背包', bagV2PageHTML({
      bagZone, bagFilter, bagSortKey,
      cap, baseCap, capacityText:game.bagCapacityText?.() || '', total, safeUsedN, sCap, pkN,
      petName: SDT.Base.carriedPet?.()?.name || '随行伙伴', receipt: bagReceipt?.cards === game.ownedCards ? bagReceipt.text : '',
      used: usedSlots(), coins: game.coins, fragments: game.fragments || 0,
      tiles: bagZoneTiles(),
    }), 'bagpage');
    // 分区 / 筛选 / 排序 / 点选详情：格子打开独立全文阅读与操作区，
    // inspectStack 契约与原有卡面特写返回路径不变。
    bagAct('bagZone', d => {
      if (!['bag', 'safe', 'pocket'].includes(d.zone)) return;
      bagZone = d.zone; bagFilter = 'all';
      showBackpack(true);
      UI.el.ovBody?.querySelector(`.bag-rz[data-zone="${d.zone}"]`)?.focus();
    });
    bagAct('bagFilter', d => { bagFilter = d.f || 'all'; showBackpack(true); });
    bagAct('bagSortCycle', () => { bagSortKey = bagSortKey === 'rarity' ? 'type' : 'rarity'; sortBagBy(bagSortKey); });
    bagAct('bagTidy', () => { bagSortKey = 'rarity'; sortBagBy('rarity'); });
    bagAct('closeBag', closeBackpack);
    bagAct('inspectStack', d => openBagZoom(d.name, d.safe === '1', d.pocket === '1'));
    bagSlots.bindBagDrag();   // v0.21：拖拽排序 / 左栏分区钮拖放跨区 / 点格子开看卡操作台
  }

  let backpackOpen = false;   // 背包弹窗开关（必须声明：showBackpack 打开路径会读取它）
  let bagOverChest = false;   // 背包是否从搜刮界面打开（关闭时回搜刮面板，2026-09-09 留言 #13）
  // 来源页返回钩子迁移到 bag-return-hook.js 中立模块（迭代评审 09-20）：事件页/物资格页
  // 也要登记恢复路径，而 scenes/flow 不能反向 import 本模块（会经 game.run 成环）


function setBagReturnHook(fn) { _setBagReturnHook(fn); }   // 中立模块再导出（boot 商店运行时注入用）
export { showBackpack, showBackpackSection, setBagReturnHook };
export { bindBagMixins, resumeBattleRewards } from './game.bag.settle.js';
