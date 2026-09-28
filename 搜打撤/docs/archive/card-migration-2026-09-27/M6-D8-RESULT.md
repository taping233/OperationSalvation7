# M6-D8 交付结果：B-M6 bag 道具批预写（2026-09-27）

- 实施者：代理 D8。范围：13 张 bag 道具卡结构化 `rules.bag.use` 预写（不接线，主指挥统一接）。
- 依据：`docs/cards/M-BATCH-CONTRACT-SPEC-2026-09-27.md` §二.13（op 键位设计）+ §二.5（execute 键位）+ `docs/M-BATCH-MATRIX.md` 道具章逐卡草案。
- 新建文件：`game/src/cards/cards.sync.m6.js`（ensureM6BagRules，保守语义照抄 cards.sync.m1.js）、`tests/m6-data.test.js`（46 用例）、本文档。
- 验证：`npx vitest run tests/m6-data.test.js --no-file-parallelism` → **45 passed / 1 skipped（条件反向用例）/ 0 failed**；`node --check` 两文件通过。未跑全量 vitest、未 build、无 git 写操作、未碰 cards-sync.json。

## 双门现状（重要，影响接线时序）

任务下发时扩展 op 预期在途；实测期间并行 M3 批已放行：

- schema `card-rules.schema.js`：`BAG_SUPPORTED_OPS` 十一种（heal/restoreConsumed/energy/blessing/curse/draw/damage/execute/acquire/discover/flee）；`bag.use` 扩为多操作数组（注释点名"恢复药水=heal+energy"）；参数白名单 `BAG_OP_KEYS` **不含 dmgType**（bag 域伤害为固定伤口径）。
- capability `card-rules.capability.js`：同名 `BAG_SUPPORTED_OPS` 消费进度收口。
- **结果：本批 13 张全部通过 schema + capability 双门**（测试 13/13 转正）。
- **消费端仍在途**：战斗侧 `battle.bag.js` useItem 仍走文本正则/applyTextEffects（期间其 +31 行改动为 M3 pick:'new' 泛化，非 bag 分派）；地图侧 `game.bag.js` useStructuredBagRule 仍仅单 op heal/restoreConsumed。
- **接线时序约束**：`rules.bag.use` 落库后，地图侧结构化分支**优先于** id/文本识别分支（game.bag.js useOwnedCard 先调 useStructuredBagRule）。若先接线回填、后收编消费端，通行证/恢复药水的地图使用会被"结构化背包用法无效"短路（不消耗道具但功能失效）。**ensureM6BagRules 必须与消费端 bag.use 分派收编同批或之后接线。**

## 一、已预写清单（13 张，definitions 见 cards.sync.m6.js）

| id | 名称 | rules.bag.use 摘要 | 旧描述（canonical 定版） |
|---|---|---|---|
| tt3-blue-potion | 恢复药水 | `[{op:'heal',amountField:'heal'},{op:'energy',n:1}]` | 回复 5 点生命，回复1点能量。 |
| tt3-demon-potion | 法力药水 | `[{op:'blessing',key:'spellUp',stacks:2,duration:1}]` | 法伤 +2。持续 1 回合。 |
| tt3-houyi-potion | 狂暴药水 | `[{op:'blessing',key:'atkUp',stacks:2,duration:1}]` | 获得 2 点攻击力。持续 1 回合。 |
| tt3-iceheart-potion | 冰冻药水 | `[{op:'curse',curse:'freeze',duration:1}]`（敌方指向由消费端承载） | 附加冰冻，持续 1 回合。 |
| tt3-mind-potion | 精神药水 | `[{op:'draw',amountField:'draw'}]`（draw:2，battle-only，见宿主清单） | 抽 2 张牌。 |
| tt3-mixed-potion | 流血药水 | `[{op:'damage',amount:2},{op:'curse',curse:'bleed'}]` | 造成 2 点固定伤害，附加流血。 |
| tt3-python-potion | 火焰药水 | `[{op:'damage',amount:2,target:'allEnemies'}]` | 对所有敌人造成2点法伤 |
| tt3-turnabout-potion | 剧毒药水 | `[{op:'curse',curse:'poison',stacks:1,target:'allEnemies'}]` | 对所有敌人附加1层中毒。 |
| tt3sp-doom | TNT | `[{op:'execute',cap:{atk:5},count:2}]`（SPEC §二.5 键位，含 BOSS 排除） | 消灭 2 名 攻击力5点及以下小怪 |
| cmtmvq6ss84l | 员工通行证A（直授版） | `[{op:'acquire',pool:{kind:'classAbility'}}]` | 获取本职业的能力卡 |
| tt-token-gold | 员工通行证B | `[{op:'acquire',pool:{kind:'legendary'}}]`（棱彩排除由池谓词 isRandomObtainable 承担） | 随机获取 1 张传说卡（不含棱彩卡）。 |
| tt4-shine-token | 员工通行证C | `[{op:'discover',count:1,pool:{kind:'legendary'}}]` | 发现 1 张传说卡。 |
| tt4-smoke-bomb | 烟雾弹 | `[{op:'flee'}]`（BOSS 禁用保持宿主，见宿主清单） | 非 BOSS 战逃跑一次。 |

