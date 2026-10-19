# 装饰切幕失败候选核验

结论：当前基线未复现“装饰图片失败令成就切幕永久等待”。未修改生产实现，仅新增真实模块回归测试。没有先红后绿修复记录，因为当前实现一开始即通过故障注入，不能把已存在的降级行为冒称本次修复。

## 当前源码证据

- HEAD：801317c207（云端恢复媒体基线）；`game/src/ui/camp-entry.js` 本轮 diff 为空。
- `prepareCityCut` 在图片加载 error / decode reject / 3000ms timeout 返回 false 后，隐藏图片、设置 `data-scenery=fallback`，随后返回 true。信号已取消或没有图片节点才返回 false。
- `playPreparedCut` 因此在装饰图片失败而目的页视觉等待完成后正常取消 `page-cut-waiting`，计时 980ms 后清理。调用清理、目的页替换、关闭或隐藏触发中止；晚到图片事件及 decode 完成不再影响新页。
- 当前创建器总会创建图片节点。“缺少图片节点”不是此候选的资源加载失败路径，本轮未扩大实现接口。

## 实际验证

命令：`npx vitest run tests/camp-entry-readiness.test.js tests/page-loading.test.js tests/archive-motion.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=verbose`

结果：5 个测试文件、65 例全部通过，完整输出见 `vitest-output.txt`。新文件 9 例使用真实 `mapImageReady`、`prepareCityCut`、`waitPageVisual`；仅模拟图片尺寸/事件/decode 和时钟，不 mock readiness 函数。覆盖成功、error、3000ms 超时、decode 拒绝、显式取消、换页、关闭、隐藏以及旧 decode 晚回调不干扰新切幕；检查结束回调只执行一次及无残余计时器。

既有 page-loading 测试同时验证业务 mount 失败继续向调用者抛出原错误、释放输入保护，以及取消期间 Escape/Alt 导航保留。没有修改业务失败/重试机制、输入保护或降级策略。

`npx eslint tests/camp-entry-readiness.test.js` 退出码 0。

验证边界：仅 jsdom 模块测试；未做游戏实页、视觉截图或构建。父任务已确认内置浏览器连接 Vite 受阻，本轮没有尝试外部浏览器、headless 或绕过执行限制。日志中的运行器时间来自环境时钟，不用来证明实页发生时间。

## 输入指纹（SHA256）

- camp-entry.js：fa226982c29fdc2043a0dc0706d36ebac17ebf8dbc40d57539f8cd81c1d577a9
- map-image-ready.js：77f5a75f98b42c2c567ba9411c1ea29d0583f7db3edd4908e9a4e3d283dce3fb
- page-visual-ready.js：c9b456e40f66479c8186ddce9738f5f851d04171105a22c769f285573ad174ac
- camp-entry-readiness.test.js：798deb6184d3ace72bb3ecd46679b6f8d0ffa7b0a70c2ded9498ecc0c7465b7f

未引入第三方源码，未提交或推送。共享台账由父任务协调；本次只拥有新增测试及此证据目录。
