# 公共闸门转场的回调生命周期

公共 `gateSweep()` 的动画结束与 700ms 兜底现在共用一次性收尾：任何一路完成都会取消计时、移除 animationend 监听，重复或已排队的旧收尾不会影响下一轮。保持原动画、700ms 兜底、busy 防重入与减少动态效果逻辑不变。

## 可复现问题与验收

在真实生产模块导出函数上，以 jsdom 原生 DOM 事件和 Vitest 虚拟时钟构造重复流程：

- 连续 100 次启动转场，只推进 700ms，不派发 animationend：修改前残留 100 个监听，之后单次 animationend 执行 100 次摘类；修改后残留 0 个、额外摘类 0 次。
- 第一轮 550ms 派发动画结束、立即启动第二轮，再推进 150ms：修改前第一轮的 700ms 兜底提前结束第二轮；修改后第二轮仍在进行，直至自己的结束事件或兜底。
- 抓取第一轮收尾，在其结束后启动第二轮再调用旧收尾：修改前影响第二轮，修改后无效。
- 混合 40 次正常结束/兜底结束，每轮重复启动：运行中仅 1 监听及 1 计时，结束后均 0。

上述是构造事件的生命周期成本验证，不是浏览器帧率、堆快照或真实手动导航结论。生产触发点仍为剧情过场继续/结束、整备页关闭。没有改业务路由、战斗状态、奖励、存档、样式。

## 本轮结果

- `before.log`：相同新增 4 测在原始源码上全部失败，记录 100 个残留监听、100 次无效摘类，以及旧回调/计时干扰下一轮。
- `after.log`：新增 4 测 + 既有 comm-demo-lazy-entry 5 测，9/9 通过。
- `lint.log`：两项修改的 ESLint 通过（无诊断，日志记命令成功）；生产模块 `node --check` 通过。
- 隔离副本仅复制目标源文件、被 mock 的模块及相关测试，复用已有依赖；未复制全库、未改主树、未同步本地、未提交发布。
- 未运行全量/构建。内置浏览器实页尚待集中验收，重点检查整备关闭/剧情继续转场仍正常且快速连续进入下一轮不被过早结束；不能将本日志写为实页通过。
- 日志工具输出时间采用执行机 UTC+9；本轮实际 UTC 2026-10-20 07:36–07:38。

## 输入指纹与合并

目标相对项目根为 `game/src/ui/transitions-director.js`。

- 基线 SHA256：`32274d74704b15cacb146a0ed28e201ad4a932417bcc842601af68ba7e2b416b`
- 修后 SHA256：`1ca62bc1a89c6f29222959dd05acccad49d8744467a80550de25fbc2a19e733c`
- 新测 SHA256：`86b4ada682589acb6bf77d16cacaf283f9eefe309892db0c8d230d2a7dd8321f`

增量补丁仅包含上述源文件、新测试与本说明。原始日志保留外部，不入库；不包含隔离副本配置、依赖链接、源码备份或无关模块。

## 原始日志定位

以下均为本轮原始日志，SHA256 用于回读核对。


- `/workspace/scratch/b7a53a06c872/work-gate-lifetime-20261020/docs/evidence/2026-10-20-transition-gate-lifetime/before.log`
  - SHA256：`8a955fd3234add95b06c948db7dcd533ba5c56758252152b281afff3c61aae3a`

- `/workspace/scratch/b7a53a06c872/work-gate-lifetime-20261020/docs/evidence/2026-10-20-transition-gate-lifetime/after.log`
  - SHA256：`e1c20e8dadfe5a871bf5197604461cd184eb4625ddd0da7aadec90591b9f9875`

- `/workspace/scratch/b7a53a06c872/work-gate-lifetime-20261020/docs/evidence/2026-10-20-transition-gate-lifetime/lint.log`
  - SHA256：`5d6d52a1fac8c53748db4c9d5119a4009766d9c00b20625534b6756ea0e4a634`
