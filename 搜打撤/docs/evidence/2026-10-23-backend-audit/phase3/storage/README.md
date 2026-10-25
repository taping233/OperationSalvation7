# 第三轮：hub 纯业务覆盖清单

本页记录第三轮初审与当时的避让状态。后续已收到精确属地释放，原先暂缓的三项候选已实施，追加源码净减 10 行；结果、原文和验证见 [pending-applied/README.md](pending-applied/README.md)。

本轮删除 `preparation.sources.js` 内一份重复的递归深冻结实现，改为导入现有 `commands.shared.js` 的 `freezeDeep`。本轮业务源码 **+1 / -1，净行数不变**；删除的是独立实现，不把代码压行、前两轮清理或证据文件算作新删除量。没有整文件删除，也没有修复首轮登记的缺陷。

## 已实施的等价收敛

`preparation.sources.js:1` 的本地 `freeze` 与 `commands.shared.js:36` 的 `freezeDeep` 步骤相同：空值、非对象与已冻结值直接返回；递归冻结 `Object.values`；最后冻结并返回原对象。用具名导入别名保留 `freeze` 的两个内部调用，公开 `getSources` 不变，来源表与判池镜像均未改变。

已核对新依赖图为 `preparation.sources → commands.shared → core/shared`。后两者仅定义/导出纯工具、静态实体表，未导入页面、存储、Base 或前者；不存在新增循环、门面求值或存储副作用。`core/shared` 部分历史注释提到旧顶层依赖，已按现行代码核实其没有该依赖。

## 本轮覆盖表

“完整”表示本轮读取当前完整实现；“复用”表示沿用前轮逐段/逐函数证据，本轮只核对相关入口或调用边界，不重复记已完成精简。“保留”不代表没有任何缺陷，而是没有证据可在本轮删除相应业务实现或保护。

| 模块（均位于 `game/src/hub/`） | 覆盖 | 本轮结论与依据 |
| --- | --- | --- |
| `preparation.sources.js` | 完整 | 已精简重复深冻结；随机池形判镜像仍保留，权威 cards.rules 有装配依赖，不贸然改导入图。 |
| `commands.shared.js` | 完整 | 保留唯一 clone 转发、失败/收据/指纹/档位/冻结工具；为 sources 提供共享实现。 |
| `preparation.commands.js` | 完整 | 保留引用规范化、预设与资格/容量预检；三个写入口已共用 commitGoals，不再另抽重复门面。 |
| `collection.commands.js` | 完整 | 保留库存/目录双重资格检查、幂等收据、皮肤旧资格和资源缺失回退；这些检查面对的来源不同，不能合并删除。 |
| `collection-conversion.js` | 完整 | 保留保护、数量、满级、首次收录和溢出分支，各对应不同业务状态。 |
| `collection-protection.js` | 完整 | 保留单一保护判定，旧记录缺标志仍受保护。 |
| `departure.summary.js` | 完整 | 保留推荐预览与实际摘要两个公开入口；前者包含候选筛选，后者包含实际计格，不能以同样“计格”为由删其一。 |
| `base-departure.commands.js` | 完整 | 保留唯一稳定引用/旧名称兼容、身份歧义拒绝、数量截断与纯计划入口；没有无消费者内核。 |
| `base-economy.js` | 完整 | 保留购买/开包/领奖三种不同草稿准备；容量与材料前提不同。资源字段数组另有同值字面量，但不为这一个常量扩大写入属地。 |
| `base-progression.commands.js` | 完整 | 保留付钥匙门禁与 legacy 免费入口；后者仍有 game.nest 生产调用，不能按命名认定死代码。 |
| `base-pet-egg.commands.js` | 完整 | 保留胸箱保底与无槽战斗兼容计数；不删除历史内存推进契约。 |
| `base-elapsed.commands.js` | 完整 | 保留按 runId 检查点同步与旧累计时间迁移，两者数据来源及语义不同。 |
| `meta-progression.js` | 完整 | 保留经验内核与公开快照入口；后者还负责数值规范化/冻结，非纯透传。 |
| `base-meta.commands.js` | 复用第二轮 | 上轮不可达事件 default 已删除；本轮不重复计数。正常经验与职业迁移仍有消费者。 |
| `base-state.js` | 复用第二轮 | 上轮七次默认树创建已归一；本轮不重复计数。缺字段深补齐与容器修复各有职责。 |
| `base-mutation.js` | 完整 | 保留隔离草稿与未变分支引用复用；同步生产者检查和失败不污染运行态有效。 |
| `game.store.js` | 完整 | 保留快照的普通数据深复制、地图/交互引用例外及 getter 保留；不是可互换的普通 clone。 |
| `battle-settlement.commands.js` | 完整 | 两次额外私有快照克隆可删候选已报主会话，因活跃返修暂未编辑；身份、修订和节点已完成重检全部保留。 |
| `battle-victory-progress.js` | 复用第二轮 | 经验准备与即时 Meta 命令的规范化/输入契约不同，未凭相似分支合并。 |
| `nest-settlement.commands.js` | 完整 | 保留重试 attempts 与并发 inFlight 两张不同生命期表；收据先于现存主档检查，防已删除主档的成功提交无法重放。 |
| `extraction.commands.js` | 分段完整 | 保留整理中间态/完成收据、随机结果留存、请求序号和失败重试令牌；相似的 updateCards/finish 共享提交内核，但返回与准备规则不同。 |
| `terminal.commands.js` | 复用第一轮，本轮入口核对 | 死亡结果已有唯一 applyDeathOutcome；保留对局删除后的稳定收据重放与同槽新局保护。 |
| `recovery.commands.js` | 完整 | 保留领域日志校验、旧身份升级和锁内提交；与 departure 共享底层 recoverable-pair，未另造第二套事务机制。 |
| `departure-persistence.js` | 完整 | 保留新探索专有日志校验；与 settlement 的“已有探索”前提不同。pending 的二次日志读取也没有盲删。 |
| `save-archive.js` | 完整 | 本地 validSlot 与共享工具同实现的候选已报告；因保存返修边界暂未编辑，导入日志/回滚保护均保留。 |
| `recoverable-pair.js` | 复用第一轮，本轮接口核对 | 保留日志阶段、第三值拒绝、持久写入复核与恢复重放；没有无消费者事务步骤。 |
| `slot-write-lock.js` | 完整 | 保留租约 WeakMap、回调同步约束、过期上下文和物理写守卫，不用“重复检查”为由删锁。 |
| `receipt-retention.js` | 完整 | 保留永久请求、活动探索全收据和已关闭探索最新收据的三个不同保留规则。 |
| `game.storage.js` | 复用第一轮，本轮入口核对 | 无效 Map 与透传链已在首轮删除；本轮不再改保存属地，也不删公开兼容 API。 |
| `bag-inventory-commands.js` | 复用第一轮 | 合成先分配 UID、防过期、容器与背包容量保护有用；处于背包返修相关范围，本轮不写。 |
| `bag-token-craft-plan.js` | 完整 | 保留两种配方与指定 UID 选择；输出缺失时不消耗来源。 |
| `game.bag.token-craft.js` | 完整 | 只有旧模块路径兼容转发，不能按本体短小或无业务代码删公开入口。 |
| `bag-use-compatibility.js` | 复用第一轮 | 旧快照与自定义文字卡仍有执行路径，保留语义有序的回退识别。 |
| `stash-sale-price.js` | 完整 | 保留仓售价与局内估值差异，未知稀有度仍回退原估值。 |
| `command-errors.js` | 完整 | 多个门面使用公共错误解释；已与旧 home presenter 解耦，无可删旧内核。 |
| `bag-return-hook.js` | 完整 | 保留单次消费钩子；用于跨模块避免直接互相导入，其状态生命周期有用。 |
| `departure.selection-state.js` | 完整 | 保留共享 live binding；仅存临时选择引用，生产消费者仍在出征逻辑。 |
| `base.js` | 复用前轮候选与本轮入口核对 | 两个蛋计数持久化函数同构候选仍保留待协调；未改活跃保存返修文件。 |

