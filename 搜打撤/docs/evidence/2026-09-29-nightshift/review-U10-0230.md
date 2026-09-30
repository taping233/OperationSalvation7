# review-U10-0230 · 第三方独立复审（R6）· teardown 守卫收口五文件 + M1

- 复审人：R6（只读复审，非实施者非发现者）；时间 2026-09-29 02:00-02:15，HEAD `854f07e`。
- 对象：工作树未提交改动五文件（pocket-strip.js / run/chests.js / hub/game.cardslib.page.js / ui/cinematics.js / hub/game.bag.settle.js）+ tests 新增 2 文件 7 用例；对照修复单 `fix-U10-0220.md` 逐条验证。
- 方法：git diff 逐行审 + 原文契约核验 + 现场负验证实验 + 亲跑定向测试。

---

## 1. diff 最小性 —— 通过

五文件 `git diff` 逐行核对，改动仅守卫与 M1 检查，无夹带：

- pocket-strip.js +2：`function tick() {` 后仅注释 + `if (typeof window === "undefined") return;`。
- run/chests.js +2：`scheduleRevealSfx` 的 `setTimeout(() => {` 后仅注释 + `if (typeof document === "undefined") return;`，后续 `document.querySelector('.bt-hand')` 等原文未动。
- ui/cinematics.js +2：`const showNext = () => {` 后仅注释 + `if (typeof document === "undefined") return;`。
- cardslib.page.js +3/-1：原行 `setTimeout(() => { if (!cardPageOpen) document.body.classList.remove('cardlib-open'); }, 240);` 替换为注释行 + `setTimeout(() => { if (typeof document === "undefined") return; if (!cardPageOpen) document.body.classList.remove('cardlib-open'); }, 240);` —— **H3 的 `!cardPageOpen` 防闪烁判定逐字保留、顺序不变**（diff 原行/现行逐字对照）；其上三行防闪烁注释块（713-715 行）未动。
- game.bag.settle.js 两处块包裹：撤退/胜利两处 `await showRunTransition({...})` 的全部参数（tone/asset/eyebrow/title/detail/duration）逐字未动，仅外加 `const shown = await` 与 `if (shown === false) return false;`；两处各自的后续 `if (!sameRun()) return false;` 及以下原文未动。

工作树中 winter.css、page-rewards-bag-help.css、package.json、package-lock.json、docs 台账等其余未提交改动为并行班次既有占用（PARALLEL-REGISTRY 在案），非本班夹带，未纳入本单审查面。

## 2. 逐守卫位置审查 —— 通过

四条守卫均置于该回调/分支可执行首行：

- H1：`tick()` 函数体第一行，先于 `const SDT = window.SDT;`。生产 window 恒在，死分支。
- H2：音效 setTimeout 回调第一行，先于 `document.querySelector`。
- H3：摘类 setTimeout 回调第一行，先于 `document.body` 与 `!cardPageOpen` 判定。无「守卫放错分支」风险——守卫只可能提前终结 teardown 后的回调，正常路径 `typeof document` 恒为实值，不触发。
- H4 三路覆盖逐一核实（cinematics.js 43-83 行原文）：(a) 同步入口——showCardReward 末尾 `showNext();`；(b) 定时器续棒——close 内 `setTimeout(showNext, 100)`；(c) 递归——归属校验分支 `if (this._cardGetQueue.length) { showNext(); return; }`。三路全部进入 showNext 闭包首行守卫，覆盖声明属实。守卫短路在 `this._cardGetShowing` 复位逻辑之前，teardown 后该标志不复位——仅测试环境内存态，无生产影响（见备注 2）。

## 3. M1 语义审查（本单核心）—— 通过

**契约原文核验**（game/run/game.run.scenes.js:110-148）：`finish()` 内 resolve 恰两处——`if (!isCurrent()) { resolve(false); return; }`（此分支**不调 UI.hideOverlay、不恢复 game.state**，直接短路）与正常路径 `resolve(true)`。promise executor 无第三 resolve，异常路径走 reject（await 抛出而非 resolve undefined）。**「契约严格两值」属实**，`=== false` 精判在生产不可漏判；undefined 仅存在于不符合契约的测试 mock（修复单自查记录的第一版 `!shown` 误伤即此因），放行 undefined 是保守正确方向。mock 路径一致性另核：bag.settle.js:14 `import { showRunTransition } from '../run/game.run.js'`，game.run.js:22 re-export 自 scenes.js，测试 mock `game.run.js` 与 import 链一致、mock 真实生效。

**resolve(false) 全部现实成因及处置判断**（`isCurrent() = currentContext() && request === transitionRequest`）：

