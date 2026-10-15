# Flameox 实际性能调查

结论：找到了明确值得继续优化的玩家界面区域——照相馆打开与分类切换的同步布局读取。地图平移本次没有性能瓶颈证据；自动战斗样本里的高开销混有 Agent 观察与测试驱动，不能归因到手动战斗。此次仅调查，没有修改游戏或验证优化后的收益。

## 实际采样范围

- 2026-10-14；HEAD `3d02437e4c3cf6fb4a55f8a05b409932ec35daae`，含其他会话未提交内容的 Vite dev 工作树，不是生产包或纯 HEAD。
- Windows，Codex 当前窗口内置浏览器，复用 5200；未改窗口尺寸。CSS 宽 1603，DPR 1.25；标题/照相馆画布高约 901.69，地图画布高约 808.19，差异来自游戏自身布局。
- 使用内置浏览器的受支持 CDP capability：Profiler 采样间隔请求 1,000 微秒；CPU 产物 `.cpuprofile` 交 Flameox 0.2.9 的 `rank_cpu_hotspots` 分析。它返回样本计数，不直接返回毫秒；下文毫秒来自游戏探针或独立计时。
- Flameox 使用 Codex 自带 Python 3.12.14 创建项目缓存中的独立 venv，经 PyPI 安装；系统 Python 3.8.3、游戏依赖及全局/MCP 配置未修改。
- 标题空闲、照相馆打开、武术/全部分类切换通过真实 UI 输入；地图受控平移通过游戏探针；战斗通过 `SDT.Agent.scenes.run('battle')` 构造并自动驱动，非真人操作。
- 所有浏览器动作仅本聊天新建标签页。地图/战斗在 127.0.0.1 来源以原 localStorage 内容的内存副本运行，持久存储原对象前后内容完全一致；原始存档备份仅留本地缓存，不进 Git。临时 getter/函数计时在结束时撤除，标签页关闭。没有启动/停止共享服务，没有 build、提交或推送。

## 值得优化：照相馆连续同步布局读取

首次打开的 CPU 样本里，`UI._checkPageBg` 为最高游戏源码 self 热点（86 个样本），`updatePhotoStudioTabMarker` 为另一热点（23 个样本）。两次分类切换里，`photo-studio-navigation.play`、`renderLibGrid`、`setLibSelection`、分类标记更新反复出现。于是针对这些读取做临时计时，保留原返回值和逻辑。

三次重复打开时，背景检查 `_checkPageBg` 的实测调用耗时依次为 **117.8、21.9、25.1 ms**。PerformanceObserver 记录包含该调用的主线程长任务依次为 **190、84、95 ms**；另有前置 67 ms 任务，没有归入这三次打开。第一轮重开 CPU 区间在异步页面完成前结束，不能用其 CPU 排名解释整次打开；独立计时和长任务观察仍覆盖实际打开。第二、三轮 CPU 样本分别再次命中背景检查与分类标记。

源码 `ui/overlay.js:171` 在新页面写入后立即 `getComputedStyle(host).backgroundImage`，且这次读取发生在 `_bgReady` URL 缓存判断之前。因此图片已加载并不免除计算样式的成本。这里的归因是：源码读取位置与计时热点一致，可能承担整页样式计算/同步布局；尚未采集 Chrome layout trace，不能把全部调用耗时都命名为 layout。

进一步直接包装原生尺寸 getter，只记录超过 1 ms 的读取，得到以下调用栈和耗时：

| 用户动作与读取位置 | 实测耗时 | 当前代码机制 |
| --- | ---: | --- |
| 打开：photo-studio-tabs.js:9，首次 marker 的 offsetWidth | 15.2 ms | 分类按钮属性写入后读取布局 |
| 同一次打开：game.cardslib.page.js:826 → syncLibTileIntrinsicSize → marker offsetWidth | 11.0 ms | 页面构建继续写样式后再次更新 marker |
| 同一次打开：game.cardslib.page.js:828 → syncLibFilterUI → marker offsetWidth | 13.6 ms | 同轮第三次 marker 更新 |
| 全部→武术：game.cardslib.page.js:680，resultCount.offsetWidth | 27.0 ms | 删除 bump 类后强制读取，再加 bump 类重启动画 |
| 全部→武术：photo-studio-navigation.js:105，grid.clientWidth | 38.5 ms | grid.innerHTML 更换后立即读取宽度计算入场动画距离 |
| 全部→武术：photo-studio-tabs.js:9，marker offsetWidth | 11.0 ms | 再次尺寸/marker 同步 |
| 武术→全部：上述三处 | 14.2 / 24.2 / 9.3 ms | 同样模式重复出现 |

