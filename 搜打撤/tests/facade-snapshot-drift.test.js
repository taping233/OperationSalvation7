import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 门面求值时点漂移守卫（2026-09-28 审计A·H1）：
// 顶层 `const X = window.SDT...` 快照把模块求值隐式锁定在门面/SDT.UI 就绪之后，
// 新文件入列必须自知（random-core.js 是正确示范：纯模块零门面解引用）。
// 本测试把在册清单钉死——只许已知文件在此列；新入列者请改用
// `import SDT from '.../sdt-facade.js'`（同对象引用且采纳既有 window.SDT）或在
// 函数内惰性读取，并同步更新本清单（清单变化本身要过人眼）。

const ROOT = 'game/src';
const list = (rel) => readFileSync(resolve(process.cwd(), ROOT, rel), 'utf8');
const walk = (dir) => {
  const out = [];
  for (const e of readdir(resolve(process.cwd(), ROOT, dir))) {
    if (e.startsWith('.')) continue;   // .githooks 等非源码条目
    const p = resolve(process.cwd(), ROOT, dir, e);
    let isDir;
    try { isDir = statDir(p).isDirectory(); } catch { continue; }
    if (isDir) out.push(...walk(`${dir}/${e}`));
    else if (e.endsWith('.js')) out.push(`${dir}/${e}`.replace(/^\.\//, ''));
  }
  return out;
};
import { readdirSync as readdir, statSync as statDir } from 'node:fs';

// 顶层 `const X = ...window.SDT...` 快照把模块求值隐式锁定在门面/SDT.UI 就绪之后。
// 判定用结构化逻辑而非单正则：负向前瞻会被 \s* 回溯绕过（实测坑）。
// 合法命中=等号右侧剥掉 JSDoc 注释后直达 window.SDT（直呼或 cast 包裹 `(window).SDT`，零运行时差异）；
// 惰性 getter（`() => window.SDT`，延迟求值不锁顺序）与 function 包装均不命中。
function isTopLevelSdtDeref(line) {
  // 行已按 \n split：不写行尾 $ 锚——CRLF 行尾的 \r 会让 (.*)$ 永不匹配（实测坑）。
  const match = /^const\s+\w+\s*=(.*)/.exec(line);
  if (!match) return false;
  const rest = match[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '');
  return !rest.includes('=>') && /^\(*window\)?\.SDT/.test(rest);
}

describe('顶层门面快照漂移守卫', () => {
  it('含顶层 window.SDT 解引用的模块 = 已知清单（新增须自觉）', () => {
    const found = walk('.').filter(rel => {
      // onetake 未提交属地文件不纳入本守卫（另有归属）
      if (['battle/core/battle.core.js', 'battle/view/battle.layers.js', 'battle/view/battle.view.js',
        'core/camera.js', 'core/renderer.js', 'hub/game.hub.depart.js',
        'run/game.run.altar.js', 'run/game.run.flow.js', 'run/game.run.shop.js',
        'run/game.session.board.js', 'run/game.session.js', 'ui/hud.js'].includes(rel)) return false;
      try { return list(rel).split('\n').some(isTopLevelSdtDeref); } catch { return false; }
    }).sort();
    // 清单失配时打印实际清单（console 可见），便于核对后更新基线
    console.log('[facade-snapshot] actual =', JSON.stringify(found));
    expect(found).toEqual([
      'battle/view/battle.aim.js',
      'battle/view/battle.anim.view.js',
      'battle/view/battle.hover.js',
      'battle/view/battle.overlays.js',
      'battle/view/battle.vfx.js',
      'cards/cards.js',
      'cards/cards.rules.js',
      'cards/cards.sync.js',
      'core/renderer.fx.js',
      'game.boot.js',
      'hub/game.bag.drag.js',
      'hub/game.bag.js',
      'hub/game.bag.settle.js',
      'hub/game.cardslib.common.js',
      'hub/game.cardslib.designer.js',
      'hub/game.cardslib.page.js',
      'hub/game.hub.pages.js',
      'hub/game.hub.runtime.js',
      'hub/game.notes.js',
      'run/game.run.dev.js',
      'run/game.run.scenes.js',
      'run/game.session.bag.js',
      'run/game.session.death.js',
      'run/game.session.modes.js',
      'ui/cinematics.js',
      'ui/overlay.js',
    ]);
  });

  it('战斗兼容门面与新工厂均不再捕获浏览器门面快照', () => {
    for (const path of ['battle/core/battle.engine.js', 'battle/core/battle.engine.factory.js',
      'battle/bag/battle.bag.js', 'battle/core/battle.enemy-phase.js',
      'battle/core/battle.exec-play.js', 'battle/core/battle.lifecycle.js']) {
      expect(list(path).split('\n').some(isTopLevelSdtDeref), path).toBe(false);
    }
  });
});
