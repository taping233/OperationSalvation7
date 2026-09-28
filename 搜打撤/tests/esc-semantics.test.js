import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// esc/escAttr 口径统一守卫（2026-09-28 代码线）：全仓 5 处实现（shared 权威 +
// art/icons-bitmap/expedition.view/preparation.view 本地版）必须同义——都转义
// & < > " ' 五字符。此前 shared 版只转三个、其余满配，同名不同义已经漂移过。
// 本地实现收敛为 import 需动 shared 的求值时点（顶层解引用 window.SDT.UI），
// 故以「语义一致 + 源码 tripwire」替代 import 收敛。

const escSrc = f => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('esc/escAttr 全仓口径一致', () => {
  it('权威实现：五字符全转义，escAttr 不弱于 esc', async () => {
    // shared.js 顶层解引用 window.SDT.UI（求值时点约束，本测试自身即证据）：
    // 先垫最小门面再导入
    window.SDT = window.SDT || { UI: {} };
    const { esc, escAttr } = await import('../game/src/core/shared.js');
    const input = `a&b<c>d"e'f`;
    const out = esc(input);
    expect(out).toContain('&amp;');
    expect(out).toContain('&lt;');
    expect(out).toContain('&gt;');
    expect(out).toContain('&quot;');
    expect(out).toContain('&#39;');
    expect(escAttr(input)).toBe(out);
  });

  it('本地实现已收敛为 import 权威（源码 tripwire）', () => {
    // art/icons-bitmap/expedition.view：直接 import，无本地定义残留
    for (const f of ['game/src/core/art.js', 'game/src/core/icons-bitmap.js', 'game/src/run/expedition.view.js']) {
      const src = escSrc(f);
      expect({ file: f, imports: src.includes("from '../core/shared.js'") || src.includes("from './shared.js'") }).toEqual({ file: f, imports: true });
      expect({ file: f, local: /const esc = .*replace/.test(src) }).toEqual({ file: f, local: false });
    }
    // preparation.view：保留空值策略包装但算法走权威
    const prep = escSrc('game/src/hub/preparation.view.js');
    expect(prep.includes("esc as escRaw") || prep.includes("escRaw")).toBe(true);
    // 权威实现必须仍是五字符满配
    const shared = escSrc('game/src/core/shared.js');
    expect(shared.includes("'&#39;")).toBe(true);
    expect(shared.includes('&quot;')).toBe(true);
  });
});
