# 战斗规则与手牌草稿独立只读审查

范围：当前动态费用、RuleHandSelection草稿/确认/取消、过期回调与注能材料；只读，没有运行测试或写生产。音效/atlas在途修改未纳入。

## 确定发现（P2，待主会话协调修复）

**取消装备主动选牌会消耗本场唯一技能次数。**

- 当前可达条件：装配深红丝袋或自然法杖，发动主动技能进入本轮新增的手牌草稿，点击取消，再尝试发动。
- Unity `StructuredRules.UseEquipment` 在调用RunRuleOps前立即把装备UID加入equipmentUsed；`CancelRuleHandSelection`只清选择、继续后续规则，不恢复次数。因此取消后 `EquipmentState.canUse` 为false。
- Vite `battle/bag/battle.equipment.domain.js`约213行明确区分handSelectionOnly，once标记在onHandSelectDone中完成；未完成的选牌取消不消耗技能。
- 这是本轮增加可取消选牌后出现的实际可达回归。建议将handSelect-only装备的once标记延后至完成选择，既保留取消重试，也保证成功后不能再用；不要为任意其他装备增加回退。
- 待集中断言：两个当前内置装备分别覆盖取消后可重开、选择成功后不可再用、旧取消回调不能清掉新选择。

已向root和battle作者报告。Assets冻结后没有实施修复。

## 本次未发现确定回归的部分

- 动态费用StructuredCost的结构规则优先级与当前源card-cost.js逐项相符；runtimeCost作为基数继续经过规则计算，消耗区法术计数读取当前去重pile。
- 草稿提交前检查battleToken、selectionId、剩余数量、候选UID、当前手牌与卡面JSON指纹；支付一次提交完整材料，普通选牌按确认草稿逐张提交，play一次只取一张给子交互继续。
- 注能确认与待目标返回时重新检查手牌存在性、fuelAllowed及能量，选材只准备草稿，消耗仍在ExecPlay；不朽斩当前结构字段fuelAllowed:false可被拒绝。

这些是源码路径判断，不替代本轮待运行的定向断言或原生UI验证。没有宣称所有schema组合已覆盖。
