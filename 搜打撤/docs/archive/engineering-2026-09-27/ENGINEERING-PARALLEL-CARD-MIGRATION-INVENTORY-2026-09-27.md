# 卡牌迁移并行盘点

日期：2026-09-27（Asia/Shanghai）  
盘点基线：HEAD `7cf5b6c`（`git log -1 --oneline`）；工作区存在多项未跟踪内容，E7 正在同目录做 QA。本报告只读源码并新增，不触碰 E7 文件、页面或服务；未运行测试、构建或生产初始化。

## 口径与边界

E6 最终记录可作为历史实测证据：生产内存初始化后 `Cards.all()` 为 272 张、68 张有 `rules`、204 张无 `rules`；原始 `CARDS_SYNC` 批次另为 55 张且 0 张有 `rules`（[E6 RESULT](ENGINEERING-E6-CARD-RULE-CONTRACT-RESULT-2026-09-27.md)，原记录第 24 行）。两个口径不可相加或互换。该统计不证明规则已完整迁移，也不代表本次重新实测。E6 RESULT 还记载 68 张全部通过当时 `supported` 能力门，但明确限定其只保证战斗入口检查通过，不表示 base/bag 各域都在战斗中执行（同文 :33-47）。

本报告没有重新运行 `Cards.ensureTabletop()` / `Cards.all()`，因此不提供当前 68 张完整 ID 枚举。以下 ID 是源码静态可定位的迁移回填定义和内联定义；正式清单仍需在批准的只读内存环境执行真实初始化后导出 `rules` 并与能力结果连接，不能凭描述补齐。

## 当前初始化和规则边界

启动路径在 `game/src/cards/cards.js:233-272`：先播种各批卡及同步覆盖、SHA 与字段回填，再执行 `ensureA3BattleRules()`、`ensureA3CurseRules()`、`ensureA3AcquireBlessingRules()`。后面三个函数在 `game/src/cards/cards.sync.js:874-1010` 按 ID 回填结构化规则，不改 `cards-sync.json`。因此仅查看原始 `cards.data.js` 或 CARDS_SYNC 都不能得到生产初始化后的完整规则集。

规则形状由 `validateCardRules`（`game/src/cards/card-rules.schema.js:588` 起）判定；能力门 `inspectCardRuleCapability` 位于 `game/src/cards/card-rules.capability.js:64` 起。E6 的 guard 阻止非法/未支持列表在支付前被消费。结构化卡按 `rules.triggers.onPlay` 执行；无 `rules` 的旧卡仍走文本兼容。结构化定义当前主要声明 battle target、cost modifiers、requirements 和 onPlay 有序操作；有规则不必然表示本卡效果完全结构化。

### 可确定的迁移卡与效果族

下列分组依据 `cards.sync.js` 的 A3 回填表（行号见每组）。这些卡在相关路径下时点均为出牌 `onPlay`；目标/依赖在摘要中列出。E6 实测的汇总操作次数为 damage 33、armor 9、curse 10、heal 2、draw 3、acquire 12、blessing 3、energy 1、status 1、discover 1（总 75，68 卡可以含多操作）；这不是 ID 到 op 的逐卡重新计算。

