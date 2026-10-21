// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { homeErrorMessage } from '../game/src/hub/command-errors.js';

describe('共用基地错误文案兼容', () => {
  it.each([
    [undefined, ''], [null, ''], [{ ok: true, message: 'ignored' }, ''],
    [{ ok: false, message: '原始消息 <原样>', code: 'SAVE_FAILED' }, '原始消息 <原样>'],
    [{ code: 'STALE_REVISION' }, '基地资料已变化，请刷新后重试。'],
    [{ code: 'SAVE_FAILED' }, '保存失败，原布局仍然保留。'],
    [{ code: 'INSUFFICIENT_FUNDS' }, '储备币不足。'],
    [{ code: 'PLACEMENT_OVERLAP' }, '家具位置重叠。'],
    [{ code: 'PLACEMENT_OUT_OF_BOUNDS' }, '家具超出房间范围。'],
    [{ code: 'UNKNOWN' }, '操作失败，请重试。'],
    [{ message: '', code: 'SAVE_FAILED' }, '保存失败，原布局仍然保留。'],
  ])('%j 保持逐字输出', (result, expected) => {
    expect(homeErrorMessage(result)).toBe(expected);
  });
});
