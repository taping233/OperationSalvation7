# E2 战斗快照卡牌隔离与消费者类型约束结果

## 接管与归属

- 开工日期：2026-09-27（Asia/Shanghai）。唯一基线 `c6fc09a5b31ec7fff994518d02cf7cef2cb40019`，`chore: 统一在途成果基线`；开工实际 HEAD 一致，tracked 工作区和暂存区干净，对本地 `origin/master` ahead 3 / behind 0，未 fetch。
- Friday 已确认旧团队停止写入，本团队不重复统一基线盘点与检查。既有排除项原地保留，不归本批成果。
- 全新团队：主指挥负责调度、engine 有限 JSDoc、验收和本结果；`snapshot_a`（GPT-6-luna）单写 snapshot 实现与运行回归；`types_b`（GPT-6-luna）单写声明、preview 和类型入口/回归；`review_sol`（GPT-6-sol medium）只读独立审查。所有检查由主指挥串行调度。
- 遵循 Friday 的 E2 计划，不修改其他 E1 缺口、共享配置、卡库、存档格式和预览算法。未 build、安装、删除、回滚、推送或发布。

## 改前证据

- 11:31:58：现有本地 Vitest 执行 `tests/battle-snapshot.test.js --no-file-parallelism`，原测试通过、新增六路径回归失败（1 passed / 1 failed）；失败位于 `Object.isFrozen(projected.rules)`，实际为 false。实现当时未改，随后才授权 A 修复。
- 默认沙箱阻止 esbuild 子进程（spawn EPERM）；通过工具审批后运行现有本地 Vitest/Vite，无安装和配置更改。

## 实际改动与覆盖矩阵

`battle.snapshot.js` 逐卡复制后递归冻结，保留 `undefined`；不冻结源卡、不改签名算法。`battle.engine.js` 仅为 captureSnapshotInput/getSnapshot 增加返回类型 JSDoc。`battle.preview.js` 启用实际检查、补准确参数/返回类型及等价收窄表达，未重写伤害算法。

| 卡牌路径 | 源与快照双向隔离 | 冻结、嵌套数组、扩展、undefined |
| --- | --- | --- |
| infusing.card | builder 八路径矩阵 | 已覆盖 |
| discovering.options[] | builder 八路径矩阵 | 已覆盖 |
| deckSelection.cards[].card | builder 八路径矩阵 | 已覆盖 |
| pendingTarget.card | builder + 真实 BattleSession 集成 | 已覆盖 |
| pendingItem.card | builder 八路径矩阵 | 已覆盖 |
| equipped[].card | builder 八路径矩阵 | 已覆盖 |
| handSelecting.srcCard | 独立审查发现后补入矩阵 | 已覆盖 |
| handSelecting.payment.card | 独立审查发现后补入矩阵 | 已覆盖 |

药水栏当前仅含 uid/name/count/desc/aim/usable/why 展示字段；手牌及各牌堆是 UID，因此没有相应嵌套卡牌。选牌 Set 仍转数组、装备索引和展示字段不变。handSelecting 只替换现有卡字段，缺席字段保持缺席；payment 含卡时浅复制为可变容器，其他嵌套引用及 onDone/onResolved 回调保留。

卡牌复制支持原始值（含 undefined）、普通数据数组，以及普通/null-prototype 对象的可枚举自有字符串数据属性。循环和异型对象原型明确拒绝；普通对象的访问器属性明确拒绝。不是任意对象图序列化器；特殊数组属性、符号键、访问器数组不在支持数据边界内。非卡牌状态保留现有浅投影保证，未声称整个快照全图深只读。

## 类型入口与检查边界

- 新入口：`node node_modules/typescript/bin/tsc -p jsconfig.battle-snapshot.json --pretty false`。allowJs + checkJs:false，以文件内 @ts-check 实际检查 snapshot.js 和 preview.js；fixture.ts 真实 import 生产函数。combat.js 等仅供依赖推导，不声称全战斗域检查。engine 只有返回契约接线，不声称整个引擎被静态诊断。
- 原入口：`node node_modules/typescript/bin/tsc -p jsconfig.json --pretty false`，配置原样保留。本批新旧入口均通过。
- 正负例：构造输入字段错误、状态 dodge 错类型、previewAction 的 snapshot.foes.hp 错类型均被拒绝；直接写生产返回卡牌的 rules.triggers.onPlay[0].op 及 onPlay.push 被拒绝。同链合法读取通过，含 snapshot、rules、operation、预览 cost/damage.total/hits 的防 any 退化断言。
- 使用本机 TypeScript 7 API，收齐 Program（包含选项）、Global、ConfigFileParsing、Syntactic、Bind、Semantic 诊断；无错误过滤或忽略指令，无新增 any。此前错误使用不存在的 getOptionsDiagnostics 已按本机声明修正。

## 验收证据与边界

