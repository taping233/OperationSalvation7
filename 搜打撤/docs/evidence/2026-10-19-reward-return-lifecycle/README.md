# 奖励返回地图的页面归属

已复现总览和卡牌页的返回地图等待期间换页，迟到成功仍关闭新页面。新增两项在修复前失败，原有及正常重绘/失败重试共 17 项通过。

仅检查旧 DOM 会误伤正常战后结算，因为其成功分支原本会恢复奖励页。因此由宝箱返回动作持有页面归属，传给战后结算；合法恢复更新同一归属，完成后再由返回动作关闭。换页后，事务仍按原命令完成，成功不抢改页面状态或恢复旧页，失败不弹出旧重试页。该归属只在本次等待期间有效，重试页沿用原 attempt。新进入及读档恢复的 beforeMapReturn 都接入此边界。

## 验证

- chest-callback-lifecycle-audit、battle-settlement-retry、reward-save-interruptions、four-player-chest-reload、architecture-boundaries：5 文件 77 项通过。覆盖两种奖励页替换、重复返回、正常归属重绘、迟到事务成功/失败、失败后复用 attempt；包含真实保存/读档邻域回归。
- reward-coins-overview、node-retrigger：2 文件 20 项通过。
- 两生产文件及两测试 ESLint、两生产文件语法、8 配置类型检查通过。
- 逐 diff 审查：未改奖励授予、createAttempt/commitAttempt 参数和顺序或资源选择。仅更新 chests.js 在资源审查表中的两处 SHA；保留保存退出批的 pages SHA，生产排除 195 项、零警告。
- 首次新增结算测试放在真实 session 测试之后时受该测试 doUnmock 影响而失败；已放回同一模拟 fixture 区域后集中重验。
- 未构建、提交或推送。当前平台内置浏览器实页未验，无 CSS 修改。恢复快照没有 .git，不宣称全量 CI 或实机结果。

日志与修改前副本位于恢复区 reward-return-lifecycle；仅此说明随源码发布。
