# 奖励页容量提示随背包整理刷新

已修复奖励页返回后底部仍显示旧容量失败的问题。黑市固定奖励与普通宝箱共用的 `render()` 现在只读派生当前显示文字，不改已领取记录或保存内容。

## 行为

- 精确识别现有批量容量失败串；保留原有“已入背包 N 张”事实，按当前剩余容量更新失败数量，全部可收时去掉容量失败后缀
- 精确识别单卡容量失败串；仅当对应待领卡现在确实可收时清除，不因另一张卡可收而清错
- 非容量错误、普通领取成功提示原样保留；旧 JSON 存档中的容量串也在显示时校准
- 当前批量预检与逐卡真实 `canReceiveCard` 拒收数取较大值，避免旧同名堆预检缺陷导致本修错误清空真实失败
- 校准只读背包；`canReceiveCard` 当前实现只统计普通背包同名卡、检查叠放上限及基础/资源专用容量，无发卡、写档或随机调用

## 变更边界

源码仅 `game/src/run/chests.js` 两处消息显示改动：新增 9 行派生显示逻辑，footer 改用派生文字。完整本轮增量见 `notice-only.patch`，基线已包含其他任务的附赠卡修复，没有覆盖该既有改动。

新增专测：`tests/chests-reward-capacity-notice.test.js`。未编辑其他源码、资产 SHA 守卫、概率或共享记录，未启动浏览器、服务、全量测试、构建、提交或推送。

## 验证

- 修前初版专测：12 项中 6 失败、6 通过；失败覆盖普通箱/黑市整理返回、部分腾格、两种单卡失败及旧存档重载。原始输出：`test-before.log`
- 修后当前专测及相邻测试、契约/架构哨兵：8 文件、90 项全部通过。原始输出：`test-after.log`
- 精确 ESLint、两个变更 JS 的 `node --check`、`git diff --check` 通过；ESLint 输出：`lint.log`（空文件表示无报告）
- 使用真实 `Chests`、`openFixedRewardsOnCell`、`grantEventCard`、背包叠放/容量函数和 `RunStorage`。背包展示为隔离端口；删除木材构造丢弃后的状态，未覆盖真实背包丢弃点击或浏览器视觉
- 断言 18/18 领 2 张后腾出木材格回 17/18：底栏、待领按钮、顶部警告和底部 notice 一致；整理返回不发卡、不增加保存调用、不改奖励快照、不消耗 RNG；重载后原奖励不重复发放

执行命令：

```sh
./node_modules/.bin/vitest run tests/chests-reward-capacity-notice.test.js tests/chest-acquired-gift-cloud.test.js tests/chest-callback-lifecycle-audit.test.js tests/four-player-chest-reload.test.js tests/chest-click-flow.test.js tests/chest-multi-queue-regression.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=verbose
./node_modules/.bin/eslint game/src/run/chests.js tests/chests-reward-capacity-notice.test.js
node --check game/src/run/chests.js
node --check tests/chests-reward-capacity-notice.test.js
git diff --check -- game/src/run/chests.js
```

## 另已证实的既有问题

当前顶部批量容量预检把“已有同名卡”一律视为可叠，不检查普通 3 张/初始攻击及火球 5 张叠放上限。专测以真实背包、真实发卡构造：17/18 且已有 3 张致命穿刺，批量收另 1 张装备后达到 18/18；剩余致命穿刺实际拒收且按钮为整理背包，但顶部 warning 缺失。本轮只防止该问题使 notice 被误清，未修改预估算法。统一顺序预估方案另报父任务协调。

## 未核项

按本任务边界未做修后内置浏览器实页验收；父任务需复核普通箱及黑市同一页面整理返回。资产 opaque consumer 指纹由父任务审阅本轮小 delta 后更新，本任务未自行修改守卫。

文件 SHA256 与交付状态见 `handoff.json`。
