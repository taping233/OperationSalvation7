# 卡牌描述规则依赖盘点（Vite）

日期：2026-09-23。盘点基线：HEAD `84a2f20`（`fix: guard card actions and saves, release frames, capture diagnostics`）。本文件记录迁移启动前可定位的运行时路径；其后的实施状态见主计划。盘点当时共享工作区存在大量并行未提交改动，未运行测试/build，也未读取或改写这些改动。相关源文件在该次 `git status --short` 中未见修改；计划文件和本清单均为未跟踪文档。

## 结论

`desc` 目前不是展示专用字段。它被用于玩家出牌前的合法性、目标范围与费用计算，拆句驱动即时及延迟效果，装备和状态被动，背包使用、钥匙数量、以及缺失卡牌字段的回填。个别路径同时有稳定 `id` 特判，但文本解析仍是实际规则来源或兼容兜底。改文案可能改变玩法；仅从卡牌静态 `dmg` 等字段迁移不足以解除依赖。

运行时数据入口包括默认卡库（`cards.js`/`cards.rules.js`）、定版与历史批次同步（`cards.sync.js`、`game/data/cards-sync.json`）、玩家卡库/自定义卡，以及战斗持卡快照。同步会按 `id` 更新 `name/desc` 并重播版本数据；不能把只改默认定义视为覆盖旧存档。计划文档也明确 `cards-sync.json` 为生成数据，不应手改。本次迁移清单范围是老板已定版的卡；制作坊新卡不作为迁移前置，自定义卡后端可关闭。这里记录其现状与编辑入口，不扩展出自定义卡规则迁移设计。

## 按运行时路径分类

