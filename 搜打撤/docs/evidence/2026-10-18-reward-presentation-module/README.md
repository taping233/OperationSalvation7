# 奖励呈现与返回动作公共边界

2026-10-18 UTC，完成未提交。按父任务授权将宝箱总览、卡下领取、放大详情、满包整理器的真实共用边界收拢，保留已有焦点与放弃状态修复。没有新建路由或状态机，没有更改领取、放弃、容量、附赠、存档及RNG规则。

## 公共接口及消费入口

`game/src/ui/reward-state.js` 为纯只读展示层：

- `rewardCardState(taken, lost, index)`：按既有taken/lost集合派生received、forfeited、pending；不产生业务写入。
- `rewardProgress(cards, taken, lost)`：派生实际已领卡、待领卡及计数。由 `chests.js` 的总览回执与选卡剩余列表共同使用，不从当前背包反推历史领取记录。
- `rewardCardStatus(state, choice)`：已领去向/已选标记/永久放弃文案，由共享领取组件使用。
- `rewardBoxSummary(...)`：总览中的已领、放弃与剩余摘要。已放弃不依赖整箱完成状态；此前修复保持。
- `REWARD_RECEIVED` 与 `REWARD_DESTINATION` 只表达本次奖励入背包，供总览、选卡完成说明与 `reward-card-feedback.js` 的成功事件适配使用。不把战斗入手、洗入牌库等不同去向统一成背包。

`game/src/ui/reward-scene-view.js` 增加：

- `rewardClaimHTML({index,state,choice,fits,disabled,zoom})`：同一宝箱卡下动作与放大详情动作共用。普通领取仍为“收下”，三选一为“选择这张”，空间不足为“腾位置领取”；动作ID仍为原有chestTake1/chestPick/chestMakeRoom。明确data-cancel=false，不更改回调守卫。zoom保留详情原生ov-btn样式，并明示“选择后，其余基础卡永久放弃；附赠仍可领取”。不会把选择与普通领取压成同一风险语义。
- `rewardReturnHTML({action,organize,className,arrow})`：仅负责返回奖励按钮与data-cancel=true。`chest-reward-overview.js` 的选卡返回及 `reward-capacity-organizer.js` 的整理返回使用；原有业务回调、当前页面/代次守卫及焦点恢复保持。

没有触及主overlay、hub帮助、battle、资产引用或架构文档。新增公共模块只使用明确业务字段，未添加通用表单/路由框架。

## 验证

多入口迁移完成后集中一轮定向测试，未逐项重复全套：12文件174项通过，完整命令/结果见 `targeted.log`。覆盖：共享状态/按钮矩阵、真实普通/选择/满包的卡下与详情一致性、已有奖励整理焦点和重复回调守卫、领取动画去向、容量回执、存档中断/重载、金币/标题及contracts/architecture-boundaries。

新增 `tests/reward-presentation-contract.test.js`；在真实控制器 `tests/chest-extra-rewards-choice.test.js` 增加4个普通/三选一×有空间/满包的详情入口测试。打开详情不授予卡牌，taken/lost保持原状；查看与实际发放边界保持。

相关8个生产/测试文件定向eslint退出0；自有生产文件node --check和diff --check通过。

## 未核验

测试使用jsdom与真实业务模块、隔离端口，不是实页游玩。当前平台内置浏览器和服务环境仍阻塞，未使用外部浏览器/headless/CDP替代。详情警告文字的真实排版与完整链的真实键鼠体验仍待实页核验。未build、提交或推送。chests.js的呈现diff交由父任务审核opaque源指纹，未自行修改该守卫。

## 资源引用独立复核

chests.js 的资源选择、预载、图像赋值及开箱资源调用均未改变，chest-opening-art.js 无差分。复核后将 runtime-asset-redundancy-review.mjs 的 retired-scenes/chests 两处消费方指纹同步为 `dbde483382c453fe9c716cc72e102a1f2ed438373bcde179e8d61b17d9ee8d18`；未放宽资源名单或绕过检查。