| 成因 | 机制 | 走 `return false` 是否正确 |
|---|---|---|
| 被新过场顶替 | await 期间他处调 showRunTransition 使 request 递增 | 正确：新过场已持有 overlay 单例与 modal 态，且旧 finish 未收拾 overlay/state，本续流让位；与 enterNode 既有先例（scenes.js:159-160 `transition.then(current => current && transition.isCurrent() ? done() : false)`）同形 |
| 上下文失效（新开局/读档/回标题） | invalidateBattleContext 递增 version / registeredGame·slot 变化 | 终态一致：此类场景 slot/seed/discoveredPairs 已变，旧实现也在紧随的 `if (!sameRun()) return false;` 出口返回 false，新旧终态相同（都无 log、无 settle），新实现仅提前数行 |
| 测试环境拆除 | window 删除 → 谓词闭包首查 `typeof window === "undefined"` 返 false（battle-loader.js:19 原文） | 正确且为本修目标：静默终止，不再 UI.log→hud.js 摸 document |

**「合法完成但 resolve false」不存在**：完成必经 finish，finish 非此即彼；resolve(true) 恒对应用户看完（定时器到期）或点击跳过（`UI.act('flowContinue', finish)` → isCurrent 仍真 → resolve(true)），两情形行为零变化（回归锚用例 2 锁定撤退 true 路径 log+saveGame 照常）。

**返回值语义**：新增 `return false` 与同函数既有错误出口（bag.settle.js:58/63/74 等 `if (!sameRun()) return false`）同形；调用方为总线订阅 `busOn('battle:end', onBattleEnd)`（bag.settle.js:364）与回退 `game.onBattleEnd`，均不消费返回值，`return false` 与原正常出口 `return;`（undefined）无消费侧差异。

## 4. 测试敏感性抽查（现场实验）—— 通过

亲验 H3（非修复单已验的 H1）：临时将 cardslib.page.js:717 的守卫摘除（还原为原行）→ `npx vitest run tests/nightshift-u10-teardown-guards.test.js` → **红**：`1 failed | 3 passed`，失败即 H3 用例，`AssertionError: expected [Function] to not throw an error but 'TypeError: Cannot read properties of undefined (reading 'body')'`——证明用例真实捕获守卫缺失。随即 Edit 还原守卫，`git diff -- game/src/hub/game.cardslib.page.js` 输出与复审前基线快照 **逐字节一致（DIFF IDENTICAL）**，临时 diff 文件已清理。实验全程未触碰其他文件。

## 5. 亲跑复验 —— 通过

- `npx vitest run $(rg -l "pocket-strip|chests|cardslib|cinematics|bag.settle" tests/)`：**Test Files 27 passed (27)，Tests 234 passed (234)**，含新增 2 文件 7 用例，全绿。
- 新增 2 文件单跑完整输出 grep `unhandled`：**0 处**，无 Unhandled 错误。
- 修复单声称的 47 files/417 tests 口径含 `|settle` 扩展词（多命中 battle-settlement 等），与本次 27/234 口径不矛盾，均为绿。

## 6. make-work 检查 —— 通过

7 用例与 5 发现点一一对应（H1-H4 各 1 + M1 撤退 false/撤退 true 回归锚/胜利 false 共 3），无冗余文件、无超范围断言；四条守卫注释均写明根因（无清理通道的定时器）与定式出处（U1 9d7b871 battle-loader 同款），非装饰性注释。测试文件内 H1 垫后并注明 sdt-facade 首次装载依赖宿主存活（core/sdt-facade.js 固化 window.SDT 引用），构造合理。

---

## 备注（不阻塞）

1. **M1 顶替窄缝语义差**：若 resolve(false) 由「被新过场顶替」造成且 sameRun() 仍为真，旧实现会继续 log+settle（结算保存），新实现静默放弃——该窄缝下奖励保存被让位。判断：与 enterNode 既有先例同形（非当前即不执行后续），且过场期间 game.state='modal' 输入锁住、生产可达性极低，收口方向正确；若未来出现「结算过场被顶替致奖励丢失」缺陷，此处是第一排查点。
2. H4 teardown 后 `_cardGetShowing` 不复位（守卫在复位逻辑之前短路），仅测试环境进程内残留，无生产影响，不需修。
3. 撤退路径正常终态仍为原 `return;`（undefined），未动；新增 `return false` 仅在 shown===false 分支。

## verdict

PASS WITH NOTES（备注 1 为顶替窄缝下续结算让位的语义记录，与既有 enterNode 契约先例同形、生产可达性极低，不阻塞；其余全部通过：diff 最小无夹带、四守卫位置正确 H3 防闪烁判定逐字保留、M1 契约严格两值实锤且 resolve(true) 双路径零变化、负验证亲证用例敏感、定向 27 文件 234 用例全绿无 Unhandled）