数据口径偏差说明（草案 → 落定）：

1. **dmgType 收敛**：矩阵草案 tt3-mixed-potion `dmgType:'fixed'`、tt3-python-potion `dmgType:'spell'`——当前 `BAG_OP_KEYS` 白名单无 dmgType（写之即拒），数据按白名单收敛为固定伤；火焰药水"法伤"口径由消费端分派定版（见"等待收编"节）。
2. **execute cap 形态**：矩阵草案 `cap:5` 简写 → 按 SPEC §二.5 已定版对象形态 `cap:{atk:5}`（与 tt3sp-devour 同语义，任务说明点名"按 SPEC execute 键位"）。
3. **烟雾弹 op 名**：SPEC §二.13 提案名 `escape`、矩阵/任务说明定名 `flee`——按 flee 写（escape/transform 在 SPEC 中属"实现批定版"提案），若实现批终定为 escape，仅改 definitions 一行。
4. 陷阱 T8 遵守：cmtmvq6ss84l（直授版）与 tt-token-color（合成体，不在本批 13 张内）同名不同 id，definitions 各自独立、未合并。

## 二、等待收编清单（双门拒绝的卡/键）

**当前为空**——13 张全部通过双门（schema+capability 均已放行所用键）。

附：消费端收编状态（数据已可落库，行为生效依赖下述收编）：

- 战斗侧：battle.bag.js bag.use 结构化分派在途（useItem 现仍文本路径；battle 侧 healM 正则先于 bag 规则命中 blue-potion，矩阵已备注"迁移需两域同步"）。
- 地图侧：game.bag.js useStructuredBagRule 多 op 分派在途（现仅单 op heal/restoreConsumed，其余 op 落"结构化背包用法无效"警告且不消耗道具）。
- 池键位：`pool:{kind:'classAbility'}`（员工通行证A）为矩阵新增池键，bag 消费端收编时需实现"本职业能力卡"池谓词（参照宿主 `SDT.Cards.classPool(game.myClass).filter(type==='能力卡')`）。

## 三、需宿主分支清单（收编点坐标为 2026-09-27 工作区实测行号，收编时以函数名为准）

