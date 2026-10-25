import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ game:{} }));
vi.mock('../game/src/run/game.session.js', () => ({ game:fixture.game,
  getActiveSlot:() => 1, startNewGame:vi.fn(), curLayer:() => null, bagCap:() => 16, usedSlots:() => 0 }));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo:() => false, reenterCell:() => false }));
import { observe } from '../game/src/agent/agent.state.js';
import { act } from '../game/src/agent/agent.action-router.js';
import { decideConfigured } from '../game/src/agent/agent.llm.runtime.js';

beforeEach(() => {
  Object.assign(fixture.game, { state:'modal', runActive:true, battleActive:false, nestActive:false,
    hp:30, maxHp:30, coins:10, turn:1, discoveredPairs:new Set(), nestRunes:[], ownedCards:[], inventory:[] });
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><section id="retained-root"><button data-act="buy" data-i="0">旧商品</button></section></div></div>';
  window.SDT = { game:fixture.game, UI:{ _acts:{ buy:vi.fn(() => true) } }, Battle:{ commands:{} } };
});
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const currentBuy = () => observe().actions.find(action => action.name === 'buy');
function replaceOffer() {
  document.querySelector('[data-act="buy"]').outerHTML = '<button data-act="buy" data-i="0">新商品</button>';
}

it('observed action cannot buy a replacement button inside the same retained page root', () => {
  const root = document.getElementById('retained-root'), oldAction = currentBuy();
  replaceOffer();
  expect(document.getElementById('ovBody').firstElementChild).toBe(root);
  expect(act(oldAction)).toMatchObject({ ok:false, code:'UI_ACTION_UNAVAILABLE' });
  expect(window.SDT.UI._acts.buy).not.toHaveBeenCalled();
  expect(act(currentBuy())).toMatchObject({ ok:true });
  expect(window.SDT.UI._acts.buy).toHaveBeenCalledOnce();
});

it('LLM normalization preserves the observed button identity through action-list matching', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok:true,
    json:async () => ({ choices:[{ message:{ content:'{"type":"ui","name":"buy","params":{"i":"0"}}' } }] }) })));
  const fallback = vi.fn();
  const action = await decideConfigured(observe(), { baseUrl:'http://unused.invalid', apiKey:'test', model:'fixture' }, fallback, {}, null);
  expect(action).toEqual({ type:'ui', name:'buy', params:{ i:'0' } });
  replaceOffer();
  expect(act(action)).toMatchObject({ ok:false, code:'UI_ACTION_UNAVAILABLE' });
  expect(window.SDT.UI._acts.buy).not.toHaveBeenCalled();
  const fresh = await decideConfigured(observe(), { baseUrl:'http://unused.invalid', apiKey:'test', model:'fixture' }, fallback, {}, null);
  expect(act(fresh)).toMatchObject({ ok:true });
  expect(window.SDT.UI._acts.buy).toHaveBeenCalledOnce();
  expect(fallback).not.toHaveBeenCalled();
});

it('manually authored command remains compatible when no observed source was supplied', () => {
  expect(act({ type:'ui', name:'buy', params:{ i:'0' } })).toMatchObject({ ok:true });
  expect(window.SDT.UI._acts.buy).toHaveBeenCalledOnce();
});
