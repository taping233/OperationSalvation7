/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const UI = window.SDT.UI;
const SDT = window.SDT;
import { esc } from './shared.js';
import { MAP, bagCap, safeCap } from './game.session.js';
import { escAttr } from './shared.js';
import { cardStacks, doDeath, game, newUid, safeUsed, saveGame, usedSlots } from './game.session.js';
import { Random } from './random.js';
import { on as busOn } from './event-bus.js';
import { showRunTransition } from './game.run.js';
import { _set_cardPageOpen } from './game.cardslib.js';

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
    const desc = card.desc || '';
    // 能源结晶：就地复原消耗口袋中最多 3 张卡牌（2026-09-13 需求：背包满时不能复原出超容量的卡）
    if (card.id === 'tt-crystal' || /复活最多\s*3\s*张卡牌/.test(desc)) {
      if (!game.usedPocket.length) { UI.log('消耗口袋是空的，无需复原', 'warn'); return; }
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
      UI.log(`[[icon:gem]] 使用【<b>${esc(card.name)}</b>】：复原了消耗口袋中的 <b>${cnt}</b> 张卡牌` +
        (leftN && usedSlots() >= bagCap() ? `（背包已满，剩 ${leftN} 张留在口袋）` : ''), 'ok');
      showBackpack(true);
      return;
    }
    // 复原药水（2026-09-09 审计补实装）：背包中使用，复原消耗口袋至多 2 张
    if (card.name === '复原药水' || /复原.{0,4}(两|2).{0,3}张卡牌/.test(desc)) {
      if (!game.usedPocket.length) { UI.log('消耗口袋是空的，无需复原', 'warn'); return; }
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
      UI.log(`[[icon:gem]] 使用【<b>${esc(card.name)}</b>】：复原了消耗口袋中的至多 <b>2</b> 张卡牌`, 'ok');
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
    // 2026-09-06 #10：员工通行证B（抽取 1 张传说卡 → 背包中使用改为直接获得传说卡）
    if (card.id === 'tt-token-gold' || /抽取\s*1\s*张传说卡/.test(desc)) {
      const pool = SDT.Cards.all().filter(c => c.rarity === '传说' && SDT.Cards.isRandomObtainable(c));
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
    if (toSafe) {
      const merges = game.ownedCards.some(o => o.safe && o.card.name === name);
      if (!merges && safeUsed() >= safeCap()) {
        UI.log(`[[icon:lock]] 安全格已满（${safeUsed()}/${safeCap()} 格），可在基地用口粮升级`, 'warn');
        return;
      }
    } else {
      const merges = game.ownedCards.some(o => !o.safe && o.card.name === name);
      if (!merges && usedSlots() >= bagCap()) {
        UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格），取不出来`, 'warn');
        return;
      }
    }
    list.forEach(o => { o.safe = toSafe; });
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
    UI.hideOverlay();
    // 从搜刮界面打开的背包：关闭后回到当前搜刮面板继续开箱（2026-09-09 留言 #13）
    if (bagOverChest) {
      bagOverChest = false;
      game.state = 'modal';
      if (SDT.Chests && SDT.Chests.resume) SDT.Chests.resume();
      UI.refresh(game);
      return;
    }
    // 从其他页面（商店等）打开的背包：关闭后调用返回钩子回到原页面（2026-09-12 留言 #31）
    if (bagReturnHook) {
      const hook = bagReturnHook;
      bagReturnHook = null;
      hook();
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

  function showDiscardConfirm(name, fromSafe) {
    backpackOpen = false;
    game.state = 'modal';
    // 2026-09-19 留言 #25：确认页背景透明——走 fx-glass 暗纱 + 中性玻璃面板
    UI.showOverlay('[[icon:question]] 丢弃卡牌？', `
      <div class="glass-panel">
        <p class="ov-note">你把【<b>${esc(name)}</b>】拖到了背包外。确认后将永久丢弃 1 张，无法从消耗口袋或墓地取回。</p>
        <div class="ov-btns">
          <button class="ov-btn danger" data-act="confirmDragDiscard">确认丢弃</button>
          <button class="ov-btn" data-act="cancelDragDiscard">取消，放回背包</button>
        </div>
      </div>`, 'glass');
    UI.act('confirmDragDiscard', () => { discardOwnedCard(name, fromSafe); showBackpack(true); });
    UI.act('cancelDragDiscard', () => showBackpack(true));
  }

  function showBagCardDetail(name, fromSafe) {
    const o = game.ownedCards.find(x => !!x.safe === !!fromSafe && x.card.name === name);
    if (!o) { showBackpack(true); return; }
    const usable = !fromSafe && o.card.type === '道具';
    // 2026-09-09 老板：点牌查看改成出发整备同款放大特写——背包页保持不动，
    // 不再切 overlay 弹窗（那会拆掉 opaque 背包页，露出局内战斗背景）
    const isSha = o.card.id === SDT.Cards.SHA.id;
    UI.showCardZoom(o.card, {
      footer: `
        <p class="ov-note">${esc(o.card.name)} · ${esc(o.card.type)} · ${esc(o.card.rarity || '')}${fromSafe ? ' · 位于安全格' : ''}${o.card.id === 'tt-token-color' ? ` · 彩色令牌碎片 <b>${game.fragments || 0}/2</b>` : ''}</p>
        <div class="ov-btns">
          ${usable ? '<button class="ov-btn ok" data-act="useDetailCard">使用这张道具</button>' : ''}
          ${o.card.id === 'tt-token-gold' && game.ownedCards.filter(x => x.card.id === 'tt-token-gold').length >= 3
            ? '<button class="ov-btn ok" data-act="craftColorToken">合成员工通行证A（3 张 B → 1 张 A）</button>' : ''}
          ${o.card.id === 'tt-token-color' && (game.fragments || 0) >= 2
            ? '<button class="ov-btn ok" data-act="craftColorTokenByFragments">合成彩色令牌（2 碎片 + 1 通行证A）</button>' : ''}
          ${o.card.id === 'tt2-pearlbox' ? '<button class="ov-btn ok" data-act="pearlStore">[[icon:gem]] 存入 / 取出资源卡</button>' : ''}
          ${o.card.id === 'tt7-stratagem' ? '<button class="ov-btn ok" data-act="pouchStore">[[icon:cards]] 打开锦囊（存放法术 ×3）</button>' : ''}
          ${fromSafe ? '<button class="ov-btn" data-act="detailFromSafe">移回背包</button>' :
            (isSha ? '' : '<button class="ov-btn" data-act="detailToSafe">移入安全格</button>')}
          ${isSha ? '' : '<button class="ov-btn danger" data-act="detailDiscard">丢弃 1 张</button>'}
        </div>`,
    });
    // 特写挂在 body（overlay 之外）：动作执行前先模拟点背景收回，回到背包页
    const closeZoom = () => document.getElementById('cardZoom')?.querySelector('.cz-backdrop')?.click();
    const closeCardZoom = () => document.getElementById('cardZoom')?.querySelector('.cz-backdrop')?.click();
    UI.act('useDetailCard', () => { closeZoom(); useOwnedCard(o.uid); });
    UI.act('craftColorToken', () => {
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
    UI.act('craftColorTokenByFragments', () => {
      closeZoom();
      // 2026-09-09 Q6 老板定向：隐藏计数器碎片——集齐 2 枚碎片 + 员工通行证A → 合成彩色令牌
      if ((game.fragments || 0) < 2) { UI.log('彩色令牌碎片不足 2 枚，无法合成', 'warn'); return; }
      game.ownedCards.splice(game.ownedCards.indexOf(o), 1);
      game.fragments -= 2;
      const token = SDT.Cards.all().find(c => c.id === 'cmtmvq6ss84l');
      if (token) game.ownedCards.push({ uid: newUid(), card: { ...token } });
      UI.log('[[icon:sparkles]] 合成成功：员工通行证A + 2 枚碎片 → 1 张<b>彩色令牌</b>（使用后获取本职业能力卡）', 'loot');
      saveGame();
      showBackpack(true);
    });
    UI.act('detailFromSafe', () => { closeZoom(); moveStackSafe(name, false); });
    UI.act('detailToSafe', () => { closeZoom(); moveStackSafe(name, true); });
    UI.act('detailDiscard', () => { closeZoom(); showDiscardConfirm(name, fromSafe); });
    UI.act('pearlStore', () => { closeZoom(); openPearlStore(); });
    UI.act('pouchStore', () => { closeZoom(); openPouchStore(); });
  }

  // —— 法师锦囊 · 存放法术牌（2026-09-16 留言 #4 定版）——
  // 点背包里的锦囊 → 存入/取出法术牌：上限 3 张，战斗中打出锦囊时从里面选 1 张直接释放
  function openPouchStore() {
    game.state = 'modal';
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
    };
    UI.act('pouchPut', (d) => {
      if (stored().length >= 3) { UI.log('[[icon:cards]] 锦囊已满（3 张法术）', 'warn'); return; }
      const stack = bagSpellStacks().find(st => st.card.name === d.name);
      if (!stack) return;
      stack.uids.forEach(uid => { const o = game.ownedCards.find(x => x.uid === uid); if (o) { o.pouchOf = POUCH_ID; o.stored = 1; } });
      UI.log(`[[icon:cards]] 【<b>${esc(stack.card.name)}</b>】存入法师锦囊`, 'ok');
      saveGame();
      render();
    });
    UI.act('pouchTake', (d) => {
      const stack = storedStacks().find(st => st.card.name === d.name);
      if (!stack) return;
      game.ownedCards.forEach(x => { if (x.pouchOf === POUCH_ID && x.card.name === d.name) { delete x.pouchOf; delete x.stored; } });
      UI.log(`[[icon:cards]] 【<b>${esc(stack.card.name)}</b>】已从锦囊取出`, 'ok');
      saveGame();
      render();
    });
    UI.act('pouchBack', () => { UI.hideOverlay(); showBackpack(true); });
    render();
  }

  // —— 珍珠盒 · 存放资源卡（2026-09-10 留言 #29）——
  // 点背包里的珍珠盒 → 存入/取出资源卡：存入的卡不占背包格（容量口径见 game.session.cardStacks
  // 排除 o.stored），盒子容量 = 个数 × 3×3 = 9 张；盒子放进安全格时盒中卡牌同样受宠物保护。
  function openPearlStore() {
    game.state = 'modal';
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
      const storedHTML = storedStacks().map(st => `
        <div class="bt-card" data-act="pearlTake" data-name="${escAttr(st.card.name)}"
          title="${escAttr(`${st.card.name} ×${st.count}——点击整叠取出回背包（需要一个空背包格）`)}">
          ${SDT.Cards.cardHTML(st.card, 'sm')}
          <span class="bt-count">×${st.count}</span>
        </div>`).join('') || '<p class="ov-empty">（盒子里还没有资源卡）</p>';
      const bagHTML = bagResStacks().map(st => `
        <div class="bt-card" data-act="pearlPut" data-name="${escAttr(st.card.name)}"
          title="${escAttr(`${st.card.name} ×${st.count}——点击整叠存入珍珠盒（腾出背包格）`)}">
          ${SDT.Cards.cardHTML(st.card, 'sm')}
          <span class="bt-count">×${st.count}</span>
        </div>`).join('') || '<p class="ov-empty">（背包里没有资源卡——木材/口粮/货币卡等才是资源）</p>';
      UI.showOverlay('[[icon:gem]] 珍珠盒 · 存放资源卡', `
        <p class="ov-note">盒中 <b>${storedN()}/${cap}</b> 张（${boxes} 个珍珠盒 · 每个内置 3×3 空间）——存入的资源卡<b>不占背包格</b>；把珍珠盒放进安全格，盒中的卡撤离失败时也会被抢运回基地</p>
        <h3 class="set-h">盒中资源（点击整叠取出）</h3>
        <div class="bt-hand">${storedHTML}</div>
        <h3 class="set-h">背包里的资源卡（点击整叠存入）</h3>
        <div class="bt-hand">${bagHTML}</div>
        <div class="ov-btns"><button class="ov-btn ok" data-act="pearlBack">[[icon:arrow]] 收好珍珠盒</button></div>`);
    };
    UI.act('pearlPut', (d) => {
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
    });
    UI.act('pearlTake', (d) => {
      const stack = storedStacks().find(st => st.card.name === d.name);
      if (!stack) return;
      // 取出需要 1 个背包空格（存入时腾出的格可能已被占用）
      if (usedSlots() >= bagCap()) {
        UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格），取不出来`, 'warn');
        SDT.Sound.sfx('deny');
        return;
      }
      // 只解除珍珠盒自己的标记：锦囊法术（pouchOf）不在盒中，跨容器取出会留下双份归属
      game.ownedCards.forEach(x => { if (x.stored && !x.pouchOf && x.card.name === stack.card.name) delete x.stored; });
      UI.log(`[[icon:bag]] 【<b>${esc(stack.card.name)}</b>】×${stack.count} 从珍珠盒取出，回到背包`, 'ok');
      saveGame();
      render();
    });
    UI.act('pearlBack', () => { UI.hideOverlay(); showBackpack(true); });
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
    if (bagDrag) {
      if (bagDrag.ghost) bagDrag.ghost.remove();
      if (bagDrag.cell) bagDrag.cell.classList.remove('dragging');
      bagDrag = null;
    }
    game.state = 'modal';
    backpackOpen = true;
    _set_cardPageOpen(false);
    syncCardOrder();
    const cap = bagCap(), sCap = safeCap();
    const total = game.inventory.reduce((a, b) => a + b.value * (b.count || 1), 0);
    const supplies = game.inventory;
    const stacks = sortStacksByOrder(cardStacks(false));
    let cells = '';
    for (let i = 0; i < cap; i++) {
      if (i < supplies.length) {
        const it = supplies[i];
        cells += `<div class="bag-slot filled tier-bd-${it.tier}" title="${it.name}">
             <b>${it.name}${it.count > 1 ? ` ×${it.count}` : ''}</b>
             <span>¥${it.value * it.count}</span>
             <i class="tier tier-${it.tier}">${it.tier}</i>
           </div>`;
      } else if (i - supplies.length < stacks.length) {
        const st = stacks[i - supplies.length];
        const isSha = st.card.id === SDT.Cards.SHA.id;
        cells += `<div class="bag-slot filled card-slot flip3d" data-stack="${escAttr(st.card.name)}"
              title="${escAttr(st.card.name)} ×${st.count} · 点击查看详情 · 按住拖动整理">
             <div class="flip-inner">
               <div class="flip-face flip-front" data-act="inspectStack" data-name="${escAttr(st.card.name)}" data-safe="0">
                 ${SDT.Cards.cardHTML(st.card, '', { hideCost: true })}
                 <span class="stack-count">×${st.count}${isSha ? ' · [[icon:pen]]' : ''}</span>
               </div>
               <div class="flip-face flip-back">${SDT.Cards.cardBackHTML()}</div>
             </div>
           </div>`;
      } else if (i >= SDT.Base.bagCap()) {
        // 2026-09-10 留言 #26：珍珠盒扩格与普通格视觉区分——玩家不再误以为「有空位却拾取不了」
        cells += '<div class="bag-slot empty pearl-empty" title="珍珠盒扩格：只收资源卡牌（木材/口粮/货币等），其他卡放不进"></div>';
      } else cells += '<div class="bag-slot empty"></div>';
    }
    // 安全格：宠物看守，撤离失败时里面的卡牌安全运回基地
    const safeStacks = sortStacksByOrder(cardStacks(true));
    let safeCells = '';
    for (let i = 0; i < sCap; i++) {
      if (i < safeStacks.length) {
        const st = safeStacks[i];
        safeCells += `<div class="bag-slot filled safe-slot flip3d" data-stack="${escAttr(st.card.name)}"
          title="${escAttr(st.card.name)} ×${st.count} · 点击查看详情 · 拖回背包可取出">
          <div class="flip-inner">
            <div class="flip-face flip-front" data-act="inspectStack" data-name="${escAttr(st.card.name)}" data-safe="1">
              ${SDT.Cards.cardHTML(st.card, '', { hideCost: true })}
              <span class="stack-count">×${st.count} · [[icon:lock]]</span>
            </div>
            <div class="flip-face flip-back">${SDT.Cards.cardBackHTML()}</div>
          </div>
        </div>`;
      } else safeCells += '<div class="bag-slot empty safe-empty"></div>';
    }
    // 消耗口袋：容量无限，未复原不能再用（2026-09-09 老板 #6：文字行改真卡面，背包里看得见口袋里是哪张牌）
    const pkN = game.usedPocket.reduce((a, b) => a + b.count, 0);
    const pocketHTML = game.usedPocket.length
      ? game.usedPocket.map(p => `
          <div class="pk-card" title="${escAttr(p.card.name)}${p.count > 1 ? ` ×${p.count}` : ''} · ${p.card.cost}费 · 本局无法使用（基地/火堆可复原）">
            ${SDT.Cards.cardHTML(p.card, 'sm')}
            ${p.count > 1 ? `<span class="bt-count">×${p.count}</span>` : ''}
            <span class="pk-tag">无法使用</span>
          </div>`).join('')
      : '<p class="ov-empty" style="margin:2px 0 0">（空——对小怪使用过的卡牌会进入这里）</p>';
    // 说明文字统一收进 ? 帮助弹层
    UI.registerHelp('bag', {
      title: '背包说明',
      html: `
        <p class="help-item"><b>背包格</b>物资与卡牌混占格数（同名堆叠只占 1 格）。双击卡牌翻面看卡背；按住拖动整理顺序，拖入右侧安全格即存入。</p>
        <p class="help-item"><b>安全格</b>由宠物阿七看守：撤离失败或放弃对局时，只有安全格里的卡牌会被抢运回基地，其余全部丢失。容量在基地「升级」页用口粮升级。</p>
        <p class="help-item"><b>消耗口袋</b>对小怪用过的卡、注能消耗的卡会进到这里：本局无法再用，容量无限。基地可免费复原；火堆每次休整可复原 2 张；道具「能源结晶」可就地复原 3 张。</p>
        <p class="help-item"><b>丢弃</b>把卡牌拖到背包页面外的空地可申请丢弃 1 张——丢弃的牌无法取回，请谨慎操作。</p>`,
      back: () => showBackpack(true),
    });
    UI.showOverlay('[[icon:bag]] 背包', `<div class="bag-view">
      <header class="bag-head">
        <div class="bag-head-info">
          <h2>[[icon:bag]] 背包 ${UI.helpBtn('bag')}</h2>
          <div class="bag-chips">
            <span class="fc-chip">格数 <b>${usedSlots()}/${cap}</b></span>
            <span class="fc-chip">总值 <b>¥${total.toLocaleString()}</b></span>
            <span class="fc-chip">[[icon:lock]] 安全格 <b>${safeStacks.length}/${sCap}</b></span>
            <span class="fc-chip">[[icon:pocket]] 消耗口袋 <b>${pkN}</b> 张</span>
            ${(game.fragments || 0) > 0 ? `<span class="fc-chip" title="集齐 2 枚，可随员工通行证A合成彩色令牌">[[icon:gem]] 彩色令牌碎片 <b>${game.fragments}/2</b></span>` : ''}
          </div>
        </div>
        <button class="bag-close" data-act="closeBag" title="关闭背包（B）" aria-label="关闭背包">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
          </svg>
        </button>
      </header>
      <div class="bag-layout">
        <div class="bag-main">
          <h3 class="set-h">[[icon:bag]] 背包格
            <span class="bag-sort">
              <button class="mini-btn" data-act="bagSortRarity" title="按稀有度从高到低排序（同稀有度按种类）">按稀有度</button>
              <button class="mini-btn" data-act="bagSortType" title="按种类排序（同种类按稀有度）">按种类</button>
            </span>
          </h3>
          <div class="bag-grid">${cells}</div>
        </div>
        <aside class="bag-side">
          <div class="bag-side-card">
            <h3 class="set-h">[[icon:pocket]] 消耗口袋 <span class="set-tip">${pkN} 张</span></h3>
            <div class="pk-list pk-cards">${pocketHTML}</div>
          </div>
          <div class="bag-side-card">
            <h3 class="set-h">[[icon:lock]] 安全格</h3>
            <div class="bag-grid safe-grid">${safeCells}</div>
          </div>
        </aside>
      </div></div>`, 'bagpage');
    // 2026-09-12 留言 #27：看卡不方便 → 点击直接放大卡面特写（替代原文字详情页）。
    // 2026-09-15 修复：#27 改版把带「使用这张道具」按钮的 showBagCardDetail 整个挂空了，
    // 背包里的道具（回血药等）从此没有任何使用入口——在特写 footer 把「使用」补回来
    UI.act('inspectStack', (d) => {
      const st = cardStacks(d.safe === '1').find(s => s.card.name === d.name);
      if (!st) return;
      const usable = d.safe !== '1' && st.card.type === '道具';
      // 珍珠盒/法师锦囊：点击直接打开容器界面（2026-09-16 留言）
      const isPearl = st.card.id === 'tt2-pearlbox' && d.safe !== '1';
      const isPouch = st.card.id === 'tt7-stratagem' && d.safe !== '1';
      let containerBtn = '';
      if (isPearl) containerBtn = '<div class="ov-btns"><button class="ov-btn ok" data-act="pearlStoreZoom">[[icon:gem]] 打开珍珠盒</button></div>';
      if (isPouch) containerBtn = '<div class="ov-btns"><button class="ov-btn ok" data-act="pouchStoreZoom">[[icon:cards]] 打开锦囊（存放法术 ×3）</button></div>';
      // 点击移动（2026-09-16 留言）：背包卡可移入安全格、安全格卡可移回背包（不必拖拽）
      const isShaStack = st.card.name === (SDT.Cards.SHA && SDT.Cards.SHA.name);
      const moveBtn = d.safe === '1'
        ? '<div class="ov-btns"><button class="ov-btn" data-act="zoomMoveToBag">[[icon:bag]] 移回背包</button></div>'
        : (isShaStack ? '' : '<div class="ov-btns"><button class="ov-btn" data-act="zoomMoveToSafe">[[icon:lock]] 移入安全格</button></div>');
      UI.showCardZoom(st.card, {
        footer: `${containerBtn}
          ${usable ? '<div class="ov-btns"><button class="ov-btn ok" data-act="useDetailCard">使用这张道具</button></div>' : ''}
          ${moveBtn}
          <p class="ov-note">${d.safe === '1' ? '[[icon:lock]] 安全格 · 可拖回背包或点击「移回背包」' : '按住拖动整理顺序 · 双击翻看卡背 · 可点击「移入安全格」'}</p>`,
      });
      if (d.safe === '1') {
        UI.act('zoomMoveToBag', () => {
          document.getElementById('cardZoom')?.querySelector('.cz-backdrop')?.click();
          moveStackSafe(st.card.name, false);
        });
      } else if (!isShaStack) {
        UI.act('zoomMoveToSafe', () => {
          document.getElementById('cardZoom')?.querySelector('.cz-backdrop')?.click();
          moveStackSafe(st.card.name, true);
        });
      }
      if (isPearl) UI.act('pearlStoreZoom', () => { closeCardZoom(); openPearlStore(); });
      if (isPouch) UI.act('pouchStoreZoom', () => { closeCardZoom(); openPouchStore(); });
      if (usable) UI.act('useDetailCard', () => {
        document.getElementById('cardZoom')?.querySelector('.cz-backdrop')?.click();
        useOwnedCard(st.uids[0]);
      });
    });
    UI.act('bagSortRarity', () => sortBagBy('rarity'));
    UI.act('bagSortType', () => sortBagBy('type'));
    UI.act('closeBag', closeBackpack);
    bindBagDrag();   // v0.21：3D 拖拽排序 / 双击翻卡背
  }

  let backpackOpen = false;   // 背包弹窗开关（必须声明：showBackpack 打开路径会读取它）
  let bagOverChest = false;   // 背包是否从搜刮界面打开（关闭时回搜刮面板，2026-09-09 留言 #13）
  let bagReturnHook = null;   // 从商店等页面打开背包时的关闭返回钩子（2026-09-12 留言 #31）

  // ---------- 背包拖拽（v0.21）：3D 立体手感 · 堆排序 · 拖入/拖出安全格 ----------
  let bagDrag = null;   // {name, fromSafe, cell, ghost, card3d, sx, sy, lx, ly, vx, vy, moved}
  let bagTiltBound = false;   // 悬停倾斜是 document 级委托，只绑一次（避免重复打开背包时叠加监听）

  function bindBagDrag() {
    const body = UI.el.ovBody;
    const bagGrid = body.querySelector('.bag-grid:not(.safe-grid)');
    const safeGrid = body.querySelector('.safe-grid');
    if (!bagGrid) return;

    // 悬停 3D 倾斜：卡牌跟随指针微微转动（立体感）
    if (!bagTiltBound) {
      bagTiltBound = true;
      document.addEventListener('mousemove', (e) => {
        if (bagDrag || UI.el.overlay.hidden) return;
        // 卡槽只存在于背包页（mode==='bagpage' 时 overlay 带 bag-full 类）：
        // 其他弹层（基地/商店/战斗/撤离页…）打开时直接跳出，
        // 避免每次鼠标移动都白跑一轮 querySelectorAll + closest。
        if (!UI.el.overlay.classList.contains('bag-full')) return;
        const root = UI.el.ovBody;
        root.querySelectorAll('.card-slot.tilted, .safe-slot.tilted').forEach(c => {
          c.classList.remove('tilted');
          const inner = c.querySelector('.flip-inner');
          if (inner) inner.style.transform = c.classList.contains('flipped') ? 'rotateY(180deg)' : '';
        });
        const cell = e.target.closest && e.target.closest('#ovBody .card-slot, #ovBody .safe-slot');
        if (!cell || (e.target.closest && e.target.closest('button'))) return;
        const r = cell.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        const flip = cell.classList.contains('flipped') ? 180 : 0;
        const inner = cell.querySelector('.flip-inner');
        if (inner) {
          cell.classList.add('tilted');
          inner.style.transform = `rotateY(${(flip + px * 16).toFixed(1)}deg) rotateX(${(-py * 14).toFixed(1)}deg)`;
        }
      });
    }
    // 双击翻面：正面 ⇄ 当前装备的卡背
    const onDbl = (e) => {
      const cell = e.target.closest('.card-slot, .safe-slot');
      if (!cell || e.target.closest('button')) return;
      cell.classList.toggle('flipped');
      const inner = cell.querySelector('.flip-inner');
      if (inner) inner.style.transform = cell.classList.contains('flipped') ? 'rotateY(180deg)' : '';
      SDT.Sound.sfx('click');
    };
    bagGrid.addEventListener('dblclick', onDbl);
    if (safeGrid) safeGrid.addEventListener('dblclick', onDbl);
    // 按住拖动（pointer 事件，鼠标/触屏通用）
    const onDown = (e, fromSafe) => {
      if (e.button !== 0 || bagDrag) return;
      if (e.target.closest('button')) return;   // 格内按钮优先
      const cell = e.target.closest(fromSafe ? '.safe-slot' : '.card-slot');
      if (!cell || !cell.dataset.stack) return;
      e.preventDefault();
      bagDrag = {
        name: cell.dataset.stack, fromSafe, cell,
        sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY,
        vx: 0, vy: 0, moved: false, ghost: null, card3d: null,
      };
      cell.classList.add('dragging');
      SDT.Sound.sfx('pick');
      window.addEventListener('pointermove', onBagDragMove);
      window.addEventListener('pointerup', onBagDragUp, { once: true });
    };
    bagGrid.addEventListener('pointerdown', (e) => onDown(e, false));
    if (safeGrid) safeGrid.addEventListener('pointerdown', (e) => onDown(e, true));
  }

  // 拖拽浮影：真正的卡面 + 跟随速度的 3D 姿态
  function makeBagGhost(name) {
    const o = game.ownedCards.find(x => x.card.name === name);
    if (!o || !bagDrag) return;
    const ghost = document.createElement('div');
    ghost.className = 'bag-ghost';
    ghost.innerHTML = `<div class="bag-ghost-3d">${SDT.Cards.cardHTML(o.card, 'sm', { hideCost: true })}</div>`;
    document.body.appendChild(ghost);
    bagDrag.ghost = ghost;
    bagDrag.card3d = ghost.querySelector('.bag-ghost-3d');
  }

  function bagDropTarget(x, y, srcCell) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const safeCell = el.closest('#ovBody .safe-grid .bag-slot');
    if (safeCell) return { kind: 'safe', el: safeCell };
    const cell = el.closest('#ovBody .bag-grid:not(.safe-grid) .bag-slot');
    if (!cell) return null;
    if (cell.classList.contains('card-slot') && cell !== srcCell) {
      return { kind: 'stack', el: cell, name: cell.dataset.stack };
    }
    return { kind: 'area', el: cell };   // 空格 / 物资格 = 放到卡牌区末尾
  }

  // 当前高亮的落点格：pointermove 是高频路径，用追踪变量替代每次全树查询 .drop-here
  let bagDropMarked = null;
  function clearBagDropMark() {
    if (bagDropMarked) { bagDropMarked.classList.remove('drop-here'); bagDropMarked = null; }
  }

  function onBagDragMove(e) {
    if (!bagDrag) return;
    const dx = e.clientX - bagDrag.lx, dy = e.clientY - bagDrag.ly;
    bagDrag.vx = bagDrag.vx * 0.72 + dx * 0.9;   // 平滑速度 → 3D 倾角
    bagDrag.vy = bagDrag.vy * 0.72 + dy * 0.9;
    bagDrag.lx = e.clientX; bagDrag.ly = e.clientY;
    if (!bagDrag.moved) {
      if (Math.hypot(e.clientX - bagDrag.sx, e.clientY - bagDrag.sy) < 5) return;
      bagDrag.moved = true;
      makeBagGhost(bagDrag.name);
    }
    if (bagDrag.ghost) {
      bagDrag.ghost.style.left = e.clientX + 'px';
      bagDrag.ghost.style.top = e.clientY + 'px';
      const ry = Math.max(-30, Math.min(30, bagDrag.vx * 1.5));
      const rx = Math.max(-22, Math.min(22, -bagDrag.vy * 1.4));
      bagDrag.card3d.style.transform =
        `translate(-50%, -62%) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) scale(1.07)`;
    }
    clearBagDropMark();
    const t = bagDropTarget(e.clientX, e.clientY, bagDrag.cell);
    if (t && t.el) { t.el.classList.add('drop-here'); bagDropMarked = t.el; }
  }

  function onBagDragUp(e) {
    window.removeEventListener('pointermove', onBagDragMove);
    clearBagDropMark();
    // 兜底清一次（战斗悬停等也用 drop-here 类；一次性查询开销可忽略）
    document.querySelectorAll('#ovBody .drop-here').forEach(el => el.classList.remove('drop-here'));
    const d = bagDrag;
    bagDrag = null;
    if (!d) return;
    d.cell.classList.remove('dragging');
    if (d.ghost) d.ghost.remove();
    if (!d.moved) return;   // 原地按住未拖动 = 无操作
    SDT.Sound.sfx('drop');
    const t = bagDropTarget(e.clientX, e.clientY, d.cell);
    if (!t) { showDiscardConfirm(d.name, d.fromSafe); return; }
    if (t.kind === 'safe') {
      if (!d.fromSafe) moveStackSafe(d.name, true);   // 拖入安全格
      return;
    }
    // 拖资源卡到珍珠盒上 = 直接存入（2026-09-17 留言「拖动资源卡到珍珠盒上可以把资源卡移动到珍珠盒内」）
    if (t.kind === 'stack' && !d.fromSafe && t.name === '珍珠盒') {
      const stack = cardStacks(false).find(st => st.card.name === d.name);
      if (!stack) return;
      if (stack.card.type !== '资源') {
        UI.log('[[icon:gem]] 珍珠盒只收资源卡（木材/口粮/钥匙/货币等）——点击珍珠盒可打开存放界面', 'warn');
        SDT.Sound.sfx('deny');
        showBackpack(true);
        return;
      }
      const boxes = game.ownedCards.filter(x => x.card && x.card.id === 'tt2-pearlbox').length;
      const cap = boxes * 9;
      const storedN = game.ownedCards.filter(x => x.stored && !x.pouchOf).length;
      if (storedN + stack.count > cap) {
        UI.log(`[[icon:gem]] 珍珠盒放不下了（${storedN}/${cap} 张）——先取出一些`, 'warn');
        SDT.Sound.sfx('deny');
        showBackpack(true);
        return;
      }
      stack.uids.forEach(uid => { const o = game.ownedCards.find(x => x.uid === uid); if (o) o.stored = 1; });
      UI.log(`[[icon:gem]] 【<b>${esc(stack.card.name)}</b>】×${stack.count} 已拖入珍珠盒——腾出 1 个背包格`, 'ok');
      SDT.Sound.sfx('gain');
      saveGame();
      showBackpack(true);
      return;
    }
    if (d.fromSafe) {
      // 从安全格拖回背包：落点之前插入并取出
      moveStackOrder(d.name, t.kind === 'stack' ? t.name : null);
      moveStackSafe(d.name, false);
      return;
    }
    if (t.kind === 'stack') moveStackOrder(d.name, t.name);
    else moveStackOrder(d.name, null);   // 空格/物资格 = 移到卡牌区末尾
    saveGame();
    showBackpack(true);
  }

  // ---------- 战后结算（battle.js 回调） ----------
  // win = true 胜利 / false 战败 / null 撤退。
  // 小怪战：使用过的卡进消耗口袋；BOSS 战：卡牌完好保留；
  // 注能消耗的卡（consumedUids）：无论战斗类型都进消耗口袋（可在火堆复原）。
  // 胜利 100% 掉宝箱（按所在环层 / BOSS 固定 BOSS宝箱），开完宝箱再续流。
  // ESM：循环导入下本模块体可能先于 game.session 执行，顶层读 game 会 TDZ，延迟到 boot 统一绑定
  function bindBagMixins() {
  const onBattleEnd = async function (opts, playedUids, win, consumedUids) {
    if (game.nestActive) return;   // 龙巢战斗结算由 game.nest 的总线订阅接管（一图战后流程不适用）
    UI.hideOverlay();
    if (win === false) { doDeath(); return; }
    // Item 16（2026-09-16 老板定版）：局内满足条件的牌 100% 进入消耗口袋（招式和装备）——
    // 「1/3 保留」改到离开对局（撤离结算）时统一结算，见 game.run.altar doExtract。
    // 衍生卡（如 闪金之锤）不能进消耗口袋（2026-09-15 留言）；职业卡与初始攻击仍直接消散。
    const toPocket = (uids, why) => {
      const moved = [];
      let gone = 0;
      uids.forEach(uid => {
        const i = game.ownedCards.findIndex(o => o.uid === uid);
        if (i < 0) return;   // 战斗内临时卡（初始攻击/发现/随机卡）战后消散，自动跳过
        const card = game.ownedCards[i].card;
        game.ownedCards.splice(i, 1);
        if (card.rarity === '职业' || SDT.Base.isSha(card)) { gone++; return; }
        if (card.rarity === '衍生') { gone++; return; }
        moved.push(card);
      });
      moved.forEach(card => pocketAdd(card));
      if ((moved.length || gone) && why) {
        UI.log(`[[icon:archive]] ${why}：<b>${moved.length}</b> 张卡牌进入消耗口袋` +
          (gone ? `，<b>${gone}</b> 张消散了（本局无法再用）` : '（本局无法再用）') +
          '，撤离结算时只有 1/3 能带回基地', 'sys');
      }
      return moved.length;
    };
    // Item 16 定版：所有战斗（含 BOSS）的消耗牌都进消耗口袋，撤离点统一 1/3 结算
    if (playedUids && playedUids.length) {
      toPocket(playedUids, '使用过的卡牌');
    }
    if (consumedUids && consumedUids.length) {
      toPocket(consumedUids, '注能消耗的卡牌');
    }
    // 「卡牌是消耗品」一次性教学（2026-09-19 关卡审查）：
    // 打出的卡不回背包、初始攻击/职业卡直接消散——这条核心规则此前只有战后台志提到过，
    // 新手首层打光 5 张初始攻击就会陷入无攻击牌死局。首胜结算后弹一次说明（按档位只弹一次）。
    // 2026-09-19 留言 #17：重做成大版图解页——卡面实物 + 箭头流向 + 图标分栏，不再挤小字
    const teachAmmoOnce = () => {
      const B = SDT.Base;
      if (!B || !B.data || B.data.ammoTaught) return;
      B.data.ammoTaught = true;
      B.save();
      game.state = 'modal';
      const shaCard = SDT.Cards.all().find(c => c.id === SDT.Cards.SHA.id) || SDT.Cards.SHA;
      UI.showOverlay('[[icon:cards]] 卡牌是消耗品', `
        <div class="ammo-teach">
          <section class="at-col">
            <div class="at-flow">
              <span class="at-card">${SDT.Cards.cardHTML(shaCard, 'sm')}</span>
              <span class="at-arrow">➜</span>
              <span class="at-node"><span class="at-ico">[[icon:pocket]]</span><b>消耗口袋</b></span>
            </div>
            <p class="at-txt">普通卡打出后<b>不会回到背包</b>，先进入消耗口袋——可在火堆/修鞋铺复原；撤离结算只有 <b class="gold">1/3</b> 能带回基地。</p>
          </section>
          <section class="at-col">
            <div class="at-flow">
              <span class="at-card">${SDT.Cards.cardHTML(shaCard, 'sm')}</span>
              <span class="at-arrow">➜</span>
              <span class="at-node gone"><span class="at-ico">[[icon:skull]]</span><b>直接消散</b></span>
            </div>
            <p class="at-txt">【初始攻击】与职业卡打出后<b>直接消散</b>——补给站的初始攻击 1 币 1 张，路过记得补弹。</p>
          </section>
          <section class="at-col">
            <div class="at-flow">
              <span class="at-node"><span class="at-ico">[[icon:archive]]</span><b>多开箱</b></span>
              <span class="at-dot">·</span>
              <span class="at-node"><span class="at-ico">[[icon:bag]]</span><b>常逛商店</b></span>
            </div>
            <p class="at-txt">弹药有限——多开宝箱、常逛商店补牌。祝顺利撤离。</p>
          </section>
        </div>
        <div class="ov-btns"><button class="ov-btn ok" data-act="ammoTeachOk">[[icon:check]] 知道了</button></div>`, 'discover');
      UI.act('ammoTeachOk', () => {
        UI.hideOverlay();
        game.state = 'idle';
        saveGame();
        UI.refresh(game);
      });
      UI.refresh(game);
    };
    // 开完宝箱后的续流：普通战/首脑战（第四层 boss 格发起）都回待机
    const settle = () => {
      // 战后保底传说（2026-09-09 玩法定版）：
      //   ① 首脑战胜利：额外 1 张传说卡；
      //   ② 击败巨兽「荒渊」（第 3/4 层精英）：30% 概率额外 1 张传说卡。
      // 都在整理背包之后结算（先让玩家清背包空间再领取）。
      const slewDragon = !opts.isBoss && (opts.foeNames || []).some(n => String(n).includes('巨兽'));
      let legends = 0;
      if (opts.isBoss && win === true) {
        legends = 1;
        // 击败首脑才消耗首脑格（编组前放弃不消耗，2026-09-09 玩法定版）
        game.visited = game.visited || {};
        game.visited[game.layerIdx + ',' + game.trackPos] = 1;
      }
      if (slewDragon && win === true && Random.random('loot') < 0.3) legends += 1;
      if (legends > 0) UI.log('[[icon:trophy]] 首脑宝库开启：额外奖励 <b>1 张传说卡</b>！', 'loot');
      for (let i = 0; i < legends; i++) {
        const pool = SDT.Cards.all().filter(c => c.rarity === '传说' && SDT.Cards.isRandomObtainable(c));
        const card = pool.length ? pool[Math.floor(Random.random('loot') * pool.length)] : null;
        if (card) game.grantCard(card);
      }
      game.state = 'idle';
      saveGame();
      UI.refresh(game);
      teachAmmoOnce();   // 首胜后一次性说明「卡牌是消耗品」（见上方 teachAmmoOnce 注释）
    };
    if (win !== true) {   // 撤退：不发宝箱、不发事件奖励
      game.pendingEventLoot = null;
      // 2026-09-07 留言：撤退要有文案和动画——复用启程过渡（撤离点场景）
      await showRunTransition({
        tone: 'exit', asset: 'scene-extract-bg',
        eyebrow: 'TACTICAL RETREAT', title: '全身而退',
        detail: opts.isBoss ? '你撤出了 BOSS战 · 已结算的战利品完好保存' : '撤出战斗 · 打出过的卡照常结算',
        duration: 1050,
      });
      UI.log('[[icon:runner]] ' + (opts.isBoss ? '你撤出了 BOSS战' : '你撤出了战斗（打出过的卡照常结算）'), 'sys');
      settle();
      return;
    }
    await showRunTransition({
      tone: opts.isBoss ? 'altar' : 'battle',
      asset: 'scene-battle-bg',
      eyebrow: opts.isBoss ? 'TARGET ELIMINATED' : 'AREA SECURED',
      title: opts.isBoss ? '首脑已击破' : '战斗胜利',
      detail: opts.isBoss ? '污染反应正在消退 · 准备整理战利品' : '威胁解除 · 正在回收战利品',
      duration: opts.isBoss ? 1350 : 1050,
    });
    UI.log(opts.isBoss ? '[[icon:trophy]] <b>BOSS战胜利！</b>' : '[[icon:trophy]] 战斗胜利！', 'ok');
    // 需求 #13：击败首脑后，第五层终局撤离点无条件放行
    if (opts.isBoss && win === true && !game.bossKilled) {
      game.bossKilled = true;
      UI.log('[[icon:exit]] 首脑已击破——第五层的<b>终局撤离点</b>已解锁，可无条件撤离', 'loot');
    }
    // 击杀统计/经验：按击败的敌人数计（BOSS 逐个记名，供祭坛征服者成就）
    const foeNames = (opts.foeNames && opts.foeNames.length) ? opts.foeNames : [opts.name || '敌人'];
    foeNames.forEach((n, i) => {
      SDT.Meta.track('kill', { boss: !!opts.isBoss && i === 0, name: n, cls: game.myClass });
    });
    // 事件奖励（如盗匪横行的中宝箱 ×2，开真宝箱）
    let eventChests = [];
    if (game.pendingEventLoot) {
      const loot = game.pendingEventLoot;
      game.pendingEventLoot = null;
      if (loot.items && loot.items.length) {
        UI.log(`[[icon:archive]] 事件奖励：<b>${esc(loot.text)}</b>`, 'loot');
        loot.items.forEach(it => game.addItem(it));
      }
      if (loot.chests && loot.chests.length) {
        UI.log(`[[icon:archive]] 事件奖励：<b>${esc(loot.text)}</b>`, 'loot');
        eventChests = loot.chests.map(k => ({ kind: k }));
      }
    }
    // 战胜 100% 掉宝箱（按所在环层 / BOSS 宝箱）
    const afterRewards = () => {
      settle();   // Item 16：BOSS 战后不再进入整理背包
    };
    const drops = SDT.Chests.rollDrops(opts);
    const all = eventChests.concat(drops);
    if (all.length) {
      UI.log(`[[icon:archive]] 战利品掉落：${SDT.Chests.dropText(all)}`, 'loot');
      SDT.Chests.open(game, all, afterRewards);
      return;
    }
    afterRewards();
  };
  // 战斗结束改经总线广播订阅（批次 5）；G.onBattleEnd 保留为无订阅方时的回退路径
  busOn('battle:end', onBattleEnd);
  game.onBattleEnd = onBattleEnd;
  }

function setBagReturnHook(fn) { bagReturnHook = typeof fn === 'function' ? fn : null; }
export { bindBagMixins, showBackpack, setBagReturnHook };
