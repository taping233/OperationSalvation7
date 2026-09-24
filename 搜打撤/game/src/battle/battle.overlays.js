/* 由 battle.view.js 拆出（2026-09-22 六文件重构批5）：独立弹层渲染（renderDeckSelection / renderGrave / renderBattleBag + 卡身份键）。
 * 逐字搬迁；本片不 import 壳（壳→片单向）；viewApi 反取已改 battle.core 具名直引。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
import { escAttr } from '../core/shared.js';
import { commands, getSnapshot, AFFIX_META, R, findCard } from './battle.core.js';
  const closeBagCmd = commands.closeBag;
  const useItemCmd = commands.useItem;
  const closeGrave = commands.closeGrave;
  const closeDeckView = commands.closeDeckView;
  const selectDeckCard = commands.selectDeckCard;
  const confirmDeck = commands.confirmDeck;
  const cancelDeck = commands.cancelDeck;
const cardIdentityKey = card => card && card.id
  ? `id:${card.id}`
  : `legacy:${card?.name || ''}|${card?.type || ''}|${card?.desc || ''}`;
const isStarterAttack = card => !!card && (card.id === 'starter-attack' || (!card.id && card.name === '初始攻击'));
  function renderDeckSelection(snapshot) {
    const { deckSelection } = snapshot;
    const selected = deckSelection.selected;
    const need = Math.min(deckSelection.need, deckSelection.cards.length);
    const isStartEquip = (card) => card && card.type === '装备' && /对战开始时/.test(String(card.desc || ''));
    const cardsHTML = deckSelection.cards.length
      ? deckSelection.cards.map(entry => {
          // 「对战开始时」装备已并入套牌池（2026-09-16 定版）：编入即生效，挂角标提示
          const startEquip = isStartEquip(entry.card);
          return `
          <div class="bt-card${selected.includes(entry.uid) ? ' sel' : ''}" data-act="bossSel" data-uid="${entry.uid}" title="点击 编入/移出 牌库${startEquip ? '——「对战开始时」装备：编入即在本场开战自动生效' : ''}">
            ${SDT.Cards.cardHTML(entry.card, 'sm')}
            ${startEquip ? '<span class="bt-count">[[icon:bolt]] 开战被动 · 编入即生效</span>' : ''}
          </div>`;
        }).join('')
      : '<p class="ov-empty">背包里没有可编入的非道具卡牌……</p>';
    const boss = deckSelection.boss;
    const affix = boss && boss.affix ? AFFIX_META[boss.affix] : null;
    const ready = selected.length >= need;
    UI.showOverlay('[[icon:demon]] BOSS战 · 编组牌库', `
      <p class="ov-stats">本局首脑：<b>${esc(boss && boss.name || '???')}</b>（${boss ? `${boss.atk}-${boss.maxHp || boss.hp}` : '?-?'}）——从背包选 <b>${deckSelection.need}</b> 张<b>招式 / 装备 / 能力卡</b>，与 <b>${deckSelection.starterCount}</b> 张初始攻击组成牌库 ·
        开局抽 ${R().battleStartDraw} 张 · 每回合开始抽 ${R().battleTurnDraw} 张 · 每回合固定 ${R().battleEnergy} 费</p>
      ${affix ? `<p class="ov-note">[[icon:question]] <b>${esc(boss.name)}</b> 词缀【${affix.icon} ${affix.name}】${esc(affix.desc)}</p>` : ''}
      ${deckSelection.max > R().bossDeckSize ? '<p class="ov-note">[[icon:eye]] 混沌之眼：牌库上限 +5——编入后可在 15 张基础上多选，最多编 ' + deckSelection.max + ' 张</p>' : ''}
      <p class="ov-note">[[icon:lock]] 固定编入：初始攻击 ×${deckSelection.starterCount}${deckSelection.starterCount < R().starterSha ? `（初始攻击不足 ${R().starterSha} 张——部分进消耗口袋了）` : ''}
        · [[icon:cross]] 道具 / 资源 / 事件卡与初始攻击不可选入 · [[icon:bolt]] 「对战开始时」装备编入即生效（卡面带角标）</p>
      ${deckSelection.cards.length < deckSelection.need ? `<p class="ov-note">[[icon:cross]] 背包可编卡牌不足 <b>${deckSelection.need}</b> 张（现有 ${deckSelection.cards.length} 张）——选完后按现有卡牌迎战首脑</p>` : ''}
      <h3 class="set-h">可选卡牌 <span class="bs-count">已选 ${selected.length} 张（至少 ${need}${deckSelection.max > deckSelection.need ? ' · 至多 ' + deckSelection.max : ''}）</span></h3>
      <div class="bt-hand">${cardsHTML}</div>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="bossGo" ${ready ? '' : 'disabled'}>${ready ? `[[icon:swords]] 开始战斗（牌库 ${selected.length + deckSelection.starterCount} 张）` : `还需选择 ${need - selected.length} 张…`}</button>
        <button class="ov-btn" data-act="bossCancel">↩ 放弃挑战</button>
      </div>`, true);
    UI.act('bossSel', data => selectDeckCard(data.uid));
    UI.act('bossGo', confirmDeck);
    UI.act('bossCancel', cancelDeck);
    UI.refresh(SDT.game);
  }

  function renderGrave(snapshot) {
    const cards = snapshot.grave.map(findCard).filter(Boolean);
    const byType = {};
    cards.forEach(entry => { byType[entry.card.type] = (byType[entry.card.type] || 0) + 1; });
    const statLine = Object.keys(byType).length
      ? Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => `${esc(type)} <b>${count}</b>`).join(' · ')
      : '（墓地还是空的——注能等效果消耗的牌会进入这里）';
    const byName = new Map();
    cards.forEach(entry => {
      const key = cardIdentityKey(entry.card);
      if (!byName.has(key)) byName.set(key, { card: entry.card, count: 0 });
      byName.get(key).count++;
    });
    const listHTML = [...byName.values()].map(stack => `
      <div class="bt-gy-row" title="${escAttr(stack.card.desc || '')}">
        <span>[[icon:cards]] <b>${esc(stack.card.name)}</b>${stack.count > 1 ? ` ×${stack.count}` : ''}</span>
        <span class="bt-gy-meta">${esc(stack.card.type)} · ${stack.card.cost}费 · ${esc(stack.card.rarity || '')}</span>
      </div>`).join('');
    UI.showOverlay(`${snapshot.opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${snapshot.turn} 回合 · [[icon:skull]] 墓地`, `
      <p class="ov-stats">被消耗的牌共 <b>${cards.length}</b> 张 —— ${statLine}</p>
      <div class="bt-gy-list">${listHTML}</div>
      <p class="ov-note">墓地中的牌<b>不会在牌库空后洗回</b>；打出的牌进弃牌堆（会洗回循环）。战胜 BOSS 后可在「整理背包」环节把这些牌放回背包或丢弃。</p>
      <div class="ov-btns"><button class="ov-btn ok" data-act="btGraveBack">↩ 返回战斗</button></div>`, true);
    UI.act('btGraveBack', closeGrave);
    UI.refresh(SDT.game);
  }

  // 牌库查看（BOSS 战专属，2026-09-13 留言：点击牌堆可看牌库中的卡）。
  // 2026-09-23 lint 批次补实现：battle.view.js 自引入起即调用本函数但定义从未在任何提交落地，
  // BOSS 战点牌堆（btDeck）会在 render 里抛 ReferenceError。行样式与 renderGrave 同构；
  // btDeckBack 关闭动作 battle.view.js 已全局接线，此处按 renderGrave 模式自注册一遍（UI.act 覆盖式，幂等）。
  function renderDeckPileView(snapshot) {
    const cards = snapshot.drawPile.map(findCard).filter(Boolean);
    const byType = {};
    cards.forEach(entry => { byType[entry.card.type] = (byType[entry.card.type] || 0) + 1; });
    const statLine = Object.keys(byType).length
      ? Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => `${esc(type)} <b>${count}</b>`).join(' · ')
      : '（牌库已经空了——弃牌堆洗回后才会补充）';
    const byName = new Map();
    cards.forEach(entry => {
      const key = cardIdentityKey(entry.card);
      if (!byName.has(key)) byName.set(key, { card: entry.card, count: 0 });
      byName.get(key).count++;
    });
    const listHTML = [...byName.values()].map(stack => `
      <div class="bt-gy-row" title="${escAttr(stack.card.desc || '')}">
        <span>[[icon:cards]] <b>${esc(stack.card.name)}</b>${stack.count > 1 ? ` ×${stack.count}` : ''}</span>
        <span class="bt-gy-meta">${esc(stack.card.type)} · ${stack.card.cost}费 · ${esc(stack.card.rarity || '')}</span>
      </div>`).join('');
    UI.showOverlay(`${snapshot.opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${snapshot.turn} 回合 · [[icon:cards]] 牌库`, `
      <p class="ov-stats">牌库剩余 <b>${cards.length}</b> 张 —— ${statLine}</p>
      <div class="bt-gy-list">${listHTML}</div>
      <p class="ov-note">查看牌库不消耗任何资源；牌库空后会<b>洗回弃牌堆</b>循环（墓地不会洗回）。</p>
      <div class="ov-btns"><button class="ov-btn ok" data-act="btDeckBack">↩ 返回战斗</button></div>`, true);
    UI.act('btDeckBack', closeDeckView);
    UI.refresh(SDT.game);
  }

  // 战斗背包（2026-09-09 老板：战斗中开背包使用道具；2026-09-09 玩法定版：
  // 新增「存入安全格」——撤离判负前把卡牌转移进安全格，失败抢运时才保得住）
  function renderBattleBag(snapshot) {
    const byName = new Map();
    (SDT.game.ownedCards || []).forEach(o => {
      if (!o.card || o.card.type !== '道具' || o.safe) return;
      const key = cardIdentityKey(o.card);
      if (!byName.has(key)) byName.set(key, { key, card: o.card, uids: [] });
      byName.get(key).uids.push(o.uid);
    });
    const stacks = [...byName.values()];
    const cardsHTML = stacks.length
      ? stacks.map(st => `
          <div class="bt-card bag-slot filled battle-bag-slot" data-act="btUseItem" data-uid="${st.uids[0]}"
            title="${escAttr(st.card.desc || st.card.name)}——点击使用">
            ${SDT.Cards.cardHTML(st.card, 'sm')}
            ${st.uids.length > 1 ? `<span class="bt-count" title="同名道具 ${st.uids.length} 件">×${st.uids.length}</span>` : ''}
          </div>`).join('')
      : '<p class="ov-empty">背包里没有道具卡……（道具卡可从宝箱 / 商店获得）</p>';
    // —— 安全格转移（同名堆叠整组存入；容量在基地用口粮升级）——
    const cap = (SDT.game.safeCap && SDT.game.safeCap()) || 0;
    const used = (SDT.game.safeUsed && SDT.game.safeUsed()) || 0;
    const bySafe = new Map();
    (SDT.game.ownedCards || []).forEach(o => {
      if (!o.card || o.safe || o.stored || isStarterAttack(o.card)) return;   // 珍珠盒存放中的卡不在此列出（2026-09-10 #29）
      const key = cardIdentityKey(o.card);
      if (!bySafe.has(key)) bySafe.set(key, { key, card: o.card, uids: [] });
      bySafe.get(key).uids.push(o.uid);
    });
    const safeStacks = [...bySafe.values()];
    const room = Math.max(0, cap - used);
    const safeHTML = safeStacks.length
      ? safeStacks.map(st => {
          const fits = st.uids.length <= room;
          return `<div class="bt-card bag-slot filled battle-bag-slot${fits ? '' : ' off'}" data-act="btSafeMove" data-card-key="${escAttr(st.key)}"
            title="${escAttr(`将「${st.card.name}」×${st.uids.length} 整组存入安全格（撤离失败时安全运回）${fits ? '' : '——安全格空位不足'}`)}">
            ${SDT.Cards.cardHTML(st.card, 'sm')}
            ${st.uids.length > 1 ? `<span class="bt-count">×${st.uids.length}</span>` : ''}
            <span class="bt-count" style="top:auto;bottom:3px">[[icon:lock]] 存入</span>
          </div>`;
        }).join('')
      : '<p class="ov-empty">背包里没有可存入的卡牌。</p>';
    UI.showOverlay(`${snapshot.opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · 第 ${snapshot.turn} 回合 · [[icon:bag]] 战斗背包`, `
      <p class="ov-stats">点击道具卡直接使用——回复类 / 能源结晶 / 神秘药水 / 口粮木材战斗内生效，其余道具战后回地图再使</p>
      <div class="bag-grid battle-bag-grid">${cardsHTML}</div>
      <p class="ov-stats">[[icon:lock]] 安全格 <b>${used}/${cap}</b>（空位 ${room}）——点击卡牌把整组存入，撤离失败时只有安全格里的卡牌会抢运回基地</p>
      <div class="bag-grid battle-bag-grid">${safeHTML}</div>
      <div class="ov-btns"><button class="ov-btn ok" data-act="btBagBack">↩ 返回战斗（B）</button></div>`, true);
    (() => { const card = document.querySelector('#overlay .card'); if (card) card.classList.add('battle-bag'); })();
    UI.act('btUseItem', (d) => useItemCmd(d.uid));
    UI.act('btSafeMove', (d) => {
      const g = SDT.game;
      const group = (g.ownedCards || []).filter(o => o.card && !o.safe && cardIdentityKey(o.card) === d.cardKey);
      if (!group.length) return;
      const name = group[0].card.name;
      const free = Math.max(0, ((g.safeCap && g.safeCap()) || 0) - ((g.safeUsed && g.safeUsed()) || 0));
      if (group.length > free) { UI.log(`[[icon:lock]] 安全格空位不足（${free} 格）——存不进「${esc(name)}」×${group.length}`, 'warn'); SDT.Sound.sfx('deny'); return; }
      group.forEach(o => { o.safe = true; });
      UI.log(`[[icon:lock]] 【${esc(name)}】×${group.length} 已存入安全格（撤离失败时安全运回）`, 'sys');
      if (g.saveGame) g.saveGame();
      renderBattleBag(getSnapshot());
    });
    UI.act('btBagBack', closeBagCmd);
    UI.refresh(SDT.game);
  }

export { renderDeckSelection, renderGrave, renderBattleBag, renderDeckPileView };
