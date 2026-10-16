# 伤害预览准确性审查

状态：以下保留修复前审查与复现结论。父线程随后批准的最小安全修复已实施，现行改动、验证和剩余边界见 [IMPLEMENTATION.md](IMPLEMENTATION.md)。

## 核心判断

奥术弹的“无法精算”是预览覆盖缺口。更高优先级的问题是现有结构化预览会把漏算的结果标成“精确”：本次隔离复现确认爆燃火球、充能射线、暗影射击各一例。应先封住伪精确，再窄范围支持奥术弹。

审查阶段只新增本目录。该阶段没有改生产源码、正式测试、共享登记或游戏数据，没有操作浏览器、注入/恢复 BattleSession、运行项目构建、提交或推送。已读取根 AGENTS、QUICKSTART、WORKFLOW-TOOLS、quality-gates，并运行限定 handoff；审查相关生产文件无编辑占用，`battle.lifecycle.js` 和 `battle.target-rules.js` 已有他人改动，仅作相关只读参考。父线程正在操控实页，注能条另有 worker 负责 `battle.view.js` / `battle-stage.css`，本审查不编辑它们。

## 已执行复现

命令（在项目目录运行）：

```sh
node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-10-16-damage-preview-audit/vitest.audit.config.mjs --reporter=verbose
```

结果：1 文件、5 用例通过。这里“通过”表示成功复现当前缺口，**不是修复已经通过**。完整结果见 `repro-output.txt`。

方法：导入实际 `previewAction`、实际 `createBattleResolution` 和实际 Combat，给 resolver 注入隔离端口夹具；卡牌规则形状与当前 M3/M11 声明一致。无真实战斗会话、DOM、存档或浏览器状态。resolver 的 hitFoe 端口仅调用 Combat，不覆盖引擎装备/龙巢/复活/全部时点钩子；下列三个数值缺陷不依赖这些附加机制。友军用例调用实际 forecast，再单独复刻已核实的友军先手阶段，未调用完整敌方阶段。

| 对象与条件 | 预览 | 实际 resolver / 对照 | 判断 |
| --- | --- | --- | --- |
| 奥术弹，法伤加成 0，普通战 | unknown，无数字 | 直接伤害 1；获得 1 张初始攻击 | 可安全补直接伤害 |
| 爆燃火球，基础 5，法伤加成 2 | exact 7，靶 HP 30→23 | 伤害 9，HP 30→21 | 漏读 spellPowerMul |
| 充能射线，基础 5，此前注能 2 张 | exact 5，HP 30→25 | 伤害 9，HP 30→21 | 漏读 perInfusedInHand |
| 暗影射击，目标有 1 层中毒 | exact 3，HP 30→27 | 两段共 6，HP 30→24 | 只取首个 damage，漏第二条件段 |
| 玩家 HP 35；雪狼 5HP/7攻、甲壳 7HP/4攻、掷弹兵 4HP/6攻；两名 4HP/4攻步兵 | 预计承伤 6，余 HP 29 | 源码所示友军先手后，后续 forecast 为 0/35 | 原 forecast 未模拟友军攻击 |

普通战奥术弹的“抽牌”并不是随机抽库：现行 resolver 抽牌兜底走 grantSha。父线程实机已观测雪狼从 6HP 降到 5HP；该实机事实由父线程提供，本 worker 没有重复实机操作。

## 根因与证据位置

### 1. 奥术弹缺少预览适配

- `game/src/cards/cards.sync.m11.js:31-36`：奥术弹只有 `battle.hosted: ['damage-and-draw']`，没有结构化 onPlay damage
- `game/src/battle/effects/battle.hosted.js:19-28`：实际执行按稳定卡 ID 和 hosted 名称选取定版执行文本，运行时字段保留
- `game/src/battle/core/battle.resolution.js:475-484`：先经过 hosted 适配和 schema/capability 断言；无结构化 onPlay 时在 `749` 附近进入字段伤害路径
- `game/src/battle/view/battle.preview.js:40-74,129-133`：只接受结构化首个 damage 或旧 SEMANTICS 白名单；奥术弹两者皆不满足
- `game/src/battle/view/battle.hover.js:26-29`：unknown 被显示为“伤害预览：无法精算”及当前原因，这与父线程 DOM 观测一致
- 普通战抽牌替代及终局守卫：`battle.resolution.js:1180-1192`；全灭后不会继续承诺抽牌

