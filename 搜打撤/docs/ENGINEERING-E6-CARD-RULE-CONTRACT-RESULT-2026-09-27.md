# E6 卡牌规则可执行性与真实入口类型契约结果

E6 主指挥持有；Friday 持有 PLAN、全量验收与提交窗口。

## 基线与当前状态

- 2026-09-27 15:13（Asia/Shanghai）开始实施；基线 HEAD `e8a169be11a06455e4851ddcd65b424ff4a75efa`。
- 开始时 tracked/index 干净；相对本地 `origin/master` ahead 13 / behind 0，未 fetch、未 push。原排除未跟踪文件和 Friday 的 PLAN 保留。
- 15:26:34 实核 HEAD 不变，本地 `origin/master` 仍 ahead 13 / behind 0；暂存区未写入，工作区仅本批四个已跟踪文件变更及下列新文件。A/B 已停写，最终独审已通过、阻断清零；全量与提交待 Friday。

## 范围与文件归属

- A：`game/src/cards/card-rules.capability.js`、同目录 `card-rules.capability.types.d.ts`、`jsconfig.card-rules.json`、`tests/e6-card-rules-capability.test.js`、`tests/e6-card-rules-types.test.js`。
- B：`game/src/battle/battle.resolution.js`、`battle.exec-play.js`、新 `battle.rule-guard.js`、`tests/e6-card-rules-execution.test.js`、`tests/battle-resolution.test.js`（6 个既有非法手造夹具适配，保留原非法数据拒绝断言）；独审发现公开入口先读非法字段，Friday 追加批准 `battle.engine.js` 仅在 `play` / `beginInfuse` 得到 card 后前置同一 guard，拒绝返回 false。
- 主指挥：本文（含支持覆盖说明）；独审只读。未授权全量、build、安装、stage/commit、推送、删除、清理或回滚。

## 已确认的问题与契约

- 原 `execPlay` 在 resolver 守卫前支付手牌、能量和注能燃料；原 acquire 不支持组合在对应操作内部才拒绝，前序操作可能已经执行；filter 存在时被忽略。
- 形状继续由 `validateCardRules` 判断，既有返回不变。新增判别结果区分合法旧卡、非法结构、格式合法但未支持、战斗入口支持检查通过。
- 队列进入手牌支付选择前检查；实际付款前再次检查，覆盖排队后对象变化；resolver/steps 消费前整列表检查。拒绝不依赖回滚事务。
- 静态检查限定真实能力模块与真实生产 guard 适配器。独立配置采用 `strict: true`，两个根文件各启用 `@ts-check`；不将旧 schema、整个 exec-play/resolution 或全仓宣称为静态覆盖。

## 现行卡支持盘点

2026-09-27 接管时，在干净内存存储运行生产 `Cards.ensureTabletop()` / `Cards.all()`；实施期专属回归再运行 `ensureSha`、`ensureStarters`、`ensureTabletop`、`ensureDmgTypes`、`ensureEffectFields` 后读取 `Cards.all()`，数量一致。均未读取或写入玩家档。此为生产初始化口径，不代表所有卡已迁移或所有牌效已验收。

| 来源 | 总数 | 有 rules | 无 rules |
| --- | ---: | ---: | ---: |
| 生产初始化后 Cards.all() | 272 | 68 | 204 |
| 原始 CARDS_SYNC 批次 | 55 | 0 | 55 |

68 张规则卡的域出现次数（不互斥）：base 8、bag 3、battle 57、triggers 56。onPlay 操作出现次数（共 75）：damage 33、armor 9、curse 10、heal 2、draw 3、acquire 12、blessing 3、energy 1、status 1、discover 1。

本次专属回归确认 schema 错误为 0；已知未支持 op/trigger/参数、equip、filter、acquire dest×act 冲突为 0，68 张全部得到 `supported`。无 rules 卡继续文本兼容。`supported` 只描述战斗入口检查通过，不承诺 base/bag 全域在此执行，也不构成整库迁移完成证明。

运行时支持表是 schema 之后的附加门，不扩大 schema 允许的组合或参数：

| 边界 | 本批运行支持口径 |
| --- | --- |
| onPlay 操作 | damage、heal、armor、draw、status、discover、curse、acquire、coins、blessing、energy、energyCap、maxHp、deckCap；保留既有执行顺序与 deckCap 的战斗中记录语义 |
| acquire + hand | 无 act、dup、noInfuse |
| acquire + deck | 无 act、dup、zeroCost、noInfuse |
| acquire + discover（dest 默认值） | 无 act、play、playKeep、dup、zeroCost、decay |
| 明确未支持 | 其余操作族；非 onPlay 时点；equip 域；damage 的 graveyard、schedule、hits.perFoe；draw 的 untilHandN、handOps；任何 acquire.filter 及上表外 dest×act |

