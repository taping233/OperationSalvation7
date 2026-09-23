/* 背包模块的架构守护（2026-09-22 六文件重构批4）
 *
 * game.bag.js 曾是 1077 行混装（背包本体 + 3D 拖拽 + 战后结算），现拆为：
 *   game.bag.js          —— 壳：背包本体（showBackpack/排序/详情/锦囊珍珠盒）+ bagSlots 注册 + 导出面
 *   game.bag.drag.js     —— 3D 拖拽（bindBagDrag/onBagDrag* + bagDrag 态 + resetBagDrag）
 *   game.bag.settle.js   —— 战后结算（bindBagMixins / onBattleEnd）
 *   game.bag.bridge.js   —— 中立桥：bagSlots（game.hub.bridge.js 批3同款先例）
 * 锁定四件事：
 *   1. 壳不再定义被拆走的入口，行数不回涨；
 *   2. 对外导出面（boot 消费的三件套）不变；
 *   3. 依赖单向：切片与桥不 import 壳（contracts 拒环），互调只经 bagSlots；
 *   4. bagDrag 共享态单一归属（drag 片 export let + resetBagDrag setter，壳只读+setter 清）。
 * 纯源码静态断言（不 import 游戏模块）——对齐 run-architecture / hub-architecture 先例。 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (file) => readFileSync(resolve(process.cwd(), `game/src/${file}`), 'utf8');
const importedModules = (code) => [...code.matchAll(/^(?:import|export)\s+(?:\{[^}]*\}\s+from\s+)?'\.\/([\w.]+)\.js';/gm)].map((m) => m[1]);

const SHELL = source('hub/game.bag.js');
const DRAG = source('hub/game.bag.drag.js');
const SETTLE = source('hub/game.bag.settle.js');
const BRIDGE = source('hub/game.bag.bridge.js');

describe('背包模块分层（批4 拆分）', () => {
  it('壳只做本体：被拆走的拖拽/结算入口不在 game.bag.js 定义，行数不上浮', () => {
    for (const name of ['bindBagDrag', 'makeBagGhost', 'bagDropTarget', 'clearBagDropMark',
      'onBagDragMove', 'onBagDragUp', 'bindBagMixins']) {
      expect(SHELL, `壳里不应再有 ${name} 的实现`).not.toContain(`function ${name}(`);
    }
    expect(SHELL).not.toContain('const onBattleEnd');
    expect(SHELL).not.toContain('let bagDrag');
    expect(SHELL.split('\n').length).toBeLessThan(780);
    expect(SHELL).toContain('function showBackpack(');
    expect(SHELL).toContain('function closeBackpack(');
  });

  it('对外导出面不变：boot 消费三件套仍从 game.bag.js 出', () => {
    const exported = [...SHELL.matchAll(/^export \{([^}]*)\}(?:\s+from\s+'[^']*')?;/gm)]
      .flatMap((m) => m[1].split(',')).map((s) => s.trim()).filter(Boolean);
    for (const name of ['bindBagMixins', 'showBackpack', 'setBagReturnHook']) {
      expect(exported, `${name} 应仍在 game.bag.js 导出`).toContain(name);
    }
  });

  it('依赖单向：切片与桥不得 import 壳；壳装配三件套', () => {
    expect(importedModules(DRAG)).not.toContain('game.bag');
    expect(importedModules(SETTLE)).not.toContain('game.bag');
    expect(importedModules(BRIDGE)).not.toContain('game.bag');
    for (const mod of ['game.bag.drag', 'game.bag.settle', 'game.bag.bridge']) {
      expect(importedModules(SHELL), `壳应装配 ${mod}`).toContain(mod);
    }
  });

  it('互调只经桥：壳注册本体五件+drag 反向注册；切片无裸本体调用', () => {
    for (const fn of ['showBackpack', 'closeBackpack', 'moveStackOrder', 'moveStackSafe', 'showDiscardConfirm', 'pocketAdd']) {
      expect(SHELL, `壳应注册 bagSlots.${fn}`).toContain(`bagSlots.${fn} = ${fn}`);
    }
    expect(DRAG).toContain('bagSlots.bindBagDrag = bindBagDrag');
    expect(DRAG, 'drag 不得裸调壳本体').not.toMatch(/(^|[^.\w])(showBackpack|moveStackOrder|moveStackSafe|showDiscardConfirm)\s*\(/m);
    expect(SETTLE, 'settle 不得裸引壳本体').not.toMatch(/(^|[^.\w])(closeBackpack|pocketAdd|showBackpack)\b/m);
    expect(BRIDGE).toContain('export const bagSlots = {}');
  });

  it('bagDrag 共享态单一归属：drag 拥有 + setter；壳经 resetBagDrag 清', () => {
    expect(DRAG).toContain('export let bagDrag = null');
    expect(DRAG).toContain('export function resetBagDrag()');
    expect(SHELL).toContain('resetBagDrag();');
    expect(SHELL).toContain('bagDrag, resetBagDrag');
  });
});
