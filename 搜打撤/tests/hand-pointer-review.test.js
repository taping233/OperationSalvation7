import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
it('命中夹具复用真实布局/CSS并只记录可见DOM事件，不替代生产发牌',()=>{
 const js=readFileSync('game/dev/hand-pointer-review.js','utf8'),html=readFileSync('game/dev/hand-pointer-review.html','utf8');
 expect(html).toContain('css/battle-stage.css');expect(js).toContain('handDisplayLayout');expect(js).toContain('cardHTML');
 const logger=readFileSync('game/dev/hand-pointer-log.js','utf8');
 expect(logger).toContain('document.elementFromPoint');expect(logger).toContain("e.target.closest('button,[data-term]')");
 expect(js).toContain('createPointerLog');
 expect(js+logger).not.toMatch(/commands\.\w|getSnapshot\(|dispatchEvent\(|localStorage|persistSave|\.startAim\(/);
});
