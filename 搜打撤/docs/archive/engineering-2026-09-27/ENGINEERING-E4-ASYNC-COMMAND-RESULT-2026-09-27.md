# E4 异步入口隔离与命令结果语义：实施记录

更新时间：2026-09-27 14:26（Asia/Shanghai）。首轮统一全量门禁因药水测试夹具不符合新会话归属契约而失败，未提交；最小测试修正后单项复验通过，最终全量仍待 Friday 重试。实页验收按老板安排后置，不能视作通过。

## 接管与归属

- 2026-09-27（Asia/Shanghai），本独立对话接替已中断的旧 E4 子代理团队；Friday 已确认旧团队停写，并批准新团队单写归属。
- 接管实时 HEAD：`cbeee027dd079610d7abdeae85296ec9af35dd4a`；相对本地 `origin/master` ahead 9 / behind 0，未 fetch、未 push。tracked/index 干净。
- 已有未跟踪 E4 内容：Friday 持有的 PLAN，以及 `tests/e4-battle-loader.test.js`（11 项）、`tests/agent-command-results.test.js`（3 项）。接管时生产代码没有 diff，继续使用现有测试，不重建已有效工作。
- A 单写 `game/src/battle/battle-loader.js`、`game/src/run/game.run.scenes.js`、`game/src/run/game.run.dev.js`、`game/src/ui/game.menu.js`、`tests/e4-battle-loader.test.js`、`tests/e4-async-entry.test.js`。
- Friday 另批准 `game/src/run/game.run.altar.js` 启程过场及紧邻继续回调的最小守卫：原回调忽略过场是否失效，仍会写 `game.state`、展示节点页。只修旧回调晚写，不改职业卡发放、随机或玩法。
- B 单写 `game/src/agent/agent.runner.js`、`tests/agent-command-results.test.js`、`docs/agent-protocol.md`。
- 主指挥单写本文；独立审查员只读。PLAN、其他批次记录与原未跟踪排除内容保留。

## 实施与验证

`battle-loader` 复用共享模块 Promise，按请求及现有局上下文校验启动权。局上下文使用 game 注册对象、seed、探索集合、巢穴符文集合、活动标志、位置及档位；new/load 替换探索集合，巢穴开局/撤离替换符文集合。生产 activeSlot 切换由菜单 launch/showTitle 失效覆盖，菜单 await 处另用真实 getActiveSlot；loader 默认读取 Base.slot，不伪造 game getter或引入 session 循环。

退出、同 seed 新局、巢穴重开、节点/层变化、请求替代后，旧加载不得启动战斗；旧失败不得清 idle、记旧诊断或向新页面提示。共享预取、当前失败后重试保留。dev 在启动拒绝后停止后续读取；菜单恢复、过场及启程后续回调只处理其仍拥有的页面。

Agent 同步 `act` 保持可 JSON 序列化；显式 false/ok:false 为拒绝，void 兼容。Promise 初始成功仅代表受理，完成 Promise 由内部 WeakMap 关联并立即接失败处理。`step` 先有界等待真实结果再等待局面稳定，超时返回未完成并停止当前 autoRun，不取消底层命令、不立即重派。决策等待、完成和交棒均核局身份，旧页面失败不写入新页面失败记忆。

旧团队交接称原懒加载测试改前 9 失败 / 2 通过；本轮核实原测试及未修复 loader 代码后复用该历史红灯证据，未重新执行改前版本。改后结果另列如下。

实施中发现正常异步 `ui:enterSlot` 在续局或进入基地时会合法更换局身份/档位，严格原局完成检查会误停。Friday 批准只为该入口生成内部成功凭据：菜单每段 await 后先通过原归属守卫，成功后同步捕获完成身份；runner 核请求目标档位、凭据与实时身份一致，归一化公开结果时剥离引用。普通命令及决策等待继续核原局，失败/取消/过期不出成功凭据，不引入新身份机制。真实菜单与 runner 衔接回归已覆盖续局、基地、加载/恢复失败、旧凭据与 JSON 边界。

旧 Agent 测试将无交互时真实 `BattleSession.commands.cancelInteraction` 的 `undefined` 当成拒绝，该假设与既定 void 兼容约定不符；修正为真实 void 兼容回归，不把这项旧红灯作为生产缺陷证据。

