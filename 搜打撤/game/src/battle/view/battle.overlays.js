/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
import { bindBattlePageAction } from './battle.page-activity.js';
import { BATTLE_CONSUMED_LABEL, consumedPileUids } from './battle.piles.view.js';
/* 由 battle.view.js 拆出（2026-09-22 六文件重构批5）：独立弹层渲染（renderDeckSelection / renderGrave / renderDeckPileView）。
 * 逐字搬迁；本片不 import 壳（壳→片单向）；viewApi 反取已改 battle.core 具名直引。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { createBattleDecisionPresenter, bindBattleDecisionInspection } from './battle.decision-shell.js';
import { battlePileBodyHTML } from './battle.decision-content.js';
import { esc } from '../../core/shared.js';
import { escAttr } from '../../core/shared.js';
import { commands, getSnapshot, AFFIX_META, R, findEffectiveCard as findCard } from '../core/battle.core.js';
  const closeGrave = commands.closeGrave;
  const closeDeckView = commands.closeDeckView;
  const selectDeckCard = commands.selectDeckCard;
  const confirmDeck = commands.confirmDeck;
  const cancelDeck = commands.cancelDeck;
const showBattleDecision = createBattleDecisionPresenter({ UI, getSnapshot, R });


  function renderDeckSelection(snapshot) {
    const { deckSelection } = snapshot;
    const selected = deckSelection.selected;
    const need = Math.min(deckSelection.need, deckSelection.cards.length);
    const excess = Math.max(0, selected.length - deckSelection.max);
    const ready = selected.length >= need && excess === 0;
    const confirmText = excess > 0 ? `超出上限，请移出 ${excess} 张…`
      : ready ? `开始战斗（牌库 ${selected.length + deckSelection.starterCount} 张）` : `还需选择 ${need - selected.length} 张…`;
    const capacitySummary = `已编入${deckSelection.max > deckSelection.need ? ` · 上限 ${deckSelection.max}` : ''}`;
    const capacityBonus = deckSelection.max - R().bossDeckSize;
    const capacityRuleText = capacityBonus > 0 ? `混沌之眼：可编牌库上限增加 ${capacityBonus}，最多选择 ${deckSelection.max} 张。` : '';
    const isStartEquip = (card) => card && card.type === '装备' && /对战开始时/.test(String(card.desc || ''));
    const cardsHTML = deckSelection.cards.length
      ? deckSelection.cards.map((entry, index) => {
          // 「对战开始时」装备已并入套牌池（2026-09-16 定版）：编入即生效，挂角标提示
          const startEquip = isStartEquip(entry.card);
          return `
          <div class="battle-select-slot"><button type="button" class="bt-card${selected.includes(entry.uid) ? ' sel' : ''}" data-act="bossSel" data-uid="${escAttr(entry.uid)}" aria-label="编入或移出 ${escAttr(entry.card.name)}" aria-pressed="${selected.includes(entry.uid)}" title="点击 编入/移出 牌库${startEquip ? '——「对战开始时」装备：编入即在本场开战自动生效' : ''}">
            ${SDT.Cards.cardHTML(entry.card, 'sm')}
            <span class="battle-card-action boss-selection-state">${selected.includes(entry.uid) ? '已编入' : '点击编入'}</span>
            ${startEquip ? '<span class="boss-start-note">开战自动装配 · 占装备栏</span>' : ''}
          </button><button type="button" class="battle-card-inspect" data-act="btDecisionInspect" data-i="${index}" aria-label="查看 ${escAttr(entry.card.name)} 详情">查看详情</button></div>`;
        }).join('')
      : '<p class="ov-empty">背包里没有可编入的非道具卡牌……</p>';
    const boss = deckSelection.boss;
    const affix = boss && boss.affix ? AFFIX_META[boss.affix] : null;
    const mounted = /** @type {BattleElement} */ (UI.el.ovBody.querySelector('[data-decision-kind="formation"]'));
    const poolKey = JSON.stringify(deckSelection.cards.map(entry => [entry.uid, entry.card]));
    if (mounted?._battleToken === snapshot.battleToken && mounted._formationPoolKey === poolKey) {
      for (const button of /** @type {NodeListOf<BattleElement>} */ (mounted.querySelectorAll('[data-act="bossSel"]'))) {
        const on = selected.includes(button.dataset.uid);
        button.classList.toggle('sel', on);
        button.setAttribute('aria-pressed', String(on));
        button.querySelector('.boss-selection-state').textContent = on ? '已编入' : '点击编入';
      }
      /** @type {BattleElement} */ (mounted.querySelector('.boss-formation-progress strong')).innerHTML = `${selected.length}<small> / ${need}</small>`;
      mounted.querySelector('[data-formation-capacity]').textContent = capacitySummary;
      const capacityRule = /** @type {BattleElement} */ (mounted.querySelector('[data-formation-capacity-rule]'));
      capacityRule.textContent = capacityRuleText;
      capacityRule.hidden = !capacityRuleText;
      const confirm = /** @type {HTMLButtonElement} */ (mounted.querySelector('[data-act="bossGo"]'));
      confirm.disabled = !ready;
      confirm.textContent = confirmText;
      return;
    }
    showBattleDecision('[[icon:demon]] BOSS战 · 编组牌库', `
      <div class="ov-stats boss-formation-summary"><div><span class="boss-formation-kicker">本局首脑</span><b>${esc(boss && boss.name || '???')}</b><span>${boss ? `攻击 ${boss.atk} · 生命 ${boss.maxHp || boss.hp}` : '属性未知'}</span></div><div class="boss-formation-progress"><strong>${selected.length}<small> / ${need}</small></strong><span data-formation-capacity>${capacitySummary}</span></div></div>
      ${affix ? `<p class="boss-formation-affix"><b>${affix.icon} ${esc(affix.name)}</b><span>${esc(affix.desc)}</span></p>` : ''}
      <p class="boss-formation-instruction">选择招式、装备或能力卡。初始攻击 ×${deckSelection.starterCount} 已固定编入。开战装备占用装备栏，生效即消耗。</p>
      ${deckSelection.cards.length < deckSelection.need ? `<p class="ov-note">携带 ${deckSelection.cards.length} 张可编卡牌，全部选入后即可迎战。</p>` : ''}
      <details class="boss-formation-rules"><summary>查看编组与抽牌规则</summary><p>开局抽 ${R().battleStartDraw} 张 · 每回合抽 ${R().battleTurnDraw} 张 · 每回合 ${R().battleEnergy} 能量。</p><p>道具、资源、事件与初始攻击不可选入。固定初始攻击不足部分由本场补给，不占背包格。「对战开始时」装备编入即生效。</p><p data-formation-capacity-rule ${capacityRuleText ? '' : 'hidden'}>${capacityRuleText}</p></details>
      <h3 class="set-h">携带卡牌 <span class="bs-count">点击编入 / 再点移出</span></h3>
      <div class="bt-hand boss-formation-grid" data-selection-scroll>${cardsHTML}</div>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="bossGo" ${ready ? '' : 'disabled'}>${ready ? '[[icon:swords]] ' : ''}${confirmText}</button>
        <button class="ov-btn" data-act="bossCancel">↩ 放弃挑战</button>
      </div>`, true, snapshot);
    bindBattlePageAction({ UI, getSnapshot, snapshot }, 'bossSel', data => selectDeckCard(data.uid));
    bindBattleDecisionInspection({ UI, getSnapshot, snapshot, cards:deckSelection.cards.map(entry => entry.card) });
    const formation = /** @type {BattleElement} */ (UI.el.ovBody.querySelector('[data-decision-kind="formation"]'));
    if (formation) formation._formationPoolKey = poolKey;
    bindBattlePageAction({ UI, getSnapshot, snapshot }, 'bossGo', confirmDeck);
    bindBattlePageAction({ UI, getSnapshot, snapshot }, 'bossCancel', cancelDeck);
    UI.refresh(SDT.game);
  }

  function renderGrave(snapshot) {
    const cards = consumedPileUids(snapshot).map(findCard).filter(Boolean);
    const { html, stacks } = battlePileBodyHTML({ cards, cardHTML:SDT.Cards.cardHTML, kind:'grave', isBoss:!!snapshot.opts.isBoss });
    showBattleDecision(`[[icon:consumed-pile]] ${BATTLE_CONSUMED_LABEL}`, html, true, snapshot);
    bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btGraveBack', closeGrave);
    bindBattleDecisionInspection({ UI, getSnapshot, cards:stacks.map(stack => stack.card), snapshot });
    UI.refresh(SDT.game);
  }

  // 两种战斗共用只读牌库网格；展示排序与实际抽牌顺序分离。
  function renderDeckPileView(snapshot) {
    const cards = snapshot.drawPile.map(findCard).filter(Boolean);
    const { html, stacks } = battlePileBodyHTML({ cards, cardHTML:SDT.Cards.cardHTML, kind:'deck', isBoss:!!snapshot.opts.isBoss });
    showBattleDecision('[[icon:draw-pile]] 剩余牌库', html, true, snapshot);
    bindBattlePageAction({ UI, getSnapshot, snapshot }, 'btDeckBack', closeDeckView);
    bindBattleDecisionInspection({ UI, getSnapshot, cards:stacks.map(stack => stack.card), snapshot });
    UI.refresh(SDT.game);
  }

export { renderDeckSelection, renderGrave, renderDeckPileView, showBattleDecision };
