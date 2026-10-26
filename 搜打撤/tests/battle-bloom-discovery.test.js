import { battleRules, playerFields } from './helpers/environment-fixtures.js';
import { showBattleCardResults } from '../game/src/battle/view/battle.card-results.js';
import { battleDiscoverBodyHTML } from '../game/src/battle/view/battle.discover-view.js';
// Canonical hosted card through the real battle session; no browser state is used.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Icons ||= { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(99, 20, 15, 0, 20, 0) }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { vi.useFakeTimers(); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };
function makeGame(cards) {
  return { ownedCards: cards.map((card, i) => ({ uid: `runtime-${i}`, card: { ...card }, safe: false })),
    ...playerFields(100, 100, 5, 0, '战士', null), logs: [],
    log(message) { this.logs.push(message); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {}, };
}
async function settle() {
  await vi.advanceTimersByTimeAsync(1000);
  const preview = R.discovering?.sourceCommit === 'preview';
  expect(R.busy).toBe(preview);
  if (preview) {
    expect(R.discovering.cancelLabel).toBe('取消使用');
    expect(R.played).not.toContain('runtime-0');
  }
}





it.each([false,true])('永恒绽放只选一次，施放1张另2入手，文本路径=%s', async textOnly => {
 const bloom = {...canonical('tt7-bladebloom')}; if(textOnly)delete bloom.rules;
 const game = makeGame([bloom]);
 const options = ['甲','乙','丙'].map((name,i)=>({id:'probe-'+i,name,type:'法术',rarity:'古朴',cost:1,dmg:1,dmgType:'spell',desc:'造成1点法术伤害。'}));
 BattleSession.start(game,[{id:'foe',name:'靶',hp:999,atk:0}],{isBoss:false});
 vi.spyOn(C,'all').mockReturnValue(options);
 const energy = R.energy;
 BattleSession.commands.playCard('runtime-0','self'); await settle();
 const state = BattleSession.getSnapshot().discovering;
 expect(state.n).toBe(1); expect(state.options).toHaveLength(3);
 const node = document.createElement('div');
 node.innerHTML = battleDiscoverBodyHTML({candidates:state.options.map(card=>({card})),cardHTML:c=>c.name,action:'选中牌免费施放，其余候选置入手牌',remaining:state.n,modifiers:[],pageToken:'probe'});
 expect(node.querySelector('[data-battle-discover]').getAttribute('aria-label')).toContain('还需发现 1 次');
 const chosen = state.options[0].id;
 const unchosen = state.options.slice(1).map(c=>c.id).sort();
 BattleSession.commands.pickDiscover(0); await settle();
 expect(R.discovering).toBeNull(); expect(R.discoverQueue).toHaveLength(0);
 expect(R.foes[0].hp).toBe(998);
 const handIds = R.hand.map(uid=>R.granted.find(o=>o.uid===uid)?.card.id).sort();
 expect(handIds).toEqual(unchosen); expect(handIds).not.toContain(chosen);
 expect(R.energy).toBe(energy - bloom.cost);
 const stage=document.createElement('div'),overlay=document.createElement('div');overlay.append(stage);
 showBattleCardResults(stage,R.cardAnims);
 const rows=[...stage.querySelectorAll('.bt-card-result')];
 expect(rows.find(row=>row.querySelector('b').textContent==='发现卡牌 · 排队施放').textContent).toContain(state.options[0].name);
 const acquired=rows.find(row=>row.querySelector('b').textContent==='获得卡牌 · 置入手牌');
 for(const option of state.options.slice(1))expect(acquired.textContent).toContain(option.name);
 expect(acquired.textContent).not.toContain(state.options[0].name);
 BattleSession.commands.pickDiscover(0); await settle();
 expect(R.foes[0].hp).toBe(998); expect(R.hand).toHaveLength(2);
});