| 分类 | 调用点与文本依赖 | 当前结果/边界 |
| --- | --- | --- |
| 战斗预检：范围与目标 | `game/src/battle.rules.js:22-104`：AOE、是否影响敌人、自身/敌方目标、牌库限定、手牌消耗，以及冰冻/流血等目标推断读取 `card.desc`。 | UI 可打出与瞄准行为受句式影响；有 `heal/armor` 等结构字段辅助，但不构成统一的结构化目标规则。测试入口：`tests/battle-pure-rules.test.js`。 |
| 战斗预检：可打出条件 | 同上 `unplayableReasonFor()` 识别“无法打出”以及普通战限制。装备/道具预检另在 `game/src/battle.engine.js:1844-1859`，如 BOSS 逃跑限制和回血道具数值。 | 同一张卡可能由 id 特判与描述条件共同决定。测试入口：`tests/battle-pure-rules.test.js`、`tests/r3-0-command-guards.test.js`。 |
| 战斗费用/代价 | `game/src/battle.card-cost.js:1-25`：锦囊口袋法术折扣、上一张武术、本回合其他武术次数、零护甲条件从描述计算动态费用。`battle.rules.js:59-72` 解析手牌消耗条件；注能前置/燃料成本由战斗执行路径处理。 | 费用存在条件优先级和状态依赖；只移动显示 cost 字段无法代替。测试入口：`tests/battle-pure-rules.test.js`、`tests/direct-cast.test.js`、`tests/card-effect-semantics.test.js`。 |
| 立即效果：基础数值/伤害 | `game/src/battle.resolution.js:13-173` 将 desc 切句，推断段数、触发次数、墓地/手牌系数、血线条件、注能变化、击杀后追加效果、吸血等；有按 `id` 的 `tt7-bloodpoison` 文本覆盖。详细句式由 `effect-steps.js` 和 `effect-steps.{damage,curse,kills,recovery,rules,deck,tail,gates}.js` 的有序正则步骤执行。 | 同时存在步骤顺序与 `did` 等门控；卡的文本可以一条触发多步骤。`effect-steps.audit.js` 对未识别句式做审计，不等同于完整实战执行证据。测试入口：`tests/battle-resolution.test.js`、`tests/card-effect-semantics.test.js`、`tests/card-audit.test.js`。 |
| 立即效果：打出/结算编排 | `game/src/battle.engine.js:764` 调用 `splitClauses`；`battle.resolution.js` 负责直接伤害类结算；常规效果经 `applyTextEffects()` 进入步骤表（例如 `battle.engine.js:1920`）。`battle.effects.js:7-63` 对句子切分及触发文本切分。 | 规则并非单一解析器；应按真实调用顺序迁移并确认每个时点整段效果归属，不能只搬匹配正则。 |
| 即时效果：目标之外的道具 | `game/src/battle.engine.js:1854-1920` 解析治疗、资源数值，识别复活/神秘药水，再执行文本效果。 | 战斗中道具使用与背包用卡是不同入口，需分别验收。 |
| 跨回合/被动/装备 | `game/src/battle.engine.js:678-681` 从描述取持续回合数；`874-988` 读取装备技能、装备上限、诅咒装备条件、战斗开始触发及牌库上限；`1041` 将触发句加入调度；`1539-1592` 解析留手、最后手牌、成长/击杀/施法被动、免疫/注能标志等；`1653-1661` 处理法伤翻倍、冰冻加伤、流血翻倍。回合延迟步骤也在 `effect-steps.gates.js` 等继续解析 `desc`。 | 至少包括登记触发与触发时重读文本两种风险；需确认事件顺序、战斗结束清理、复制/离场与存档恢复。测试入口：`tests/battle-resolution.test.js`、`tests/card-effect-semantics.test.js`、按具体卡族的战斗测试；计划列有 `tests/battle-resolution.test.js`、`tests/card-effect-semantics.test.js`。 |
| 背包道具 | `game/src/game.bag.js:22-147` 由 desc 解析治疗、复原卡数、口粮/木材数量、抽卡/觉醒/神秘效果；部分规则同时检查 `id`，复原药水还检查卡名。`game/src/battle.engine.js:1854-1859` 是另一份战斗道具语义。 | id 特判不保证文案可改；部分分支描述正则是同 id 卡的后备判别。当前未在指定目标测试清单中找到完整背包效果回归入口，需按各卡用例补查。 |
| 基地材料/钥匙/经济 | `game/src/base.js:547` 从卡描述读材料堆叠数量；`:605-610` 解析钥匙 `×N` 计数。`cards.rules.js:223-240` 的出售资格优先读显式 `sellable`，缺省时用 `不可出售`/`可出售` 描述备注判定。 | 资源数量和出售资格都受文本影响。现有钥匙定向测试：`tests/base-key-count.test.js`；出售相关的现有入口可从 `tests/hub-flow-regression.test.js`、`tests/premium-ui-pages.test.js` 继续定位，但这些测试名称/断言本身不足以证明描述改写不变性。材料用法在 `base.js:522-588`，其数量解析需结合调用者行为复核。 |
| 数据回填/同步/制作坊 | `game/src/cards.rules.js:65-150` 对缺少 `dmgType/dmg/draw/infuse/heal/armor` 时从描述推导；`:223-240` 回退推断卖出资格。`cards.sync.js:145-203,479-480` 同步名称/描述并规范化旧描述；`cards.js` 定义旧档字段契约；`game.cardslib.js:827-1044` 允许填写/编辑描述及机制词条并保存。 | 文本可能在载入、播种或编辑时补成结构字段；须区分“兼容数据转换”与每次运行规则执行。测试入口：`tests/cards-catalog.test.js`、`tests/cards-replay.test.js`、`tests/cards-sync-snapshot-guard.test.js`、`tests/custom-cards.test.js`。 |
| 延迟文本载荷 | `battle.engine.js:78` 根据牌区入口再切卡牌描述；`:1041-1062` 建立/读触发文本；`:2201-2223` 在生成/复制卡效果中读取描述；`effect-steps.gates.js` 处理回合触发文字。 | 迁移需盘点延迟记录究竟保存操作数据还是文本/卡快照，当前静态扫描无法证明所有恢复和清理分支。 |
| 纯展示/搜索 | `game/src/game.cardslib.js:228,555,935-976,1044,1131` 把描述显示在卡面、用于图鉴搜索与制作坊编辑。`battle.engine.js:625-639` 把 desc 放进可用性/状态投影供 UI 展示；`:2122` 将卡描述用作选择项文案。 | 这些是展示或 UI 文案用途，但须先确认调用没有再将投影文本送回规则路径。仅这些展示用途可在规则迁移后继续保留 desc。 |

## 第一批代表卡（按稳定 id）

以下只列可以从静态卡数据、源代码和现有测试入口交叉定位的代表项；`当前行为证据` 是代码/测试存在的证据，不宣称已做浏览器或本次测试验收。

