/* 由 battle.view.js 拆出（2026-09-22 六文件重构批5）：独立弹层渲染（renderDeckSelection / renderGrave / renderBattleBag + 卡身份键）。
 * 逐字搬迁；本片不 import 壳（壳→片单向）；viewApi 反取已改 battle.core 具名直引。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { createBattleDecisionPresenter } from './battle.decision-shell.js';
import { battlePileBodyHTML, pileDetailHTML, cardIdentityKey } from './battle.decision-content.js';
import { esc } from '../../core/shared.js';
import { escAttr } from '../../core/shared.js';
import { commands, getSnapshot, AFFIX_META, R, findEffectiveCard as findCard } from '../core/battle.core.js';
  const closeBagCmd = commands.closeBag;
  const useItemCmd = commands.useItem;
  const closeGrave = commands.closeGrave;
  const closeDeckView = commands.closeDeckView;
  const selectDeckCard = commands.selectDeckCard;
  const confirmDeck = commands.confirmDeck;
  const cancelDeck = commands.cancelDeck;
const isStarterAttack = card => !!card && (card.id === 'starter-attack' || (!card.id && card.name === '初始攻击'));
const showBattleDecision = createBattleDecisionPresenter({ UI, getSnapshot, R });


function installPileInspection(stacks) {
  UI.act('btInspectPile', data => {
    const index = +data.i;
    const stack = stacks[index];
    const root = UI.el?.ovBody?.querySelector('.battle-decision[data-decision-kind="pile"]');
    if (!stack || !root) return;
    root.querySelectorAll('.battle-pile-card').forEach(button => {
      const selected = +button.dataset.i === index;
      button.classList.toggle('is-inspected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const detail = root.querySelector('.battle-decision-inspect');
    if (detail) detail.outerHTML = pileDetailHTML(stack);
  });
}
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
          <button type="button" class="bt-card${selected.includes(entry.uid) ? ' sel' : ''}" data-act="bossSel" data-uid="${entry.uid}" aria-label="编入或移出 ${escAttr(entry.card.name)}" aria-pressed="${selected.includes(entry.uid)}" title="点击 编入/移出 牌库${startEquip ? '——「对战开始时」装备：编入即在本场开战自动生效' : ''}">
            ${SDT.Cards.cardHTML(entry.card, 'sm')}
            ${startEquip ? '<span class="bt-count">[[icon:bolt]] 开战被动 · 编入即生效</span>' : ''}
          </button>`;
        }).join('')
      : '<p class="ov-empty">背包里没有可编入的非道具卡牌……</p>';
    const boss = deckSelection.boss;
    const affix = boss && boss.affix ? AFFIX_META[boss.affix] : null;
    const ready = selected.length >= need;
    showBattleDecision('[[icon:demon]] BOSS战 · 编组牌库', `
      <div class="ov-stats boss-formation-summary"><div><span class="boss-formation-kicker">本局首脑</span><b>${esc(boss && boss.name || '???')}</b><span>${boss ? `攻击 ${boss.atk} · 生命 ${boss.maxHp || boss.hp}` : '属性未知'}</span></div><div class="boss-formation-progress"><strong>${selected.length}<small> / ${need}</small></strong><span>已编入${deckSelection.max > deckSelection.need ? ` · 上限 ${deckSelection.max}` : ''}</span></div></div>
      ${affix ? `<p class="boss-formation-affix"><b>${affix.icon} ${esc(affix.name)}</b><span>${esc(affix.desc)}</span></p>` : ''}
      <p class="boss-formation-instruction">选择招式、装备或能力卡。初始攻击 ×${deckSelection.starterCount} 已固定编入。</p>
      ${deckSelection.cards.length < deckSelection.need ? `<p class="ov-note">携带 ${deckSelection.cards.length} 张可编卡牌，全部选入后即可迎战。</p>` : ''}
      <details class="boss-formation-rules"><summary>查看编组与抽牌规则</summary><p>开局抽 ${R().battleStartDraw} 张 · 每回合抽 ${R().battleTurnDraw} 张 · 每回合 ${R().battleEnergy} 能量。</p><p>道具、资源、事件与初始攻击不可选入。固定初始攻击不足部分由本场补给，不占背包格。「对战开始时」装备编入即生效。</p>${deckSelection.max > R().bossDeckSize ? `<p>混沌之眼：可编牌库上限增加 5，最多选择 ${deckSelection.max} 张。</p>` : ''}</details>
      <h3 class="set-h">携带卡牌 <span class="bs-count">点击编入 / 再点移出</span></h3>
      <div class="bt-hand">${cardsHTML}</div>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="bossGo" ${ready ? '' : 'disabled'}>${ready ? `[[icon:swords]] 开始战斗（牌库 ${selected.length + deckSelection.starterCount} 张）` : `还需选择 ${need - selected.length} 张…`}</button>
        <button class="ov-btn" data-act="bossCancel">↩ 放弃挑战</button>
      </div>`, true, snapshot);
    UI.act('bossSel', data => selectDeckCard(data.uid));
    UI.act('bossGo', confirmDeck);
    UI.act('bossCancel', cancelDeck);
    UI.refresh(SDT.game);
  }

  function renderGrave(snapshot) {
    const cards = snapshot.grave.map(findCard).filter(Boolean);
    const { html, stacks } = battlePileBodyHTML({ cards, cardHTML:SDT.Cards.cardHTML, kind:'grave', isBoss:!!snapshot.opts.isBoss });
    showBattleDecision('[[icon:skull]] 消耗牌', html, true, snapshot);
    UI.act('btGraveBack', closeGrave);
    installPileInspection(stacks);
    UI.refresh(SDT.game);
  }

  // 牌库查看（BOSS 战专属，2026-09-13 留言：点击牌堆可看牌库中的卡）。
  // 2026-09-23 lint 批次补实现：battle.view.js 自引入起即调用本函数但定义从未在任何提交落地，
  // BOSS 战点牌堆（btDeck）会在 render 里抛 ReferenceError。行样式与 renderGrave 同构；
  // btDeckBack 关闭动作 battle.view.js 已全局接线，此处按 renderGrave 模式自注册一遍（UI.act 覆盖式，幂等）。
  function renderDeckPileView(snapshot) {
    const cards = snapshot.drawPile.map(findCard).filter(Boolean);
    const { html, stacks } = battlePileBodyHTML({ cards, cardHTML:SDT.Cards.cardHTML, kind:'deck', isBoss:!!snapshot.opts.isBoss });
    showBattleDecision('[[icon:cards]] 剩余牌库', html, true, snapshot);
    UI.act('btDeckBack', closeDeckView);
    installPileInspection(stacks);
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
      ? stacks.map((st, i) => `<div class="battle-bag-entry">
          <button type="button" class="bt-card bag-slot filled battle-bag-slot" data-act="btUseItem" data-uid="${st.uids[0]}" aria-label="使用 ${escAttr(st.card.name)}"
            title="${escAttr(st.card.desc || st.card.name)}——点击使用">
            ${SDT.Cards.cardHTML(st.card, 'sm')}
            ${st.uids.length > 1 ? `<span class="bt-count" title="同名道具 ${st.uids.length} 件">×${st.uids.length}</span>` : ''}
          </button><button type="button" class="battle-bag-inspect" data-act="btInspectBag" data-i="${i}">查看规则</button></div>`).join('')
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
      ? safeStacks.map((st, i) => {
          const fits = st.uids.length <= room;
          return `<div class="battle-bag-entry"><button type="button" class="bt-card bag-slot filled battle-bag-slot${fits ? '' : ' off'}" data-act="btSafeMove" data-card-key="${escAttr(st.key)}" aria-label="存入安全格 ${escAttr(st.card.name)}，${st.uids.length} 张${fits ? '' : '，空位不足'}"
            title="${escAttr(`将「${st.card.name}」×${st.uids.length} 整组存入安全格（撤离失败时安全运回）${fits ? '' : '——安全格空位不足'}`)}">
            ${SDT.Cards.cardHTML(st.card, 'sm')}
            ${st.uids.length > 1 ? `<span class="bt-count">×${st.uids.length}</span>` : ''}
            <span class="bt-count" style="top:auto;bottom:3px">[[icon:lock]] 存入</span>
          </button><button type="button" class="battle-bag-inspect" data-act="btInspectBag" data-i="${stacks.length + i}">查看规则</button></div>`;
        }).join('')
      : '<p class="ov-empty">背包里没有可存入的卡牌。</p>';
    const inspectCards = [...stacks, ...safeStacks];
    showBattleDecision(`${snapshot.opts.isBoss ? '[[icon:demon]] BOSS战' : '[[icon:swords]] 遭遇战'} · [[icon:bag]] 战斗背包`, `
      ${inspectCards.length ? `<p class="ov-note">查看规则只展开详情；使用或存入需点击卡牌。</p>${pileDetailHTML({ card:inspectCards[0].card, count:inspectCards[0].uids.length })}` : ''}
      <section class="battle-bag-section"><h4>使用道具</h4><p class="ov-stats">点击使用；无法在战斗中使用的道具需回地图使用。</p>
      <div class="bag-grid battle-bag-grid">${cardsHTML}</div>
      </section><section class="battle-bag-section"><h4>保护卡牌 <span>安全格 ${used}/${cap} · 空位 ${room}</span></h4>
      <p class="ov-stats">点击把整组存入安全格；撤离失败时，安全格里的卡牌抢运回基地。</p>
      <div class="bag-grid battle-bag-grid">${safeHTML}</div></section>
      <div class="ov-btns"><button class="ov-btn ok" data-act="btBagBack">↩ 返回战斗（B）</button></div>`, true, snapshot);
    (() => { const card = document.querySelector('#overlay .card'); if (card) card.classList.add('battle-bag'); })();
    UI.act('btUseItem', (d) => useItemCmd(d.uid));
    UI.act('btInspectBag', data => {
      const stack = inspectCards[+data.i];
      const detail = UI.el?.ovBody?.querySelector('.battle-decision[data-decision-kind="bag"] .battle-decision-inspect');
      if (stack && detail) detail.outerHTML = pileDetailHTML({ card:stack.card, count:stack.uids.length });
    });
    UI.act('btSafeMove', (d) => {
      const g = SDT.game;
      const group = (g.ownedCards || []).filter(o => o.card && !o.safe && !o.stored && cardIdentityKey(o.card) === d.cardKey);
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

export { renderDeckSelection, renderGrave, renderBattleBag, renderDeckPileView, showBattleDecision };
