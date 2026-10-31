import { uiDisclosure } from './ui-disclosure.js';
import { runMementoHTML } from './run-memento-view.js';
import { esc, escAttr } from '../core/shared.js';
import '../../css/extraction-rewards.css';

const countOf = stacks => stacks.reduce((n, stack) => n + stack.count, 0);
const rarities = ['古朴', '稀有', '史诗', '传说', '棱彩'];
const smartDescription = '按估值从高到低入库，同估值按背包原次序。';
const rarityOfCard = (card, rarityOf) => rarityOf?.(card) || card.rarity || '古朴';
export const extractionRarityRank = (card, rarityOf) => rarities.indexOf(rarityOfCard(card, rarityOf));

// Presentation only. Original indices survive the rarity sort; commands still own capacity and value order.
function cardGrid(stacks, { cardHTML, rarityOf, action, room = 0, pending = false, awaitingDeposit = false }) {
  return stacks.map((stack, index) => ({ ...stack, index, rarity: rarityOfCard(stack.card, rarityOf) }))
    .sort((a, b) => rarities.indexOf(b.rarity) - rarities.indexOf(a.rarity) || a.index - b.index)
    .map(({ card, count, index, rarity }) => {
      const take = Math.min(count, Math.max(0, room));
      const canDeposit = take > 0 && !awaitingDeposit;
      const availability = awaitingDeposit ? '请先重试上次入库' : take ? `可入库 ${take}/${count} 张` : '仓库已满';
      return `<article class="exr-item" data-exr-key="${escAttr(JSON.stringify(card))}" data-rarity="${escAttr(rarity)}">
        <div class="exr-item-meta"><span class="exr-rarity-mark" aria-label="${escAttr(rarity)}"></span><b>×${count}</b></div>
        <button type="button" class="exr-card-preview" data-act="${action}" data-i="${index}" aria-label="查看${escAttr(card.name)}详情，${escAttr(rarity)}，${count}张">
          <span class="exr-card-face" inert aria-hidden="true">${cardHTML(card, 'sm')}</span>
        </button>
        ${pending ? `<button type="button" class="exr-deposit ext-card${canDeposit ? '' : ' off'}" data-act="exStash" data-i="${index}" ${canDeposit ? '' : 'disabled'} aria-disabled="${!canDeposit}" aria-label="${escAttr(card.name)} · ${availability}" title="${availability}"><span>${awaitingDeposit ? '等待上次入库' : take ? (take < count ? `入库 ${take}/${count} 张` : `入库 ${take} 张`) : '仓库已满'}</span></button>` : ''}
      </article>`;
    }).join('');
}

function resourcesHTML(wood, rations) {
  return `<div class="exr-resources"><div><span>[[icon:wood]] 木材</span><b>×${wood}</b></div><div><span>[[icon:bread]] 口粮</span><b>×${rations}</b></div></div>`;
}

function pocketHTML({ pocketKept, pocketLost, pocketRuleLost = 0, keptPocket = [], compact = false }) {
  return `<section class="exr-pocket"><div class="exr-pocket-heading"><h3>[[icon:pocket]] 待复原</h3><p class="exr-pocket-count"><b>${pocketKept}</b><small> 张</small></p></div>
    ${uiDisclosure({ className:'exr-pocket-list', label:`复原说明${!compact && keptPocket.length ? '与卡牌' : ''}`, content:`<p>已送至基地消耗区，用钥匙复原后才能携带。</p><p class="exr-pocket-loss">逐张 1/3 概率保留 · 概率散失 ${Math.max(0, pocketLost - pocketRuleLost)} 张${pocketRuleLost ? `；初始攻击/职业卡 ${pocketRuleLost} 张不可带回` : ''}</p>
    ${!compact && keptPocket.length ? `<ul>${keptPocket.map((s, i) => `<li><button type="button" data-act="exPocketInspect" data-i="${i}">${esc(s.card.name)} <b>×${s.count}</b></button></li>`).join('')}</ul>` : ''}` })}</section>`;
}

