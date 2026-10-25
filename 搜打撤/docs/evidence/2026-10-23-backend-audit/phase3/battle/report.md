# 第三轮战斗/卡牌非前端冗余清理

日期：2026-10-23。卡牌迁移初批实际修改 2 个文件，增加 23 行、删除 35 行，净减 12 行、655 字节。另删除 1 个被后续同键覆盖的 Map 数据项；该数据项保留排版后净行数为 0，未虚增行数。后续协调释放后应用的战斗精简另见 `pending-applied/report.md`：生产净减 213 行，全仓净减 18 行。两批合计生产净减 225 行、全仓净减 30 行。没有整文件删除。

## 已完成

### 同步卡库的三套相同执行体合并为一套

文件：`game/src/cards/cards.sync.catalog.js`。`ensureTabletopSync`、`ensureTabletopSync11`、`ensureCardsSyncLive` 原先分别复制 marker 检查、读全库、倒序退役、按 id 覆盖/补种、保存和复读盖章。现由私有 `synchronizeCatalog` 执行同一套流程，各入口保留自己的退役条件和源数据回调。本文件本轮 +21/-33，净减 12 行。

静态等价依据：

- marker 键及真假判断不变，依旧先查 marker 再读取 library.all。
- 源数据通过回调延迟读取，顺序仍为读全库、移除退役卡、再读取/映射定版数组；没有在 marker 检查前提前读取源表。
- 三种退役谓词逐字保留其条件，包括实机 retire 集合、第十一批“新兵操典”名称和 live-sync 自身 retire 数组。
- 倒序 splice、源表 forEach 顺序、findIndex、整卡浅拷贝、已有卡原位置以及缺失卡追加顺序均不变；没有换成 Map 去重改变重复 id 的历史行为。
- live-sync 的箭头回调捕获原方法 this，仍读取调用接收者上的 RETIRE_CARDS_SYNC 和 CARDS_SYNC。
- 成功保存后才复读盖章，saveAll 返回 false 时不盖章。原三个入口的 try/catch 仍在原方法，异常范围和静默退出保留。

### 删除装备迁移表的重复映射

文件：`game/src/cards/cards.sync.m7.js`。私有 `CANONICAL_TABLE_BY_ID` 对 `tt8-archdemon` 原来先存 TABLETOP11、后一项马上覆盖为 TABLETOP10。现在仅保留有效 TABLETOP10 值，并保留该键的首次插入位置，因此最终 Map 的值和迭代顺序均不变。本文件本轮 +2/-2，净删 33 字节、1 个重复项。

调用证据：该 Map 仅交给 `createRuleBackfiller`，由 `cards.sync.backfiller.js:60` 按 id 调用 `.get`。没有把当前的 TABLETOP10 映射退回旧来源。

## 检查与证据

- 两个修改文件分别执行 `node --check` 和 `git diff --check`，退出码均为 0。
- 使用已存在的 Acorn 对 47 个 cards 纯数据/规则模块做静态解析，扫描重复对象键、字面量 Map 重复键和无条件退出后的块级语句；修改后未发现其他同类候选。没有执行这些业务模块。
- `receipt.json` 包含每个源文件修改前后字节 SHA256、真实增删行数、净字节数及本轮独立 diff。
- `*.before.txt` 保留读取时的原始字节；`*.diff.patch` 仅比较本轮基线，不混入其他会话未提交改动。
- 逐文件覆盖及保留理由见 `coverage.md`。AST 检查范围与人工定向审读范围分别标明，不把语法遍历说成全部业务已经审完。
- 按老板要求没有运行测试、构建、游戏实页；未修改前两轮 bug、没有提交。

## 保留与未实施

- `cards.sync.rule-backfill` 的 E8 治疗迁移和 M 批 backfiller 虽然骨架相似，但 marker 的存在判断、缺目标卡处理和能力检查不同；没有为了减少行数合并这些行为。
- 旧版规则指纹、卡面默认值和变体快照都有迁移/数值读取消费者；不因名字带 previous 或历史日期就删除。
- 默认实例门面、旧卡/自制卡文本兼容、存档版本和既有测试覆盖保持。
- 第二轮 combat 内置 selfTest 迁出、acquire 两套循环合并在初批时因归属未释放而保留；主会话后来确认释放，现已应用并在 `pending-applied/` 单列源码、测试搬迁计数及静态证据，没有重复计入本页初批 receipt。
- 目前没有其他达到“可静态证明无行为变化”的整段删除项；保留会改变自定义卡、失败重试或回调顺序的候选。