另一确定窗口为同局同节点的微任务接管：旧过场已经 resolve，后续回调执行前新过场启动。Friday 批准给本次 `showRunTransition` 的 Promise 附局部只读 `isCurrent()`，保留 await 的 boolean 结果；scenes/altar/menu 持有原 Promise，在后续写入前核本次请求与局上下文。此内部过场句柄不属于 Agent 公开 JSON 结果，也不增加全局局身份或通用异步框架。

### 有效证据

| 范围 | 最终有效结果 |
| --- | --- |
| A 固定快照定向，14:12:46 | 9 文件、67/67：loader 13、异步入口 18、菜单恢复 3、session/menu 5、scenes 2、架构 6、boot 13、撤离 3、基地损坏字段 4 |
| B 最终跨接口复验，14:13:59 | `npx --no-install vitest run tests/agent-command-results.test.js --no-file-parallelism`，29/29 |
| B 既有相邻消费者 | `agent-llm.test.js` 7/7、`agent-recorder.test.js` 6/6；复用 B 在本轮三文件 41 项命令中的结果。此后仅新增专属交棒检查，专属最终 29 项已重新通过 |
| 三个既有类型入口 | A/B 最终生产快照复验，均退出 0、无诊断，命令见下 |
| 静态与格式 | A 自有 10 个 JS 文件 ESLint 通过；主指挥另验 runner、B 专属测试及最终 base-corrupt-field 替身，ESLint 通过。B 两个 JS 的 node --check 通过。相关 tracked diff --check 通过，仅换行提示 |

以上不同时间的定向证据合计覆盖 12 个文件、109 个不同测试，不是单次全量执行。最终 A 命令为：

```powershell
npx vitest run tests/e4-battle-loader.test.js tests/e4-async-entry.test.js tests/menu-recovery-entry.test.js tests/r7a-scenes-integration.test.js tests/r5a-session-menu.test.js tests/run-architecture.test.js tests/boot.test.js tests/extraction-flow.test.js tests/base-corrupt-field.test.js --no-file-parallelism
```

B 相邻消费者命令：`npx vitest run tests/agent-command-results.test.js tests/agent-llm.test.js tests/agent-recorder.test.js --no-file-parallelism`（当时专属 28 + 7 + 6 = 41；不与最终 29 重复相加）。

类型命令：`npx --no-install tsc --noEmit -p jsconfig.json`、`npx --no-install tsc --noEmit -p jsconfig.battle-snapshot.json`、`npx --no-install tsc --noEmit -p jsconfig.battle-settlement.json`。这些仍是原有渐进检查范围，不代表 E4 全部生产文件新增了强制 checkJs。

代表链为真实 scenes → transition → loader、真实 menu → transition → loader → loadGame 端口，以及真实 menu 注册 enterSlot → Agent act/step；渲染、存储端口和延迟模块 transport 使用测试替身。它们验证入口归属和结果衔接，不是玩家存档或完整浏览器验收。

中间失败如实保留：A 一次 9 文件运行期间仍有写入，出现旧 catch 路径 1 项失败；新增 menu→loader 导入提前建立 SDT，既有 base-corrupt-field 替身未补 Icons 导致 1 suite 导入失败。补守卫/测试初始化并停止写入后，固定快照 67 项全通过。Vitest 初次在沙箱因 esbuild spawn EPERM 未启动，获准提升运行权限后执行通过；没有安装依赖或执行 build。

## 精确交付文件

以下路径均相对 `搜打撤/`，共 15 个；加 Friday 自有 PLAN 为 16 个，PLAN 不计入本团队交付。

- A 生产：`game/src/battle/battle-loader.js`、`game/src/run/game.run.scenes.js`、`game/src/run/game.run.dev.js`、`game/src/run/game.run.altar.js`、`game/src/ui/game.menu.js`。
- A 专属测试：`tests/e4-battle-loader.test.js`、`tests/e4-async-entry.test.js`。
- A 既有替身兼容：`tests/menu-recovery-entry.test.js`、`tests/r5a-session-menu.test.js`、`tests/base-corrupt-field.test.js`；只升级 isCurrent 句柄替身，最后一个另补 SDT.Icons 初始化。
- 门禁修正：`tests/potion-tip.test.js`，由主指挥最小适配真实已注册 game 夹具，并增加启动身份/状态断言，原两药水、hover/pointer 及等待逻辑保留。
- B：`game/src/agent/agent.runner.js`、`tests/agent-command-results.test.js`、`docs/agent-protocol.md`。
- 主指挥：`docs/ENGINEERING-E4-ASYNC-COMMAND-RESULT-2026-09-27.md`。