| 稳定 id | 规则族与当前证据 | 建议验证入口 | 未覆盖点 |
| --- | --- | --- | --- |
| `cc-rapid-fire` | **cards-sync 定版：是**（`game/data/cards-sync.json`）；`cards.js` 的通用 `ensureCardsSyncLive()` 会按同步版本覆盖/补齐旧库。**TT12：否**。**旧档：是**，走 cards-sync live 同步，不是 TABLETOP12。数据为 cost=1、`dmg=2`、`dmgType=fixed`；描述规定本回合每打出其他招式触发伤害。结算存在此触发专用逻辑。 | `tests/rapid-fire.test.js`；亦可用 `tests/battle-resolution.test.js` 的同类探针核对次数/顺序。 | 多敌与被沉默、击杀后扫尾组合的具体矩阵未在本盘点执行。 |
| `tt7-holyheal` | **cards-sync 定版：未找到**；属于 TABLETOP7 旧批次定义。**TT12：否**。**旧档：是**，`cards.js` 先播种 `TABLETOP7`，之后仍可能被当前 cards-sync live 更新。注能费用为 2 燃料后回复 4 的行为有明确断言。 | `tests/card-effect-semantics.test.js:86-100`。 | 失败支付、目标状态/禁疗与普通战/BOSS 差异仍需按计划完整复核。 |
| `tt7-meteorstrong` | **cards-sync 定版：是**（定版同步 JSON）；**TT12：否**（虽属旧 `tt7-` ID，不属于 `TABLETOP12`）。**旧档：是**，旧 TABLETOP7 播种后再由 live sync 以 id 覆盖。当前数据 cost=2、描述“注能(2)：施放 3 次火球”；测试断言注能两张后共造成 12 点法伤。 | `tests/card-effect-semantics.test.js:101-…`；较新的批次回归 `tests/message-batch-0920-late.test.js`。 | 消耗失败、目标死亡期间的剩余段与随机目标语义尚未在本次核实。 |
| `tt7-bloodpoison` | **cards-sync 定版：未找到**；属于 TABLETOP7 旧批次定义。**TT12：否**。**旧档：是**，经 TABLETOP7 播种；其后存在独立 id 特判。`battle.resolution.js:13-15` 按 id 覆盖结算描述为攻击+1且附加流血；`battle.engine.js:1607` 另有二段点选特判。 | `tests/message-batch-0917.test.js`、`tests/r3-0-command-guards.test.js`。 | 定版描述与结算覆盖差异应先判定为兼容实现还是规则偏差；双目标交互要保留。 |
| `tt-crystal` | **cards-sync 定版：是**（JSON 定版数据）；**TT12：否**。**旧档：是**，旧批次历史回填记录明确包含此 id，启动时再由 cards-sync live 更新。`game.bag.js:41` 按 id 或描述识别复原最多 3 张卡。 | 计划推荐的背包/旧档定向用例；目前本检索未定位可确认该效果完整结果的单独测试。 | 效果、容量/可选目标与使用后去向需要补具体断言。 |
| `tt3-mystery-potion` | **cards-sync 定版：未找到**；旧批次卡库定义。**TT12：否**。**旧档：是**，通过旧 TABLETOP3 批次播种，后续同步可能覆盖。`game.bag.js:134` 与 `battle.engine.js:1857` 按 id 或“随机神秘效果”识别，在背包和战斗各有语义入口。 | 背包与战斗各自的定向用例；本次未定位完整测试名。 | 随机分支、双入口一致性与效果去重未核实。 |
| `tt-key-one` / `tt-keys-bunch` | **cards-sync 定版：是**（JSON 定版数据）；**TT12：否**。**旧档：是**，历史覆盖批次记录明确含两 id，cards-sync live 同步按 id 更新。描述分别标记 `钥匙 ×3`、`钥匙 ×2`；基地按 `×N` 计数。 | `tests/base-key-count.test.js`。 | 旧档没有乘数标记时按 1 计，需保留这一回退兼容语义。 |
| `starter-emergency-bandage` | **cards-sync 定版：未找到**；属于本地初始卡定义。**TT12：否**。**旧档：是**，`cards.sync.js:101-112` 通过 `ensureStarters()` 将旧“应急绷带”记录改绑稳定 id；默认定义在 `cards.rules.js:345`。`game.bag.js` 的通用治疗回填/使用入口从文字取回复量。 | 背包道具使用相关测试；本次未找到该 id 的专门行为断言。 | 新旧字段 `heal` 缺失/存在时的优先级与治疗上限需要明确。 |
| `tt12-barriermend` | **cards-sync 定版：否**（当前定义在 `cards.data.js` TABLETOP12）；**TT12：是**。**旧档：是**，`cards.js:153` 用全新 `TT12_KEY` 播种，因此已有旧档启动会补播。结构字段 `armor=6`，描述另承担“无护甲时本牌变为0费”条件；规则可定位到 `battle.card-cost.js:22-23`。 | `tests/battle-pure-rules.test.js` 中零护甲规则；卡牌实际实例需从 TABLETOP12 按 id 校验。 | 该描述含有可匹配的“没有护甲，该牌变为0费”子串，但现有费用测试是否以此稳定 id 实例化、是否覆盖完整预检/结算同步，本次未核实。 |
| `tt12-hitechrd` | **cards-sync 定版：否**（TABLETOP12 定义）；**TT12：是**。**旧档：是**，同上经新 key 补播。描述规定发现 2 费招式，并在每个回合开始时降 1 费；牌库发现和跨回合效果均靠文本识别。 | `tests/card-audit.test.js` 可能覆盖句式识别；真实发现、下回合费用变化需新增/定位定向战斗用例。 | 本次没有找到按此稳定 id 验证完整发现+跨回合流程的测试。 |
| `tt12-raydragon` | **cards-sync 定版：否**（TABLETOP12 定义）；**TT12：是**。**旧档：是**，`TT12_KEY` 启动播种。当前字段有 `infuse=1`，描述给出注能后 11 点法伤，代表结构数值与文本效果分置的基础注能族。 | `tests/card-effect-semantics.test.js` 中注能基线；本次未找到该 id 专测。 | 需核对 `dmg/dmgType` 缺失时伤害推导及未注能直接打出的行为。 |