function capacityHTML(used, cap, room) {
  const percent = cap > 0 ? Math.min(100, Math.max(0, used / cap * 100)) : 100;
  return `<div class="exr-capacity"><div><span>[[icon:archive]] 仓库容量</span><strong>${used}<small> / ${cap} 格</small></strong></div><div class="exr-meter" role="meter" aria-label="仓库容量" aria-valuemin="0" aria-valuemax="${cap}" aria-valuenow="${used}"><i style="width:${percent}%"></i></div><p>${room ? `还能入库 <b>${room}</b> 张` : '仓库已满'}</p><p>卡牌每张、符文每块各占1格</p></div>`;
}

function growthHTML(receipt) {
  const growth = receipt.growth;
  if (!growth?.before || !growth?.after) return '';
  const { before, after } = growth;
  const need = Math.max(1, Number(growth.nextLevelXp) || 1);
  const xp = Math.min(need, Math.max(0, Number(after.xp) || 0));
  const percent = growth.maxed ? 100 : xp / need * 100;
  const effects = (growth.effects || []).filter(effect => effect.after > effect.before);
  return `<section class="exr-growth" aria-label="人物成长">
    <div class="exr-growth-heading"><b>${esc(growth.characterName || '人物')}</b><span>${before.lv === after.lv ? `Lv.${after.lv}` : `Lv.${before.lv} → Lv.${after.lv}`}${growth.maxed ? ' · MAX' : ''}</span></div>
    <div class="exr-growth-progress" role="progressbar" aria-label="结算后人物经验" aria-valuemin="0" aria-valuemax="${growth.maxed ? 100 : need}" aria-valuenow="${growth.maxed ? 100 : xp}"><i style="width:${percent}%"></i></div>
    <p class="exr-growth-note">${growth.maxed ? '已满级' : `${xp} / ${need} XP`}</p>
    ${effects.length ? `<ul class="exr-growth-effects">${effects.map(effect => `<li><span>${esc(effect.label)}</span><b>+${effect.before} → +${effect.after}</b></li>`).join('')}</ul>` : ''}
  </section>`;
}

/** @typedef {import('../hub/game.store.types.js').CardSnapshot} ExtractionCard
 * @typedef {{card: ExtractionCard, count: number}} ExtractionStack
 * @typedef {{cardHTML: (card: ExtractionCard, size: string) => string, rarityOf: (card: ExtractionCard) => string}} ExtractionRenderers
 * @typedef {Partial<ReturnType<typeof import('../hub/extraction.commands.js').buildExtractionReceipt>>} ExtractionReceipt
 */
