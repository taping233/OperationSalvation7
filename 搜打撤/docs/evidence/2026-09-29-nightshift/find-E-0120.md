# find-E-0120 · 测试 teardown 后触发面专项深挖（开采者 E，2026-09-29 夜班）

只读审计产出。对象：`game/src` 全部 117 处 `setTimeout|setInterval|requestAnimationFrame|queueMicrotask`（38 文件，19 文件有 clearTimeout/clearInterval/cancelAnimationFrame 清理通道），逐点甄别「宿主环境拆除后仍会执行的异步面」。
证据基准：`docs/evidence/2026-09-29-nightshift/vitest-final-4u-clean.log`（EXIT=0 全绿基线）、`vitest-final-4u.log`、`vitest-final-batch2.log`、`vitest-baseline-T0.log`。

---

## 高危清单（teardown 后可致 unhandled ReferenceError；结构实锤，标注今晚是否实测触发）

### H1 【最重要】pocket-strip.js:91 —— tick 回调裸引 `window`，600ms 永久 interval 无清理通道（与已修 U1 完全同构）

`game/src/experience/pocket-strip.js:90-93`（回调逐字）：
```js
function tick() {
  const SDT = window.SDT;
  const game = SDT && SDT.game;
  if (!game) return;
```
同文件 `139-147` 挂载（句柄未保存、无任何清理通道）：
```js
export function startPocketStrip() {
  if (started) return;
  started = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setInterval(tick, POLL_MS));
  } else {
    setInterval(tick, POLL_MS);
  }
}
```
- **触发链推导**：`game.boot.js:24` 在模块装配期显式调用 `startPocketStrip()`（注释：「模块内部自带 DOMContentLoaded/防重入处理」）→ boot.test.js 经 `await import('../game/src/main.js')` 必然装入 → setInterval(600ms) 注册 → jsdom teardown 删除 `window`/`document` 全局（baseline-T0.log:858 实证 teardown 后 `window` 会变 undefined）→ 下一个 tick 首行 `window.SDT` 抛 `ReferenceError: window is not defined`，回调无 try/catch（94 行只包了 decorateChapters）→ unhandled。
- **今晚日志**：零触发（全部日志无 pocket-strip 报错）。疑被「jsdom 关窗时回收其名下定时器」掩盖；但同日志里 battle.frames/settle 链的 `processTimers (node:internal/timers)` 栈证明部分 Node 层定时器确实穿透 teardown——掩盖前提脆弱，不建议依赖。
- **建议修法（最小侵入）**：`tick()` 首行加 `if (typeof window === 'undefined') return;`（与 U1 battle-loader.js:19 守卫同款式）；可选加固：保存 interval 句柄供测试 teardown 清理。

### H2 chests.js:389 —— 逐卡揭晓音效定时器裸引 `document.querySelector`

`game/src/run/chests.js:387-396`（回调逐字）：
```js
function scheduleRevealSfx() {
  (cur.cards || []).forEach((c, i) => {
    setTimeout(() => {
      const hand = document.querySelector('.bt-hand');
      if (!hand) return;
      SDT.Sound.sfx('reveal');
```
- **触发链推导**：开箱揭晓（`266` 的 `setTimeout(() => { … render(); scheduleRevealSfx(); }, delay)`）→ scheduleRevealSfx 为每张卡挂一个无句柄、无 catch 的 setTimeout（时值随卡序叠加）→ 若测试在揭晓后立即收尾，后续卡的定时器跨 teardown 触发 → 首行裸 `document.querySelector` → unhandled ReferenceError。`266` 回调内的 `render()` 同链（DOM 写）。
- **今晚日志**：未观测触发。结构同 H1/U1（裸宿主 API + 无守卫 + 无清理）。
- **建议修法**：回调首行加 `if (typeof document === 'undefined') return;`；或 scheduleRevealSfx 收集句柄、openChests 收尾时统一 clear。

### H3 cardslib.page.js:716 —— 关页摘类定时器裸引 `document.body`，唯一守卫是模块状态位

`game/src/hub/game.cardslib.page.js:716`（逐字）：
```js
setTimeout(() => { if (!cardPageOpen) document.body.classList.remove('cardlib-open'); }, 240);
```
- **触发链推导**：`closeLibPage()` 摘 `cardlib-open` 必等 240ms 淡出（注释载明防闪烁根因）→ boot.test.js「卡牌大页 Esc 关闭与加载态强关」用例在关页后数百毫秒内收尾 → 定时器跨 teardown 触发 → `cardPageOpen` 是模块内存状态（teardown 不改它，仍为 false）→ 直达裸 `document.body` → unhandled。句柄未保存、无清理。
- **今晚日志**：未观测触发（时序窗口窄）。
- **建议修法**：`if (typeof document === 'undefined' || cardPageOpen) return;`（一处前置，语义不变）。