这是浏览器原生读取的实测阻塞时间，超出单帧 120 Hz 的 8.33 ms 预算；不是仅凭循环复杂度推断。Getter 计时增加少量观测开销，样本规模也很小，但两种切换均重现，足以把这段列为优化优先项，不能据此预测精确提速比例。

建议后续修复方向：

1. 合并同一页面构建/分类切换中的 marker 更新，把布局读取集中到一次，读完再统一写样式。
2. 数字动画改用可重启的动画 API，避免为重加 class 读取 offsetWidth。
3. 网格动画宽度通过既有 ResizeObserver 缓存或在替换 DOM 前读取，避免 innerHTML 后立即 clientWidth。
4. 背景就绪检查复用已知资产 URL 或调整读写顺序，保留加载失败/离场取消/提示语义；不能简单删掉检查。

验收应在同窗口、同卡库、相同冷/热状态下比较打开和分类切换的长任务、读取耗时及输入响应，且保留视觉动画。没有做实现 A/B，本报告不宣称这些方向已经降低总耗时。

## 暂不优化的场景

### 地图受控平移

6,002.7 ms 采样内：863 次 draw，绘制中位 **0.2 ms**、p95 **0.4 ms**、最大 **0.7 ms**；帧间隔 p95 **7.1 ms**，超过 20 ms 的比例 0，长任务 0。draw 只覆盖 SDT.Renderer，不包含全部 GPU/合成；rAF 回调率 143.77 Hz 不是屏幕 FPS，探针每帧 invalidate 也不代表普通玩家时刻的 120 Hz 调度。

Flameox 将 drawMapNodeBadge 列为主要绘制 self 热点，但绝对 draw 开销很低，本次没有进一步改地图绘制的依据。

### 照相馆静置

6,007 ms 采样内：帧间隔 p95 **7.1 ms**、超过 20 ms 的比例 **0.12%**、长任务 0、后台地图 draw 0。此样本排除持续地图重绘问题，但不排除打开/切换瞬间阻塞。CPU 样本里主要源码热点来自 perfProbe 自己的可见性/页面机制检查，不能当作正常产品热点。

### 构造自动战斗

单场剧本 **4,473 ms / 28 步**，7 条断言通过、errors 为空。Flameox 热点集中在 observe、cardStacks、Agent 场景时钟/轮询；最高 cardStacks 包含 264 样本，observe 包含 757 样本，不能直接把采样计数当毫秒，也不能把包含计数相加。

这说明未来要提升自动跑局吞吐，可单独调查观察数据组装与重复卡堆计算；当前没有证明它拖慢手动战斗，也没有验证缓存/降频能保持行为，因此不建议据此改战斗规则或默认加缓存。

## 工具收益与证据边界

Flameox 本次的价值是把真实 V8 栈整理为有来源、覆盖限制和样本计数的热点，帮助定向找到照相馆代码；采集来自内置浏览器，功能计时和最终判断由本会话补充。它不是自动修复器。

CPU 不覆盖 GPU、栅格化、独立线程、全部图片解码或堆分配；没有 source-map 解析。photo-open 初次输出 40/85 行、battle-scene 150/327 行，保留 truncation，排名没有完整展开，不称全栈审查；其他已分析样本的行返回完整。没有生产包、全职业、全部楼层或多窗口尺寸测试。

原始 CPU、Flameox JSON、探针 JSON、定向计时调用栈和截图由 `artifact-manifest.json` 记录相对路径、大小、SHA256。超过 1 MB 的文件留在 node_modules 缓存，只登记获取方式；存档原文不复制。源码 SHA 是核对时点的身份，不能证明其他会话在全过程未改代码。浏览器结束时捕获 warn/error 0 条。

CLI 复现：本地独立环境 `flameox analyze rank_cpu_hotspots <绝对路径.cpuprofile> --format cpuprofile --limits '{"max_rows":150}'`。采集步骤、临时计时脚本另见 `capture-notes.md`。证据与登记完成未提交；未完成项是优化实现和同条件 A/B 验证，不属于本轮调查授权范围。