本批未新增召唤、延迟、墓地、装备、额外回合等运行能力，未改规则版本、卡牌数值或同步数据。schema 合法的上述未支持能力仍可由 schema 验证通过，但在战斗入口明确拒绝。

## 验证与未完成

- 15:19:57，B 在生产接线前运行专属执行回归：9 项中 7 失败 / 2 兼容用例通过。resolver/steps 后段 acquire `hand + play` 拒绝之前金币由 0 变为 7；filter 未拒绝；未支持卡打开强制支付；真实命令能量由 9 变为 7 且源牌被移除并登记 played。排队后规则变化时，支付牌和燃料均已消耗、能量 9→7、注能数 0→1、手牌清空后才拒绝。
- 接线后相同 E6 专属执行用例 9/9 通过，随后加入 HTML 安全拒绝与公开入口回归，最终 E6 执行专属 13/13 通过。最终 B 定向 12 文件 177 项，A 能力与类型定向 2 文件 9 项，合计不重复 14 文件 186 项全部通过。
- 独审追加公开入口红灯：15:25:00，专属 13 项中原 10 通过、新 3 失败。`playCard` 的 `requirements: [null]` / `costModifiers: [null]` 及 `beginInfusion` 的 `costModifiers: [null]` 在到达队列前抛 `TypeError`（读取 null.kind），未发出明确拒绝提示；补修仅前置同源 guard。
- A 的能力与类型定向 2 文件 9 项通过。类型证据包括 1 个正例、7 个错误契约负例，以及 3 个内存生产源码变异：错误目标 2322、能力表未知操作键 2353、guard 的 `port.warn(42)` 2345。负例不改磁盘生产源码。
- A 的初始“新模块缺失”只属于搭建期失败，不计为上述行为故障红灯。
- 15:25:46 公开入口补修后，3 项新增红灯全部转绿；出牌和注能拒绝均返回 false，保留资源和交互状态。`battle.engine.js` 仅新增 import 与两个 guard，共 3 行。
- `git diff --check` 通过；schema、同步数据、玩家档和规则版本均未改。
- 全新只读独审最终通过：核对实际 diff、所有新增文件、公开入口 return false、队列与付款复验顺序、steps 首次消费检查、旧卡兼容与两真实静态根，无剩余阻断或新增非阻断项。独审独立运行 `git diff --check` 通过，测试复用上列 14 文件 186 项证据，未重复全量。
- 全量/index/本地提交：由 Friday 统一接手，E6 团队不提前运行。
- 本批不验浏览器；E2–E5 积压实页继续留 E7。实页未验不等于通过。

可复现命令（工作目录 `搜打撤`，使用现有依赖）：

```powershell
npx vitest run tests/e6-card-rules-capability.test.js tests/e6-card-rules-types.test.js --no-file-parallelism
npx vitest run tests/e6-card-rules-execution.test.js tests/battle-resolution.test.js tests/structured-onplay-battle.test.js tests/a3-battle-rules.test.js tests/tt7-hand-payment.test.js tests/n1-infuse-uid-toggle.test.js tests/e4-async-entry.test.js tests/e4-battle-loader.test.js tests/commands-shared-contract.test.js tests/r3-0-command-guards.test.js tests/r2a-commands.test.js tests/agent-command-results.test.js --no-file-parallelism
```

B 组合覆盖：E6 执行 13、resolver 54、A3 20、structured-onplay 8、手牌支付 4、注能 3、E4 async 18、E4 loader 13、共享命令 2、R3 命令守卫 4、R2 命令 9、Agent 命令结果 29，共 177 项。

既有 resolver 夹具调整理由：4 处结构化伤害/护甲缺少 schema 要求的 battle.target；1 处空 onPlay 保留非零 dmg；1 处同卡 chosenEnemy/allEnemies 目标声明冲突。补足合法前提后保留伤害、沉默、文本回退和段顺序断言，对后两类非法数据增加整次拒绝断言，不放宽生产 schema。

## 精确交付清单

以下 12 文件由 E6 交付；Friday 自有 PLAN 另计，所有其他原排除未跟踪项不在交付内。