1. 改前红：11:31:58 六路径嵌套 rules 未冻结；11:38:05 补两条 handSelecting 路径后，srcCard 与源仍为同一对象，回归再次失败。均先测试后修实现，没有回滚构造红灯。
2. 运行定向：11:44:02，`node node_modules/vitest/vitest.mjs run tests/battle-snapshot.test.js tests/battle-snapshot-integration.test.js tests/battle-snapshot-types.test.js tests/r3-a-preview.test.js --no-file-parallelism`。运行行为 3 文件 / 32 项通过；当时类型测试 2 项因 API 收集器失败，未冒称该次全过。
3. 类型回归修正后：11:45:48 单独运行 battle-snapshot-types.test.js，2/2 通过。合计有效定向证据 4 文件 / 34 项；行为实现未随后改动。八路径实际尝试 Reflect.set 和嵌套数组 push，写入受拒且源值保持；源后续合法修改不影响旧快照，新快照反映修改。真实 start → playCard → BattleSession.getSnapshot 证明稳定缓存复用、源嵌套规则变化使缓存更新。
4. 全量：使用本批本地提交的仓库 pre-commit 门禁执行 `node node_modules/vitest/vitest.mjs run --no-file-parallelism`，不绕过钩子、不另外重复跑相同全量。11:50:11 开始，247.33 秒，160 文件 / 924 项全部通过；门禁完整日志为仓库 `.git/gate-full-test.log`。实现提交为 `c9affb81b9d8b70a4208d286a6630754db389928`（fix: isolate battle snapshot cards and check preview contracts）；提交后 tracked 干净，对本地 origin/master ahead 4 / behind 0，未 fetch。全量日志含 jsdom 无 Pixi renderer 等警告，但没有失败；272 张卡实打审计硬失败为 0。后续仅结果文档补记，不更改该已验代码版本。
5. 实页：Codex 内置浏览器、当前窗口，独立 `http://127.0.0.1:5187/`，现有 Vite 直接启动（无 npm 前置生成）。在页面确认空档位 05 后建立测试对局，已看过基地、整备、角色选择和地图；这些准备发生于实现过程中，不能当最终战斗兼容证据。最终代码 reload 后，继续测试档位 05 停在选档层；保留该档，再经明确空档位 04 尝试，仍停在选档层。未覆盖/删除任何既有玩家档案，未改存档底层数据。此次工具捕获的 console error/warn 为空，不代表已证明故障原因。正常战斗、编组、悬停预览、指向/选牌页面最终兼容均未验，未扩范围修复进入流程。

6. 实页补证（11:52–11:55）：全量日志显示项目已有 `docs/previews/r7a-encounters/index.html`，只读确认它加载真实 BattleSession/BattleView，未接入持久化写入口，遂复用内置浏览器当前窗口直接打开该隔离页。加载 L2 射手（3 HP）+机动兵（6 HP）普通战斗成功；键盘选择初始攻击，界面显示精确攻击伤害 4、预计击败射手；Enter 确认后实际日志伤害 4、射手 0 HP、机动兵仍 6 HP、能量 2→1，恢复“你的行动”。退出样本后显示“存储快照=未变化”。截图与 AX 状态均已实际观察。该页面以占位美术承载真实视图，不代表完整主游戏美术验收；此次验证了普通战斗、目标选择和焦点触发的预览，未证明鼠标悬停、BOSS 编组、注能或选牌面板兼容。前述主菜单进入问题保留，未改范围外文件；未把 AX 点击未生效直接归因为游戏故障。

交付状态：代码、定向、类型、全量验收完成，实页部分通过（完整实页仍待验）。未运行 build、产物预算或长局。卡牌复制增加与嵌套数据量相关的分配/冻结成本；签名缓存命中仍复用快照，但本批没有克隆耗时/FPS/长局性能测量，不能外推性能结论。

## 独立审查与四项简报

Sol 已复审实际生产 diff、声明、配置、fixture 和类型测试：指出并关闭两条遗漏卡路径、Set/null/回调真实形状、非卡浅边界、输入输出已知字段一致、真实拒写负例以及反向写入尝试不足等问题。预览类型收窄表达保持原语义，生产检查实际开启；最终无未处理本批关键代码或类型问题。全量门禁与实页补证在实现提交后回交审查。

1. **干了什么**：八条实际快照卡牌路径隔离与冻结，真实缓存链回归，snapshot/previewAction 窄类型检查；仅十个授权文件，engine 两行 JSDoc，无顶层架构扩展。
2. **必要性**：必要，改前失败直接证明共享嵌套数据风险；其他 E1 缺口可后置；克隆性能收益未证明；重跑基线全量、重做 E1、全战斗类型化与新抽象属于本批无效/越界返工，未执行。
3. **有效证据**：两阶段改前失败、修后 32 项行为 + 2 项静态回归、新旧类型入口通过、Sol 独立审查、改后全量 160/924、真实隔离视图预览与实际伤害一致及存储快照未变；不以历史 920 项或源码存在替代当前验收。
4. **还欠什么**：最终当前窗口的 BOSS 编组、鼠标悬停、注能或选牌面板兼容，以及主游戏进入流程问题的归因。getPreviewContext().card、findCard 兼容读口、GameStore 地图引用及其他 E1 风险未包含于卡牌隔离承诺。实现已独立落库，本次只追加结果文档补证提交，不重复全量或改历史；完成后停止，不自动下一批或设置唤醒。
