# 复审单 U13：战斗 Esc 分支 IME 组合守卫（复审者 R8，0345）

- 对象：工作树 `game/src/battle/view/battle.layers.js` +2 行、新增 `tests/battle-esc-ime-guard.test.js`（4 用例）；对照修复单 fix-U13-0330.md。
- 方式：只读复审 + 亲跑验证。

## 1. diff 核对（验收①）

`git diff -- game/src/battle/view/battle.layers.js` 仅 +2 行（1 行注释 + 1 行守卫），无其他夹带；新测试文件 1 个（未跟踪）。工作树中 winter.css / page-rewards-bag-help.css / package.json / package-lock.json 等改动为同班其他会话在途热点，与本修复无关（修复单第四节已声明，属实）。**达标。**

## 2. 守卫语义（验收②）

- 定式与 game.boot.js:153-154 / 259-260、game/src/ui/ui.js:78-79 逐字一致（`if (e.isComposing || e.keyCode === 229) return;`），注释风格对齐 boot.js。
- 位置：`if (e.key === 'Escape') {` 之后、`e.defaultPrevented` 检查之前，属 Escape 分支内且先于其他条件。
- 非组合态：守卫条件恒假直接穿过，后续所有条件逐字未动；未加焦点检查（无焦点检查的现状语义保持，符合派单范围）。
- 组合态 Esc 三层叠加推演（无回归）：
  1. ui.js:77 overlay capture：组合态 return——不关面板、不 preventDefault/stopPropagation，事件放行；
  2. game.boot.js document bubble（cardPageLoading / consoleOpen 分支）：已有同款守卫，组合态早退；
  3. battle.layers.js document bubble：新守卫 return——不取消瞄准/点选/注能。
  三层一致早退，Esc 交还浏览器原生取消组词，互不抢事件；非组合态时新守卫不改变任何既有路径。**达标。**

## 3. 测试质量（验收③）

- mock 路径 `../game/src/battle/core/battle.core.js` 与 battle.layers.js:45 导入路径一致；vi.mock hoist + beforeEach 内首次 `await import`，模块顶层 `const cancelPendingTarget = commands.cancelPendingTarget` 绑定的正是 mock vi.fn，调用断言真实生效；getSnapshot 按用例 mockReturnValue 切换。
- `document.dispatchEvent` 真驱动 document 级 keydown 监听器（bubble 分支）；battle-stage + `SDT.UI.el.ovBody` 布景齐备。
- keyCode 229 经 defineProperty 注入（KeyboardEventInit 无此字段）、isComposing 构造直传+回退，双保险合理。
- 4 用例各覆盖一面：组合态反例（isComposing）、legacy 反例（229）、非组合正例（cancel+preventDefault）、空闲态防误触发；守卫若被移除，用例 1/2 的断言（未被调用、defaultPrevented=false）必然失败，断言有效。无 make-work、无凑数用例。**达标。**

## 4. 亲跑验证

- `npx vitest run tests/battle-esc-ime-guard.test.js` → 1 file / 4 tests passed，无 Unhandled。
- `rg -l "battle\.layers|aim" tests/` 前 5 命中（agent-command-results / base-corrupt-field / base-mutation / base-meta / battle-esc-ime-guard）一并跑 → 5 files / 66 tests 全绿，无 Unhandled。

## 5. make-work 检查

无重复用例、无恒真断言、无未被断言约束的实现面；改动量与问题面相称（1 行守卫对 1 个误触发入口）。

## 备注（非阻塞）

- 测试第 31 行 isComposing 回退分支在本环境（jsdom 支持 KeyboardEventInit.isComposing）为防御性死代码，无害。
- 残余面：Esc 分支仍无输入焦点检查（非组合态从 INPUT 按 Esc 仍会取消瞄准）——派单范围明确不含此项，现状语义保持正确，仅记录存在。

## 结论

verdict: PASS