另有少量装配/页面文件只为跟踪上述调用读取，未作为可编辑纯业务范围，不将其归入完整前端审查。类型声明未逐项审查；未对 DOM、CSS、页面、桌面 EXE 做删除。

## 尚未实施的具体候选

1. `battle-settlement.commands.js` 的 `createAttempt`：`readBase` 已把外部快照克隆为私有 `base.value`，同一函数随后又 `clone(base.value)`；输入 `afterRun` 开头已克隆为私有 `snapshot`，组装 attempt 时又 `clone(snapshot)`。两者可直接转移私有对象所有权给最终 `freezeDeep`，全部外部输入隔离、收据/修订检查不变。该文件与活跃战斗保存返修重叠，主会话要求先不编辑。
2. `base.js` 的 `persistEggPity` 与 `persistEggBattles` 除目标字段外同构，可合并成内部字段持久化 helper；无槽/落盘失败仍仅推进相应内存计数，不改公开命令。该文件仍避让保存返修。
3. `save-archive.js` 自写 `validSlot` 与 `commands.shared.validSlot` 判定完全相同，可导入替代，避免第二个档位上限真源；本轮按保存边界先保留。

没有证据足够、可绕过公开兼容或迁移契约整文件删除的候选。未用“只有测试引用”“无直接静态调用”作为删文件依据。

## 证据与静态验证

修改前原始字节保存为 `preparation.sources.js.before.txt`，SHA256 为 `980EEFF5AE6B929B751DD60FA2A592726DDA26FC21BD59B87BCF32287EA21E80`；修改后为 `BFBEFCF92562C5864902E3901CFE18A09AA79FF0E0C285850B62576F34BAF2C5`。同目录 JSON 清单分别记录前后哈希。

`node --check game/src/hub/preparation.sources.js`、定向 `git diff --check` 均退出 0；已逐项读取相对本轮快照的完整差异，仅替换上述一行。`git diff --no-index` 退出 1 表示有预期差异。

按要求未测试、build、实页、提交或推送；共享占用登记由主会话管理。
