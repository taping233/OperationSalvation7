import { uiDisclosure } from './ui-disclosure.js';
import { esc, escAttr } from '../core/shared.js';
import '../../css/extraction-rewards.css';

const countOf = stacks => stacks.reduce((n, stack) => n + stack.count, 0);
const rarities = ['古朴', '稀有', '史诗', '传说', '棱彩'];
const smartDescription = '按估值从高到低入库，同估值按背包原次序。估值不代表稀有度或实战强度，也不表示卡牌可以出售。';
const rarityOfCard = (card, rarityOf) => rarityOf?.(card) || card.rarity || '古朴';

// Presentation only. Original indices survive the rarity sort; commands still own capacity and value order.
function cardGrid(stacks, { cardHTML, rarityOf, action, room = 0, broughtByName = new Map(), pending = false }) {
  return stacks.map((stack, index) => ({ ...stack, index, rarity: rarityOfCard(stack.card, rarityOf) }))
    .sort((a, b) => rarities.indexOf(b.rarity) - rarities.indexOf(a.rarity) || a.index - b.index)
    .map(({ card, count, index, rarity }) => {
      const take = Math.min(count, Math.max(0, room));
      const brought = broughtByName.get(card.name) || 0;
      const availability = take ? `可入库 ${take}/${count} 张` : '仓库已满';
      return `<article class="exr-item" data-rarity="${escAttr(rarity)}">
        <div class="exr-item-meta"><span class="exr-rarity-mark" aria-label="${escAttr(rarity)}"></span><b>×${count}</b></div>
        <button type="button" class="exr-card-preview" data-act="${action}" data-i="${index}" aria-label="查看${escAttr(card.name)}详情，${escAttr(rarity)}，${count}张">
          <span class="exr-card-face" inert aria-hidden="true">${cardHTML(card, 'sm')}</span><span class="exr-inspect-hint">查看详情</span>
        </button>
        ${pending ? `<button type="button" class="exr-deposit ext-card${take ? '' : ' off'}" data-act="exStash" data-i="${index}" ${take ? '' : 'disabled'} aria-disabled="${!take}" aria-label="${escAttr(card.name)} · ${availability}" title="${availability}"><span>${take ? (take < count ? `可入库 ${take}/${count} 张` : `入库 ${take} 张`) : `仓库已满 · ×${count}`}</span></button>${brought ? `<span class="exr-brought" title="本局同名卡的出发携入记录，不代表剩余卡的来源；入库按同名合并，不区分携入或局内获得">出发曾带入 ×${brought}</span>` : ''}` : '<span class="exr-item-saved" aria-label="已入库">[[icon:check]]</span>'}
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
  return `<div class="exr-capacity"><div><span>[[icon:archive]] 仓库容量</span><strong>${used}<small> / ${cap} 张</small></strong></div><div class="exr-meter" role="meter" aria-label="仓库容量" aria-valuemin="0" aria-valuemax="${cap}" aria-valuenow="${used}"><i style="width:${percent}%"></i></div><p>${room ? `还能入库 <b>${room}</b> 张` : '仓库已满'}</p></div>`;
}

function growthHTML(receipt) {
  const growth = receipt.growth;
  if (!growth?.before || !growth?.after) {
    return receipt.firstExplore ? `<section class="exr-growth" aria-label="本次结算成长"><h3>[[icon:medal]] 本次结算成长</h3><p class="exr-growth-heading">首探经验 <b>+${receipt.firstExplore.xp ?? 0}</b></p><p class="exr-growth-note">旧结算记录未保存等级变化明细。</p></section>` : '';
  }
  const { before, after } = growth;
  const gained = Math.max(0, Number(growth.actualXp) || 0);
  const need = Math.max(1, Number(growth.nextLevelXp) || 1);
  const xp = Math.min(need, Math.max(0, Number(after.xp) || 0));
  const percent = growth.maxed ? 100 : xp / need * 100;
  const effects = (growth.effects || []).filter(effect => effect.after > effect.before);
  return `<section class="exr-growth" aria-label="本次结算成长"><h3>[[icon:medal]] 本次结算成长</h3>
    <div class="exr-growth-heading"><b>${esc(growth.characterName || '人物')}</b><span>撤离经验 <strong>+${gained}</strong></span></div>
    <p class="exr-growth-level">Lv.${before.lv} <span aria-hidden="true">→</span> Lv.${after.lv}${growth.maxed ? ' · MAX' : ''}</p>
    <div class="exr-growth-progress" role="progressbar" aria-label="结算后人物经验" aria-valuemin="0" aria-valuemax="${growth.maxed ? 100 : need}" aria-valuenow="${growth.maxed ? 100 : xp}"><i style="width:${percent}%"></i></div>
    <p class="exr-growth-note">${growth.maxed ? (before.lv === after.lv ? '人物已满级，本次撤离未增加经验。' : '人物熟练度已满。') : `${after.xp} / ${need} XP · 距 Lv.${after.lv + 1} 还差 ${growth.xpToNext} XP`}</p>
    ${growth.overflowXp > 0 ? `<p class="exr-growth-note exr-growth-overflow">本次撤离奖励 ${growth.awardedXp} XP，实际用于成长 ${gained} XP；溢出 ${growth.overflowXp} XP 不再提升等级。</p>` : ''}
    ${effects.length ? `<ul class="exr-growth-effects">${effects.map(effect => `<li><span>${esc(effect.label)}</span><b>+${effect.before} → +${effect.after}</b></li>`).join('')}</ul><p class="exr-growth-note">成长加成在下次出征生效。</p>` : ''}
  </section>`;
}

/** @typedef {import('../hub/game.store.types.js').CardSnapshot} ExtractionCard
 * @typedef {{card: ExtractionCard, count: number}} ExtractionStack
 * @typedef {{cardHTML: (card: ExtractionCard, size: string) => string, rarityOf: (card: ExtractionCard) => string}} ExtractionRenderers
 * @typedef {Partial<ReturnType<typeof import('../hub/extraction.commands.js').buildExtractionReceipt>>} ExtractionReceipt
 */
/** @param {Partial<ExtractionRenderers & {remainingCards: ExtractionStack[], savedCards: ExtractionStack[], keptPocket: ExtractionStack[], pocketKept: number, pocketLost: number, pocketRuleLost: number, wood: number, rations: number, stashUsed: number, stashCap: number, room: number, coins: number, shaN: number, starterSha: number, otherN: number, broughtByName: Map<string, number>, help: string, notice: string, confirmFinish: boolean}>} [options] */
export function extractionStashHTML({ remainingCards = [], savedCards = [], keptPocket = [], pocketKept = 0, pocketLost = 0, pocketRuleLost = 0,
  wood = 0, rations = 0, stashUsed = 0, stashCap = 0, room = 0, coins = 0, shaN = 0, starterSha = 0, otherN = 0,
  broughtByName = new Map(), cardHTML, rarityOf, help = '', notice = '', confirmFinish = false } = {}) {
  const remaining = countOf(remainingCards), saved = countOf(savedCards);
  const canStore = Math.min(remaining, Math.max(0, room));
  const allFit = remaining > 0 && canStore === remaining;
  const bulk = !remaining ? ''
    : allFit ? `<button type="button" class="exr-button exr-primary" data-act="exAll">全部入库 <b>${remaining} 张</b></button>`
      : `<button type="button" class="exr-button exr-primary" data-act="exSmart" ${canStore ? '' : 'disabled'} title="${smartDescription}" aria-label="${smartDescription}"><span>${canStore ? `按估值入库 ${canStore} 张` : '仓库已满'}</span></button>`;
  return `<div class="pg exr-page sdt-feedback-theme" id="exMain" data-unclaimed-cards="${remaining}" data-reveal="${!notice}">
    <header class="exr-header"><div><h2 class="exr-success-title">撤离成功</h2></div><div class="exr-step"><span class="is-current">01</span><i></i><span>02</span>${help}</div></header>
    <div class="exr-layout"><section class="exr-loot" aria-label="本次战利品">
      <div class="exr-section-title"><div><h3>待入库 <b>${remaining}</b><small> 张</small></h3></div></div>
      <p class="exr-notice" role="status" aria-live="polite">${esc(notice)}</p>
      <div class="exr-card-scroll"><div class="exr-card-grid">${remaining ? cardGrid(remainingCards, { cardHTML, rarityOf, action: 'exInspect', pending: true, room, broughtByName }) : `<div class="exr-empty"><span>[[icon:archive]]</span><h3>${saved ? '卡牌已妥善入库' : '本次没有待入库卡牌'}</h3></div>`}</div>
        ${saved ? `<details class="exr-saved-shelf"><summary>[[icon:check]] 本次已入库 ${saved} 张 </summary><div class="exr-card-grid">${cardGrid(savedCards, { cardHTML, rarityOf, action: 'exSavedInspect' })}</div></details>` : ''}
      </div>
    </section><aside class="exr-sidebar" aria-label="入库与去向">
      <section class="exr-store">${capacityHTML(stashUsed, stashCap, room)}${bulk}${remaining && !allFit ? '<p class="exr-sort-note">按估值从高到低</p>' : ''}</section>
      <div class="exr-sidebar-scroll"><section class="exr-resource-block"><h3>[[icon:archive]] 资源已入库</h3>${resourcesHTML(wood, rations)}</section>
        ${pocketHTML({ pocketKept, pocketLost, pocketRuleLost, keptPocket })}
        <details class="exr-left-behind"><summary>留在局中的物品</summary><p>随身币 ${coins} 币不带回基地。</p>${shaN ? `<p>初始攻击 ×${shaN} 不可入库；每局自动携带 ${starterSha} 张。</p>` : ''}${otherN ? `<p>其余物资 ×${otherN} 未能带出，价值已计入本局得分。</p>` : ''}</details>
      </div></aside></div>
    <footer class="exr-footer${confirmFinish && remaining ? ' is-confirming' : ''}">${confirmFinish && remaining ? `<section class="exr-confirm" aria-label="确认放弃未入库卡牌"><div class="exr-finish-note is-risk"><b>这些卡牌将永久散失</b><span>出发带入卡同样适用，完成后无法取回。</span></div><ul class="exr-confirm-list" tabindex="0" aria-label="将永久散失的卡牌">${remainingCards.map(s => `<li><span>${esc(s.card.name)}</span><b>×${s.count}</b></li>`).join('')}</ul><div class="exr-confirm-actions"><button type="button" class="exr-button exr-primary" data-act="exCancelFinish">返回整理</button><button type="button" class="exr-button exr-danger" data-act="exConfirmFinish">确认放弃 ${remaining} 张并完成</button></div></section>` : `<div class="exr-finish-note${remaining ? ' is-risk' : ''}"><b>${remaining ? `完成时将丢失 ${remaining} 张未入库卡` : `本次已入库 ${saved} 张`}</b><span>${remaining ? '永久失去；带入卡同样适用' : '已保存至基地仓库'}</span></div>
      <button type="button" class="exr-button ${remaining ? 'exr-danger' : 'exr-primary'}" data-act="exFinish">${remaining ? `放弃 ${remaining} 张并完成` : '完成整理'}<span aria-hidden="true">→</span></button>`}
    </footer></div>`;
}

/** @param {Partial<ExtractionRenderers & {receipt: ExtractionReceipt, stashUsed: number, stashCap: number, collectionCount: number, baseCoins: number, hp: number, maxHp: number}>} [options] */
export function extractionDoneHTML({ receipt = {}, stashUsed = 0, stashCap = 0, collectionCount = 0, baseCoins = 0, hp = 0, maxHp = 0, cardHTML, rarityOf } = {}) {
  const r = receipt;
  /** @type {Partial<NonNullable<ExtractionReceipt["netTake"]>>} */ const net = r.netTake || {};
  /** @type {Partial<NonNullable<ExtractionReceipt["losses"]>>} */ const loss = r.losses || {};
  const savedCards = Array.isArray(r.savedCards) ? r.savedCards : [];
  const s = Math.max(0, Math.floor(Number(r.durationSec) || 0));
  const time = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const clear = r.outcome === 'clear';
  return `<div class="pg exr-page exr-done sdt-feedback-theme" id="exDone" data-reveal="true">
    <header class="exr-header"><div><p class="exr-eyebrow">${clear ? '首脑突破 · 已保存' : '收获已保存'}</p><h2 class="exr-success-title">撤离成功</h2></div><div class="exr-step"><span>01</span><i></i><span class="is-current">02</span></div></header>

    <div class="exr-layout"><section class="exr-loot" aria-label="本局真实入库">
      <div class="exr-section-title"><div><h3>已入库 <b>${net.cardsStashed ?? 0}</b><small> 张</small></h3></div></div>
      <div class="exr-card-scroll"><div class="exr-card-grid">${savedCards.length ? cardGrid(savedCards, { cardHTML, rarityOf, action: 'exDoneInspect' }) : '<div class="exr-empty"><span>[[icon:archive]]</span><h3>本次没有卡牌入库</h3></div>'}</div></div>
    </section><aside class="exr-sidebar" aria-label="成长、其他收获与散失"><div class="exr-sidebar-scroll">
      ${growthHTML(r)}
      <section class="exr-resource-block"><h3>[[icon:archive]] 资源已入库</h3>${resourcesHTML(net.wood ?? 0, net.rations ?? 0)}</section>
      ${pocketHTML({ pocketKept: net.pocketKept ?? 0, pocketLost: loss.pocketLost ?? 0, pocketRuleLost: loss.pocketRuleLost ?? 0, compact: true })}
      ${(loss.lostCount || loss.pocketLost) ? `<details class="exr-loss"><summary>[[icon:cross]] 散失明细</summary><p>未入库 <b>${loss.lostCount || 0}</b> 张 · 消耗区散失 <b>${loss.pocketLost || 0}</b> 张</p>${loss.lostNotable?.length ? `<p>其中传说/史诗包括：${loss.lostNotable.map(c => `【${esc(c.name)}】×${c.count}`).join('、')}</p>` : ''}</details>` : '<p class="exr-ready">[[icon:check]] 本次没有卡牌散失</p>'}
      <details class="exr-expedition-details"><summary>远征记录</summary><div class="exr-run-facts"><span>用时 <b>${time}</b></span><span>行动 <b>${r.actions ?? 0}</b> 次</span><span>抵达 <b>第 ${r.layersReached ?? '-'} 层</b></span><span>剩余生命 <b>${hp}/${maxHp}</b></span><span>${r.growth ? '撤离经验' : '首探经验'} <b>+${r.growth?.actualXp ?? r.firstExplore?.xp ?? 0}</b></span></div><p class="exr-currency-note">本局携带 ${r.runCoins ?? 0} 币留在局中；储备币 ${baseCoins} 币留在基地，不进局。</p></details>
    </div></aside></div>
    <footer class="exr-footer"><div class="exr-finish-note"><b>本次收获已保存</b><span>仓库 ${stashUsed}/${stashCap} · 图鉴 ${collectionCount}</span></div><button type="button" class="exr-button exr-primary" data-act="goBase">[[icon:home]] 返回基地 <span aria-hidden="true">→</span></button></footer>
  </div>`;
}
