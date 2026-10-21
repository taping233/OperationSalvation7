# 页面视觉就绪去重结果

基线：e817a3aa2ad945c904b87bdaa99bb697a7f30d0c。统一补丁：readiness-sharing-e817a3aa.patch。
补丁 SHA256：1102afc052a50d749f92c0560e58bcc0e9ed266b23e2989c59dbcea55fe21970。

## 已验证结果

相同的 jsdom 场景在准确旧源码与新源码上对比；三个计数分别是 img 查询、代表图片布局测量、decode 调用：

| 场景 | 旧版三个计数 | 新版三个计数 |
| --- | --- | --- |
| 设置热开：通用视觉门＋设置切幕 | 2 / 2 / 2 | 1 / 1 / 1 |
| 设置冷开：上述两者＋loading | 3 / 3 / 3 | 1 / 1 / 1 |
| 基地首次进入：基地切幕＋loading | 2 / 2 / 2 | 1 / 1 / 1 |

这些是确定的调用次数，不是帧率或实际设备耗时的提升百分比。

## 实现边界

- 只修改 page-visual-ready.js 与 camp-entry.js；新增 page-visual-readiness-sharing.js 和 page-visual-readiness-sharing.test.js。page-loading.js 保留原字节，现有调用自动参与共享。
- 同一个 ovBody、首页面实例、UI 所有者、overlay revision 和 extraRoots 才可复用进行中的资源等待。没有跨页面的已完成缓存。
- 每个调用独立保留初始布局帧、1500ms 默认截止时间、调用者取消、背景和字体等待、最终呈现帧。一个调用超时或取消只解除自己的引用；最后一个引用释放才清理图片监听。再次进入会重新扫描，旧 decode 完成不能解开新等待。
- 图片筛选仍保留最多12张、lazy/hidden/图库排除及视口检查。目的页统一以 ovBody 扫描，旧档案 ghost 不参与目的页等待，切幕自身图片仍由原 prepareCityCut 独立准备与3000ms失败回退。
- 基地异步资料刷新会递增 revision 并替换内容；初次切幕沿用同一个装饰层，立即取消旧页面订阅并重绑新的基地实例。页面已就绪而切幕图片尚未就绪时，同样跟随刷新。切到非基地、关闭或取消则清理，旧回调不能清除后来切幕的标记。
- 980ms 装饰时长未改；没有修改玩法、路由、存档、其他动画模块或CSS。

## 验证

- 14个定向测试文件，201 / 201通过。完整命令见下，日志 targeted-readiness-final.log。
- 新测试文件19项覆盖调用成本、热/冷设置、基地、980ms、同基地刷新两种等待阶段、页面/版本替换、独立取消/超时、迟到 decode、监听清理、背景/字体与图片筛选。
- 旧源码 A/B 负向复现：选定5项全部按预期失败，明确报告2次或3次，见 baseline-duplicate-work-reproduction.log。该日志不是新补丁失败。
- 改动4个JavaScript文件 ESLint 和 node --check 通过；git apply --check --whitespace=error-all 对固定基线通过。
- 首次扩大测试缺 desktop-app/main.js、desktop-app/package.json 和 game/index.html；从固定树精确核对 SHA 后补齐，最终201项无失败。测试输出的 offline/network unavailable 是既有失败恢复场景主动模拟。

在本种子的搜打撤目录执行：

```sh
node node_modules/vitest/vitest.mjs run --config ../vitest.seed.config.mjs \
  tests/page-visual-readiness-sharing.test.js tests/camp-entry-readiness.test.js \
  tests/screen-entry-performance.test.js tests/page-surface-lifetime.test.js \
  tests/page-loading.test.js tests/hub-lazy-entry.test.js tests/menu-pages-lazy-entry.test.js \
  tests/page-entry-cancellation.test.js tests/runtime-trace-stages.local.test.js \
  tests/home-menu-motion.test.js tests/archive-motion.test.js tests/class-choice-lazy-entry.test.js \
  tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot
```

正常完整项目使用其原有配置执行相同测试列表即可；临时 seed 配置没有改动项目配置。

## 集成待验

这是逻辑与调用成本验证，不代替浏览器实页、多设备性能、完整生产构建或全量CI。未发布、未提交、未推送。集成方负责 camp-entry.js 的资源消费者指纹与统一证据。
独立种子的 handoff 命令因缺 docs/PARALLEL-REGISTRY.md 明确失败；没有更改共享登记，统一登记由集成方维护。
