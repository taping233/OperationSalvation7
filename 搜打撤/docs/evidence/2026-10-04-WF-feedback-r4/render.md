# 照相馆渲染性能改动（WF-feedback-r4）

本次仅记录 `game/src/hub/game.cardslib.page.js` 的渲染分支。IntersectionObserver 在同一网格上复用；每帧追加壳与同步补壳都只观察刚插入的节点，不再断开并重扫整张网格。IO 真正挂载卡片时将本批 shell 传给 `warmLibArt({ roots, preview: false })`；初次打开和筛选重绘只把当前已挂载 item 作为 roots，并单独保留选片台预热。

卡牌内层 HTML 按卡对象缓存在 `WeakMap`，卡库数据刷新时重置缓存，卸载后再次挂载复用模板；关闭照相馆时也替换缓存，释放全局卡目录仍持有的缓存键对应模板字符串。当前选中态仍按 `libSelectedId` 写入 `aria-current`。整页刷新、筛选重绘和关闭照相馆都会递增队列 generation，旧 rAF / observer 回调在影响新网格前退出。

90ms 悬停预览去抖计时器改为模块级句柄，在筛选重绘、整页重绘和关闭照相馆时清理；原悬停等待时长及选中预览回调保持不变，避免旧卡 hover 回调晚于网格切换或关馆运行。

静态机制依据：`observeLibTiles`、`appendLibShellsIdle`、`flushLibShellsNow`、`invalidateLibShellWork`、`photoTileInnerHTML` 及 `renderLibGrid` / `renderCardLibrary` / `closeLibPage` 的调用链与 `libPreviewTimer` 的清理点。

按老板要求，本轮未运行测试、lint、解析验证、benchmark、build 或浏览器；没有运行时性能基线，未声称具体耗时、百分比或 FPS。交老板验收，实际打开、筛选、滚动和关闭表现未核实。