### 2. 现有 exact 的 fail-open 漏洞

`battle.preview.js:41` 使用 find，不检查完整 damage 列表；`43-49` 的不稳定参数黑名单早于后续 M 批能力扩展，没有涵盖新参数。

- `cards.sync.m3.js:116-118` 的 `spellPowerMul: 2` 在 `battle.resolution.js:641-648` 确实补上另一份法伤加成；预览无该处理也不降级
- `cards.sync.m3.js:105-107` 的 `perInfusedInHand: 2` 在 `battle.resolution.js:618-624` 读取累计注能数；预览上下文未携带该数，也不降级
- `cards.sync.m3.js:123-126` 有两个 damage，第二个带 `cond.anyCurse`；真实 resolver 在 `592-600` 遍历所有 damage，预览只看首个

同类未建模键还包括 `perTargetPrice`、`infuseBonus`、`pick:'new'`。本轮未声称这些键都对应一个已复现的现行普通卡缺陷，但 fail-closed 边界必须覆盖，否则新卡或合法自制卡会重复出现同类错误。

### 3. 其他已定位的静态准确性风险

- `battle.engine.js:1148-1154` 读取已装备卡 `rules.equip.passive.cond.vsFreeze` 并给命中追加伤害；预览使用的裸 Combat 与 `getPreviewContext` 均未反映该修正。该合法装备形状存在执行通道；本轮未做装备实机复现，**不把任意 hosted 寒冰剑都等同于已复现这个形状**
- `battle.engine.js:1156-1163` 对 `pstat.status.bleedAmp` 额外补一次流血量；Combat 只自带一次流血加成，preview 不处理这个旗标。当前 `cards.sync.m3.js:95` 有 registerRule bleedAmp 来源。建议至少先降级这类上下文；未作完整会话回归
- 多段转向后的伤害还依赖后续目标的修正与特殊生命周期。已有预览只对 hearts/protected/aegis 做后续目标降级，不宜在本补丁中声称全面支持所有引擎命中钩子

以上是读代码得到的额外风险，和已执行的三个 resolver 数值复现分开记录。

## 最小修补方案（未执行）

### 第一段：先收紧“精确”承诺

1. 用完整 onPlay 列表取 damageOps。最小版要求恰好一个 damage；多 damage 一律 unknown，原因写“包含多段独立伤害流程，暂未完整预演”。不要把第一段数字作为整卡精确总伤害
2. 从黑名单改成受支持键的明确白名单。允许已经覆盖的字面量/`amountField:'dmg'`、确定段数、已支持目标和 retarget 形状；其余伤害来源、修正、延迟、新目标选择及未知字段 fail closed。最小版可连 `onKill` 等副作用键一起降级，以保持承诺边界简单；如保留，必须明确仅不改变直接伤害的金币/护甲奖励形状及提示
3. 非 damage op 同样检查：会直接引爆/施放/改变后续伤害的 op 不得默默忽略。已知只在直接伤害后附加的抽牌/诅咒等效果可保留直接伤害数字，但通过 unknownEffects 写清“不含后续效果”
4. 在 core 只读上下文补未建模 hitFoe 修正的窄布尔量，例如当前 bleedAmp、有对冰冻增伤的装备；最小版存在即 unknown，避免为了此次补齐重写结算公式。对多段转向应覆盖所有可能命中目标，而不是只看当前 hover 目标
5. 保留已有 hearts、破隐、暗羁绊、注能、整卡重复、箭矢符文和成长降级；“伤害确定”和“整卡结果确定”是不同承诺

### 第二段：奥术弹窄适配

