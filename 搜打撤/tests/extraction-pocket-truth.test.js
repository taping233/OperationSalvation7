import { describe, expect, it, vi } from 'vitest';
import { buildExtractionReceipt, createExtractionCommands, validatePendingExtraction } from '../game/src/hub/extraction.commands.js';

const normal = { id: 'pocket-normal', name: '普通消耗卡', rarity: '稀有' };
const sha = { id: 'sha', name: '初始攻击', rarity: '古朴' };
const career = { id: 'career', name: '旧职业卡', rarity: '职业' };
const isSha = c => c.id === 'sha';
const sum = stacks => stacks.reduce((n, s) => n + s.count, 0);
function setup(rolls = Array(9).fill(.1)) {
  const game = { runActive: true, ownedCards: [], inventory: [], coins: 0, elapsed: 0,
    usedPocket: [{ card: normal, count: 3 }, { card: sha, count: 2 }, { card: career, count: 4 }] };
  const baseApi = { isSha, data: { wood: 0, rations: 0, pocket: [{ card: normal, count: 10 }], stats: { extracts: 0, bestRunCoins: 0 } } };
  let i = 0;
  const random = vi.fn(() => rolls[i++]);
  const commands = createExtractionCommands({ game, baseApi, random, getActiveSlot: () => null });
  return { game, baseApi, random, commands };
}

describe('extraction pocket receipt matches the cards actually sent to the base', () => {
  it('excludes initial attacks and retired career cards after the same nine successful rolls', async () => {
    const h = setup();
    const result = await h.commands.begin();
    h.game.pendingExtraction = result.value;
    expect(validatePendingExtraction(result.value).ok).toBe(true);
    expect(h.random).toHaveBeenCalledTimes(9);
    expect(sum(result.value.keptPocket)).toBe(9); // Pending is the original roll snapshot, without a migration.
    expect(h.baseApi.data.pocket).toEqual([{ card: normal, count: 13 }]);
    const finished = await h.commands.finish();
    expect(finished.receipt.netTake.pocketKept).toBe(3); // This run's delta, not the base's total of 13.
    expect(finished.receipt.losses.pocketLost).toBe(6);
    expect(finished.receipt.losses.pocketRuleLost).toBe(6);
    expect(h.random).toHaveBeenCalledTimes(9);
  });

  it('counts random loss plus successful rolls rejected by the existing persistence rule', async () => {
    const h = setup([.1,.9,.2, .1,.9, .1,.9,.1,.9]);
    const { value: pending } = await h.commands.begin();
    const before = JSON.stringify(pending);
    const receipt = buildExtractionReceipt({ game: h.game, pending, isSha });
    expect(receipt.netTake.pocketKept).toBe(2);
    expect(receipt.losses).toMatchObject({ pocketLost: 7, pocketRuleLost: 3 });
    expect(receipt.netTake.pocketKept + receipt.losses.pocketLost).toBe(pending.totalPocketCount);
    expect(pending.lostPocketCount).toBe(4);
    expect(h.baseApi.data.pocket).toEqual([{ card: normal, count: 12 }]);
    expect(JSON.stringify(pending)).toBe(before);
    expect(h.random.mock.results.map(r => r.value)).toEqual([.1,.9,.2,.1,.9,.1,.9,.1,.9]);
  });

  it('recomputes legacy organizing snapshots without rerolling or changing their valid format', () => {
    const pending = { version: 1, runId: 'old', phase: 'organizing', requestSeq: 0, remainingCards: [],
      keptPocket: [{ card: normal, count: 20 }, { card: sha, count: 9 }],
      totalPocketCount: 78, lostPocketCount: 49, resources: { wood: 0, rations: 0 } };
    expect(validatePendingExtraction(pending).ok).toBe(true);
    const receipt = buildExtractionReceipt({ game: { ownedCards: [] }, pending, isSha });
    expect(receipt.netTake.pocketKept).toBe(20);
    expect(receipt.losses).toMatchObject({ pocketLost: 58, pocketRuleLost: 9 });
    expect(validatePendingExtraction(pending).ok).toBe(true);
  });
});
