# FB040：灵符自动装配后的消耗

## 已实现行为

灵符（`tt7-talisman`）编入 BOSS 套牌后，开战自动装配并立即消耗。本牌从手牌、牌库和弃牌堆移除，本场记入墓地，战后沿既有消耗 UID 结算进入消耗区。同一 UID 的开战入口重复调用不会重复发动灵符效果或追加消耗记录。装备展示记录保留。

未编入的灵符不受影响；其他开战装备不因此消耗。普通战仍沿原有规则不发动开战装备。旧卡缺少 UID 时不新增消耗记录，以免按空 UID 误删其他卡；本次不扩展旧档迁移规则。

现行共享 `docs/rules.md` 由其他工作项编辑，本文行为条目待统一集成同步，不覆盖共享修改。

## 范围

生产仅修改 `game/src/battle/bag/battle.equipment.js`。`battle.lifecycle.js` 既有 consumed 快照传递和 `game.bag.settle.js` 既有 UID 去重逻辑已通过真实链路测试，不修改。新增 `tests/battle-talisman-settlement.test.js`，扩展 `tests/boss-equip-select.test.js`。

## 验证

- 新基线：远端 cd98745f，独立云端基线 fd9691aa。
- Node v22.23.3，修前 `red.log`：7项中2失败、5通过，分别复现未登记消耗、重复触发。
- 最终 `regression.log`：6文件58项通过；含编组、普通战保留、未选中保留、重复调用、可用牌区移除、无 UID 安全边界、实际战后消耗区及跨 played/consumed 去重、装备主动技能、生成卡结算、contracts 与 architecture-boundaries。
- `lint.log`：3个自有 JS 文件通过；自有 diff whitespace 检查通过。
- `settle.log` 为早期测试夹具缺少奖励 restore 的记录，虽然断言通过但有结算告警；已补齐夹具，最终回归无该错误，不将早期日志当完成证据。
- 未进行全量、构建或实页。真实内置浏览器待媒体补齐后验证 BOSS 编组灵符、开场额外抽牌与消耗显示、战后消耗区；单测不等同实机通过。
- 未提交、未推送、未操作本地电脑，无本任务后台服务。