## 独立审查

独立只读审查通过，当前未发现需修复 P 级问题。审查覆盖实际生产 diff、真实入口故障测试、菜单成功凭据与 JSON 边界、loader 生命周期、过场微任务替代、game.boot→runtime 无包装注入和三份旧测试替身。审查员没有修改文件，也未用静态审查替代实页验收。

14:15 再核 HEAD 仍为 `cbeee027dd079610d7abdeae85296ec9af35dd4a`，相对本地 origin/master ahead 9 / behind 0；index 空。tracked 修改 10 文件，加本团队 3 份未跟踪测试和 RESULT，共 14 文件。原未跟踪排除内容保留；未 fetch、未 push。

以上为 14:15 停写时快照。此后 Friday 独占暂存区并暂存原 15 文件（含 PLAN）；门禁修正仅在工作区修改 potion-tip 和本文，由 Friday 重新暂存。E4 主团队及子代理均未操作 index。

## 统一门禁阻断与定向修正

1. Friday 首轮原门禁于 14:18:06 开始，耗时 205.17s：166 文件中 165 通过 / 1 失败，1007 项中 1006 通过 / 1 失败。唯一失败为 `tests/potion-tip.test.js:79`，`.bt-potion` 期望 2、实际 0。未产生新提交；日志由根协调保存在 `.git/gate-full-test.log`。
2. 子代理两次通过同一审批入口请求限定单文件测试，均未执行。首次自动审批理由为仍适用此前“全队停写且不再测试”；第二次将重新开放窗口的授权认定为不可信助手转述，继续沿用旧停止要求。团队未换工具或代理绕过，转由持直接用户授权的 Friday 执行。
3. Friday 直接送审获准，14:25:02 执行原样 `npx vitest run tests/potion-tip.test.js --no-file-parallelism`，1 文件 / 1 项失败、耗时 2.82s；仍是药水数量 0 对 2，确认可复现。
4. 静态及独立只读根因核验：测试先加载 main 注册真实 `SDT.game`，随后另造独立 game。loader 的 `registeredGame === game` 归属守卫拒绝该夹具，未启动战斗。真实 scenes/altar/dev/nest 均使用 session singleton，kernel 注册同一对象；未发现生产注册顺序错误，未归因为随机时序。
5. Friday 仅开放主指挥文件编辑窗口。主指挥用 `Object.assign(window.SDT.game, 原夹具字段)` 初始化，增加 game 身份一致、`started !== false` 与 `battleActive === true` 断言。真实战斗 start 返回 void，故不强求返回 true。未削弱两药水及 hover/pointer 断言，未增加 sleep，未改生产守卫。
6. Friday 14:26:02 直接执行相同单文件命令，1 文件 / 1 项通过，耗时 3.21s。全部药水断言通过，仅有 jsdom 环境既有 Pixi renderer 警告。该结果由根协调回传，不冒称 E4 主团队亲自运行。

最终全量仍待 Friday 重试，单项绿色不等于全量门禁或提交完成。门禁修正后的实际 diff 与本文由独审只读核对，不再次执行测试。

## 验收边界

- 本批只开发 Vite，不 build、不安装、不改全局配置、不删除/清理/回滚、不写玩家存档。
- 未获 Friday 独占窗口，不全量、不暂存、不提交；本地提交由 Friday 统一执行。未推送，不自动启动 E5。
- E2 hover/旧档 04、05，E3 实页普通胜利结算/旧档/长局，E4 异步交互实页均属后置统一验收，未在本批重复执行或冒称通过。

必要工作是消除已能确定性复现的旧请求晚写和结果误报；新增完成凭据用于保持真实进入档位的正常兼容。性能收益未测量、未宣称。未发现丢档、重复奖励或无法启动的实质阻断；存储测试仅隔离环境，不扩展为玩家存档验收。剩余为 Friday 统一全量/index/本地提交门禁，以及老板已后置的实页验收；不自动开始下一批。
