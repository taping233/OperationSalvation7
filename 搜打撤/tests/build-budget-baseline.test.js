// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PERFORMANCE_BUDGETS as budgets } from '../game/src/core/performance-budgets.js';
// 固定已发布9b0fe799同环境构建基线；不随最新build自动更新。
const fixed = [
  ['entryGzipBytesMax', 356092, 360 * 1024],
  ['initialJsGzipBytesMax', 404522, 410 * 1024],
  ['cssGzipBytesMax', 226967, 230 * 1024],
  ['packageBytesMax', 222424745, 220 * 1024 * 1024],
];
describe('fixed published build-byte baseline', () => {
  for (const [key, baseline, limit] of fixed) it(key + ' applies the approved 50% increase to the previous limit', () => {
    expect(budgets[key]).toBe(limit * 1.5);
    expect(limit).toBeGreaterThan(baseline);
    expect(Math.ceil(baseline * 1.04)).toBeGreaterThan(limit);
  });
  it('leaves runtime gates unchanged and increases the remaining build byte gates by 50%', () => {
    expect(budgets.startupPreloadMax).toBe(40);
    expect(budgets.retainedImageCountMax).toBe(96);
    expect(budgets.retainedImageBytesMax).toBe(192 * 1024 * 1024);
    expect(budgets.packagedDuplicateBytesMax).toBe(904 * 1024 * 1.5);
    expect(budgets.featureChunkGzipBytesMax).toBe(104 * 1024 * 1.5);
    expect(budgets.narrativeChunkGzipBytesMax).toBe(50 * 1024 * 1.5);
  });
});
