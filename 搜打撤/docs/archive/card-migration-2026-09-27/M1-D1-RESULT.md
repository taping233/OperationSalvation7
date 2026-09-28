# M1 数据迁移批 D1 结果（2026-09-27）

- 执行者：代理D1（卡牌规则化 M 批·现集批次——当前 schema/capability 已支持能力的 legacy 卡）
- 基线：HEAD `a8e91e6`，生产卡库 272 张（71 有 rules / 201 legacy）
- 能力基线：E6 实测支持集——onPlay 有序 ops：damage / armor / heal / draw(固定N) / curse / acquire / blessing / energy / status / discover；出牌前 requirements / costModifiers
- 交付文件（均为新建，未改任何既有文件）：
  - `game/src/cards/cards.sync.m1.js` —— `ensureM1OnplayRules(deps?)` 回填函数 + 4 张卡 definitions
  - `tests/m1-data.test.js` —— 18 条用例（每张迁卡 3 条 + 批次级 6 条），全绿
  - 本文档
- 验证：`npx vitest run tests/m1-data.test.js` 18/18 通过（对当前工作区 schema/capability 实测）；裸 node ESM 导入与无依赖 no-op 检查通过。未跑全量 vitest、未 build、无 git 写操作。
- 接线：`ensureM1OnplayRules` 未接入启动链——由主指挥在 cards.js ensure 层与 `ensureA3*` 同位调用。

## 一、已迁卡清单（4 张）

rules 数据风格与 cards.sync.js `ensureA3*` 定义一致（`version: 1`、onPlay 有序 ops）。

| id | 名称 | rules op 摘要 | 对应旧描述 |
|---|---|---|---|
| `starter-attack` | 初始攻击 | battle `{side:'enemy',area:false}`；onPlay：damage(amountField:'dmg', chosenEnemy) | 攻（+0）：造成等同于攻击力的伤害。 |
| `tt3-skewer` | 穿刺 | battle 敌单体；onPlay：damage(amountField:'dmg') → curse(abreak, duration:1) | 攻（+2），附加破甲，持续 1 回合。 |
| `tt8-dragonblade` | 青龙偃月斩 | battle 敌单体；onPlay：damage(amountField:'dmg') → curse(abreak, duration:2) → curse(bleed, stacks:1) | 攻+6，附加破甲与 1 层流血。 |
| `tt7-livingwater` | 圣光之源 | battle `{side:'self',area:false}`；onPlay：draw(amountField:'draw') | 抽 5 张牌。 |

### 语义等价依据
- **attack 型伤害**：结构化 damage(`amountField:'dmg'`) 由 `Combat.dealDamage` 按 `dmgType:'attack'` 并入攻击力（combat.js `dmg = amount + atk`）——`starter-attack` dmg:0 即"纯攻击力"；负修改量同口径（B1 已迁 `tt3-venom-arrow` 攻（-1）为先例）。
- **破甲默认时长**：`tt8-dragonblade`「附加破甲」无回合词，文本路径默认 2 回合（battle.engine.js CURSE 解析表 `abreak def:2`），故 `duration:2`；`tt3-skewer` 有「持续 1 回合」故 `duration:1`。schema 对具名计时诅咒强制正整数 duration、bleed/poison 强制 stacks。
- **op 顺序**：先伤害后诅咒由解释器循环保证（循环 1 伤害 → 循环 2 诅咒），同文本路径；破甲与流血的施加次序照描述词序。
- **canonical 锚定**：整卡深相等比对取 `SDT.Cards.TABLETOP10` / `TABLETOP11` 运行时定版（E8 先例：不另存可漂移数值表）。4 个 id 均不在 cards-sync，TABLETOP 内联对象即定版真身；`tt3-skewer`（TABLETOP3[30] 旧法术版）/ `tt8-dragonblade`（TABLETOP8 旧版）的同名旧副本与定版深不相等，将被保守跳过（有用例锁定）。

## 二、跳过卡清单（8 张）

