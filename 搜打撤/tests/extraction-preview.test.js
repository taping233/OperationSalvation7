import { describe, expect, it } from 'vitest';
import { isExtractNode, previewExtraction } from '../game/src/run/extraction-preview.js';

// CODE-002 带出预估口径钉（2026-09-28 代码线）：口径唯一权威是
// hub/extraction.commands.js calculateBaseAndPending，本测试钉住其期望值投影版本。

const baseApi = {
  isSha: (c) => c && (c.id === 'starter-attack' || c.name === '初始攻击'),
  bagCap: () => 16,
};

describe('extraction-preview 带出预估', () => {
  it('空对局安全降级：全零、bagCap 走 baseApi', () => {
    const out = previewExtraction({}, baseApi);
    expect(out).toEqual({ bagTotal: 0, bagCap: 16, pocketTotal: 0, expectedKept: 0,
      wood: 0, rations: 0, coins: 0, layerIdx: null });
  });

  it('ownedCards 全带回、初始攻击豁免、usedPocket 期望=Σcount/3', () => {
    const game = {
      ownedCards: [
        { uid: 'a', card: { id: 'x1', name: '斩击' } },
        { uid: 'b', card: { id: 'starter-attack', name: '初始攻击' } },
        { uid: 'c', card: { id: 'x2', name: '火球' } },
      ],
      usedPocket: [
        { card: { name: '炸药' }, count: 2 },
        { card: { name: '药水' }, count: 1 },
      ],
      coins: 12,
      layerIdx: 1,
    };
    const out = previewExtraction(game, baseApi);
    expect(out.bagTotal).toBe(2);          // 初始攻击不入库，不计带出
    expect(out.pocketTotal).toBe(3);
    expect(out.expectedKept).toBeCloseTo(1);   // 3 × 1/3
    expect(out.coins).toBe(12);
    expect(out.layerIdx).toBe(1);
  });

  it('资源只计木材与口粮，其余物资不计', () => {
    const game = { inventory: [
      { name: '木材', count: 3 }, { name: '口粮', count: 2 },
      { name: '钥匙', count: 1 }, { name: '不知道', count: 9 },
    ] };
    const out = previewExtraction(game, baseApi);
    expect(out.wood).toBe(3);
    expect(out.rations).toBe(2);
  });

  it('isExtractNode 只认紧急撤离与终局撤离', () => {
    expect(isExtractNode('emergencyExit')).toBe(true);
    expect(isExtractNode('extraction')).toBe(true);
    expect(isExtractNode('battle')).toBe(false);
    expect(isExtractNode(undefined)).toBe(false);
  });
});
