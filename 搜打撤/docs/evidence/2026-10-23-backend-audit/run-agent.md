# Run / Agent 非前端静态审查

日期：2026-10-23。仅阅读源文件与调用/字段证据；未修改业务源码，未运行测试、构建、游戏实页。审查不把旧地图生成器、存档兼容路径、导出门面判为死代码。

## 确定的 bug

### A1：Agent 使用过期卡牌分类，稀有度与保留牌优先级失真（P2）

- 位置：`game/src/agent/agent.policy.js:57-60`、`:152-156`、`:203-208`、`:749-760`。
- 当前规范证据：`game/src/cards/cards.rules.js:25-27` 的稀有度包含“古朴”、类型包含“武术/法术/能力卡”；`cards.sync.renames.js:275-278` 也将旧“英雄卡”明确迁为“能力卡”，没有把当前类型转为“招式/能力”。
- Agent 仍把“普通/常见”设为最低档，缺少“古朴”，所以古朴落入默认值 1，与稀有同分。编组选牌和发现选牌会在两者之间按原序取牌；满包丢卡也无法优先丢古朴。
- `DECK_TYPES` 仍为“招式/装备/能力”，因此武术、法术、能力卡全部被当作非卡组类型，同稀有度腾格时不能按注释要求优先保留。`agent.state.js:317-320` 直接投影 `o.card.type/rarity`，不存在转换层。
- 最小修法：最低稀有档加入当前“古朴”；类型改为当前“武术/法术/装备/能力卡”。旧“普通/常见”若保留兼容可继续同分；棱彩/初始/衍生的策略等级应按明确策略补齐，不凭本次审查臆定新排序。

### A2：商店出售排序读取不存在的嵌套字段（P2）

- 位置：`game/src/agent/agent.policy.js:862-864`。
- 证据：`game/src/agent/agent.state.js:317-322` 的 `obs.run.ownedCards` 为扁平 `{uid,name,type,rarity,safe,sellable}`。出售排序却把元素强制断言有 `card` 后读取 `o.card?.rarity`。
- 触发：strategic 策略满包进入收购页，同时有多个 `sellCard` 动作。所有牌查出的稀有度都是 undefined，`rarityRank` 恒为 1，排序按原序，可能先卖传说、后卖古朴，违背本段最低价值优先目标。
- 最小修法：映射值直接用 `o.rarity`，删掉为不存在的 `card` 所加的类型断言；与 A1 的实际稀有度映射同时修。

### A3：曾撤退的对局在事件死亡后被误计为战斗死亡（P2）

- 位置：`game/src/agent/agent.stats.js:65-75`。
- 证据：`:73` 用累计 `fought > won` 判“战斗中”；`game/src/agent/agent.recorder.js:99-111` 对每次收尾增加 fought、仅胜利增加 won，同时保留 mode；`game/src/battle/core/battle.lifecycle.domain.js:156-160` 的 mode 明确区分 win / lose / flee，flee 同样不是胜利。
- 触发：玩家或 Agent 至少撤退过一次，之后在地图事件/非战斗生命损失中死亡。即使最后一场战斗已获胜，累计 fought 仍大于 won，死亡桶仍标“战斗中”。
- 当前死亡入口已有事实：`game/src/run/game.session.death.js:109` 以“非战斗生命损失”发起死亡，`:113` 接收可空 battleSummary；`:165` 把死亡 receipt 交给 recorder。统计没有消费这一事实，而是从累计计数猜测死因。
- 最小修法：优先消费死亡回执/终局明确来源；若当前回执缺少稳定判别字段，在终局记录中增加事实字段再统计。旧记录仅靠 fought/won 无法证明死因，应归“未知”或保留旧口径并标明推算，不能将存在 flee 的累计差值当死亡证据。

## 可安全精简的私有冗余（建议由主会话统一实施）

### R1：删除只转发一次的私有包装

- `game/src/run/game-session-restoration.js:32-38`：`loadGameImpl(slot)` 仅返回 `trackRestoration(() => restoreGame(slot), slot)`，唯二引用都在 `loadGame` 同一表达式的开发/生产分支。无导出、无外部调用、无额外状态或异常处理。
- 可将 `loadGame` 内创建 `const restore = () => trackRestoration(() => restoreGame(slot), slot);` 后返回 `development ? traceRestoreStep('load-game', restore) : restore()`，删除私有 `loadGameImpl`。保留公开 `loadGame` 及 tracing 标签。

### R2：移除私有成功构造器后的不可达失败分支

- `game/src/run/map-snapshot.js:179-188` 的 `hydrateValidatedMapSnapshot` 唯一返回 `{ok:true,value:...}`；它没有失败返回，参数来自本次调用校验隔离副本。
- `:197` 和 `:206` 随后都以 `hydrated.ok ? 成功值 : hydrated` 分支。失败侧不可达，可直接构造成功返回，保留 `hydrateMapSnapshot` 对外校验和旧 3/9 重建。
- 若不追求这种小型可读性整理，可以不改；不删除任何文件。

## 主会话后续实施

审查结束后，主会话已实施 R1/R2，仅修改 `game-session-restoration.js` 与 `map-snapshot.js`。R1 删除私有 `loadGameImpl`，`loadGame` 内的 restore 回调仍通过 `trackRestoration` 执行，并保留开发追踪标签。R2 只去掉两处 `hydrated.ok` 的不可达失败侧，未修改校验、构造器或旧 3/9 重建。

两文件的修改后 `node --check` 与定向 `git diff --check` 均退出 0。未测试、构建或实页；A1–A3 没有修改。上文位置为审查时点，后续精简会使相关会话行号前移。

## 证据不足，保留

- `agent.weights.js:92` 的 `deck.rarityWeight` 在策略中没有消费；策略仅使用 counterWeight。它属于对外权重结构，可能有外部实验消费者，本次不能凭仓内调用缺失删除配置键。可另行决定接入该权重或废弃。
- `agent.llm-parser.js:9` 的花括号提取是贪婪匹配，回复夹带多个 JSON 对象时无法按注释所称提取第一个；现有协议要求回复一个动作，属于容错缺口，不列为本轮必须修复的核心 bug。
- 旧地图 `map-generator.js` / `layeredMap.js` 仍被当前生成器复用和 3/9 存档恢复调用，不是整文件删除候选。

## 实际覆盖

- 完整阅读：`game-session-restoration.js`、`game-session-persistence.js`、`map-snapshot.js`、`map-graph.js`、`encounter-selector.js`、`encounter-meta.js`、`chest-reward-save.js`、`event-commands.js`、`shop-commands.js`、`event-recode-candidates.js`、`node-restore-state.js`；Agent 的 protocol、llm/parser/runtime、stats、battle-stats、run-control、runner facade、replay facade/state。
- 定向阅读：Agent policy 的卡牌分类、编组选牌、发现、腾格和商店出售；state 的卡牌投影与丢卡动作；recorder 的战斗流水与终局记录；地图生成器/规则/路线的定义与引用，死亡和战斗收尾事实入口。
- 为追踪依赖读到 event-runtime/lifecycle、shop-commission、node-reward-state 的混合 UI 文件；未审查或建议修改其中 DOM、页面、动画或表现代码。
- 未全面覆盖：大体量地图生成与 route 算法逐分支、Agent runner runtime 的等待/熔断循环、Agent replay 执行与场景运行器、run 大型页面混合控制器。报告不表示这些模块无 bug。
