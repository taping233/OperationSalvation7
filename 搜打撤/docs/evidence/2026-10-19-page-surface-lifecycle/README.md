# 页面揭幕归属统一

## 已核实断点与实现

`page-loading.js` 原先等待 `waitPageVisual` 却忽略 false；挂载目标等待背景/字体/图片期间被替换或关闭时，没有目标DOM归属校验，旧 `onRevealStart` 仍可能执行。该问题是源码和合成异步时序可证的旧回调问题；尚未实页验证其视觉表现。

新增 `ui/page-surface-lifetime.js`：`createPageSurfaceLifetime(page, {overlay?, getRevision?, onInvalidate?})` 返回 `current()`、取消 `signal`、幂等 `dispose()`。统一检查具体页面仍连接原overlay、overlay未关闭/正在关闭、可选revision未变化。MutationObserver负责失效时及时释放，current负责异步边界的同步核验；初始化时已失效也会在调用方完成接线后取消。模块不持有业务状态，不接管路由。

同批迁入三个展示机制：

- `runPageLoading`：目标页挂载后绑定surface；必须等待素材/首帧正常完成且目标仍有效才执行旧揭幕；取消只移除自己的cover，放行输入并释放aria-busy。没有ovBody的旧加载-only使用方式保持兼容。复用 `visualFrame`，去掉重复的帧等待实现。
- `playPreparedCut`：成就、设置、整备共用装饰切幕统一校验页面归属；补原生closing类和整个overlay脱离DOM的取消边界。
- `stagePageVisual`：普通全页/背包/节点页展示使用同一surface归属，仍保留overlay revision校验；旧等待不得揭幕或移除新页cover。

`page-entry-cancellation`继续负责入口/下载业务仲裁，本次不另建第二套导航机制。未修改run/battle、出发/返回地图业务等待或CSS。图片error/decode失败/加载超时仍按原逻辑正常降级揭幕，false仅代表取消/目标失效。

## 验证

批量改动后首轮5文件70项全部通过：page-loading、page-surface-lifetime、camp-entry-readiness、contracts、architecture-boundaries。
补入初始隐藏宿主回归后，7文件76项全部通过：page-surface-lifetime、hub-lazy-entry、card-library-lazy-boundary、class-choice-lazy-entry、menu-pages-lazy-entry、page-entry-cancellation、departure-handoff。最后只补验该公用初始化校验涉及的page-loading/camp-entry-readiness两文件26项通过。
去重累计11文件143项通过，局部ESLint与diff空白检查通过。门面测试的网络失败warning为预设故障用例，最终结果全绿。

新增测试覆盖等待中替换、隐藏、两种closing、overlay移除、初始无效、revision即时过期、旧就绪结果不影响新cover，以及背景超时仍可正常揭幕。成就切幕的成功/error/超时/decode拒绝保持原测试，补原生closing和宿主脱离DOM。

## 资源选择复核

`camp-entry.js`相对HEAD的资源映射/预热段、createCityCut选择与URL渲染完整函数、prepareCityCut降级函数分别逐字相同。本次只有playPreparedCut归属/清理改动，未改资源选择集合或失败降级。
稳定文件SHA256：`84a03a47534afbe1ca284ede88975597e044e948b76df97921123b47454cb4e0`。已向主会话提供此证据，由其统一更新runtime-asset-redundancy-review的transitions指纹和复验。

## 验收边界

全部为jsdom与源码契约，非真实浏览器视觉验收；当前平台实页阻塞，不使用headless/CDP替代，不声称闪烁/露地图已实测改善。保留当前绘制时长与素材兜底策略，地图Renderer实际首帧和切幕连续性待当前窗口补验。无build/commit/push/服务；原有改动保持。
