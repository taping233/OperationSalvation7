# 第五轮只读定位：hub/core 的大块候选

**本轮没有找到能在“非 DOM、非 UI、非表现、保留旧档与用户牌库兼容”边界内直接删除数百行的业务代码。源码未修改。** 最大的无生产入口代码确实存在，但属于已明确保留审核副本的雨景供应商表现代码；本报告只记录排除证据，不把它计作后台可删量，也不请求扩大到前端。

## 定位方法与覆盖边界

1. 由 `game/index.html:380` 的唯一 ESM 入口 `game/src/main.js` 出发，Acorn 解析 `game/src` 的 613 个生产 JS，追踪相对 JS import、再导出、字面量动态 import。零解析失败，未发现非字面量动态 import。hub/core 共 156 个 JS、20,886 行，快照含文件大小、SHA、父模块、导入、导出及大函数位置，见 `module-inventory.json`。
2. 图中 DOM/Canvas 等标记仅用于筛选，不能自动判定模块是纯业务；例如 RainSimulation 没有 DOM 但仍是雨景模拟，因此排除。可达表示有生产装配链，不等于每次运行都执行。
3. 对 hub/core（排除供应商目录）做现有 jscpd 的只读重复检测：strict 阈值 25 行/150 tokens，weak 阈值 15 行/100 tokens，均无克隆命中。报告分别在 `clones/`、`clones-weak/`。此结果只排除达到阈值的 token 重复，不宣称不存在语义相似实现。
4. 定向复核纯业务大文件、状态/规则声明、旧存档读取、恒 false 门禁及现行消费者；没有执行游戏源码、测试、build 或实页。工具只解析文件并写本证据目录。

## 大项候选与排除表

| 候选 / 文件规模 | 根入口及全库引用证据 | 估计可直接净减 | 结论 / 还缺什么 |
| --- | --- | --- | --- |
| `hub/courtyard-vendor/RainSimulation.js`，511 行 / 17,184 bytes；`RainRenderer.js`，412 行 / 14,949 bytes | 两者均无生产父模块。现行雨景为 `hub.courtyard-runtime.js:4,68 → courtyard.rain-tableau.js`。全库只见来源记录、资产审核镜像、random 测试的历史排除清单；没有执行导入。 | 后台范围 **0**；若另获明确范围及删除授权，源码去重上限为 **923 行 / 32,133 bytes**，另需少量来源记录更新。 | **排除：表现/供应商范围**。`courtyard-vendor/SOURCE.md:3` 明确这些文件为历史 MIT 审核源码，不是误留的运行时模块。它们与 `game/assets/vendor/base-courtyard/` 的对应文件逐字 SHA 相同（见哈希清单），但不能在当前边界下自行删除或改变保留政策。 |
| `hub/base.js`，扫描时 879 行 | 根 `main.js → base.js`；另有 base.commands、recovery、save-archive 引入。公开 Base 的库存、成长、持久化、锁和迁移仍有实际入口。 | **0 行可证明为整块退役**。 | 保留。最新 WF-project-bugfix 正编辑；大文件不等于重复实现。state 默认/规范化、economy、progression、pet、elapsed、meta 等规则已有分片，共享前提不同；本轮未发现可直接抹掉的第二份基地内核。 |
| `hub/extraction.commands.js`，433 行；`nest-settlement.commands.js`，186 行；`terminal.commands.js`，146 行；`battle-settlement.commands.js`，扫描时 265 行 | 各自有 session/altar/nest/bag 生产入口，父链都回到 main。撤离整理、研究所、死亡/放弃、战斗继续分别消费各自 API。 | **无百行级直接可删量**；本轮估计为 0，未把各文件总长当节省量。 | 保留。四轮已经归一撤离整理两入口的重复状态机。剩余相似骨架的收据优先级、主档是否删除、随机结果留存、令牌生命期、输出与 await 顺序不同。若把整套结算压入通用执行器，需重新证明全部分支与异步边界，不是现成冗余删除。terminal/battle 还在当前修复占用内。 |
| `hub/game.storage.js`，扫描时 288 行；`base.js` 的读档装配；`versioned-slot-reader.js`，121 行 | RunStorage 与 Base 均注入同一个 `createVersionedSlotReader`，生产根分别是 main/Base/session。 | **0 百行级重复管线**。 | 保留。指纹缓存、版本门、逐版迁移和坏档备份的读取内核已经只有一份。两个注入装配有意保留 Run 严格版本/拒顶层数组与 Base 历史宽松版本/允许数组的差别；不能用一套更严格声明覆盖旧档语义。 |
| `hub/recovery.commands.js`，193 行；`departure-persistence.js`，99 行；`recoverable-pair.js`，146 行；`save-archive.js`，扫描时 184 行 | 出征/session/普通结算调用真实存在；前两者已共用 recoverable-pair。归档由 session 装配，导入有独立日志键与回滚。 | **0 百行级直接重复内核**。 | 保留。departure 的旧 run 必须为空并创建新 runId；settlement 复核已存在 runId/revision；archive 恢复的是完整被覆盖原字节，允许原档损坏/过新，不能用“可玩存档”校验代替。重复的是领域术语，不是可删除的等价事务实现。 |
| `hub/meta.js`，366 行；`base-meta.commands.js`，134 行；`meta-progression.js`，49 行 | main 直接装配 Meta；collection/terminal 消费其入口；Base 装配命令；经验内核被战斗/收藏/撤离共用。 | **0 百行级等价实现**。 | 保留。Meta 是门面与奖励/播报，Base 命令是草稿规则，progression 是纯经验计算；不将不同职责整套删去。旧收藏经验标记与卡背补发有显式迁移契约。 |
| `hub/game.store.types.d.ts` 的 GameState / GameSnapshot 与 battle-settlement 类型声明 | GameState 同时包含运行态端口、Set/Map/交互对象；BattleSettlementRunSnapshot 仅包含持久事务的窄 readonly 字段和扩展位。JS 引用相应类型，preparation 也已 import CardSnapshot。 | **0 百行级逐字重复声明**。 | 保留。字段交集不是同一类型；用 GameState 代替存档/事务快照会混入函数、Map/Set 和可变要求。没有找到一整套可删的第二份存档 schema。 |
| `core/notes.js`，138 行 | main 直接导入并注册 Notes；game.notes 消费迁移、读写、清空。 | **0**。 | 保留。长部分是旧备注坐标迁移的 before/after marker 恢复保护，不能为了行数去掉用户内容兼容。 |
| `core/random-core.js` 36 行、`random-service.js` 50 行、`random.js` 30 行、`random-streams.js` 15 行 | map、战斗、奖励及 main 都有根链；pure RNG、命名流恢复、SDT 服务门面与版本键策略各有消费者。 | **0**。 | 保留。core 是唯一数学步进实现，不是第二套 RNG；legacy stream key 与快照版本属于旧档确定性。 |
| `core/rule-config.js`，116 行；`rules.js`，35 行；`base-state.js`，104 行；`game.store.js`，106 行 | RULE_CONFIG 为分组规则真源，RULES 只做旧名别名；BaseState 与 GameStore 分别表示局外永久资产和单局运行态。均可达。 | **0 百行级重复编码声明**。 | 保留。共享字段名如 coins/stats 不代表相同所有权或默认值；分组规则的旧名转发不是一份重新手写数值表。 |

