import fs from 'node:fs';
import { parse } from 'acorn';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as footer from '../../../../../game/src/ui/room-footer.js';
import * as roomActions from '../../../../../game/src/ui/room-actions.js';
import * as lifetime from '../../../../../game/src/ui/page-surface-lifetime.js';
import * as disclosure from '../../../../../game/src/ui/ui-disclosure.js';
import * as linked from '../../../../../game/src/ui/home-linked-interactions.js';
import * as completion from '../../../../../game/src/ui/motion-completion.js';
import * as motion from '../../../../../game/src/ui/motion-presets.js';
import * as notice from '../../../../../game/src/ui/operation-notice.js';
import * as random from '../../../../../game/src/core/random.js';
import * as shared from '../../../../../game/src/core/shared.js';
import * as cardView from '../../../../../game/src/cards/cards.view.js';
import * as primitives from '../../../../../game/src/core/motion-primitives.js';
import * as browse from '../../../../../game/src/run/shop-browse-state.js';
import * as commission from '../../../../../game/src/run/shop-commission.js';
import * as checkpoint from '../../../../../game/src/core/run-checkpoint.js';
import * as commands from '../../../../../game/src/run/shop-commands.js';
import * as chestSave from '../../../../../game/src/run/chest-reward-save.js';
import { rewardClaimHTML } from '../../../../../game/src/ui/reward-scene-view.js';

const modules = { 'room-footer':footer, 'room-actions':roomActions, 'page-surface-lifetime':lifetime,
  'ui-disclosure':disclosure, 'home-linked-interactions':linked, 'motion-completion':completion,
  'motion-presets':motion, 'operation-notice':notice, random, shared, 'cards.view':cardView,
  'motion-primitives':primitives, 'shop-browse-state':browse, 'shop-commission':commission,
  'run-checkpoint':checkpoint, 'shop-commands':commands, 'chest-reward-save':chestSave };
const baseline = 'node_modules/.cache/lean-refactor-1024/before/';
// Evaluate the complete frozen controller with the same real dependency exports
// as the current controller. Only the two controller source versions differ.
function controller(file) {
  let source = fs.readFileSync(file, 'utf8');
  const tree = parse(source, { ecmaVersion:'latest', sourceType:'module' });
  const names = [], values = [], edits = [];
  for (const node of tree.body) {
    if (node.type === 'ImportDeclaration') {
      const module = modules[node.source.value.split('/').at(-1).replace(/\.js$/, '')];
      if (!module) throw Error(`Unmapped dependency: ${node.source.value}`);
      for (const specifier of node.specifiers) { names.push(specifier.local.name); values.push(module[specifier.imported.name]); }
      edits.push([node.start, node.end, '']);
    } else if (node.type === 'ExportNamedDeclaration') {
      edits.push([node.start, node.declaration ? node.declaration.start : node.end, '']);
    }
  }
  for (const [start, end, replacement] of edits.reverse()) source = source.slice(0, start) + replacement + source.slice(end);
  return new Function(...names, `${source}\nreturn { createShopController, configureShopRuntime };`)(...values);
}
const frozen = controller(`${baseline}game/src/run/game.run.shop.js`);
const current = controller('game/src/run/game.run.shop.js');
const card = { id:'oracle-card', name:'商店测试卡', type:'法术', rarity:'古朴', desc:'<规则>' };
const sha = { ...card, id:'oracle-sha', name:'初始攻击', type:'武术' };
const coin = { ...card, id:'oracle-coin', name:'货币卡', sellable:true, value:3 };
afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); });