/** @param {Partial<ExtractionRenderers & {remainingCards: ExtractionStack[], savedCards: ExtractionStack[], keptPocket: ExtractionStack[], pocketKept: number, pocketLost: number, pocketRuleLost: number, wood: number, rations: number, stashUsed: number, stashCap: number, room: number, coins: number, shaN: number, starterSha: number, otherN: number, broughtByName: Map<string, number>, sourceIdentityVersion: 1, notice: string, confirmFinish: boolean, pendingDepositCount: number}>} [options] */
export function extractionStashHTML({ remainingCards = [], savedCards = [], keptPocket = [], pocketKept = 0, pocketLost = 0, pocketRuleLost = 0,
  wood = 0, rations = 0, stashUsed = 0, stashCap = 0, room = 0, coins = 0, shaN = 0, starterSha = 0, otherN = 0,
  cardHTML, rarityOf, notice = '', confirmFinish = false, pendingDepositCount = 0 } = {}) {
  const remaining = countOf(remainingCards), saved = countOf(savedCards);
  const awaitingDeposit = pendingDepositCount > 0;
  const confirming = confirmFinish && remaining > 0 && !awaitingDeposit;
  const canStore = Math.min(remaining, Math.max(0, room));
  const allFit = remaining > 0 && canStore === remaining;
  const bulk = awaitingDeposit
    ? `<p>请先重试上次入库，确认结果后可继续整理。</p><button type="button" class="exr-button exr-primary" data-act="exRetryStash">重试上次入库 ${pendingDepositCount} 张</button>`
    : !remaining ? ''
    : `${allFit ? `<button type="button" class="exr-button exr-primary" data-act="exAll">全部入库 <b>${remaining} 张</b></button>` : ''}
      <button type="button" class="exr-button ${allFit ? 'exr-secondary' : 'exr-primary'}" data-act="exRarity" ${canStore ? '' : 'disabled'} title="优先入库高稀有度卡牌，同稀有度按背包原顺序">按稀有度入库${canStore ? ` ${canStore} 张` : ''}</button>
      ${!allFit ? `<button type="button" class="exr-button exr-secondary" data-act="exSmart" ${canStore ? '' : 'disabled'} title="${smartDescription}">按估值入库</button>` : ''}`;
  return `<div class="pg exr-page sdt-feedback-theme" id="exMain" data-unclaimed-cards="${remaining}" data-reveal="${!notice}">
    <header class="exr-header"><div><h2 class="exr-success-title">整理战利品</h2></div></header>
    <div class="exr-layout"><section class="exr-loot" aria-label="本次战利品">
      <div class="exr-section-title"><div><h3>待入库 <b>${remaining}</b><small> 张</small></h3></div></div>
      <p class="exr-notice" role="status" aria-live="polite">${esc(notice)}</p>
      <div class="exr-card-scroll"><div class="exr-card-grid">${remaining ? cardGrid(remainingCards, { cardHTML, rarityOf, action: 'exInspect', pending: true, room, awaitingDeposit }) : `<div class="exr-empty"><span>[[icon:archive]]</span><h3>${saved ? '卡牌已妥善入库' : '本次没有待入库卡牌'}</h3></div>`}</div>
        ${saved ? `<details class="exr-saved-shelf"><summary>[[icon:check]] 本次已入库 ${saved} 张 </summary><div class="exr-card-grid">${cardGrid(savedCards, { cardHTML, rarityOf, action: 'exSavedInspect' })}</div></details>` : ''}
      </div>
    </section><aside class="exr-sidebar" aria-label="入库与去向">
      <section class="exr-store">${capacityHTML(stashUsed, stashCap, room)}${bulk}</section>
      <div class="exr-sidebar-scroll"><details class="exr-storage-details"><summary>其他收获与去向</summary>
        ${wood || rations ? `<section class="exr-resource-block"><h3>资源已入库</h3>${resourcesHTML(wood, rations)}</section>` : ''}
        ${pocketKept || pocketLost ? pocketHTML({ pocketKept, pocketLost, pocketRuleLost, keptPocket }) : ''}
        ${coins ? `<p>随身币 ${coins} 币不带回基地。</p>` : ''}${shaN ? `<p>初始攻击 ×${shaN} 不可入库；每局自动携带 ${starterSha} 张。</p>` : ''}${otherN ? `<p>其余物资 ×${otherN} 未能带出。</p>` : ''}
      </details></div></aside></div>
    <footer class="exr-footer${confirming ? ' is-confirming' : ''}">${confirming ? `<section class="exr-confirm" aria-label="确认放弃未入库卡牌"><div class="exr-finish-note is-risk"><b>这些卡牌将永久散失</b><span>出发带入卡同样适用，完成后无法取回。</span></div><ul class="exr-confirm-list" tabindex="0" aria-label="将永久散失的卡牌">${remainingCards.map(s => `<li><span>${esc(s.card.name)}</span><b>×${s.count}</b></li>`).join('')}</ul><div class="exr-confirm-actions"><button type="button" class="exr-button exr-primary" data-act="exCancelFinish">返回整理</button><button type="button" class="exr-button exr-danger" data-act="exConfirmFinish">确认放弃 ${remaining} 张并完成</button></div></section>` : `${awaitingDeposit ? '<div class="exr-finish-note"><b>上次入库结果待确认</b><span>请先重试上次入库，再完成整理。</span></div>' : `<div class="exr-finish-note${remaining ? ' is-risk' : ''}"><b>${remaining ? `完成时将丢失 ${remaining} 张未入库卡` : `本次已入库 ${saved} 张`}</b><span>${remaining ? '永久失去；带入卡同样适用' : '已保存至基地仓库'}</span></div>`}
      <button type="button" class="exr-button ${remaining && !awaitingDeposit ? 'exr-danger' : 'exr-primary'}" data-act="exFinish" ${awaitingDeposit ? 'disabled aria-disabled="true"' : ''}>${awaitingDeposit ? '等待上次入库确认' : remaining ? `放弃 ${remaining} 张并完成` : '完成整理'}<span aria-hidden="true">→</span></button>`}
    </footer></div>`;
}

