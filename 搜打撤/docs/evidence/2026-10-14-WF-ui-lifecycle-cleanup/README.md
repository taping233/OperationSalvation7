# 页面生命周期定向修复

本批修复四项已复现的生命周期缺陷。仅修改 `ui/cinematics.js`、`ui/term-tips.js`、`ui/comm-feed.js`，没有修改存档、战斗规则、基地入口、音频或素材。

## 缺陷与修复

1. **旧屏幕退场回调破坏新的退场锁**：240ms 退场尚未完成时重开并再次关闭屏幕，旧回调先清空 `pointerEvents` 和 `_scrHiding`，再检查代次，导致新退场期间可重新交互和重复关闭。重开会取消旧计时器；迟到回调在任何状态修改前检查代次。覆盖重开、再关闭、人工迟到回调和减少动态效果同步路径。
2. **词条释放监听累积及旧指针误收起新提示**：每次按压挂两个独立的 once 监听，正常 pointerup 不会移除 pointercancel，反之亦然。修前20轮产生40次释放监听注册；导航之后的旧释放事件还能收起新悬停提示。释放监听改为全局安装一次，按 pointerId 识别当前按压；导航、滚动和失焦清除归属。覆盖普通释放、取消、多指输入、导航、失焦及词条来源 DOM 移除后的释放；长按显示方式不变。
3. **旧局奖励队列穿透新局或其他档位**：队列原来只记录 `runActive` 布尔值；新开局或读档后仍为 true，因此旧局剩余卡牌在新界面显示并抢占点击。现按 `runActive`、`Base.slot` 和既有 `game.discoveredPairs` 内存身份校验。`newRun/loadGame` 会重建该 Set；同局添加元素保留同一身份。丢弃失效条目时保留当前局后来追加的奖励，不增加持久化字段。覆盖同种子重读、切档、返回原档、同局顺序、Set 原地修改和不提供 slot/token 的兼容调用。
4. **无线电演示关闭后保留资源**：仅在 `?commDemo=1` 开发演示中，关闭面板没有解绑 document 模式监听，没有断开 MutationObserver，也没有取消900ms打字计时器。关闭改为幂等的对称清理；宿主直接移除面板后，下一次原有1800ms节拍也会清理。覆盖重复挂载、重复关闭/重挂、关闭后旧事件和观察器回调、正常六条消息、战斗隐藏/恢复、进度和滚动。

## 验证

- 相同最终新增测试在原始源码的独立只读依赖副本上：3文件，14失败、4通过，见 [修前日志](final-before-tests.log)
- 修后新增测试与照片特写、卡牌浏览器、旧宿主拆除守卫：6文件43项通过，见 [修后日志](after-tests.log)
- 自有3源码和3测试 ESLint、`jsconfig.strict-ui.json` TypeScript、3源码 `node --check` 均通过，见 [lint](lint.log)、[类型检查](typecheck.log)、[语法](syntax.log)
- 架构哨兵在并行编辑中初跑39通过、3失败，涉及当时 `run/game.run.class-choice.js` 缺失或新增 `.page.js` 快照尚未登记，见 [当时日志](sentinel-tests.log)。并行现场稳定后重跑 `contracts`、`architecture-boundaries`、`facade-snapshot-drift`：3文件42项通过，见 [重跑日志](sentinel-tests-recheck.log)；本批没有调整其代码或放宽检查
- `handoff` 正确按路径调用后因导出快照无 `.git` 失败，见 [handoff](handoff.log)

## 交付边界

仅做定向测试和静态检查，没有全量测试、build、提交、推送、发布或源图删除。上述 DOM 和指针测试使用 jsdom 合成事件，不能替代真实浏览器输入和视觉验收。源码已冻结，待父会话组织当前平台内置浏览器验证快速退场/重开、词条按压与页面切换、奖励队列换局及开发演示关闭。

原始源码、完整 diff、输入与输出 SHA256 位于本轮云端交付元数据目录 `cloud-review-next.meta/ui-lifecycle/`；本页及日志随项目交付。
