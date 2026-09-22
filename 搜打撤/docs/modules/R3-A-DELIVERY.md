# R3-a 可信伤害预览交付

## 玩家可见改变

- 多敌人战中点击选中指向卡后，每个存活敌人旁直接显示当前目标的伤害预览，无需 hover。
- 点选提示为「点击该敌人打出」；拖拽 hover 才显示「松手打出」。
- 通过完整语义指纹的白名单显示「精确伤害」；其余只显示中文的「无法精算」原因，不给数字或击倒承诺。
- 预览显示逐段数字、总伤害、击倒判定，以及护盾/护甲/闪避变化；庇幕或护卫偏转会显示 0 伤害原因。
- 取消点选会清除常驻预览；每次 render 都从当前 snapshot 重算。常驻预览不使用拖拽手势捕获的旧 `aim.snap`。
- 单名存活敌人的指向卡仍直接打出，没有新增确认步骤。

## 实现边界

- 新模块 `game/src/battle.preview.js` 持有有限语义指纹、exact/unknown 分类和纯伤害计算。R3-a 不再开放通用 partial 推测路径。
- 多段预览在同一个深克隆目标上逐段调用 `Combat.dealDamage`，因此闪避、护盾、护甲会按真实顺序消耗，并在 HP 归零后停止。已删除「首段结果 × 次数」的视图算法。
- 纯预览不调用 RNG、`addCurse`、`addBlessing`、`hitFoe`、`resolveCard` 或 Combat hooks。
- `battle.core.js` 只增加冻结的 `getPreviewContext(uid,targetIndex)` 只读窄口，复用真实手牌、能量、可用性和目标规则，输出有效卡快照、实际费用、目标及战斗层修正，不暴露内部可变集合。
- 拖拽和点选气泡每次使用当前 snapshot 与 core context 重算；不再优先使用 `aim.snap`，已有气泡也不会阻止刷新。
- 气泡宽度限制为敌人格宽减 8px，去掉 170px 最小宽度，供三敌 1280px 布局复验。

## exact 真实对照覆盖

| ID | 类型 | 真实 `BattleSession.commands.playCard` 对照 |
| --- | --- | --- |
| `starter-attack` | 单段攻击 | HP/伤害一致；另对照首脑偶数回合庇幕 0 伤害 |
| `tt7-sneak` | 单段攻击 | HP/伤害一致 |
| `tt3-reshot` | 单段攻击 | HP/伤害一致 |
| `tt2-shoot` | 单段固定 | HP/伤害一致 |
| `tt3-fireball` | 单段法术 | 含玩家法伤后 HP/伤害一致 |
| `cmtna0nb1yxt` | 单段法术 | 含玩家法伤后 HP/伤害一致 |
| `tt7-meteorrain` | 两段攻击 | 闪避 1 层 + 护盾 1：预览/Real 均为 `[0,2]`，闪避与护盾均归零 |
| `tt3-double-shot` | 三段固定 | 1 HP 目标只执行首段，后两段停止 |
| `tt3-chain-lightning` | 两段法术 | 法伤 + 护盾 + 护甲的 HP/防御最终值一致 |

每张 exact 卡必须同时匹配 `id/type/dmgType/dmg/desc`。测试覆盖 desc、dmg、dmgType、type 任一改写后均降为 unknown，且不输出伤害或击倒。

## 实际未支持上下文

以下情况当前明确降为 unknown，不展示伪精确数字：

- 龙巢 `heartsMode` 折心。
- 初始攻击/杀的战斗内变身。
- 白梅「破隐一击」翻倍。
- 龙巢 `nestSyn.dark1/dark3` 伤害加成。
- 已选注能材料或「所有招式均已注能」会改写伤害的卡。
- 元素风暴整卡重复、末手整卡重复、箭矢符文重复。
- 法伤加成翻倍、对冰冻增伤、流血加成翻倍、半血增伤、血量门槛、墓地/本回合/抽到卡价格动态伤害。
- 击杀后再施放、诅咒条件额外施放等条件重复。
- AOE 整体结果、随机目标/随机卡、发现、选手牌、敌人互攻等非定序单目标伤害。

无法打出的动作同样不显示数字：卡不在当前手牌、能量不足、卡牌自身不可用、当前交互阻塞、目标死亡或目标类别错误。费用随气泡展示。`freeCast` 当前存在“结算不扣费、但 `play()` 仍先检查原费用门槛”的既有口径，预览忠实反映，不在 R3-a 改写出牌规则。

已支持的战斗层阻断：异能庇幕与 `protected/protects` 存活护卫者庇护，两者都可精确显示 0 伤害及原因。

## 程序验收

```text
npx vitest run tests/r3-a-preview.test.js tests/r3-0-command-guards.test.js tests/message-batch-0917.test.js tests/bag-slam-button.test.js tests/camera-interaction.test.js --no-file-parallelism
```

结果：5 个文件、50 个测试全部通过，其中 `r3-a-preview.test.js` 为 27 个测试。

R3-a 新增反例覆盖真实 AOE、随机流程与状态前置卡，手牌/能量/目标合法性、暗 1 多段跨半血、初始攻击变身，以及护甲、护盾、格挡、减伤、破甲、免疫、潜行、闪避防御矩阵。防御矩阵均以真实 `BattleSession.commands.playCard` 对照。

`contracts.test.js` 同轮存在 1 个与本包无关的既有失败：`main.js` 已导入 `term-tips`，`boot-order.js` 仍少该条目。R3-a 未修改这两个文件。

模块语法检查通过；`git diff --check` 无新空白错误。

## 待 Friday 根 IAB 验收

- 普通多敌战：点击指向卡后，不 hover 也能在每个活敌人旁看到各自伤害预览。
- 确认点选文案没有「松手」；拖拽 hover 仍是「松手打出」。
- Esc/再点当前卡取消后气泡与可选高亮全清，能量/手牌/目标状态不变；重新选牌能继续打出。
- 单敌人仍免选直打。
- 首脑偶数回合庇幕显示精确 0 伤害，破甲后恢复实算。
- 三敌 1280×720 下气泡应互不重叠、不盖意图；大屏与窄屏可读性、hover/点选之间切换仍需真实页面观察。

本文档不将程序测试通过写成 IAB 实机通过。
