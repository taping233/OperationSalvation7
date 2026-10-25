import { beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ game: {} }));
vi.mock('../game/src/run/game.session.js', () => ({ game: fixture.game, getActiveSlot: () => 1,
  startNewGame: vi.fn(), curLayer: () => null, bagCap: () => 2, usedSlots: () => 2 }));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: () => false, reenterCell: () => false }));
import { observe } from '../game/src/agent/agent.state.js';
import { act } from '../game/src/agent/agent.action-router.js';
import { strategicPolicy } from '../game/src/agent/agent.policy.js';
import { discardInventoryCard } from '../game/src/hub/bag-inventory-commands.js';
beforeEach(() => {
  document.body.innerHTML = '<section id="overlay"><div id="ovBody"><button data-act="closeBag">返回</button></div></section>';
  Object.assign(fixture.game, { state: 'modal', runActive: true, battleActive: false, nestActive: false,
    hp: 30, maxHp: 30, inventory: [], discoveredPairs: new Set(), nestRunes: [],
    ownedCards: [{ uid: 'first', card: { id: 'first-card', name: '同名牌', type: '资源', rarity: '古朴' } },
      { uid: 'second', card: { id: 'second-card', name: '同名牌', type: '武术', rarity: '传说' } }] });
  fixture.game.discardCard = vi.fn((name, fromSafe, uid) => discardInventoryCard(fixture.game,
    { name, fromSafe, uid }, { id: 'starter', name: '初始攻击' }).ok);
  window.SDT ||= {};
  Object.assign(window.SDT, { game: fixture.game, UI: { _acts: {} }, Battle: { commands: {} } });
});

it('一个观察后失效的丢卡UID被拒，另一合法UID仍可选择并执行', () => {
  const initial = observe();
  expect(initial.actions.filter(action => action.name === 'discardCard')).toHaveLength(2);
  const rejected = initial.actions.find(action => action.name === 'discardCard' && action.args[1] === 'first');
  fixture.game.ownedCards[0].safe = true;
  expect(act(rejected)).toMatchObject({ ok: false, code: 'DISCARD_REJECTED' });
  const next = strategicPolicy()(observe());
  expect(next).toMatchObject({ type: 'sys', name: 'discardCard', args: ['同名牌', 'second'] });
  expect(act(next).ok).toBe(true);
  expect(fixture.game.ownedCards.map(entry => entry.uid)).toEqual(['first']);
});

it('失败记忆冻结本次标量args，不随外部候选数组修改', () => {
  const rejected = observe().actions.find(action => action.name === 'discardCard' && action.args[1] === 'first');
  fixture.game.ownedCards[0].safe = true;
  expect(act(rejected).ok).toBe(false);
  rejected.args[1] = 'second';
  expect(observe().lastFailed).toMatchObject({ id: 'sys:discardCard', params: {}, args: ['同名牌', 'first'] });
});

it('UI失败仍只排除同名同params按钮，不排除另一个参数候选', () => {
  document.getElementById('ovBody').innerHTML = '<button data-act="testChoice" data-i="0">领取0</button><button data-act="testChoice" data-i="1">领取1</button>';
  window.SDT.UI._acts.testChoice = () => false;
  expect(act({ type: 'ui', name: 'testChoice', params: { i: '0' } }).ok).toBe(false);
  expect(strategicPolicy()(observe())).toMatchObject({ type: 'ui', name: 'testChoice', params: { i: '1' } });
});