统一根因：**混合目标契约缺口**——`battle.target` 是卡级单值，HEAD schema 交叉契约强制 heal/armor/draw 类 op `side:'self'`，而 damage/curse 选定敌强制 `side:'enemy'`，同卡无法声明（card-rules.schema.js battle.target 交叉契约段）。缺的契约：**per-op 独立目标侧（或自身域 op 在敌方主体卡上的放行）**。

| id | 名称 | 旧描述 | 原因 | 缺什么契约 |
|---|---|---|---|---|
| `tt2-forestarrow` | 绿化箭 | 攻（-1），+3 甲。 | damage(敌) + armor(自) 混排矛盾；A3 已显式排除同款 | 同下 |
| `tt2-piercearrow` | 破甲箭 | 攻（-1），获得 3 点护甲。 | damage(敌) + armor(自) 混排矛盾 | armor 在敌方主体卡上的自身域放行 |
| `tt2-swiftarrow` | 迅疾箭 | 攻（-1），抽 1 张牌。 | damage(敌) + draw(自) 混排矛盾 | draw 在敌方主体卡上的自身域放行 |
| `tt7-fullstrike` | 全力一击 | 攻（+5），抽 1 张牌。 | damage(敌) + draw(自) 混排矛盾 | 同上 |
| `tt7-arcanebolt` | 奥术弹 | 1′，抽 1 张牌。 | spell damage(敌) + draw(自) 混排矛盾 | 同上 |
| `tt7-throwblade` | 飞刃偷袭 | 攻（-3），附加流血，抽 1 张牌。 | damage+curse(敌) 可表达，但 draw(自) 无法同卡声明 | draw 自身域放行 |
| `tt3-toxin` | 毒药 | 附加 1 层中毒。抽 1 张牌。 | curse(敌) + draw(自) 混排矛盾；A3 排除清单点名「毒药+抽牌」 | 同上 |
| `tt12-sporewall` | 孢子城墙 | 对一名敌人附加2层中毒，自己获得6点护甲 | curse(敌) + armor(自) 混排矛盾；A3 排除清单点名「孢子城墙+护甲」 | armor 自身域放行 |

### 与并行 M1 能力扩批的交接（重要）

本批执行期间观测到并行会话正在工作区扩展 schema/capability（**未提交**，标记 M1 2026-09-27）：新增 `cleanse` op、`draw.range/untilHandN/handOps`、`acquire.filter(cost/costMax)`，并加**混合目标放行**——battle.target `side:'enemy'` 时，字面量源的自身域 op（heal/armor/draw 字面量、cleanse）免 side/area 强制（field-anchored 不参与）。

影响与交接：
1. 本批 4 张已迁卡只用 damage(amountField)/curse/draw(amountField)，**在 HEAD 与工作区两版 schema/capability 下均校验通过**（测试即对工作区版本跑绿），不受该批影响。
2. 上表 8 张跳过卡在混合放行 + 解释器接线落地后将**全部可重开**（draw/armor 改字面量源并满足 declaresField 即可），建议作为 M 批后续数据批迁移；本批不越权代迁——宁可跳过不许硬造契约。
3. `tt7-livingwater` 用 field-anchored draw（`amountField:'draw'`、battle self），与混合放行无交互，维持现写法。

## 三、回填函数保守语义（cards.sync.m1.js）

照抄 `ensureA3*` / `ensureE8FixedHealRules` 先例：只处理指定 4 个 ID；仅当无自有 rules（含玩家制作坊产出）且整卡与 canonical 深相等才回填；marker（`sdt-cards-m1-onplay-rules-v1-seeded`）一次性；异常/缺定义/缺卡/存库失败/复读不一致一律保守退出不标记、下次启动重试；不原地改热缓存对象（写时复制）；先校验（`validateCardRules` + `inspectCardRuleCapability` 双门）后保存；成功后复读确认。deps 参数仅测试注入用，生产无参调用。

## 四、未核实项

- 并行 M1 能力扩批的最终落地形态（schema/capability/解释器接线仍在变动中）；本批跳过卡的"可重开"结论以当时工作区 diff 为据，落地后需重核。
- 真实存档端的端到端回填（需接线后由主指挥实机验收：启动两次看 marker 与卡面）。
