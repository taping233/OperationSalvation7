# U1 复审单：captureBattleContext window 守卫（review-U1-0058）

- 复审者：R1（夜班三代理编制，第三方独立复审，非实施者/非发现者）
- 时刻：2026-09-29 23:49（时间盒内完成）
- 复审对象：工作树未提交改动 `game/src/battle/battle-loader.js`（基线 HEAD 5384bfd）
- 对应修复单：docs/evidence/2026-09-29-nightshift/fix-U1-0042.md（已读）
- 红线遵守：全程只读（唯一写入本单），未 git 写操作、未 npm install、未碰 winter.css / page-rewards-bag-help.css / package-lock.json。

## 1. diff 正确性 — PASS

裸 window 触达点全枚举（`grep -n "window" game/src/battle/battle-loader.js`，函数内共 3 处语义触达）：

- L16 默认参数：`getSlot = () => window.SDT?.Base?.slot`
- L21：`const registeredGame = window.SDT?.game;`
- L28（谓词内）：`window.SDT?.game === registeredGame`

守卫覆盖论证：

- **默认参数求值时机**：默认值表达式在调用时只创建箭头函数，箭头**体**仅在 `getSlot()` 被调用时才求值。该箭头体的全部调用点为 L22 `const slot = getSlot();` 与谓词内 L28 `getSlot() === slot`。L19 `if (typeof window === "undefined") return () => false;` 位于 L22 之前——window 缺失时提前返回，L22 不可达；谓词内 L26 `if (typeof window === "undefined") return false;` 位于 L28 之前。早退分支返回 `() => false`，从不调用 `getSlot()`。**守卫赶在默认参数体求值之前，成立。**
- 自定义 getSlot 调用方（`game.run.altar.js:379`、`game.menu.js:713`、`game.menu.js:741` 均传 `getActiveSlot`）：L19 第一层守卫先于任何 `getSlot()` 执行，透明受益；若 window 在「捕获后、谓词调用前」消失，L26 第二层守卫赶在 `getSlot()` 之前。完整。
- `typeof window === "undefined"` 对未声明标识符不抛错（对比 `window === undefined` 会抛），是 teardown 删全局后的正确判法。
- 触发链实证：`game.run.scenes.js:143` `timer = setTimeout(finish, turboMs(duration));` → L128 `if (!isCurrent()) { resolve(false); return; }` → L119 `isCurrent = () => currentContext() && ...` → 谓词。修复后该链在 window 缺失时返回 false，不再触达 L28 裸 window。

## 2. 浏览器语义不变性 — PASS

对照 diff 前后原文：

- 旧谓词（diff − 行）：`return () => (contextVersions.get(game) || 0) === version && (!registeredGame || registeredGame === game) && window.SDT?.game === registeredGame && getSlot() === slot && keys.every((key, index) => game[key] === values[index]);`
- 新谓词（L27-29）：`return (contextVersions.get(game) || 0) === version && (!registeredGame || registeredGame === game) && window.SDT?.game === registeredGame && getSlot() === slot && keys.every((key, index) => game[key] === values[index]);`

**return 表达式逐字相同**（三个 && 子句、短路顺序、操作符、空格均未动）；快照行 L20-24（version/registeredGame/slot/keys/values）内容与顺序未动。谓词所有 `&&` 操作数均为布尔（`===`/`!`/`every`），故箭头表达式体 → 块体 + 显式 return 的返回值逐值一致。浏览器内 `typeof window === "undefined"` 恒为 false，两层守卫不可达。唯一行为差仅在 window 缺失场景：原抛 `ReferenceError`（未定义行为），现返回 `false`（上下文失效语义，与 `invalidateBattleContext` 方向一致）——即修复目标本身，浏览器不可达。论证成立。

## 3. 同文件扩大面评估 — 待议（只评估，不要求本次修）

`grep -n "window"` 其余裸点：L34、L39（均在 `ensureBattleReady`）、L66-67（`startBattle` catch 块）。

- **L39**（`battlePromise` 的 `.then` 回调内 `const battle = window.SDT?.Battle;`）：若 teardown 发生在 promise 挂起期，此处裸 window 抛 ReferenceError → promise 拒绝 → `startBattle` catch L62 `if (!isCurrent()) return false;`。修复后 `isCurrent` 内 `currentContext()` 在 window 缺失时安全返回 false → **在触达 L66-67（catch 块裸 window `window.SDT?.UI?.log` / `refresh`）之前返回 false**。L66-67 经此链被间接闭环；副作用是 L63 `recordDiagnostic('battle-loader', error)` 不落（window 已拆，诊断无意义，可接受）。
- **L34**（`ensureBattleReady` 入口同步读 `window.SDT?.Battle`）：经 `startBattle` 调用时同样被「catch + isCurrent」闭环；但 L72 `sdtDefine('BattleLoader', ... { ensure: ensureBattleReady ... })` 将其直接导出——**测试 teardown 后若有挂起定时器/微任务直接调 `SDT.BattleLoader.ensure()`，L34 仍会同步抛 ReferenceError**。当前测试套件无此触发路径（potion-tip 在测试体内 `await window.SDT.BattleLoader.start(...)`，L76），属理论暴露面。
- 备注：L37/41/42 `performance.mark?.` 不涉 ReferenceError（node 有 `globalThis.performance`）。

结论：本次修复未引入新暴露面；残余为 L34 的直接外部 ensure 路径（当前无触发者）。建议挂账待议，不构成本次修复缺陷。

## 4. 抽查复验 — PASS

复审者亲跑 `npx vitest run tests/potion-tip.test.js`（2026-09-29 23:49，vitest v3.2.7）：

```
✓ tests/potion-tip.test.js (1 test) 879ms
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  5.62s
```

输出止于 Duration，**无 Unhandled Errors 段**。stderr 中 `[SDT.BattleFrames] PixiJS init failed` 为既有被捕获噪声（battle.frames.js 自行 catch 后打印），非 unhandled。

## 5. make-work 检查 — PASS（真问题的真修复）

- 触发链真实：scenes.js L143 `setTimeout(finish, ...)` 可在测试环境拆除后触发，finish → isCurrent → 谓词，旧代码谓词裸引 window 必抛 → vitest Unhandled Errors → EXIT=1（全量跑抖动的机制自洽；实施者根因链路已按原文核对，调度长简报同口径）。
- 修复最小且落在确切抛点（两层守卫恰好覆盖捕获期与谓词期两条执行期），语义方向正确（环境不在 = 上下文必然失效），未改签名、未改调用方、未改 scenes.js。
- 非表演性：守卫删除后问题必然回归（裸 window 触达点是客观存在的，见第 1 条枚举）。

## 总 verdict

**PASS WITH NOTES**

备注清单：
1. L34 `ensureBattleReady` 入口裸 window：teardown 后直接调 `SDT.BattleLoader.ensure()` 仍会同步抛（当前无测试触发路径，理论暴露面，建议挂账）。
2. L66-67（catch 块）的安全性依赖「isCurrent 谓词守卫先行」这一间接闭环；后续若有人调整 catch 内判序或 isCurrent 定义，需重新核对此链。
3. 根因「teardown 后 window 被删」为实施者/调度长核对结论，失败态系时序抖动、复审者未能按需复现；但触发链、守卫逻辑与定向验证（本人亲跑 1 次绿 + 实施者 3 连跑记录）相互印证，予以采信。
