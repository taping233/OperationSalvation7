import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

describe('R7-a isolated QA host',()=>{
  it('loads real BattleSession/View without main or persistence writers',()=>{
    const html=readFileSync(resolve(process.cwd(),'docs/previews/r7a-encounters/index.html'),'utf8');
    const js=readFileSync(resolve(process.cwd(),'game/src/r7a.qa.js'),'utf8');
    expect(html).toContain('../../../game/src/r7a.qa.js');
    expect(js).toContain("import('./battle/battle.view.js')");expect(js).toContain("import('./battle/battle.core.js')");
    expect(js).not.toMatch(/Base\.|RunStorage|localStorage\.setItem|import\(['"]\.\/main/);
    expect(html).toContain('l2-archer-cavalry');expect(html).toContain('l4-fire-grass');
    expect(html).toContain('无奖励、无存档');expect(html).toContain('退出样本');
  });
});
