import { esc } from '../core/shared.js';
import { uiDisclosure } from './ui-disclosure.js';
import { uiDecisionChoice, uiDecisionFacts } from './ui-decision.js';

export function altarRitualHTML({ fragments, capacity, availableCards, hasItem, itemUsed, restorable }) {
  const fragmentDetail = fragments >= 2 ? '获得 1 张本职业随机能力卡；放不下时不扣碎片。' : `碎片不足：现有 ${fragments}/2 枚。`;
  const itemDetail = itemUsed ? '每座祭坛限一次，本处已用过。' : !hasItem ? '背包里没有道具卡。' : `手选复原至多 ${Math.min(2, restorable)} 张；每座祭坛限一次。`;
  return `<section class="ui-design-system ui-node-decision" aria-label="祭坛代价与奖励">
    ${uiDecisionFacts([['背包', capacity], ['可献祭', `${availableCards} 张`], ['通行证A碎片', `${fragments} 枚`]])}
    <p class="ui-risk">确认献祭后，所选卡牌永久失去；激活奖励只能选一次。</p>
    <div class="ui-decision-options">
      ${uiDecisionChoice({ action:'altarOn3', label:'弃 3 张 · 激活祭坛', detail:`${availableCards < 3 ? '可献祭卡不足 3 张。' : ''}回赠二选一：复原至多 3 张 + 回复 10 血，或随机 1 张传说卡 + 1 张装备卡。` })}
      ${uiDecisionChoice({ action:fragments >= 2 ? 'altarFragHero' : 'altarFragLocked', label:'献上 2 枚员工通行证A碎片（不弃牌）', detail:fragmentDetail, disabled:fragments < 2 })}
      ${uiDecisionChoice({ action:itemUsed ? 'altarItemUsed' : hasItem ? 'altarItemRestore' : 'altarItemNoItem', label:itemUsed ? '献祭道具 · 已用过' : '献祭 1 张道具 · 复原卡牌', detail:itemDetail, disabled:itemUsed || !hasItem })}
    </div>
    ${uiDisclosure({ label:'仪式说明', content:'<p>献祭候选仅来自普通随身背包；安全格、容器内的卡牌需先移回背包。选卡时可取消，确认前不扣卡。</p><p>道具献祭独立于激活，每座祭坛限一次；复原数量仍受消耗区可用卡牌和背包容量限制。</p>' })}
  </section>`;
}

export function altarRewardHTML({ capacity, restorable }) {
  return `<section class="ui-design-system ui-node-decision" aria-label="祭坛回赠选择">
    ${uiDecisionFacts([['背包', capacity], ['可复原', `${restorable} 张`]])}
    <p class="ui-risk">只能选一次；选择后另一项不可领取。离开可保留待选奖励。</p>
    <div class="ui-decision-options">
      ${uiDecisionChoice({ action:restorable ? 'altarRewardRestore' : 'altarRewardRestoreOff', label:`复原至多 ${Math.min(3, restorable)} 张 + 回复 10 血`, detail:restorable ? '手选消耗区卡牌；实际复原受背包容量限制。' : '消耗区里没有可复原的卡牌，此项不可选。', disabled:!restorable })}
      ${uiDecisionChoice({ action:'altarRewardLoot', label:'传说卡 + 装备卡', detail:'随机获取各 1 张；放不下的奖励保留待领。' })}
    </div>
    ${uiDisclosure({ label:'回赠说明', content:'<p>道具/装备类消耗不能复原；生命回复不超过上限。选择复原后，未用完次数由本节点保留。</p><p>离开再回到本格可继续领取已选择的奖励，不能重新选择另一项。</p>' })}
  </section>`;
}

export function entrySupplyIntroHTML({ count, character, capacity }) {
  return `<section class="ui-design-system ui-node-decision" aria-label="入城补给数量与容量">
    ${uiDecisionFacts([['待领补给', `${count} 张`], ['背包', capacity]])}
    <p class="ui-decision-note">${character ? `${esc(character)}的职业卡` : '随行职业卡'}，全部领取后才能继续探索。</p>
    <button type="button" class="ui-action ui-action-primary" data-act="clsEntryReveal">查看职业补给 <span aria-hidden="true">→</span></button>
    ${uiDisclosure({ label:'领取说明', content:'<p>放不下时可先整理背包，未领取的补给保留在入口。点卡面可查看详情，收下后进入本次远征背包。</p>' })}
  </section>`;
}
