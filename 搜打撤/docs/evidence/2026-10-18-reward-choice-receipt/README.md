# 奖励总览：已放弃候选与待领附赠分开反馈

2026-10-18 UTC。完成未提交，仅改总览呈现与定向回归；没有更改选牌、领取、附赠、存档或容量规则。

## 真实断点与修复

中宝箱三选一同时附赠宠物蛋时，选择基础卡后，其余两张立即写入 `lost`，宠物蛋仍待领。此时返回奖励总览，原来显示“已领取 1 张 · 其余 2 张未领取 · 剩余 1 张待处理”，却在选卡页显示两张“已永久放弃”。“未领取”错误暗示还能回头领取；两张实际已不可恢复。

- `game/src/run/chests.js` 的 `claimRewardAt` 在选择成功时立即把其他基础候选记入 `lost`，只将基础候选范围以外的附赠保留为待领。
- `overviewHTML` 向总览传入真实 `lostCount`；附赠未处理时整箱 `completed=false`。
- `game/src/ui/chest-reward-overview.js` 的 `boxResultRule` 原先用整箱是否结束选择“已放弃/未领取”。现在 `lostCount` 始终陈述“已放弃”，整箱是否结束只决定待处理数。

改动仅一行展示逻辑。借鉴参考审查中的原则：结果反馈以真实结算事实为准，未完成的后续动作不能改写已经发生的结果。没有移植第三方代码。

## 定向证据

新增 `tests/chest-extra-rewards-choice.test.js` 中4项真实模块测试：

1. 未选基础卡：总览仍显示“3 张中选 1 张”，taken/lost均为空。
2. 已选择、附赠未领：总览显示“其余 2 张已放弃 / 剩余 1 张待处理”；重开选卡页仍为“已永久放弃”，旧/当前领取回调都不能再领取lost项。
3. 同上经过真实奖励JSON序列化/恢复，状态与文案保持一致。
4. 附赠全部领取：总览“已领取 2 张 · 其余 2 张已放弃”，继续探索只触发一次续流。

修前 `red.log`：29项中2失败、27通过；两项都直接断言到实际错误文案。

修后 `green.log`：5文件85项通过，范围为 chest-extra-rewards-choice、reward-receipt-clarity、reward-save-interruptions、architecture-boundaries、contracts。定向 `npx eslint game/src/ui/chest-reward-overview.js tests/chest-extra-rewards-choice.test.js` 退出0。

日志中的运行时钟03:00为测试进程环境显示，执行日期/审计时间按父任务UTC记录。stderr中的存档失败为既有中断测试故意注入；相关用例通过。

## 未核验与边界

测试使用jsdom、真实奖励控制器/总览/容量模块，隔离UI、随机池及库存写入端口。它们不是浏览器实际游玩；没有使用headless、CDP或外部浏览器。当前平台内置浏览器与服务连通环境仍阻塞，待补：实际中宝箱带附赠→选基础卡→返回总览→重开查看→领附赠→继续探索的可见完整链。无build、提交、推送或服务启动。
