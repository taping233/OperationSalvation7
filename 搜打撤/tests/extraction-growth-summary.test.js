import { describe, expect, it } from 'vitest';
import { buildExtractionReceipt, createExtractionCommands, validatePendingExtraction } from '../game/src/hub/extraction.commands.js';
import { addXpToProgress } from '../game/src/hub/meta-progression.js';
import { extractionDoneHTML } from '../game/src/ui/extraction-rewards-view.js';

function harness(progress = { lv: 1, xp: 0 }, xpMultiplier = 1) {
  const baseApi = {
    data: { wood: 0, rations: 0, stash: [], pocket: [], characters: { wu: { ...progress } },
      stats: { extracts: 0, bestRunCoins: 0, stashTotal: 0 } },
    isSha: () => false,
  };
  const game = { runActive: true, myClass: '侠客', explored: {}, ownedCards: [], inventory: [], usedPocket: [] };
  const commands = createExtractionCommands({ getActiveSlot: () => null, baseApi, game,
    random: () => 0, characterFor: () => ({ id: 'wu', name: '无' }), addXpToProgress,
    xpMultiplier: () => xpMultiplier,
  });
  return { baseApi, game, commands };
}

async function settle(h) {
  const started = await h.commands.begin();
  expect(started.ok).toBe(true);
  h.game.pendingExtraction = started.value;
  expect(validatePendingExtraction(started.value)).toEqual({ ok: true });
  return (await h.commands.finish()).receipt;
}

describe('结算成长真实快照', () => {
  it('未升级保留前后经验、距下级差额，结算摘要默认显示', async () => {
    const receipt = await settle(harness({ lv: 2, xp: 10 }));
    expect(receipt.growth).toMatchObject({ source: 'extraction', actualXp: 20,
      before: { lv: 2, xp: 10 }, after: { lv: 2, xp: 30 }, levelsGained: 0,
      nextLevelXp: 90, xpToNext: 60, maxed: false });
    document.body.innerHTML = extractionDoneHTML({ receipt });
    const summary = document.querySelector('.exr-growth');
    expect(summary.closest('details')).toBeNull();
    expect(summary.getAttribute('aria-label')).toBe('人物成长');
    expect(document.querySelector('.exr-totals').textContent).toContain('人物经验+20');
    expect(summary.textContent).toContain('Lv.2');
    expect(summary.textContent).toContain('30 / 90 XP');
    expect(summary.querySelector('.exr-growth-effects')).toBeNull();
    expect(summary.querySelector('[role=progressbar]').getAttribute('aria-valuenow')).toBe('30');
  });

  it('升级展示实际生命加成前后，并把快照与后续基地变化分离', async () => {
    const h = harness({ lv: 1, xp: 40 });
    const started = await h.commands.begin();
    h.game.pendingExtraction = started.value;
    expect(h.baseApi.data.characters.wu).toEqual({ lv: 2, xp: 10 });
    h.baseApi.data.characters.wu = { lv: 8, xp: 80 };
    const receipt = (await h.commands.finish()).receipt;
    expect(receipt.growth).toMatchObject({ actualXp: 20, before: { lv: 1, xp: 40 },
      after: { lv: 2, xp: 10 }, levelsGained: 1, xpToNext: 80,
      effects: [{ label: '出征生命加成', before: 0, after: 1 }] });
    document.body.innerHTML = extractionDoneHTML({ receipt });
    expect(document.querySelector('.exr-growth-effects').textContent).toContain('出征生命加成+0 → +1');
    expect(document.querySelector('.exr-growth-heading').textContent).toContain('Lv.1 → Lv.2');
    expect(document.querySelector('.exr-growth').textContent).not.toContain('Lv.8');
  });

  it('跨多级的经验实增仍按真实结算值记录', async () => {
    const receipt = await settle(harness({ lv: 1, xp: 40 }, 10));
    expect(receipt.growth).toMatchObject({ awardedXp: 200, actualXp: 200,
      before: { lv: 1, xp: 40 }, after: { lv: 3, xp: 100 }, levelsGained: 2, xpToNext: 30,
      effects: [{ label: '出征生命加成', before: 0, after: 2 }] });
  });

  it('满级真实经验为零，达到满级与原本满级分别说明', async () => {
    const maxed = await settle(harness({ lv: 10, xp: 77 }));
    expect(maxed.growth).toMatchObject({ awardedXp: 20, actualXp: 0, overflowXp: 20,
      before: { lv: 10, xp: 77 }, after: { lv: 10, xp: 77 }, maxed: true, xpToNext: 0 });
    document.body.innerHTML = extractionDoneHTML({ receipt: maxed });
    expect(document.querySelector('.exr-totals').textContent).toContain('人物经验+0');
    expect(document.querySelector('.exr-growth-note').textContent).toBe('已满级');
    expect(document.querySelector('.exr-growth-progress').getAttribute('aria-valuenow')).toBe('100');
    expect(document.querySelector('.exr-growth-heading').textContent).toContain('Lv.10 · MAX');
    const reachedMax = await settle(harness({ lv: 9, xp: 360 }));
    expect(reachedMax.growth).toMatchObject({ actualXp: 10, overflowXp: 10, after: { lv: 10, xp: 10 }, maxed: true });
    document.body.innerHTML = extractionDoneHTML({ receipt: reachedMax });
    expect(document.querySelector('.exr-growth').textContent).toContain('已满级');
    expect(document.querySelector('.exr-growth').textContent).not.toContain('未增加经验');
  });

  it('末级只差少量时保留旧存档溢出，但有效经验最多计到满级', async () => {
    const h = harness({ lv: 9, xp: 367 });
    const receipt = await settle(h);
    expect(h.baseApi.data.characters.wu).toEqual({ lv: 10, xp: 17 });
    expect(receipt.growth).toMatchObject({ awardedXp: 20, actualXp: 3, overflowXp: 17,
      before: { lv: 9, xp: 367 }, after: { lv: 10, xp: 17 }, levelsGained: 1, maxed: true });
    document.body.innerHTML = extractionDoneHTML({ receipt });
    expect(document.querySelector('.exr-totals').textContent).toContain('人物经验+3');
    expect(document.querySelector('.exr-growth-note').textContent).toBe('已满级');
  });

  it('旧整理快照和旧收据不推算未保存的等级变化', async () => {
    const h = harness({ lv: 9, xp: 80 });
    const started = await h.commands.begin();
    delete started.value.growth;
    h.game.pendingExtraction = started.value;
    const receipt = (await h.commands.finish()).receipt;
    expect(receipt).not.toHaveProperty('growth');
    document.body.innerHTML = extractionDoneHTML({ receipt });
    expect(document.querySelector('.exr-totals').textContent).toContain('人物经验+20');
    expect(document.querySelector('.exr-growth')).toBeNull();
  });

  it('回执冻结原成长快照且展示文本转义', async () => {
    const h = harness();
    const started = await h.commands.begin();
    const receipt = buildExtractionReceipt({ game: h.game, pending: started.value });
    started.value.growth.after.xp = 999;
    expect(receipt.growth.after.xp).toBe(20);
    receipt.growth.characterName = '<img src=x onerror=evil()>';
    document.body.innerHTML = extractionDoneHTML({ receipt });
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('.exr-growth-heading').textContent).toContain('<img src=x onerror=evil()>');
  });
});
