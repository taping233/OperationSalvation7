# 图片恢复连续性

2026-10-26，`WF-flow-goals-round2-1026`。本批源码与行为回归已修改；子任务未单独执行检查。主会话既有检查结果及老板统一验收安排见 [总记录](README.md)。

## 当前事实与修复

列表手动恢复原本最多同时处理四张。活动图移除、换 `src` 或 `data-lib-src` 时，列表观察器先删除该图记录，再取消单图恢复；单图的 cancelled 回调因记录身份已失效而返回。列表路径随后只更新提示，因此四个活动槽同时释放时，余下队列可能等待没有机会再触发的完成回调。

现将后续调度放在活动槽释放处，并合并同轮微任务。移除、换源、失败、自然完成共同释放槽位，销毁后调度停止。仍由明确的手动重试把失败图片入队，上限仍为四；首屏预热、自动尝试次数和消费者均保持原实现。

补齐单图重试焦点：禁用重试按钮导致焦点落回 body 时，成功恢复后交回可用操作；用户已操作其他控件则保留其选择。列表和单图均跳过隐藏、inert、aria-hidden 或 disabled 的候选，并使用图片所属 document。关键图恢复登记同时比较 `src` 与 `srcset` 属性快照，节点属性改变后立即建立新身份并取消旧请求。

现有 clearable decode 任务已阻止取消后的迟到结果；本批保留该机制并补页面销毁、旧回调和部分排队状态的覆盖。

## 修改范围

- `game/src/ui/list-image-recovery.js`
- `game/src/ui/visual-resource-recovery.js`
- `tests/list-image-recovery.test.js`
- `tests/visual-resource-recovery.test.js`（新增）

## 待主代理统一验证

建议合入同一次定向运行的测试文件：

- `tests/list-image-recovery.test.js`
- `tests/visual-resource-recovery.test.js`
- `tests/photo-art-warm-audit.test.js`
- `tests/character-portrait-loading.test.js`

新增行为回归覆盖：四个活动项同时移除/换源后继续排队；替换后的失败图片等待下一次明确重试；失败释放槽位；销毁后旧回调不启动剩余队列；禁用或隐藏卡牌后的焦点回退；单图重试失焦及用户另行操作；同节点 `srcset` 改变后的身份隔离。

当前窗口复验可用正式 `createListImageRecovery` 挂载八张故障图片，点击恢复后让前四张保持请求中，再移除它们或更换图片来源，观察后四张开始恢复。另复核失败后按钮重新可用、成功后焦点回到可用卡牌，以及离页后旧图完成不修改新页。该构造检查与自然浏览页面的操作结果分别记录。

修改完成，待老板统一验收；本批未安装、提交或删除文件。
