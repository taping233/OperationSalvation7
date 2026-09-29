# find-A-0036 —— 开采者 A · 已知坑家族同类机制排查（2026-09-29 夜班）

范围：game/src 全部键盘输入处理点、inert 隔离名单、跨模块可变绑定、监听器/定时器配对、localStorage 健壮性。只读审计，引用均为原文。

---

## P1

### F-001 | P1 | game/src/game.boot.js:257
```js
if (e.key === 'Escape' && !e.defaultPrevented && cardPageOpen && !cardPageLoading && !UI.el.overlay.hidden) closeCardPageTop();
```
为什么是问题：卡牌大页的 Esc 关闭挂在 window 冒泡级、无 isComposing/keyCode 229 守卫——焦点在卡牌库搜索框（#cardSearch）或设计器 textarea 打中文时，按 Esc 取消候选词会误关整个大页（正是历史 IME 事故家族；ui.js:79/356 同类点均已加守卫，此处遗漏）。
建议修法：分支前补 `if (e.isComposing || e.keyCode === 229) return;`。

### F-002 | P1 | game/src/game.boot.js:152-154
```js
if (e.key === 'Escape' && cardPageLoading) {
  e.preventDefault();
  e.stopImmediatePropagation();
```
为什么是问题：同文件 158 行才有 INPUT/TEXTAREA 焦点守卫，此 Esc 分支在守卫之前执行且用 stopImmediatePropagation 强关大页、无 isComposing 守卫——大页加载态下输入法组合中的 Esc 同样误关并吞事件。
建议修法：与 F-001 同一 handler 内统一补 isComposing 守卫（一处覆盖两分支）。

## P2

### F-003 | P2 | game/src/battle/view/battle.layers.js:57-58
```js
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
```
为什么是问题：战斗 Esc（取消瞄准/点选/灌注）无 isComposing 守卫；战斗中可开开发者控制台（含 #devcSearch 输入框），输入法组合中按 Esc 会误取消瞄准/选牌而非仅取消组词。
建议修法：Esc 分支内补 `if (e.isComposing || e.keyCode === 229) return;`（口径对齐 ui.js:79）。

### F-004 | P2【待核实】 | game/src/ui/overlay.js:339
```js
if (sibling.id === 'sugLayer') continue;
```
为什么是问题：inert 排除名单仅 `#sugLayer`，而 #logPanel（行动记录，带可点的 #logToggle 按钮，index.html:308）同为 #overlay 兄弟层，开任意弹层（背包/商店/事件）即被整层 inert——弹层里无法展开/查看行动记录；#bagBtnFloat 已有 hud.js:144-146 观察器对冲，#logPanel 无任何对冲。
建议修法：先与老板核对设计口径（弹层内是否应可查行动记录）；若应可查，比照 #bagBtnFloat 加对冲或扩排除名单。

## P4

### F-005 | P4 | game/src/run/lab.ending.js:83
```js
if (e.key === 'Escape') { finish(); return; }
```
为什么是问题：通关演出 Esc 直接跳过演出、无 isComposing 守卫（演出页无输入框，实际触发需 IME 组合态残留，风险低，属家族一致性补齐）。
建议修法：顺手补同款守卫，或确认演出链无输入点后接受现状。

---

## 家族排查结论（未发现新违规的家族）

- **家族 3（跨模块可变绑定）**：setter 化已完成——battle.runtime.js:2-7 注释明示「重导出保留活绑定 + set$Xxx」，kernel 有 `_set_dpr/_set_cam`，cardslib 有 `setCardPageOpen`；全库 `^export let` 命中均为同模块内重绑 + 他文件只读（活绑定），未发现遮蔽/快照新违规。
- **家族 4（监听器/定时器）**：抽查 game.boot.js(37 处)/game.menu.js(21 处)——设置页每次 innerHTML 重建挂新节点、titleExtrasBoundGlobal 与 `.ak-back-tl` 存在性守卫防重；battle.frames.js pollTimer 有 :508 clearInterval；lab.ending.js stopType/removeEventListener 在 finish() 配对；pocket-strip.js 有 started 守卫且常驻装饰层不清理属设计。未发现不配对。
- **家族 5（localStorage 健壮性）**：抽查全部 JSON.parse 站点（cards.js/input.js/card-photo-notes.js/agent.recorder.js/recoverable-pair.js/recovery.commands.js/feedback.local.js/diagnostics.local.js/agent.llm.js/cards.sync.js/backfiller.js）均在 try/catch 内；对局档走 SAVE_VERSION + versioned-slot-reader 版本管线。未发现新违规。

发现 5 条（P1×2，P2×2，P3×0，P4×1）
