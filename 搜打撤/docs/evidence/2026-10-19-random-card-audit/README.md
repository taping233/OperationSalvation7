# 沉船宝盒随机获取审计稳定性

结论：测试假设错误。`runtime.granted` 包含基础获取与阿猫的派生获取；沉船宝盒基础2张中有1张阿猫时，正确总数为3张且能量+1。无需修改玩法。

## 复现

基线为 `sync-9b0fe799/fresh-9b0fe799/搜打撤`，独立副本 `work-random-audit-9b0fe79`。基线与冻结集成树的目标测试相同。外部归档中的 `reproduction.patch` 仅用于在基线上重现：到期/重复到期固定普通冰刺，正常消耗正对照首张固定阿猫，其余为冰刺；真实生产管线执行，旧精确断言稳定 expected 2 / received 3。见外部归档 `reproduction.log`（退出1，1失败/74按筛选跳过），此复现补丁不用于修复交付。

## 修复

只改测试。基础计数正对照固定真实可随机获取且无 onAcquire 的冰刺单候选池，保留所有精确数值与重复到期幂等断言。新增到期和正常消耗两种组合：首张阿猫后固定冰刺，精确断言获取顺序 `[tt2-apollo, tt3-ice-spike, tt3-ice-spike]`、全部进入手牌、能量+1；重复到期不再增加卡或能量。每例恢复 mock。

## 验证

- `node node_modules/vitest/vitest.mjs run tests/card-description-audit-battle.test.js tests/battle-turn-start-discover.test.js`：2文件87项通过，0失败/跳过（77+10）；见外部归档 `targeted.log`。
- `node node_modules/eslint/bin/eslint.js tests/card-description-audit-battle.test.js`：退出0。
- `node --check tests/card-description-audit-battle.test.js`：退出0。
- 未跑全量门、build或浏览器；无生产行为变化。
- 未改 engine/lifecycle/equipment 或冻结集成树，未提交/推送。

## 复现与日志位置

历史文件保留在交付目录 `integration-delivery/fourth-batch/random-card-audit-history/`，不纳入源码。仅在独立基线副本应用其中 reproduction.patch 后，运行 `node node_modules/vitest/vitest.mjs run tests/card-description-audit-battle.test.js -t "tt2-wreck：临时卡到期消耗"` 可复现旧断言失败；不得对修复版应用该复现补丁。修复后的命令见上方两文件定向验证；本轮集成日志位于 `integration-delivery/fourth-batch/targeted-tests.log`。