### H4 cinematics.js:81 —— 发卡演出排队 `setTimeout(showNext, 100)`，showNext 直写 `document.body`

`game/src/ui/cinematics.js:80-81` 与 `30-31`（逐字）：
```js
        setTimeout(() => el.remove(), 420);
        setTimeout(showNext, 100);
```
```js
    el.addEventListener('click', close, { once: true });
    document.body.appendChild(el);
```
- **触发链推导**：多张卡连发（grantEventCard 排队，scenes.js:292 注释「多张连发自动排队逐张播」）→ 每张收尾后 `setTimeout(showNext, 100)` 拉下一张 → showNext 走 `document.body.appendChild` → 测试在队列中途收尾 → 下一棒跨 teardown 触发 → 裸 `document.body` → unhandled。对比同文件 36 行 `setTimeout(() => { if (el.isConnected) close(); }, 2800)` 有守卫，81 行没有。
- **今晚日志**：未观测触发。
- **建议修法**：showNext 入口加宿主守卫（与 36 行同款 `typeof document === 'undefined'` 短路），或队列 token 断链。

---

## 中危清单（确定性噪音，今晚日志实测复现）

### M1 【最重要】settle 过场定时器 resolve 后的续流无宿主检查 → hud.js:90 `document.createElement` 抛错（U1 的残余暴露面，两种 stderr 形态同根）

报错原文（`vitest-final-4u-clean.log:321-329`，`vitest-final-4u.log` 与 `vitest-final-batch2.log` 同现）：
```
stderr | Console.wrappedError [as error] (…\game\src\core\diagnostics.local.js:123:22)
[battle:settle] 战后结算未完成 ReferenceError: document is not defined
    at Object.log (…\game\src\ui\hud.js:90:17)
    at run (…\game\src\hub\game.bag.settle.js:278:45)

stderr | Console.wrappedError [as error] (…\game\src\core\diagnostics.local.js:123:22)
[Bus] battle:end 异步订阅者异常: ReferenceError: document is not defined
    at Object.log (…\game\src\ui\hud.js:90:17)
    at retry (…\game\src\hub\game.bag.settle.js:65:10)
```
代码原文（定时器本体，`game/src/run/game.run.scenes.js:124-133,144`，U1 修复后现状）：
```js
    const finish = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (!isCurrent()) { resolve(false); return; }
      UI.hideOverlay();
```
```js
    timer = setTimeout(finish, turboMs(duration));
```
消费者（`game/src/hub/game.bag.settle.js:271-278`，逐字）：
```js
      if (settlement.phase === 'pocket') await showRunTransition({
        tone: 'exit', asset: 'scene-extract-bg',
        …
      });
      if (!sameRun()) return false;
      if (settlement.phase === 'pocket') UI.log('[[icon:runner]] ' + (…), 'sys');
```
落点（`game/src/ui/hud.js:89-90`）：
```js
  log(msg, cls) {
    if (!this.el.log) return;   // 日志面板已从前台移除，仅保留内部记录入口
    const div = document.createElement('div');
```
- **触发链推导**：测试内战斗结束进结算 → `showRunTransition` 挂 900~1050ms 过场定时器，测试不等它播完即收尾 → teardown 后定时器触发 → `finish()` 里 U1 守卫生效：`isCurrent()` 返回 false → `resolve(false)`（定时器回调自身不再抛，U1 目标达成）→ **但 await 侧不看 resolve 值**：续流里 `sameRun()`（settle:49-57，只比对内存 game 字段与 RunStorage，不查宿主）仍为 true → `settlement.phase === 'pocket'` 成立 → `UI.log` → hud.js:90 `document.createElement` → `document is not defined` → 该 async run() 整链 reject → `.catch(error => sameRun() ? retry(error) : false)`（settle:264）→ retry → settle:65 `UI.log` 再抛 → 以 `battle:end` 订阅者异常形态二次落 stderr。两形态=一条链两跳。
- **性质**：被 diagnostics wrappedError / Bus 订阅 catch 兜住，非 unhandled、不红测试，但每次相关用例（hero-cards、boot 等）必刷，且语义错误（teardown 后本应静默终止）。
- **建议修法（最小侵入，选一）**：① settle 两处 await showRunTransition 之后（或 retry 入口首行）加 `if (typeof document === 'undefined') return false;`——与 U1「宿主没了=必然失效」同一语义；② hud.log 首行加同款守卫（覆盖面更广，但动 UI 层）。

### M2 battle.frames.js:166/437 —— jsdom 无 WebGL → Pixi init failed warn + processTimers 栈，每跑战斗类用例必刷（caught 噪音）