/** @param {Partial<ExtractionRenderers & {receipt: ExtractionReceipt, stashUsed: number, stashCap: number, collectionCount: number, baseCoins: number, hp: number, maxHp: number}>} [options] */
export function extractionDoneHTML({ receipt = {}, cardHTML, rarityOf } = {}) {
  const r = receipt;
  /** @type {Partial<NonNullable<ExtractionReceipt["netTake"]>>} */ const net = r.netTake || {};
  /** @type {Partial<NonNullable<ExtractionReceipt["losses"]>>} */ const loss = r.losses || {};
  const savedCards = Array.isArray(r.savedCards) ? r.savedCards : [];
  const s = Math.max(0, Math.floor(Number(r.durationSec) || 0));
  const time = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const clear = r.outcome === 'clear';
  const lost = (loss.lostCount || 0) + (loss.pocketLost || 0);
  return `<div class="pg exr-page exr-done sdt-feedback-theme" id="exDone" data-reveal="true">
    <header class="exr-header"><h2 class="exr-success-title">${clear ? '首脑突破' : '撤离成功'}</h2><span class="exr-done-meta">第 ${r.layersReached ?? '-'} 层 · ${time}</span></header>
    <div class="exr-done-content"><section class="exr-totals" aria-label="本次收获">
      <div><span>卡牌入库</span><b>${net.cardsStashed ?? 0}<small> 张</small></b></div>
      <div><span>木材</span><b>+${net.wood ?? 0}</b></div>
      <div><span>口粮</span><b>+${net.rations ?? 0}</b></div>
      <div><span>人物经验</span><b>+${r.growth?.actualXp ?? r.firstExplore?.xp ?? 0}</b></div>
    </section>${growthHTML(r)}${runMementoHTML(r.memento)}
    ${savedCards.length ? `<details class="exr-done-cards"><summary>入库卡牌</summary><div class="exr-card-grid">${cardGrid(savedCards, { cardHTML, rarityOf, action:'exDoneInspect' })}</div></details>` : ''}
    ${(net.pocketKept || lost) ? `<details class="exr-receipt-details"><summary>待复原 ${net.pocketKept ?? 0} 张${lost ? ` · 散失 ${lost} 张` : ''}</summary>
      ${net.pocketKept ? '<p>保留的消耗牌已送至基地消耗区，可用钥匙复原。</p>' : ''}
      ${lost ? `<p>未入库 ${loss.lostCount || 0} 张 · 消耗区散失 ${loss.pocketLost || 0} 张</p>` : ''}
      ${loss.lostNotable?.length ? `<p>${loss.lostNotable.map(c => `${esc(c.name)} ×${c.count}`).join('、')}</p>` : ''}
    </details>` : ''}</div>
    <footer class="exr-footer"><span class="exr-saved-state">[[icon:check]] 已保存</span><button type="button" class="exr-button exr-primary" data-act="goBase">返回基地 <span aria-hidden="true">→</span></button></footer>
  </div>`;
}
