# 本轮奖励／战斗只读集成审查

审查结论：发现两个可复现的回合预测偏差，均交主会话转战斗 owner；本代理未修改源码或测试。审查仅围绕本轮新增 diff 和必要近邻消费点，不扩查旧问题。第一批背包、第二批新手实现维持冻结。

## REV-B01 · P2 · 额外回合错误结算毒／灼，误报致死

- 定位：`game/src/battle/view/battle.turn-forecast.js:10`–15。预测先执行 tickPoison/tickBurn，仅敌方攻击循环受 extraTurn 控制。
- 实际规则：`game/src/battle/core/battle.enemy-phase.js:36` 在 extraTurn 时直接执行 `resolveExtraTurn`（78 行起），不会执行 resolvePlayerEndTurn 的中毒／灼烧结算。
- 触发：当前 3 生命、4 层中毒、额外回合已获得，敌方可以为空或不行动。
- 只读复现：调用 forecastEnemyTurn 得到 `{damage:4,hpAfter:0,lethal:true}`；实际结束回合应进入额外回合，当前毒不结算、生命仍 3。
- 影响：`game/src/battle/view/battle.view.js:568` 错误显示余 0 生命，590 行触发本不该出现的“回合结束可能致死”二次确认。不是实际战斗伤害错误。
- 建议：额外回合在毒／灼循环之前分流；补 poison/burn 与 timeRune 的 extraTurn 组合回归。由战斗 owner 实施。

## REV-B02 · P2 · 死亡保险只修改致死标志，生命预测仍显示零

- 定位：`game/src/battle/view/battle.turn-forecast.js:24`–25。deathSave 只用于 lethal 判定，未参与 damage/hpAfter 模拟。
- 实际规则：`game/src/battle/core/battle.engine.js:1400`–1404 在致命攻击命中时消耗一次 deathSave、添加当回合无敌并返回 0，保持该次攻击前的 G.hp。
- 触发：5 生命、无防御、deathSave=1，单个敌人攻击 8。
- 只读复现：预测 `{damage:8,hpAfter:0,lethal:false}`；实际本次伤害被挡下，生命仍 5，本回合其余直接攻击也应被无敌挡下。
- 影响：固定信息行显示“预计承伤 8 · 余 0 生命”，却不显示可能致死，给出矛盾信息；多次攻击场景也会继续累计保险后本应免疫的伤害。
- 建议：在副本内按单次攻击模拟保险触发及本回合无敌，保留中毒／灼烧不走 playerTakeHit 保险的现行边界。由战斗 owner 实施。

## 其他限定检查

- **真实状态污染**：forecast 创建 player/status/defense 及 allies 的副本。用毒／额外回合样本调用前后比较原 snapshot JSON，结果一致；Combat.tickPoison/tickBurn/dealDamage 路径未调用全局伤害或祝福触发钩。该样本未发现真实状态污染，不代表所有未来状态字段均已覆盖。
- **固定奖励刷新／重复领取／离开回调**：本轮 openFixedRewardsOnCell 复用 Chests.restore；serializeChestReward 对 current 展开复制，来源、标题、卡牌 rules 与 taken/lost 均可保留。只读 Node 往返验证输出 `固定事件 / 领取奖励 / taken:[0] / heal`。领取处理在授卡成功后写 taken，render 守卫绑定当前 cur 和 surface；离开写 lost 并 persist。事件选项在 choice.run 之前 consumeCurrentCell，未见固定奖励重新进节点重新发放的新增路径。该检查未构造真实刷新或存储失败。
- **stable 手牌／数字键**：数字键按当前 DOM 的 data-hand-index 获取 UID，常驻槽在每次渲染更新代表 UID。只读验证同卡 `[a] → [a,b] → [b]`，displaySlot 始终为 0，UID 随剩余实例更新。未发现这条复制／合并／消耗代表实例路径会错打；复杂费用拆组、九槽跨页与注能拆组未跑实页。
- **结构化装备动作／免费释放／忙锁**：新增结构化技能进入 queueBattleAction/runStagedSteps，once 标记在队列内、附同实例仍在装备列表的检查。发现任务后交既有 processDiscoverQueue，act=play 的选择通过 queueCardExecution(...,true) 进入免费执行；runner finally 在队列闲置时收忙锁。限定静态追踪内未发现新增重复结算／显式忙锁遗留。不把静态追踪当作完整多段异步运行验证。

## 实际执行与边界

- 执行工作树目标 diff、定向源码片段读取，以及两次无写入 Node ESM 调用；命令退出码 0。
- 只读 Node 第一组输出：

```text
EXTRA_TURN {"damage":4,"hpAfter":0,"lethal":true} UNCHANGED true
DEATH_SAVE {"damage":8,"hpAfter":0,"lethal":false}
```

- 第二组验证奖励元数据往返与稳定槽 UID 更新，输出符合上述描述。
- 未运行测试、未操作浏览器、未开服务、未 build、未改源码或测试、未提交。
- 两个风险已通知主会话；本报告记录审阅时工作树，owner 后续修复需另附回归证据，不能自动视为本报告已复验。
