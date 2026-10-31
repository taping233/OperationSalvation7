# 当前战斗状态、名牌与场地投放迁移

本片生产已冻结，等待 Root 集中原生复验。修复依据是对 current-visual-6 三张截图的独立只读检查，结论存于 `../migration-1029/current-effect-review/review6-battle-settlementagent.json`。本片没有启动 Unity、操作前台或独立验收自己的 HUD。

## 当前结果

- 敌人和友军使用 28px 状态区，玩家使用 59px 状态区。状态项高26、横向间距7、纵向间距5、垂直留白1，超过固定区域后在状态列表内滚动；右侧保留数量摘要。
- 敌人状态只显示专用图标和数量；玩家显示名称、数量及单位。悬停和键盘聚焦读取完整说明，Tab/Shift+Tab 和上下导航保持被聚焦项可见。按稳定状态键复用节点，不随快照重建全部状态项。
- 名牌依源顺序使用名称、可选玩家/友军属性、状态、被动意图，各段间距6。敌人没有额外属性行；意图显示图标和伤害，多段附乘数，零伤害仍显示0；冰冻与失去行动/退场分别投影，不沿用完整攻击标签。
- `CombatResolver` 两张 metadata 表是状态显示资料的唯一来源。本片同步16种源显示资料、专用图标、满月形态名称和闪避说明；未修改伤害与计时算法。
- 当前输入捕获、InputField、IME、捕获结束同帧导航抑制均会拦住战斗快捷键。选中原生 Button 时 Return 交由该控件提交，避免与目标确认及650ms结束回合长按重复执行。
- 普通战和 BOSS 战均显示当前源牌库入口。符合源条件的群体/随机敌人招式可投场地空处；enemy 侧提交首名存活且生命大于0的敌人，self/null 侧分别保留原语义。状态、名牌、手牌与其他读控件区域拦住穿透投放。沿用现有手牌保留槽、逐段健康投影和帧图绑定。

## playerEffects 真实链与字段

源链为 `core/battle.snapshot-projection.domain.js` → `runtime/battle.player-effects.js` → `runtime/battle.snapshot.js` 冻结列表 → `view/battle.layers.js` 自身状态追加项。新 `BattlePlayerEffects.Project` 保留完整纯生成器，`BattleSession.ProjectPlayerEffects` 只读取当前会话字段，`GetSnapshot` 发布新只读元素与只读列表；自身名牌使用相同状态组件追加 `effect:<key>`。

| 源输入 | 当前会话映射 |
| --- | --- |
| playerCurseImmune | persistentRules 的 playerCurseImmune |
| curseImmunityTemporary | ruleJobs 的 removeRule/playerCurseImmune 到期任务 |
| spellCost1 + meleeCost1 | 当前 spellCost1 同时适用于武术与法术，对应 moveCost1 |
| nextSpellTwice | doubleNextSpell |
| allSpellsInfused | persistentRules 的 allSpellsInfused |
| discoverPlus | discoverExtra 实际计数 |
| bleedAmp | persistentRules 的 bleedAmp 注册状态 |
| deathSave | deathSaves 实际次数 |
| extraTurn | extraTurn |
| holyRune / turn | 纯生成器保留全部算法；运行投影 holyRune=false、turn=真实回合 |

当前 C# 没有 nest rune/holyRune 运行状态；原项目可选研究范围仍排除，未伪造圣洁标记。纯生成器对圣洁第1/3/4回合、0/负回合及永久/临时免疫优先级均与源逐属性比对。现有独立 spellCost1/meleeCost1 注册键和 bleedAmp 的费用/伤害消费者差距已报 Root，本片只读投影没有以显示补改规则。bleedAmp 显示的是实际已注册规则标记，不声称本片修复其伤害行为。

## 文件与稳定节点

新增组件：`CurrentBattleStatusModel`、`CurrentBattleStatusLayout`、`CurrentBattleStatuses`、`CurrentBattleNameplate`、`CurrentBattleDropProjection`；新增 Core `BattlePlayerEffects`。共享文件只改 `BattleWidgets.BtChips`、`BattlePresentation` 的输入/自身投影/UnitMount、`BattleScreen` 最小投放段、`CombatResolver` metadata 两表、`BattleSession.GetSnapshot` 一行。

保留节点名为 `sts-nameplate`、`sts-headrow`、`sts-stats`、`sts-chips`、`sts-intent`；状态子节点为 `status-chip-list`、`status-content`、`status-chip-summary`、`status-<buff|curse|effect>:<key>`。保留 `UnitMount.BindActor`、`SetActorHead`、`PresentHealth`，新共性组件全部通过 `UIKit.GetOrAdd` 接入。

## 已完成验证及边界

- 私有完整源码快照引用当前 Unity managed DLL 编译：0错误、7条既有警告。输出仅位于本片 `private-check`，未写共享编译目录。
- 实际当前 JS 输出与生产显示模型对照54断言：16种基础状态的名称/图标/数值/单位/顺序，3类意图，15组额外效果状态，固定密度与换行，以及场地目标投影。场地投放用视图边界的 Card/Rule 测试替身，不冒充 Core 全规则回归。
- 额外9断言加载本次私有编译的真实 `BattleSession`，调用真实注册入口/快照入口，验证临时转永久免疫、全部8类效果顺序、发现/致命抵挡计数、消耗后消失、旧快照不随字段变化、读快照不消费效果。
- 定向 `git diff --check` 通过。`receipt.json` 记录源/生产 SHA 与私有快照一致性。

尚未验证当前修复的原生画面与真实鼠标/键盘事件：名牌和人物比例、长中文换行、手牌遮挡、Raycast穿透、状态滚动/焦点、捕获结束同帧输入、Return与长按及目标提交互斥均待 Root 集中原生检查和其他代理复验。current-visual-6 仅作为缺陷证据，不当成修复通过证据。