| id | hosted 建议名 | 现状宿主与收编点 |
|---|---|---|
| tt3-blue-potion | hosted:heal-regex-first | 战斗侧 healM 正则（battle.bag.js:50，useItem 内 `/回复\s*(\d+)\s*点生命/`）先于任何 rules 命中——分派收编时 heal op 需接在正则前或移除正则，防双结算；地图侧 cardHealAmount 文本兜底（game.bag.js useOwnedCard 尾部）收编后由 heal op 接管 |
| tt3-mind-potion | hosted:battle-only-draw | 矩阵备注"地图侧抽牌无意义，bag 规则需 battle-only 作用域标记"——地图侧分派对 draw op 应拒绝使用（或跳过保留道具），契约键（作用域标记）未定版前由消费端按 op 语义承载 |
| tt3-iceheart-potion | hosted:item-target-enemy | 敌方指向选择：itemTargetSideFor（battle.rules.js）+ beginSpecialTargeting('item')（battle.bag.js useBattleEffectItem，:102-111 一带）——分派收编时 curse/damage 单敌 op 需保留拖拽/点选交互 |
| tt3-mixed-potion | hosted:item-target-enemy | 同上（damage+curse 双段同目标） |
| tt4-smoke-bomb | hosted:boss-flee-pattern | BOSS 战禁逃跑现由 ITEM_BOSS_FLEE_PATTERN（battle.bag.js:36,40 itemUsability，正则 `/非\s*BOSS\s*战/`）承担——flee op 收编后改读 rules（或 op 内建 BOSS 拒绝）；逃跑通道需 finish(false)（SPEC §二.13 提案口径，实现批定版） |
| cmtmvq6ss84l | hosted:class-acquire-pool | 直授版当前无专用使用分支（地图侧落"效果将在 M1 战斗中实装"兜底；其 desc 不含"觉醒"，不会被 tt-token-color 正则误触发）——收编点为新增 classAbility 池消费，池谓词参照 tt-token-color 觉醒分支（game.bag.js:148-156）；陷阱 T8：与 tt-token-color 同名不合并 |
| tt-token-gold | hosted:token-gold-direct | 地图侧 id 分支（game.bag.js:134-144）："直接随机获得，不进入发现候选页"+showLegendGet 提示——收编为 acquire legendary 池时保持直接获得语义与提示界面 |
| tt4-shine-token | hosted:shine-token-direct | 地图侧 id 分支（game.bag.js:159+，2026-09-09 留言 #11）："背包中使用直接获得"——矩阵草案为 discover（「发现」≠直接获得，交互域）；收编时需拍板：保持宿主直接获得（建议，行为无回归），或升级为发现面板交互 |
| 其余 5 张（demon/houyi/turnabout/python/doom） | 无独立宿主 | 纯战斗域 op（blessing duration / curse allEnemies / damage allEnemies / execute cap），随 battle.bag.js bag.use 分派逐 op 接线即可 |

## 四、回填器与测试说明

- `ensureM6BagRules(deps?)`：只处理指定 13 id；仅当无自有 rules 且整卡与 canonical 深相等才回填；marker（`sdt-cards-m6-bag-rules-v1-seeded`）一次性；异常/缺定义/缺卡/存写异常保守退出不标记；写时复制；先双门校验后保存；成功后复读确认。生产无参调用；**本函数未接线**，由主指挥统一在 cards.js ensure 层与 ensureA3*/ensureM1* 同位调用。
- canonical 源表：12 张取 `SDT.Cards.TABLETOP10`（其中 tt3sp-doom/tt-token-gold 为 cards-sync 字符串引用，解析后对象即定版真身）；cmtmvq6ss84l 取 `TABLETOP11`。TABLETOP3/TABLETOP4 旧副本（蓝瓶药水等旧名旧值）由深相等校验天然挡住。
- `tests/m6-data.test.js`（46 用例）：每卡 3 条——双门通过、回填生效（rules 逐键一致/卡面不动/复读一致/marker 盖章/单次保存）、保守跳过三变体（改名/改字段/已有 rules）；批次级 7 条——marker 一次性与未收编保守退出、等待收编形态（数据全不动，双门齐后自动 skip）、缺卡/缺表/saveAll false/无原库串不标记、TABLETOP3 旧副本不写脏。扩展键若回退为未放行，卡级用例经运行时探测自动转 skip 并在标题标注等待的契约项。
- 未核实项：`pool:{kind:'classAbility'}`/`{kind:'legendary'}` 在 bag 消费端的池谓词实现（在途）；烟雾弹 flee 的 finish(false) 通道（实现批定版）；mind-potion battle-only 作用域标记键（矩阵备注，未定版）。