## 恒 false 与无入口核对

已检索 hub/core 的 `const false`、`if(false)`、默认关闭开关及门禁。纯业务未发现整套实现被不可变 false 阻断。

`CARD_DESIGNER_WRITES_ENABLED = false` 的确会挡住制作坊写操作，但其大实现位于 DOM/制作坊页面，仍有导出工具活入口；本轮不把它当后端候选。运行时 `let` 初值 false/null（如 turbo、写警告、锁持有者、重试状态）都有后续变化或存储初始化，不属于恒 false 证据。

根图仅四个 hub/core JS 不可达：上述两份历史雨景、84 行的退役 `game.hub.home-scene.js`（UI 及直测兼容）、2 行的 `game.bag.token-craft.js`（公开旧路径转发）。后两项不满足本轮“大块纯业务”条件。没有发现额外的无入口数百行纯业务模块。

## 可供主会话直接作出的判断

- **当前授权范围：可直接实施的百行级删除候选为 0。** 本轮不为满足数量给旧档迁移、用户牌库兼容或有效事务机制贴“冗余”标签。
- 历史雨景两份源码提供了 923 行的确切无运行入口事实，但属于已排除的表现/来源审核范围。本报告不将其升级为删除建议，也未删除它们、许可证或资产镜像。
- 若目标必须达到数百行净减，现有证据不足以通过继续扫这两个目录保证达成；不把“重新设计通用存档/结算框架”伪装为已验证等价的清理。

## 文件证据

- `module-inventory.json`：613 模块解析结果、156 个 hub/core 条目、路径/行数/大小/SHA、根可达与父模块。
- `inspect.mjs`：本轮静态图定位脚本，只读取源码并写本目录。
- `clones/jscpd-report.json`、`clones-weak/jscpd-report.json`：两档静态成段重复检测，退出码均 0、命中均 0。不是测试或运行行为验证。
- `rain-source-hashes.json`：仅用于排除项定性；两份源码与保留审核镜像逐字相同。
- `rain-references.txt`、`storage-schema-references.txt`：定向全库路径引用及共享存档管线消费者。

本轮没有修改共享源码、运行测试/build/实页、删除任何文件、提交或推送。活跃修复可继续改变其占用文件，清单大小/SHA仅代表本次读取快照，不能代替未来编辑前的实时核对。