1. `game/src/cards/card-rules.capability.js`（新增）
2. `game/src/cards/card-rules.capability.types.d.ts`（新增）
3. `game/src/battle/battle.rule-guard.js`（新增）
4. `game/src/battle/battle.exec-play.js`
5. `game/src/battle/battle.resolution.js`
6. `game/src/battle/battle.engine.js`
7. `jsconfig.card-rules.json`（新增）
8. `tests/e6-card-rules-capability.test.js`（新增）
9. `tests/e6-card-rules-types.test.js`（新增）
10. `tests/e6-card-rules-execution.test.js`（新增）
11. `tests/battle-resolution.test.js`
12. `docs/ENGINEERING-E6-CARD-RULE-CONTRACT-RESULT-2026-09-27.md`（本文，新增）

## 首轮统一门禁与限定补修（后续状态）

Friday 首轮原 pre-commit 于 15:29:20 开始，运行 227.14 秒后失败，未生成提交：170 文件通过 / 1 失败，1118 项通过 / 1 失败，另有 1 个未处理异常。此结果优先于上文定向通过，不能视作整批验收通过。原 13 文件暂存区保留，补修团队不操作 index、不重跑全量。

- 快照失败：`tests/battle-snapshot-integration.test.js:42` 的 pendingTarget 未建立。原探针缺 `rules.version`，且 `battle.extension.values` 是 schema 未知键，被新守卫正确拒绝。15:34:30 限定单文件 1 项复现失败。
- B 仅修改该测试，使用 version:1 和合法 onPlay 伤害操作数组；变更后追加一个合法同目标操作。保留待选卡深冻结、源卡及源数组不冻结、稳定快照复用、源数组修改触发重投影、旧快照隔离等全部原意图，增加操作对象冻结以及修改前后 schema/capability 通过断言。
- 15:35:34，快照集成/投影/类型三个定向文件 5/5 通过；文件 diff 检查通过，生产 schema/guard 未改。
- 另一个首轮门禁错误：`game.boot.js:398` 的 `requestAnimationFrame is not defined`，由 :412 的 Timeout 在 `bag-item-rule-baseline` 环境 teardown 后触发。独审单独运行原 bag 文件 10/10 通过，**未复现该未处理异常**；这不否认完整门禁错误。
- 已定位测试清理缺口：真实启动保留 boot 主循环的 250ms timer，测试 afterAll 仅恢复 mocks，未取消 timer；timer 再调用全局 rAF 时环境可能已销毁。Friday 批准仅改该测试生命周期，B 唯一写入，不改 boot 生产循环。
- bag 测试在 main 导入前启用 timeout/interval/rAF 及其取消函数的 fake timers，window/global 引用不同则用可恢复 spy 转接。两端分别创建 timeout、interval、rAF，验证计数增加 3 并逐项取消后恢复原计数，证明两端均受控。原 0/280ms 等待改定量异步推进；afterAll 清空并验证 timer count 为 0，嵌套 finally 还原真实 timers 和 mocks。保留原 10 项业务断言，无 runAllTimers、异常抑制或生产改动。
- 15:37:36，限定 snapshot integration + bag 两文件 11/11 通过，exit 0，无 unhandled/teardown error；仅出现既有“剑士”资源映射警告。该通过结果不等于已复跑完整门禁，完整门禁仍由 Friday 执行。

快照限定命令（工作目录 `搜打撤`）：

```powershell
npx vitest run tests/battle-snapshot-integration.test.js tests/battle-snapshot.test.js tests/battle-snapshot-types.test.js --no-file-parallelism
npx vitest run tests/battle-snapshot-integration.test.js tests/bag-item-rule-baseline.test.js --no-file-parallelism
```

补修新增可交付文件：`tests/battle-snapshot-integration.test.js`、`tests/bag-item-rule-baseline.test.js`；本文同步记录。E6 总交付因此由 12 文件增至 14，Friday 自有 PLAN 另计共 15。15:38:17 实核本轮未暂存变动仅这两个测试、本文及 Friday 自有 PLAN；既有 13 文件暂存状态保留。

原独审已完成两文件最终复审，无阻断或新增非阻断项；独立执行两文件 `git diff --check` 通过，复用 11 项定向证据，不重复全量。A/B/独审/主指挥完成记录后全队停写，将补修交 Friday 重跑原门禁。首轮完整门禁失败仍须新的完整门禁通过才能关闭，本文不预先宣称全量验收完成。
