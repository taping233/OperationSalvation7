# 回合交互续接生产独审

2026-11-01。只读审查 `BattleDrawnCasts.cs`、`BattleTurnContinuation.cs`，并沿 `BattleSession.cs`、`StructuredRules.cs`、`BattleHandPayment.cs`、`BattleTargetSelections.cs` 及当前 Battle UI 消费者核对。未编译、运行领域检查、启动 Unity 或修改生产/检查源。

## 确证项与闭合

初审发现多段攻击的续接没有重检当前敌人死亡：保存的 current/plan/nextHit 恢复后，命中循环只检查玩家 HP 与 CanAct。`CombatResolver.CanAct` 仅检查冰冻，不能阻止死敌攻击。实卡条件是逆鳞受伤响应抽到星辰生成的神灯，玩家选择消灭受伤敌人或发现伤害卡，杀死当前多段敌人，而场上仍有其他存活敌人。Vite `battle.enemy-phase.domain.js` 在反馈/交互之后、每段攻击前明确检查 `foe.dead`。

已同步 Root 与 Battle 作者；作者随后将循环条件补为 `!current.dead && current.hp > 0 && CombatResolver.CanAct(current)`，当前 `BattleTurnContinuation.cs:53` 静态闭合。原 plan、下一 hit、后续敌人位置仍保留，未重新掷随机数。本审查不把静态闭合写作已执行回归。

## 当前静态结论

- 只有 RuleChoice、手牌选择、发现或 rulePick 真实待输入才挂起；普通同步效果完成后继续推进，没有逐帧等待或额外队列驱动。
- 受伤响应先用 drawnCastHold 覆盖同批装备循环；敌方单次命中还覆盖狂乱等命中后附加结算。抽到的自动施放实体按到达顺序入队，等待期间移出手牌，避免成为其他材料；随后复用实际出牌/支付执行器。符合当前 Vite 装备抽签先完成、正式施放队列后执行的顺序。
- DeferRuleBatch 在当前子链之前插入续接，ResumeRules 从末尾取出并删除后调用；drawnCastResumeQueued 阻止同一自动队列重复登记。选择产生的子链及本卡完成段先执行，再恢复原命中/回合。取消 rulePick 同样调用 ResumeRules。
- turnEndPending 在临时 player/busy=false 的待选期间持续保留；正式出牌、结束回合、主动装备、道具、职业技能及 Surrender 均拒绝独立操作，当前选择接口保留可用。UI 按该字段锁定普通控件并显示等待选择。
- Finish 与新战斗初始化清除回合 owner、自动施放队列及续接；DeferRuleBatch 同时检查 over 与 battle token。完成回合只在 OwnsTurn 成立时清 owner，旧战斗不能恢复新战斗阶段。

## 覆盖边界

以上针对本片现行内建卡及正式可达的星辰—逆鳞—神灯/发现/二段目标链。没有把退役接口或任意自定义旧文本触发组合扩成当前完成承诺。Retract 没有脚本生产调用，本片不以其未添加回合锁制造缺口。最终行为、RNG 顺序、终局次数、旧事件失效和实际选择控件仍由作者冻结后的领域/原生检查集中验证。

审查终点原字节 SHA256：

| 文件 | SHA256 |
| --- | --- |
| BattleDrawnCasts.cs | 873e0e97b3fc6be5ae69330e922d0e410a0bad1aacf52cd23dab72baa809bd1f |
| BattleTurnContinuation.cs（已含死亡重检） | c3b591f15184d7bf0096c92780dee613bf762a407f909efe17973b4fa0a5a178 |
| BattleSession.cs | 8870664d5cb1ba2b670c24109106163c8a9e2c31aa00840ea27e3c664c262d6b |
| StructuredRules.cs | 3688971cd57b1153de0c71bfcbde987784c317d311bd691c99891ddbb4f9dc8f |
