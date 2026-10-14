// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createHubPreparationFeature } from '../game/src/hub/game.hub.preparation.js';
function harness() {
  let slot = 1, resolve;
  const card = { id: 'a', name: '同名牌', rarity: '稀有' }, other = { id: 'b', name: '同名牌', rarity: '稀有' };
  const snapshot = { stash: [{ card, count: 2, variantKey: 'plain' }, { card: other, count: 2, variantKey: 'foil' }], characters: {}, pets: {}, goals: { tracked: [], presets: { 'preset-1': { id: 'preset-1', name: '预设', picks: [{ card: { cardId: 'b', variantKey: 'foil' }, count: 1 }] } } } };
  const gate = new Promise(r => { resolve = r; }), update = vi.fn(), dispose = vi.fn(), read = vi.fn(() => ({ ok: true, value: snapshot, revision: 1 })), commit = vi.fn(() => gate);
  const root = { isConnected: true }; let intent;
  const navigation = { applyPicks: vi.fn(), openDeparture: vi.fn(), returnToBase: vi.fn() };
  const feature = createHubPreparationFeature({ data: { slotId: () => slot, readBase: read, readBaseReceipt: async () => ({ ok: true, value: null }), commitBase: commit, cardCatalog: () => [card, other], characters: () => [], pets: () => [], bagCapacity: () => 16 },
    view: { openPanel: () => root, buildModel: input => input, mount: (_root, opts) => { intent = opts.onIntent; return { update, dispose }; } }, navigation, reportError: vi.fn(), formatError: result => result.message, requestId: () => 'test-request' });
  feature.open(); return { feature, navigation, update, read, commit, resolve, intent: value => intent(value), setSlot: value => { slot = value; } };
}
describe('整备预设slot与完整CardRef', () => {
  it('换slot后旧intent不能提交到新slot', async () => { const h = harness(); h.setSlot(2); const pending = h.intent({ type: 'goal-add', payload: { targetId: 'a' } }); h.resolve({ ok: true }); await pending; expect(h.commit).not.toHaveBeenCalled(); });
  it('旧slot命令成功后不读新slot或更新旧页面', async () => { const h = harness(); const pending = h.intent({ type: 'goal-add', payload: { targetId: 'a' } }); await Promise.resolve(); const reads = h.read.mock.calls.length, updates = h.update.mock.calls.length; h.setSlot(2); h.resolve({ ok: true }); await pending; expect(h.read.mock.calls.length).toBe(reads); expect(h.update.mock.calls.length).toBe(updates); });
  it('预设应用保存cardId+堆级variant身份', async () => { const h = harness(); await h.intent({ type: 'preset-apply', payload: { presetId: 'preset-1' } }); expect(h.navigation.applyPicks).toHaveBeenCalledWith({ 'card:b:foil': 1 }); expect(h.navigation.openDeparture).toHaveBeenCalledOnce(); });
});