报错原文（`vitest-final-4u.log:171-178`；clean/batch2/baseline 日志同现）：
```
stderr | tests/boot.test.js > 启动链（DOMContentLoaded → showTitle） > 战斗指向卡支持点击选中、Esc取消与目标结算
[SDT.BattleFrames] PixiJS init failed: Error: Unable to auto-detect a suitable renderer.
    at autoDetectRenderer (…/@pixi/core/lib/autoDetectRenderer.mjs:8:9)
    at new _Application2 (…/@pixi/app/lib/Application.mjs:10:34)
    at D:\素材\代号柒\搜打撤\game\src\battle\view\battle.frames.js:166:17
    at runNextTicks (node:internal/process/task_queues:64:5)
    at processTimers (node:internal/timers:538:9)
    at attach (D:\素材\代号柒\搜打撤\game\src\battle\view\battle.frames.js:437:14)
```
代码原文（`battle.frames.js:190-194` catch 与 `437` 调用点）：
```js
  })().catch(error => {
    console.warn('[SDT.BattleFrames] PixiJS init failed:', error);
    appPromise = null;
    return null;
  });
```
- **触发链推导**：boot.test.js / potion-tip.test.js 走真实战斗渲染 → attach() → ensureApp() → `new Application(...)` 在 jsdom（无 WebGL）必然抛 → 模块 catch 后 console.warn → ensureApp 返回 null。下游 `wakeRenderer`/`startLoop`/`hide` 均有 `if (!rt) return` 守卫，pollTimer/renderHoldT 不会挂——**仅剩 warn 噪音本身**，stderr 里带 processTimers/processTicksAndRejections 栈（原生 `new Image`/localStorage 等未见由此升级）。potion-tip.test.js 的 U1 unhandled 已根治，现残留即此 warn（clean.log:314-319 可证）。
- **建议修法（最小侵入）**：ensureApp 入口探测测试环境直接降级：`if (typeof process !== 'undefined' && process.env?.VITEST) { appPromise = Promise.resolve(null); return appPromise; }`（与 battle.clock.js isTestRuntime、battle.engine.js VITEST 置零同款式）；或仅把该 warn 在 VITEST 下静默。

---

## 低危/无害（只计数不展开）

共约 96 处，分四组：
1. **有 isConnected / 短路守卫**（约 20 处）：ui/ui.js×8（含 376 `photoSourceTimer`——`!el.isConnected` 短路在 `document.baseURI` 之前，安全）、ui/game.menu.js×8、battle/view/battle.view.js:472、hub/game.cardslib.page.js:612、ui/overlay.js:237（44/183-186 有双通道清理）、battle/aim.js 全部 rAF/事件监听（拆除后 rAF 不再触发）。
2. **测试态置零或显式文档守卫**（约 10 处）：battle.engine.js:652（VITEST→0ms+abort 清理）、battle.enemy-phase.js:151（VITEST setTimeout(0)+stillEnemyPhase+catch）、battle.clock.js 全部（isTestRuntime→Promise.resolve）、audio/sound.js:457（`typeof document === 'undefined'` 守卫）。
3. **分离节点安全**（remove/classList/textContent 对 detached 节点合法，约 30 处）：ui.js:329、battle.layers.js:35、battle.hover.js:72/81、cinematics.js:36/80、cardslib 452/460/633、game.boot.js:712-714、game.nest.js:96/133（`if (SDT.Sound)` 守卫）。
4. **纯数据/纯逻辑或有 catch**（约 36 处）：renderer.js:92、renderer.fx.js:23、sound.js:81、battle.engine.js:88-89（battleActive 数据守卫+渲染 try/catch）、game.run.flow.js:91（watchdog 在 finish 内自清，tick 走 rAF 拆后自停）、altar.js:78（catch 已挂）、renderer/camera/map-reveals（typeof rAF 守卫）、agent.llm/runner（abort/clearTimeout 齐）、perf-probe.local（dev-only+rAF 自停）、feedback.local.js:87（URL.revoke 纯 API）、lab.ending.js:64/92（测试未加载+分离节点安全）等。
- 注记（同构但未入高危，触发面窄）：`game.hub.depart.js:342` `setTimeout(startChoice, turboMs(520))` → hub 渲染摸 document，需启程页动画窗口内收尾才触发，日志未见。

---

## 汇总

- 高危 4 条（全部「裸宿主 API + 回调无守卫/无清理」同构；仅 H1 有入口必装的永久 interval，其余为结构暴露、今晚未实测触发）；中危 2 条（均有日志逐字实锤）。
- **最重要 2 条**：H1 pocket-strip.js:91——入口必装的 600ms 永久 interval 回调裸引 `window`，U1 的完全同构复刻，守卫一行即根治；M1 settle 过场续流——U1 只堵了定时器回调内部，resolve 后的 await 续流仍会摸 `document`，这是当前日志里唯一持续复现的 teardown 后宿主引用报错。
- 中危不足 3-10 条预期的原因：宁缺毋滥——其余 111 处经逐点甄别均有守卫、测试态置零或属分离节点安全/纯数据回调，无一条能给出代码原文+触发链的确定性噪音论证。
