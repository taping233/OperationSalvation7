// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { previewCollectionConversion } from '../game/src/hub/collection-conversion.js';
import { collectionConversionHTML } from '../game/src/hub/collection-conversion-view.js';

const card = { id: 'growth', name: '培养招式', cls: '侠客', rarity: '职业', type: '武术' };
const preview = (progress, count = 1, availableCount = 20, record) => previewCollectionConversion({
  baseSnapshot: { characters: { wu: progress }, collection: record ? { growth: record } : {} }, card, count, availableCount,
});

describe('经验转化纯预览', () => {
  it('按固定10/50计算跨级经验前后，并提供清楚的消耗/人物预览', () => {
    const value = preview({ lv: 1, xp: 40 });
    expect(value).toMatchObject({ canConvert: true, count: 1, perCardXp: 10, actualXp: 10,
      characterId: 'wu', characterName: '无', before: { lv: 1, xp: 40 }, after: { lv: 2, xp: 0 } });
    const html = collectionConversionHTML(value);
    expect(html).toContain('消耗【培养招式】×1');
    expect(html).toContain('实际经验 +10');
    expect(html).toContain('Lv.1 · 40 XP / 50');
    expect(html).toContain('Lv.2 · 0 XP / 90');
    const ability = previewCollectionConversion({ baseSnapshot: {}, card: { ...card, type: '能力卡' }, availableCount: 1 });
    expect(ability).toMatchObject({ perCardXp: 50, actualXp: 50, after: { lv: 2, xp: 0 } });
  });

  it('批量上限恰为到满级所需最少张数，末张溢出不增加满级余量', () => {
    const value = preview({ lv: 9, xp: 345 }, 3, 9, { protected: false });
    expect(value).toMatchObject({ maxCount: 3, neededCount: 3, remainingXp: 25, baseXp: 30,
      actualXp: 25, overflowXp: 5, after: { lv: 10, xp: 0 } });
    expect(collectionConversionHTML(value)).toContain('末张溢出 5 经验');
    expect(preview({ lv: 9, xp: 345 }, 4, 9, { protected: false })).toMatchObject({ canConvert: false, code: 'CONVERSION_LIMIT', maxCount: 3 });
    expect(preview({ lv: 1, xp: 0 }, 2, 1)).toMatchObject({ canConvert: false, code: 'INSUFFICIENT_CARDS' });
  });

  it('旧记录默认受保护，取消保护保留收录但允许重复卡转换', () => {
    expect(preview({ lv: 1, xp: 0 }, 1, 2, { name: card.name })).toMatchObject({ registered: true, protected: true, canConvert: false, code: 'COLLECTION_PROTECTED' });
    expect(preview({ lv: 1, xp: 0 }, 1, 2, { protected: false })).toMatchObject({ registered: true, protected: false, canConvert: true, actualXp: 10 });
  });

  it('满级未收录仅允许消耗1张经验0，已收录拒绝纯经验转化', () => {
    const value = preview({ lv: 10, xp: 0 });
    expect(value).toMatchObject({ canConvert: true, registrationOnly: true, maxCount: 1, actualXp: 0, overflowXp: 0 });
    expect(collectionConversionHTML(value)).toContain('仅收录图鉴，经验 0，消耗 1 张');
    expect(preview({ lv: 10, xp: 0 }, 2)).toMatchObject({ canConvert: false, code: 'CONVERSION_LIMIT' });
    expect(preview({ lv: 10, xp: 0 }, 1, 2, { protected: false })).toMatchObject({ canConvert: false, code: 'CHARACTER_MAXED', maxCount: 0 });
  });
});
