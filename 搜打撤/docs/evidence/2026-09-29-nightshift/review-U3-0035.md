# 复审单 R2：U3「game.boot.js 两处 Esc 分支补 IME 组合态守卫」（00:35）

- 复审者：R2（夜班三代理编制，第三方独立复审，只读；唯一写入本单）
- 复审对象：工作树未提交改动 `game/src/game.boot.js` + `tests/boot.test.js`；修复单 `fix-U3-0100.md`
- 基线 HEAD：5384bfd（与 fix 单记载一致）
- 方法：git diff 全文比对 + 原文引用 + 亲跑定向测试

## 1. diff 最小性 —— 通过

`git diff game/src/game.boot.js` 全文仅 2 个 hunk，各 +2 行（注释+守卫），无删除、无夹带。守卫落位（改后行号）：

- boot.js:153-155（加载态分支体内首行）：
  > `if (e.key === 'Escape' && cardPageLoading) {` / `// 输入法组合中（keyCode 229）：Esc 是取消拼音组合，不是关浮层` / `if (e.isComposing || e.keyCode === 229) return;` / `e.preventDefault();`
- boot.js:259-260（大页监听器首行）：
  > `window.addEventListener('keydown', (e) => {` / `// 输入法组合中（keyCode 229）：Esc 是取消拼音组合，不是关大页` / `if (e.isComposing || e.keyCode === 229) return;`

`git diff tests/boot.test.js` 仅 1 个 hunk（@@ -475,4 +475,55 @@），describe 末尾追加 1 用例 +51 行，未删改既有行。合计 +55 行，与 fix 单 §1「仅两个文件，+55 行，无删除」一致。工作树另有 14 个改动文件（winter.css、package-lock.json 等）属其他并行热点，不在本次授权范围，未比对未触碰。

## 2. 守卫语义 —— 通过（与定式等价，无求值顺序副作用）

定式原文（ui.js:79）：
> `if (e.isComposing || e.keyCode === 229) return;`

boot.js:154/260 与之逐字符相同。（ui.js:356 是 preventDefault+stopPropagation 变体；本次对齐的是 79 式纯 return，选式正确。）

- **152 加载态分支**：守卫插在 `if (e.key === 'Escape' && cardPageLoading)` 体内首行。非 IME 时两次属性读不命中，后续 `e.preventDefault(); e.stopImmediatePropagation(); closeCardPageTop(); return;` 原序原样执行；非 Escape 键不进分支。组合态 Esc 纯 return 不吞事件（浏览器默认取消候选词），事件继续传播的下游均有守卫（boot.js:260、ui.js:79 overlay 捕获处理器），无新漏网。既有用例「照相馆动态载入可被快捷切页或真实 Escape 取消」本轮仍通过，现状语义保持。
- **257 大页分支**：守卫插在监听器首行而非 Escape 判断内——对每个 keydown（含非 Escape）先求值，比 ui.js:79 式多做两次属性读；该监听器对非 Escape 键本就无操作，可观察行为等价，非缺陷。非 IME 时条件链 `!e.defaultPrevented && cardPageOpen && !cardPageLoading && !UI.el.overlay.hidden` 原样求值。

## 3. 测试质量 —— 通过（真路径、三态齐全、姿势合规、有判别力）

- **真路径**：本文件 setup 注入真实 index.html body 并动态 import 真实 main.js；用例点击 `#btnCardLib` → `await waitFor(() => document.querySelector('.card-library-page'), 15000)`（boot.test.js:489）→ 断言 `cardsLib.cardPageOpen === true`、`overlay.hidden === false`，驱动真实卡牌库大页，非 stub。
- **三态**：①isComposing=true（boot.test.js:501，焦点在 `#cardSearch` 后 target 派发、bubbles 到 window，复刻玩家真实漏网链）③keyCode=229 ②普通 Esc 照常关（:513 waitFor 条件等待收场动画）。加载态分支同样三态覆盖（window 直接派发以复刻「152 分支先于 160 行焦点守卫」的现状语义），断言 loading 保持 → 普通 Esc 后 loading/open 均 false。
- **判别力**：撤掉守卫则组合态 Esc（key 仍为 'Escape'）命中关闭条件，`expect(cardsLib.cardPageOpen).toBe(true)` 与加载态 `expect(cardsLib.cardPageLoading).toBe(true)` 均会失败——用例对本次修复有区分度。
- **姿势先例**：与本文件 246 行既有用例同款 `new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true })`；`waitFor` 为 67 行既有 helper；关闭动画用条件等待，优于既有固定 setTimeout 先例。KeyboardEventInit 的 `keyCode` 字段 jsdom 实测支持（用例通过）。

## 4. 抽查复验 —— 通过

亲跑 `npx vitest run tests/boot.test.js`（00:06:55）：
> Test Files 1 passed (1) / Tests 15 passed (15)（含新用例 458ms）

输出尾部无 Unhandled Errors 段。stderr 有 3 条 `[SDT.BattleFrames] PixiJS init failed: Unable to auto-detect a suitable renderer`（jsdom 无 GPU 下 battle.frames.js:166 捕获降级的既有告警，非 unhandled）。实施者所述「首轮 1 个 teardown 后 PixiJS timer Unhandled、复跑不复现」与本轮结果相容（本轮未复现，无法证伪首轮，但按实施者定性为既有抖动可信）。

## 5. 移交项定性 —— 建议立单（P3，登记 PENDING 待拍板，不阻塞 U3）

- **存在性核实**：函数级无守卫调用点实际在 **boot.js:183**（fix 单 §4 与派工单均写「boot.js:191」，行号引错）——`case 'moveCancel'`（:174）体内 `if (!UI.el.overlay.hidden && UI.closeTopOverlayByEsc()) break;`。body 焦点（不命中 :160 INPUT/TEXTAREA 焦点守卫）+ 组合态 Esc + overlay 开启时，经 `SDT.Input.actionFor` 映射 moveCancel 关浮层。
- **影响面**：窄。ui.js 侧 Esc（:79 捕获级）与 ×按钮/背景点击（:53/:56）已有守卫或非键盘路径；agent.runner.js:137 为合成动作非玩家输入。Windows 下组合态通常伴随可编辑焦点（此时 :160 守卫先 return），body 焦点组合态属边缘场景（Chrome 下 body 可成为组合目标，理论可达）。同家族一行守卫可修，建议登记待拍板，P3。

## 6. make-work 检查 —— 通过

修复对应已记录事故家族（ui.js:79/356 为历史同族补丁），P1 玩家可见；测试真 DOM 路径且有判别力；无冗余文件、无过度抽象、无顺手改动。

## 备注

1. fix 单 §4 及派工单的「boot.js:191」应为 **boot.js:183**（grep 实测唯一调用点），登记移交单时以 183 为准。
2. 257 分支守卫插位（监听器首行）与 ui.js:79（Escape 判断内）略异，等价无害，见第 2 节。
3. git 提示 boot.test.js「LF will be replaced by CRLF」为该文件既有换行状态，非本次引入。

verdict: PASS WITH NOTES（代码与测试全部通过验收标准①②③及亲跑复验；备注仅为移交项行号勘误与守卫插位说明）
