import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { appendSuggestionDocument, deleteSuggestionDocument, parseSuggestionDocument } = require('../desktop-app/suggestions-store.cjs');

describe('桌面留言文件兼容', () => {
  it('保留旧版裸数组形状并可追加', () => {
    const old = [{ ts: 'old', text: '旧留言' }];
    expect(parseSuggestionDocument(old).list).toEqual(old);
    expect(appendSuggestionDocument(old, { ts: 'new' })).toEqual([...old, { ts: 'new' }]);
  });

  it('保留对象元数据并可删除指定留言', () => {
    const old = { version: 1, suggestions: [{ ts: 'keep' }, { ts: 'drop' }] };
    const result = deleteSuggestionDocument(old, 'drop');
    expect(result.changed).toBe(true);
    expect(result.value).toEqual({ version: 1, suggestions: [{ ts: 'keep' }] });
    expect(deleteSuggestionDocument(old, 'missing').changed).toBe(false);
  });
});