async function run(version, mode, action) {
  vi.useFakeTimers();
  random.setRandomService(new random.SeededRandomService(2451));
  const trace = [], acts = {}, frames = [];
  let uid = 0, coins = mode === 'short' ? 0 : 20, inventory = [{uid:'coin-1',card:coin}], performing = false;
  const raw = [
    {card:mode === 'gift' ? {...card,id:'tt2-apollo'} : card,price:mode === 'free' ? 0 : 5,free:mode === 'free',sold:false,mystery:mode === 'gift'},
    {card:sha,price:1,sold:false,shaReplenish:5},
  ];
  const stock = raw.map((slot,index) => new Proxy(slot, { get(target,key) {
    if (typeof key === 'string') trace.push(['slot:get',index,key]);
    return target[key];
  }, set(target,key,value) { trace.push(['slot:set',index,key,value]); target[key]=value; return true; } }));
  const host = document.createElement('main'); document.body.append(host);
  const UI = {el:{ovBody:host,overlay:host},act:(name,fn)=>{acts[name]=fn;},
    showOverlay:(title,html)=>{trace.push(['overlay',title]);host.innerHTML=html;},
    hideOverlay:()=>{trace.push(['hide']);host.hidden=true;},refresh:()=>trace.push(['refresh']),
    log:(...args)=>trace.push(['log',...args]),helpBtn:()=>'',registerHelp:()=>{} };
  const game = {state:'idle',seed:2451,layerIdx:0,trackPos:3,discoveredPairs:[],layerData:[],shopStocks:{one:stock},
    canReceiveCard:item=>{
      trace.push(['capacity',item.id]);
      if(performing && mode==='capacity-reentry') {acts[action]({i:action==='buySha'?1:0});acts.closeShop();}
      if(performing && mode==='capacity-requote')raw[action==='buySha'?1:0].price++;
      return mode!=='full';
    } };
  Object.defineProperties(game, {
    coins:{get(){trace.push(['coins:get',coins]);return coins;},set(value){trace.push(['coins:set',value]);coins=value;},enumerable:true},
    ownedCards:{get(){trace.push(['owned:get']);return inventory;},set(value){trace.push(['owned:set']);inventory=value;},enumerable:true},
  });
  const SDT = {Base:{slot:1},Motion:{reduceMotion:()=>true},Icons:{rich:html=>html},
    Sound:{sfx:name=>trace.push(['sound',name])},
    Cards:{isSellable:item=>!!item.sellable,sellPrice:item=>item.value||0,all:()=>[...raw.map(slot=>slot.card),coin],isRandomObtainable:()=>true},
    Chests:{restore:(_game,reward)=>trace.push(['gift',reward])} };
  const save = () => {
    trace.push(['save',coins,inventory.map(entry=>entry.card.id),raw.map(slot=>[slot.sold,slot.shaReplenish])]);
    if (mode==='save-reentry') { acts[action]({i:action==='buySha'?1:0});acts.closeShop(); }
    if (mode==='save-throw') throw Error('disk');
    if (mode==='save-detach') host.remove();
    return mode!=='save-false';
  };
  const runtime = version.createShopController({UI,SDT,game,saveGame:save,
    bagCap:()=>{trace.push(['bagCap']);return 16;},usedSlots:()=>{trace.push(['usedSlots']);return inventory.length;},
    cardHTML:item=>`<div class="hs-card">${shared.esc(item.name)}</div>`,
    newUid:()=>{
      trace.push(['uid']);
      if(mode==='uid-throw')throw Error('uid');
      if(mode==='uid-reentry'){acts[action]({i:action==='buySha'?1:0});acts.closeShop();}
      if(mode==='uid-requote')raw[action==='buySha'?1:0].price++;
      return mode==='uid-duplicate'?'coin-1':`new-${++uid}`;
    },
    setCardPageOpen:()=>{} });
  runtime.openShop('one');
  if(mode==='quote-price')raw[action==='buySha'?1:0].price=2;
  if(mode==='quote-card')raw[action==='buySha'?1:0].card={...card,id:'replacement'};
  if(mode==='quote-slot')stock[action==='buySha'?1:0]={...raw[0]};
  if(mode==='stale-run')game.trackPos++;
  if(mode==='sell')acts.openSell();
  const savedFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = fn => {frames.push(fn);return frames.length;};
  trace.length=0;
  performing=true;
  try {
    const input = mode==='index-getter' ? {get i(){trace.push(['input:i']);return action==='buySha'?1:0;}} : {i:action==='buySha'?1:0};
    await acts[action](mode==='sell'?{uid:'coin-1'}:input);
    if(mode==='repeat')await acts[action](input);
    if(mode==='save-false')await acts.closeShop();
    for(const frame of frames)frame();
    const result = {trace:structuredClone(trace),coins,inventory:structuredClone(inventory),stock:structuredClone(raw),
      nodeRewards:structuredClone(game.nodeChestRewards||{}),state:game.state,
      html:host.innerHTML.replace(/operation-\d+/g,'operation-ID'),focus:document.activeElement?.getAttribute('data-act')};
    return result;
  } finally {globalThis.requestAnimationFrame=savedFrame;host.remove();vi.clearAllTimers();}
}

describe('frozen shop source differential receipts and port order', () => {
  for(const action of ['buyCard','buySha']) for(const mode of ['success','short','full','free','save-false','save-throw','save-reentry','save-detach','repeat','quote-price','quote-card','quote-slot','stale-run','uid-throw','uid-duplicate','uid-reentry','uid-requote','capacity-reentry','capacity-requote','index-getter','gift']) {
    it(`${action}: ${mode}`, async () => expect(await run(current,mode,action)).toEqual(await run(frozen,mode,action)));
  }
  it('sell receipt and resource order', async () => expect(await run(current,'sell','sellCard')).toEqual(await run(frozen,'sell','sellCard')));
});

it('reward claim markup is byte-identical across legacy/explicit modes and all decision flags', () => {
  const source = fs.readFileSync(`${baseline}game/src/ui/reward-scene-view.js`,'utf8');
  const tree = parse(source,{ecmaVersion:'latest',sourceType:'module'});
  const declaration = tree.body.find(node=>node.type==='ExportNamedDeclaration'&&node.declaration?.id?.name==='rewardClaimHTML').declaration;
  const old = new Function('escAttr',`${source.slice(declaration.start,declaration.end)};return rewardClaimHTML;`)(shared.escAttr);
  for(const claimMode of ['','one','all','unknown']) for(const state of ['pending','received','forfeited'])
    for(let flags=0;flags<32;flags++) {
      const options={index:'<0>',cardName:'卡牌"<&',claimMode,state,choice:!!(flags&1),fits:!!(flags&2),disabled:!!(flags&4),zoom:!!(flags&8),bonus:!!(flags&16),actions:{pick:'pick<&',take:'take"',organize:'bag'}};
      expect(rewardClaimHTML(options)).toBe(old(options));
    }
});