| 批次/效果族 | 源码可确认的卡 ID | 时点、作用域与依赖 | 状态与热点 |
| --- | --- | --- | --- |
| B1 直接伤害/单体与全体 | `tt2-shoot`, `tt3-execute`, `tt7-whirlwind`, `tt3-arrow-rain`, `tt3-reshot`, `tt7-smite`, `cmtna0nb1yxt`, `tt3-fireball`, `cc-double-boom`, `tt12-unstableray` | onPlay；单敌选取或全体；依赖 damage 执行、目标约束、部分牌的血线门/伤害类型/区间。 | 回填定义 `cards.sync.js:887-898`。`tt3-fireball` 是衍生牌，注释说明施放链走专支，不经 onPlay。 |
| B2 多段、随机次数、击杀重施 | `tt3-double-shot`, `tt3-chain-lightning`, `cc-ember-burst`, `tt12-saturate`, `tt12-elemburst` | onPlay；单体/全体/随机敌人；依赖 hitCount、随机数、击杀后重施和存活目标重选。 | `cards.sync.js:899-904`。顺序、随机和逐击语义牵涉 `battle.resolution.js` 与 effect steps。 |
| B3 治疗/护甲/吸血 | `tt2-bloodblade`, `tt7-bloodpotion`, `tt7-holyglow`, `cc-unmoved`, `tt7-ironcharge`, `tt7-bulwark`, `tt2-block`, `tt3-holy-shield` | onPlay；敌方伤害或自身；依赖吸血、护甲守卫/回合末衰减、字段引用、出牌前护甲费用修正。 | `cards.sync.js:905-914`。若拆 op 需保留原有序与同卡伤害联动。 |
| B5 诅咒（含伤害组合） | `tt3-venom-arrow`, `tt3-armor-rush`, `tt3-blood-arrow`, `tt3-frost-slash`, `tt3-ice-spike`, `tt12-infectray`, `tt3-nuke-ray`, `tt3-thornfield` | onPlay；指定敌人或全敌；依赖 curse 状态类型、免疫、随机种类、叠层/时长、poison burst；多效果卡须先伤害再诅咒。 | `cards.sync.js:925-960`。源码明确另有 15 张因目标契约/时点/表达力/语义差而排除，见 :925-930。 |
| B6 获取/发现 | `cc-dual-wield`, `tt3-flux-slash`, `tt3-life-arrow`, `cmtn1i64j7y7`, `tt7-ironphalanx`, `tt7-twinfireball`, `cmtn1gfhczzj`, `tt12-basicdev`, `tt3-treasure-hunt`, `cc-lava-blast`, `cmtn125e1nk0`, `tt12-magicfind` | onPlay；自身/单敌混合；去 hand/deck/discover；依赖池名词解析、随机池过滤、BOSS deck 差异、选择面板及 act/费用修饰。 | `cards.sync.js:962-999`。`battle.resolution.js:194-230` 记录 acquire 池与三种目的地；BOSS deck 与普通战差异不可忽略。 |
| B7 增益与能量 | `tt7-stealth`, `cmtn1ntxzoc4`, `tt7-energize`, `tt3sp-dodge` | onPlay；自身；依赖祝福生命周期、抽牌顺序、能量结算。 | `cards.sync.js:1000-1008`。此组还需回合/伤害入口配套验收。 |
| 初始化内联代表 | `tt3-bandage`, `tt3-hold-fast`, `tt7-frozenight`, `tt12-hitechrd`, `tt12-barriermend`, `tt12-firecracker`, `tt12-backupcell` | 前两张 onPlay 治疗+护甲、护甲+抽牌；TT12 例子分别为发现后逐回合减费、护甲零值免费、全体固定伤害、消耗口袋折费。 | `cards.data.js:483,488,592,721-735`；真实战斗代表测试 `tests/tt12-structured-battle.test.js:64-170`。 |
| base / bag 非战斗域 | E6 盘点统计 base 8、bag 3（域计数）；源码可见代表 `tt-keys-bunch`, `tt-rations`, `tt-key`, `tt-wood`, `tt-wood-lots`, `tt3-savior-elixir`, `cmtn6bge52qt` | 基地材料结算或背包使用，不是战斗 onPlay；分别依赖材料接收器、物品使用规则。 | `cards.data.js:37-51,164,552-553,683`。完整 8/3 ID 集合未在本次初始化导出，不能把代表项当穷举。 |

## Legacy 文本执行与能力边界

无结构化规则卡的战斗执行并非一个单独解析器：`battle.engine.js` 的打牌编排调用 `battle.resolution.js`，后者与 `effect-steps.*.js` 的有序步骤表解释描述文本。既有静态盘点指出伤害/段数/条件/击杀重施及吸血在 `battle.resolution.js`，普通效果经 `applyTextEffects()` 与 `effect-steps`，被动、装备、延迟时点还分散在 `battle.engine.js` 及 gates 步骤；详见 [2026-09-23 文本盘点](../card-rules-2026-09-23/card-rule-text-inventory-2026-09-23.md)第 17–25 行。这份历史盘点明确称其为静态扫描、未跑战斗/浏览器，故只作为源码导航，不当作本次验证。

已结构化能力可拆成：即时 battle/onPlay op；出牌前 requirements/costModifiers；非战斗 base/bag；仍是文本路径的触发被动、装备主动技能、持续/延迟效果、墓地交互、额外回合等。E6 capability 支持集合明确排除非 onPlay triggers、equip、damage 的 graveyard/schedule/hits.perFoe、draw 的 untilHandN/handOps 和 acquire.filter/未列组合（RESULT :37-47）。这些应先扩展能力契约和真实消费端，再迁卡。仅 `schema` 通过不等于运行能力可执行。

