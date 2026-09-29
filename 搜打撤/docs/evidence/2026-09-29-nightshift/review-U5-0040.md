# 复审单 U5（R4 独立复审，00:40 班次）

- 复审人：R4（夜班三代理编制第三方，只读复审，唯一写入即本单）
- 对象：工作树未提交改动 fix-U5-0130（基线 HEAD `6cc2cf4`）
- 方法：git diff/HEAD 对照 + 调用方全量 rg + 亲跑 vitest（命令与输出见 §5）
- 时间：2026-09-29 00:40 前后，时间盒 20 分钟

## 1. diff 最小性与红线

`git diff --numstat`（4 目标文件）：

```
8       0       game/src/battle/battle-loader.js
6       0       game/src/hub/game.storage.js
27      0       tests/e4-battle-loader.test.js
20      0       tests/save-compat.test.js
```

61 插入 0 删除，与修复单宣称一致。逐文件 `git show HEAD:...` 对照 game.storage.js：仅 3 处纯新增 hunk（PREV_KEY 常量+注释 3 行、write 备份 2 行、remove 清理 1 行），主写路径逐字未动。附件 `fix-U5-0130.diff`（121 行）与实况 diff 逐字一致（仅 index 行差异，比对输出 `ATTACH-MATCH`）。工作树其余改动（AGENTS.md/docs/CSS/package*.json）属他班在制品，本班未触碰，与修复单基线声明吻合。红线（css/winter.css、page-rewards-bag-help.css、package*.json、cards-sync.json）均不在本班 4 文件内。**结论：无夹带、无删除行，通过。**

## 2. U5-a throw 形态 vs 调用方捕获（逐调用方）

`ensureBattleReady` 为 async 函数，`throw` 即 rejection。全量 rg（game/src + tests）调用方恰为 3 处，均有捕获：

1. **startBattle**（battle-loader.js:66）：`const battle = await ensureBattleReady();` 位于 `try {`（65 行）内，`catch (error)`（69 行）先 `if (!isCurrent()) return false;`——`isCurrent` 首调 `currentContext()`，即 captureBattleContext 谓词（26 行 `if (typeof window === "undefined") return false;`），window 消失时提前返回，catch 内 74-75 行 `window.SDT?.UI` 不会裸引用。✓
2. **game.run.altar.js:75**：`const warmBattleRuntime = () => ensureBattleReady().catch(error => console.warn('[battle-loader] 选角页后台预取失败', error));` ✓
3. **game.menu.js:760**：`await ensureBattleReady();` 位于外层 `try {`（745 行）内，`catch`（772 行）先 `if (!currentContext() ...) return false;` 同样由守卫谓词短路；该 ensureBattleReady 由 game.session.js:398 注入 menuController。✓

`SDT.BattleLoader.ensure` 无其他外部调用方（tests 仅 potion-tip.test.js:76 用 `BattleLoader.start`，走 startBattle 的 try）。不存在无捕获调用方，「reject 而非同步抛」的选型成立。**结论：通过。**

## 3. U5-b write() 逐行对照

- 主写语义：HEAD 对照仅 3 个纯新增 hunk；txPending 门（131 行）、基线失配 STALE_SLOT（136 行）、无基线已有身份拒绝（142 行）、身份递增（146-147）、`setItem(RUN_KEY, nextRaw)`（151）、writeBaseline 推进/issue 清理/reader.invalidate/CORRUPT 清理/返回值全部逐字未动。✓
- 转存不外溢：备份行 150 `if (currentRaw) { try { localStorage.setItem(PREV_KEY(index), currentRaw); } catch { } }`——`PREV_KEY(index)` 求值也在 try 内，键构造异常同样被吞；不可能落入外层 catch 误标 `'STORAGE'`。置于 `JSON.stringify`（148）之后：stringify 抛出时不触备份不主写，与原行为一致。✓
- 主写失败时序：备份成功后主写若因 quota 抛出，prev==current（旧档仍在主键），无害。✓
- remove()（164 行）：内层独立 try/catch 嵌在外层 try 内，异常不可能外溢影响返回值；write/remove 均全同步无 await，单线程下不存在「备份后、主写前」被 remove 插队删除 prev 的时序；remove 连同主档一起清 prev，语义正确。✓
- API 面：PREV_KEY 未导出（190 行 export 清单无它）、未挂 RunStorage；rg 全库无任何 PREV_KEY 读取方（纯写入备份，消费端留待后续，与修复单「未挂公共面」宣称一致）。migrateLegacy 直写 RUN_KEY(1) 仅发生在空槽迁移（182 行 `!localStorage.getItem(RUN_KEY(1))` 门），无 prev 交互。✓

**结论：通过。**

## 4. 测试有效性

- e4 新增 describe 前该文件 beforeEach 已有 `vi.resetModules()`（11 行），每个用例拿到全新 battle-loader（battlePromise=null），无跨用例模块态污染；新增 afterEach `vi.unstubAllGlobals()` 恢复 jsdom window。
- 用例 1（stub window=undefined 后直调）：断言 `message).toContain('宿主环境已拆除')`——该文案为新守卫独有，无守卫时 jsdom 下裸 `window.SDT` 抛 TypeError（文案不同），断言可区分，目标分支真实驱动。✓
- 用例 2（doMock 工厂内拆 window）：import 完成→then 回调，无守卫时报错文案应为「战斗模块加载后未注册 SDT.Battle」，断言文案锁定新守卫分支；经既有 `.catch`（battlePromise 置 null）传导。✓
- save-compat 新增用例走公共 write/remove 真实链路：首次写无 prev、二次覆盖 prev=上一版原串、三次滚动、remove 双清；键名以字面量 `'sdt-run-2-prev'` 断言锁死契约；beforeEach `localStorage.clear()` 保证隔离。✓
- 「boot 真实 window 链路」覆盖属实：boot.test.js:269-279 `await ensureBattleReady()` 后断言 `window.SDT.Battle` 发布、`getSnapshot`/`commands` 可用——浏览器路径（守卫分支不可达）行为不变有实测。✓

**结论：3 例（e4×2 + save-compat×1）均真实驱动目标分支，通过。**

## 5. 亲跑复验

对 `rg -l "battle-loader|game.storage|RunStorage" tests/` 命中的全部 36 文件执行 `npx vitest run`：

```
 Test Files  36 passed (36)
      Tests  354 passed (354)
```

全绿，无 Unhandled Errors 段。stderr 中 `[SDT.BattleFrames] PixiJS init failed` 为 jsdom 无渲染器的既有环境噪音（来源 battle.frames.js，本班未触碰，boot.test.js 各用例自身均 ✓）。

## 6. make-work 检查

非 make-work：U5-a 对应测试 teardown 场景真实可达的 unhandled ReferenceError，且与库内既有定式（captureBattleContext 9d7b871 谓词守卫，见 battle-loader.js:17-19/26）一致，仅 2 行；U5-b 补的是「写基线只防并发不防逻辑坏档」的真实缺口，3 行最小方案（调度长已拍板），测试无一例同义反复。

## 备注（不影响判定）

- 修复单引「startBattle（同文件 58 行）」在守卫注释加入后实际为 60 行/await 66 行，行号漂移，非实质错误。
- PREV_KEY 当前为只写备份、库内无读取方，恢复价值待后续接入消费端才落地——与修复单宣称一致，仅在此留账。

## Verdict

**PASS WITH NOTES**（改动最小、调用方捕获齐全、主写逐字未动、测试真实驱动、354 全绿；备注两条仅留账不要求返工）
