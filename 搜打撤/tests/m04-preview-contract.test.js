import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getM04VisualPack } from '../game/src/home.visuals.js';

const root = path.resolve(import.meta.dirname, '..');

describe('M04 preview fixtures', () => {
  it('ships four browseable pages with stress states', () => {
    const pages = getM04VisualPack().previewPaths.map(file => fs.readFileSync(path.join(root, file), 'utf8'));
    const all = pages.join('\n');
    expect(pages).toHaveLength(4);
    for (const text of ['霜落星河·不可逆转的终末回响', '仓库已满', '这里还没有收藏', '余额不足', '未解锁', '职业卡不可带入', 'M04-a 原型']) expect(all).toContain(text);
  });
});

