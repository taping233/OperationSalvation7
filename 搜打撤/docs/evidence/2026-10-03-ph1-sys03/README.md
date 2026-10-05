# 2026-10-03 PH1 第四批（SYS-03 物资事务）（WF-ph1-sys03）

工作流 dwfrun-98df00c7（GLM-5.3-Flash）。验证门：**四门全绿**。**结论：无缺陷，仅验证**——按计划「未发现缺陷的分支仅验证」执行，零源码修改，交付=五拍现状表+24 个钉现状测试（tests/sys03-loot-shop-txn / sys03-altar-restore-txn / sys03-base-key-restore）。

## 五拍现状表（校验→确认→提交→回执→画面，逐行读码核实）

1. **搜刮页**：chestTake1/chestPick 消费 grantCard 返回值，失败不标已领、卡可重选（09-19 P2-8 修复在位）；chestSkip 币照收卡散落（无主物口径）。
2. **商店**：买入三重前置（sold/empty/canReceiveCard）全过才扣币，拒绝分支零副作用；卖出 uid+isSellable+!stored 三重校验；取消=关页无挂起扣费。
3. **祭坛**：献祭确认才上锁、取消不上锁卡不丢；紧急撤离 canPay disabled+双检；奖励二选一「领取即消耗/离开保留」幂等。
4. **事件复原**：修鞋铺 evtSettled 防连点（09-13 三连发已修）；共用 openPocketRestore 满包拒绝卡留口袋。
5. **钥匙复原**：渲染预检 afford disabled→Base.restore mutate 事务（草稿完成+保存成功才替换运行态）→回执按返回值分四笔。
6. **火堆**（10-02 批次「发现两张自动复原」，只验证未动）：满包先检后扣+deny 播报。

## 定性「口径如此」不修三项（老板知悉）

- takeAll 满包强收散落：warnLine 预检明示「放不下的 N 张将散落」+deny 播报，结果可预期；
- altarRewardLoot 满包时奖励卡散失且领取标记照常消耗：有 deny 音+「掉在了原地」播报；若要改（满包预检/先退款）属设计决策，待老板拍板；
- 火堆 _fireRestKey 守卫因每次置 null 实际失效：防重入现由 consumeCurrentCell 保证，现状安全，系 10-02 批次遗留观察项。

## 属地外观察（只报告未动）

复原药水双入口满包时药水被消耗、0 张复原，成功回执与满包 warn 并存观感矛盾（同文件 tt-crystal 分支回执诚实「复原了 0 张」）；battle 侧 useItem 另一套口径未审（禁碰）。→ 建议归 backlog。

## 测试

新增 3 文件 24 例钉现状；既有 chest/shop/altar/extraction/run-architecture/hub/base 域定向 20 文件 108 例全绿。