1. 仅对 `tt7-arcanebolt` 与它声明的 hosted `damage-and-draw` 配对放行；需要排除附带 triggers/equip/bag、额外 hosted 名称或未来扩展字段。不能仅凭名称、描述含数字或任意卡的 dmg>0 放行
2. 用与实际执行一致的 hosted 定版执行视图验证身份/文本语义；伤害金额取实际运行时字段，避免预览硬编码 1 而实际合法运行时字段已变化。若只接受定版字段，也应把改字段情形明确降级
3. 当前普通战显示直接法术伤害（自然包含法伤加成、防御、免疫、庇护等已覆盖规则）；额外说明“普通战抽牌改为获得初始攻击；未计后续触发，敌人全灭时停止余下效果”。不要承诺必定抽到一张或抽牌后的整卡总伤害
4. BOSS 战的抽牌结果/onDraw/灰烬符文等后续执行不应靠试跑真实 resolver 来计算预览。最小版可以仅普通战放行，BOSS 仍 unknown；或显示确定的直接伤害并明确“不含抽牌及后续触发”
5. `PreviewResult` 已有 unknownEffects，`battle.hover.js:48` 已展示它，普通补充说明可沿用该通道，无需修改 `battle.view.js` / layers。若要改主标题为“直接伤害”，可在独占 `battle.hover.js` 实施

### 建议精确属地

最小安全修复预计只需申请这些文件：

- `game/src/battle/view/battle.preview.js`：完整 op 检查、fail closed、窄 hosted 预览计划、unknownEffects
- `game/src/battle/core/battle.core.js`：只读额外修正上下文/必要时 hosted 执行视图，不改真实结算
- `game/src/battle/battle.snapshot.types.d.ts`：同步新增只读 context 类型
- 可选 `game/src/battle/view/battle.hover.js`：若主标题需明确“直接伤害”；否则用现有 unknownEffects 即可
- 新增 `tests/battle-preview-trust-boundary.test.js`，按需要补 `tests/r3-a-preview.test.js` 的实际会话一致性回归
- 只更新本证据目录的修后结果

不需要改 `battle.view.js`、`battle.layers.js`、`battle-stage.css`、卡牌定版数据、规则 schema 或真实 resolver；forecast 主标签由父线程与当前 UI worker 统一处理。

## 建议测试与验收边界

### 必须先有的自动化回归

- 将本复现三例改为“不得误标 exact”，最小版预期 unknown；后续真支持时再和 resolver 的 9/9/6 对齐
- 第二个 damage 的 cond/bonus/range、随机目标、延迟、pick:new、perTargetPrice、perInfusedInHand、spellPowerMul、infuseBonus 以及未知键逐一 fail closed；所有 damage op 都必须被扫描
- 一般确定 damage 与无附加伤害的后置效果保留可用性，避免把所有结构化伤害都退化
- 奥术弹：普通战无加成 1、法伤/祝福加成、防御矩阵、免疫/庇护/首脑庇幕、目标死亡、非法费用/手牌状态、整体重复/注能/成长/被动修正降级
- 奥术弹只认正确 ID+hosted；同名、错误 hosted、额外规则、描述变化与运行时 dmg 改写的约定行为
- 普通战 grantSha、BOSS 抽牌未知、沉默与全灭后余句停止，确认说明不会承诺未发生的抽牌
- 预览连调 100 次不改变输入、快照、牌区或 RNG；不调用真实 hooks
- bleedAmp、合法 vsFreeze 装备、转向目标带修正时不再误标 exact

### 现有近邻测试（本轮未运行）

`tests/r3-a-preview.test.js`、`tests/battle-preview-amount.test.js`、`tests/multi-hit-retarget.test.js`、`tests/battle-resolution.test.js`、`tests/fresh-run-battle-turn-forecast.test.js` 及 contracts / architecture-boundaries。修复涉及类型时补相关 typecheck；本次纯证据审查不代表全量通过，也没有 build/实页验收通过声明。

父线程可在现有真实普通战中以奥术弹选目标，核对 hover 数字、打出后的目标血量、普通战获得初始攻击，以及有步兵时 forecast 主标签的估算说明。继续使用父线程当前窗口，避免其他 worker 重载现场。

## 友军承伤预测专项结论

`battle.turn-forecast.js:6` 已写“按当前状态估算；回合末触发、随从攻击与随机效果可能改变结果”。但普通栏主数字“预计承伤”通常只把该说明放在 title，触屏或未 hover 时不明显。

父线程观测和代码一致：奥术弹使雪狼 6→5；两名 4 攻步兵先打雪狼，再在敌方阶段替玩家承伤。forecast 没有模拟这个先手阶段，所以可能高估。当前应称其“估算”，可在主标签显式写“估算承伤”，并在可见副文案说明“未计随从攻击与回合末触发”。没有证据证明它是严格上界，不能称“最多承伤”或保证“保守上限”。本轮不改战斗顺序、随从规则或 forecast 公式。