## 当前测试入口索引

- 预检/动态费用：`tests/battle-pure-rules.test.js`、`tests/direct-cast.test.js`。
- 即时效果/注能/顺序：`tests/battle-resolution.test.js`、`tests/card-effect-semantics.test.js`、`tests/rapid-fire.test.js`、`tests/message-batch-0917.test.js`、`tests/message-batch-0920-late.test.js`。
- 未识别句式审计：`tests/card-audit.test.js`；它审计逐句识别，不足以证明完整结算。
- 数据/同步/自定义卡：`tests/cards-catalog.test.js`、`tests/cards-replay.test.js`、`tests/cards-sync-snapshot-guard.test.js`、`tests/custom-cards.test.js`。
- 基地钥匙：`tests/base-key-count.test.js`。
- 背包效果：本次检索到的测试名未能确认覆盖 `tt-crystal`、`tt3-mystery-potion`、急救绷带的完整实际效果，作为缺口保留。

## 未知项与下一步取证

1. 本次是静态源码盘点，没有执行测试、完整卡库 desc 调用点自动清单、浏览器交互、普通战/BOSS 行为对照，也没有逐个审阅 `effect-steps.*` 中的操作语义。文中的代表卡是第一批候选，不是最终覆盖集。
2. 需要把所有现役定版稳定 id 与解析命中句式、持有场景、触发时点和真实测试断言关联起来；特别是装备/状态触发、复制/发现和延迟保存。自定义卡不作为这一批迁移前置。
3. `game/data/cards-sync.json` 的历史批次/退役列表及覆盖数量未在本次盘点审计；不能据此断言旧档迁移闭环或全卡库覆盖。
4. 动态构造/覆写描述与临时卡文本的全路径还未穷举；需在阶段 0 扩展到生成者与消费者两端。不要在此清单基础上直接删除旧解析器。
5. 静态源中同一机制有 id 特判、名字判定、结构字段和 desc 正则并存；实际优先级须以具体用例追踪，遇到行为冲突应作为规则问题单列，不能在结构迁移时顺带改玩法。

## 下一批可执行清单（按当前工作树）

下表以当前工作树中的 `card-rules.schema.js`、各运行时分派点和新增定向测试为准；这些文件有其他并行任务的未提交改动，所列是只读定位结果，不表示本清单作者修改了对应源码。优先迁入能由现有规则操作完整接管整张卡的族；解析器/操作能力不足时明确暂缓，避免同一张卡新旧路径并跑。

