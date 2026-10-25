import { battleViewMocks, overlayElements, frameMocks, inventoryFields, mountBattleRoot } from './helpers/environment-fixtures.js';
/* 反馈12条·B组（10）：敌方负面状态图标——施加到敌人身上的每一个状态，
 * 名牌角标都必须同时给出图标与文案，不能出现「有状态没图标」。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  ...frameMocks(),
}));
// 真实图标口径：[[icon:key]] 必须被解析成 <img>，测试据此断言「图标真的出了」。
const rich = value => String(value || '').replace(/\[\[icon:([^\]]+)\]\]/g, (_m, key) => `<img class="ic" data-icon="${key}" alt="">`);
const UI = {
  el: {}, _lastMode: null, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {}, act() {},
  showOverlay(title, html, mode) { this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode; },
  hideOverlay() { this.el.overlay.hidden = true; document.dispatchEvent(new Event('sdt-overlay-close')); },
};
window.SDT = {
  UI, ...battleViewMocks(rich, true, 9, 99, 5, 5),
};
await import('../game/src/cards/cards.js');
const { BattleSession, commands, Combat } = await import('../game/src/battle/core/battle.core.js');
const Runtime = await import('../game/src/battle/runtime/battle.runtime.js');
await import('../game/src/battle/view/battle.view.js');
const { mountUnitLayer, updateUnits } = await import('../game/src/battle/view/battle.layers.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const catalog = Cards.all();
let game, frames;
const originalAnimate = Element.prototype.animate;
const foeMount = () => UI.el.ovBody.querySelector('[data-unit-mount="foes"]');
const foes = () => [...foeMount().children];
function flush() { const pending = frames; frames = []; pending.forEach(callback => callback(performance.now())); }
async function settle() {
  for (let i = 0; i < 400; i++) {
    flush(); await new Promise(resolve => setTimeout(resolve, 5));
    if (!Runtime.busy && !BattleSession.getSnapshot().actionQueueLength && !frames.length) return;
  }
  throw new Error('Battle did not settle');
}
async function start() {
  game = {
    ownedCards: [{ uid: 'status-bandage', card: structuredClone(catalog.find(card => card.id === 'tt3-bandage')) }],
    ...inventoryFields(60, 80, 1, '法师'), log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'unit-target', name: '训练靶', hp: 120, atk: 3 }], { isBoss: false });
  await settle();
  const snapshot = BattleSession.getSnapshot();
  return { ...snapshot, equipped: [], allies: [], foes: [{ ...snapshot.foes[0], status: {} }] };
}
function paint(snapshot, ctx = {}) {
  updateUnits(mountUnitLayer(UI.el.ovBody, snapshot.battleToken), snapshot, {turn:snapshot.turn,playerStatus:snapshot.pstat.status,...ctx});
}
beforeEach(() => {
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  mountBattleRoot();
  UI.el = { ...overlayElements() };
  UI._lastMode = null;
});
afterEach(async () => {
  clearFeedback();
  if (game?.battleActive) { commands.flee(); await settle(); }
  UI.hideOverlay(); frames = []; Element.prototype.animate = originalAnimate; vi.restoreAllMocks();
});

it('敌方名称详情显示全部生效状态，逐键刷新且不残留',async()=>{
 const snapshot=await start(),all=[...Combat.CURSES,...Combat.BUFFS];expect(all.length).toBeGreaterThanOrEqual(16);
 const metadata=key=>Combat.CURSE_META[key]||Combat.BUFF_META[key];
 snapshot.foes[0].status=Object.fromEntries(all.map(key=>[key,1]));paint(snapshot);
 const head=()=>foes()[0].querySelector('.sts-headrow[data-ui-tip]');
 expect(head().tabIndex).toBe(0);
 for(const key of all)expect(head().dataset.uiTipText).toContain(metadata(key).name);
 for(const key of all){snapshot.foes[0].status={[key]:1};paint(snapshot);expect(head().dataset.uiTipText).toContain(metadata(key).name);for(const other of all.filter(k=>k!==key))expect(head().dataset.uiTipText).not.toContain(metadata(other).name+' ');}
 expect(head().dataset.uiTipText).not.toContain('[[icon:');
});
it('腐化与契约回响在名称详情中各出现一次',async()=>{
 const snapshot=await start();
 for(const patch of [{rotSeedMarked:true,label:'腐化标记'},{deathBurst:{status:'poison',multiplier:1},label:'腐化标记'},{damageEcho:{amount:2,dmgType:'true'},label:'契约回响'},{soulContractMarked:true,label:'契约回响'}]){
 Object.assign(snapshot.foes[0],{status:{},rotSeedMarked:false,deathBurst:null,damageEcho:null,soulContractMarked:false},patch);paint(snapshot);
 expect(foes()[0].querySelector('.sts-headrow').dataset.uiTipText).toContain(patch.label);
 }
 Object.assign(snapshot.foes[0],{rotSeedMarked:true,deathBurst:{status:'poison',multiplier:1},damageEcho:null,soulContractMarked:false});paint(snapshot);
 expect(foes()[0].querySelector('.sts-headrow').dataset.uiTipText.split('腐化标记')).toHaveLength(2);
});