## 测试证据和迁移批次建议

历史可复用的实战测试入口：`tests/structured-onplay-battle.test.js:109-216` 覆盖改写描述仍单次执行、单/群伤、多段重选、负攻击修正、沉默、治疗/护甲/抽牌顺序；`tests/tt12-structured-battle.test.js:64-170` 覆盖现役卡库取卡、费用规则和描述改写；`tests/e6-card-rules-execution.test.js:79-205` 覆盖整列表拒绝、支付前拒绝、规则改写只执行一次、旧文本卡仍可用。它们是已存在源码测试，不表示本盘点运行了测试。另有 schema 参数测试 `tests/card-rules-schema.test.js:4-323`。A3 来源注释将首批列为 23 张、B5 8 张、B6+B7 16 张；以实际 Map 键数量和当次生产计数复核后再采用精确批次总数。

建议后续实施顺序（仅盘点建议，不构成授权）：

1. **结构化清单先导出**：用受控内存初始化得到全部 272 项的 `id/rules/domain/op/trigger` 表，分别记 68 有 rules、204 legacy；CARDS_SYNC 55 单独列表。为每个 legacy 记录真实描述解释族、时点和目标，不靠名称推断。
2. **低耦合即时效果**：纯固定 damage、单项 armor/heal/draw，逐卡核验所有附加字段及目标；复用 battle resolution 真实场景。热点 `cards.sync.js` 的迁移回填表与 `card-rules.schema.js`、`battle.resolution.js`、`battle.exec-play.js`。可由独立实施者处理单批数据定义+对应真实 BattleSession 测试，但要避免并行修改这几个核心文件。
3. **复合即时效果族**：多段/击杀重施、诅咒/状态、获取/发现、祝福/能量；每族需独立验操作顺序、随机与目标、沉默/免疫、普通战/BOSS 差异、失败/无目标分支。它们会争用 `battle.resolution.js` / `effect-steps.*` / `battle.engine.js` / `battle.selection-flow.js`，应串行单写或先冻结共享接口。
4. **跨时点和装备**：非 onPlay triggers、装备被动/主动、持续状态和延迟载荷最后做。先有明确 trigger/lifecycle schema 与事件顺序、清理及恢复约定；热点 `battle.engine.js`、`effect-steps.gates.js`、`battle.runtime.*`、`battle.snapshot.*`，高度争用战斗核心。
5. **base/bag 单独一批**：按消费入口分开，验证物品实际使用或基地入账；不要把 E6 的 capability supported 当作这些域已被战斗 guard 实际执行。

每一批的验收应包括真实稳定卡 ID、改写名称/描述不改变行为、结构化操作顺序、效果字段和目标、沉默/免疫、普通战/BOSS 适用边界、未支持规则在任何支付前整体拒绝，以及旧文本卡回归。卡库同步数据不得手改；新增结构化卡须经 schema、capability、真实调用入口以及相应测试全部对应。

## 可独立实施与共享热点

可独立的工作是只读导出生产初始化规则清单、按 ID 对照现有测试、撰写逐卡映射表；如果动手实施，新的单一效果族可先新增数据定义和隔离测试，但任何触及公共 schema、执行器、入口的变更须归一个实施者串行完成。

共享争用最高：`cards.js` 初始化排序、`cards.sync.js` 三个 A3 回填器及标记、`battle.resolution.js` 结构化/文本解释混合分派、`battle.exec-play.js` 支付与执行边界、`battle.engine.js` 触发登记/公开命令、`effect-steps.*` 的文本顺序、`card-rules.schema.js` 和 `card-rules.capability.js`。多个并行批次改这些文件会造成回填顺序、双重结算、能力表与执行器漂移风险；`cards-sync.json` 是生成同步源，禁止手改。

## 未核实项

- 本次没有跑生产卡库初始化；未核对当前实时初始化结果是否与 E6 272/68/204 一致，也未枚举全部 68 张 ID。
- 未重新执行测试、构建、页面验收或分析 E7 并行 QA；测试引用仅表示源码存在。
- 未逐卡读取 204 张 legacy 的文本执行条件，也未证明每张结构化卡的非战斗域已接线。CARDS_SYNC 55 张全 legacy 是 E6 历史实测数据。
- A3 函数注释中 B1-B3 数量“23”与可见 definitions Map 需进一步核对，避免把注释数直接当键数；完整分类需以内存初始化导出为准。