| 优先级 / 族 | 稳定 id 聚类 | 当前真实解析点 / 已有字段 | 建议迁移顺序 | 最小真实测试入口 / 能否完整迁移 |
| --- | --- | --- | --- | --- |
| P1 即时伤害：单段负攻击修正 | `tt7-sneak`（-1 攻；相邻但不可并入的 `tt7-throwblade` 另有流血和抽牌，`tt7-ghostblade` 另有破隐增伤和抽牌） | `battle.resolution.js` 的直接伤害路径与 `battle.engine.js` 出牌结算；schema 已支持 `dmg`、`dmgType: attack`、`onPlay.damage`、`chosenEnemy`。`tt7-sneak` 有 `dmg=-1`、`dmgType=attack`，无其他效果字段/效果句。 | 先为 `tt7-sneak` 声明敌方单体目标和一次伤害；确保 `rules.triggers.onPlay` 存在时绕开同句旧解析，再以改写 desc 的实战断言封口。通过后再盘点同样只有 `dmg` 的其他定版攻击卡，勿把带附加效果者混入。 | `tests/structured-onplay-battle.test.js` 的负攻击实战模式；最小新增用例从现役卡库按 id 加入 `tt7-sneak`，改写 desc 后验证目标、攻击力修正与只结算一次。**可完整迁移，建议下一批首卡。** |
| P1 基地仓库材料：钥匙 | `tt-key`、`tt-keys-bunch`、`tt-key-one` | `base.js` 的 `materialInfo/materialAmount/useStashMaterial/keyCount`；已识别 `rules.base.material`，kind 支持 `keys`，可绕过名字/desc 数量回退。现有定向测试 `base-material-rule-baseline.test.js` 仍刻画旧描述行为，`tt3-wood-bundle` / `tt3-ration-double` 已有结构化字段样例。 | 先给三张现役定义补 `{kind:'keys', amount:1/2/3}`；按 id 修补旧档持有卡快照；扩展基线断言涵盖单张/整堆折入、`keyCount()` 汇总与改写名称/desc。保留旧存档无规则时的兼容回退，避免把旧快照当成已迁移。 | `tests/base-material-rule-baseline.test.js` + `tests/tt3-material-structured.test.js` 的旧档回填模式；实测使用一次仓库钥匙，再验证总钥匙计数。**可完整迁移，且与已有材料规则同一实现域。** |
| P2 纯出牌前：剩余 TT12 条件/目标/折费 | `tt12-magicfind`、`tt12-hitechrd`、`tt12-backupcell`（后者的消耗口袋折费已迁；立即抽牌/回能仍未迁） | `battle.rules.js` 负责文本目标/条件；`battle.card-cost.js` 负责旧文本折费；`battle.engine.js` 还会解析发现候选和跨回合临时费用。schema 的 `battle` 仅支持 target、handCards requirements、既有两种 cost modifier，不包含“发现费用置零”或发现候选存档规则。 | 保持已结构化的 `tt12-backupcell` 折费子域不动；`tt12-magicfind` 与 `tt12-hitechrd` 等待发现/持有候选数据模型明确后再整卡迁移，不能只迁预检而让效果继续读 desc。 | `tests/tt12-structured-battle.test.js` 覆盖后备能源折费但明确不足以代表整卡效果；`tests/tt12-hitechrd-battle-baseline.test.js` 是跨回合旧行为基线。**当前无可完整接管的待迁族。** |
| P2 即时伤害：TT12 复合伤害 | `tt12-raydragon`、`tt12-unstableray`、`tt12-infectray`、`tt12-saturate`、`tt12-chargeray`、`tt12-freezeray` | `cards.rules.js` 仍能从 desc 回填缺失 dmg/dmgType；`battle.resolution.js` 读取注能、随机区间、诅咒、击杀重施、手牌注能成长、先前受伤等句式。字段如 `infuse/dmg/dmgType/draw` 只描述部分效果；schema 的 damage-only onPlay 不允许和这些附加效果混用。 | 先为每张卡建立完整效果清单，再逐个补 schema 操作；在一次 PR 可表达其整张 onPlay 前不声明 `rules.triggers.onPlay`。优先级低于单段纯伤害。 | `tests/tt12-structured-battle.test.js` 仅覆盖已迁卡；按机制分别使用 `battle-resolution` / effect semantics 的真实 `BattleSession` 用例。**暂缓，均不能以当前 damage-only schema 完整迁移。** |
| P2 背包/经济：普通治疗道具 | `tt-medneedle`、`tt-jinchuangyao`、`tt4-woodify`（分别描述固定回复 16/10/6）；已迁 `tt3-savior-elixir` 作参考 | 背包真实入口 `game.bag.js` 的 `useOwnedCard()` / `cardHealAmount()`；当前结构化 `bag.use.heal` 要求 `card.heal` 数值字段，而三张卡只有 desc，旧执行器从 desc 取值。 | 给定版数据补齐 heal 字段并声明单操作 heal；按 id 回填玩家 `ownedCards` 快照；先逐卡验证满血不消费、受伤时上限钳制和 uid 消耗，再改写名称/desc 重验。不要与抽牌、净化、免疫药水并族。 | `tests/bag-structured-rule-migration.test.js` 已提供真实背包 UI 及改文案模式；复制其 heal 用例并以三张真实 id 参数化。**操作可表达，但须先把缺失 heal 变为正式数值字段后才可完整迁移。** |
| P3 即时状态 | `tt12-sporewall`、`tt12-infectray`、`tt12-freezeray`、`tt3-toxin`、`tt3-thornfield` 等附加中毒/冰冻/随机诅咒卡 | `battle.rules.js` 从 desc 推目标阵营/范围；`effect-steps.curse.js`、`effect-steps.damage.js` 和 `battle.engine.js` 的多目标/效果结算仍按文本解析。当前 `onPlay` schema 只允许 damage/armor/heal/draw，没有 applyStatus 操作。 | 先补状态操作和目标约束，再按稳定 id 分“指定层数/指定目标”“群体状态”“随机状态”；同卡若同时有伤害或护甲，必须确保所有效果能由同一结构化 onPlay 完整表达后再迁。 | 现有 `battle-resolution` / `card-effect-semantics` 可作基础，但需新增按真实卡 id 的 `BattleSession` 状态叠加、目标数、沉默和描述改写断言。**当前不可完整迁移。** |
| P3 跨回合/被动/装备 | `tt12-hitechrd`；`tt7-bulwark`、`tt3-petal`、`tt3-master-staff`、`tt3-blooddrinker`、`tt3-swordimmortal` 等作为代表待核定版覆盖 | `battle.engine.js` 的 battle-start 登记、回合开始/结束触发及被动扫描（约 980-1077、1539-1661）；`effect-steps.gates.js` 解析延迟句。字段 `draw/armor` 不描述触发时点、期限、成长存续和战斗清理。 | 先按触发时点和生命周期分族（本回合、N 回合、整场战斗、装备被动）；再定义 trigger schema 与旧档恢复边界，逐卡迁。不要和普通 onPlay 合并。 | `tests/tt12-hitechrd-battle-baseline.test.js` 能作为发现后费用衰减基线；其他卡需对应回合边界与战斗结束清理的真实 BattleSession 用例。**当前不可完整迁移。** |

### 推荐批次

1. `tt7-sneak`：当前 schema 足以让整张卡绕过描述规则执行；以一条真实战斗改文案回归即可闭环。
2. `tt-key`、`tt-keys-bunch`、`tt-key-one`：复用已验证的 `base.material` 操作，将整个稳定 id 钥匙家族迁完并补旧档回填测试。
3. `tt-medneedle`、`tt-jinchuangyao`、`tt4-woodify`：需要把 heal 从文案提升为正式字段后，复用已存在的背包结构化操作。

先不要把 `tt12-hitechrd`、附状态/触发的复合伤害、装备被动或“抽牌+回能”的 `tt12-backupcell` 标为完成；当前 schema/执行器还不能完整接管其触发与结果。

## 本次验证

- 只读：读取 `D:\素材\代号柒\AGENTS.md`、本迁移计划、`git status --short`、`git log -1 --oneline`。
- 只读：用 `rg` 定位指定运行时模块、步骤模块和相关测试中的 `desc` 读取，再查看代表卡静态数据字段；追加清单时又核对了当前规则 schema、真实分派点、定向测试名和对应卡定义。
- 未运行测试/build；未更改除本清单之外的文件；未提交或删除任何内容。
