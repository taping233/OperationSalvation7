# 性能基准

## 基准方法

运行 `npm run perf`。脚本会在本机启动 Vite 和短暂显示的无边框 Electron 窗口，按系统缩放比反算 1920×1080 物理像素内容区，连续执行三轮空闲地图、移动、缩放与不透明页面覆盖采样，并以各指标中位数输出 CSS 视口、设备缩放比、物理像素尺寸、Renderer 调用数、绘制耗时和帧间隔。

## 当前优化

- 活动移动和特效目标 120 FPS，空闲环境动画最多 30 FPS。
- 标题或不透明全屏页面覆盖地图时不调用 Renderer。
- 静态天空、棋盘、渐变和壁纸继续复用缓存；资源完成加载后使调度器失效并补绘。
- HUD 仅在对应字段变化时写入 DOM。

## 两级验收线

- 发布性能门槛 `performanceGatePassed`：物理内容区为 1920×1080；移动与缩放场景 Renderer 绘制耗时 p95 不高于 8ms；空闲 Renderer 调用数相对持续 60 FPS 至少下降 40%；`covered` 样本的 Renderer 调用数为 0。
- 体验目标 `experienceTargetMet`：移动与缩放的整体帧间隔 p95 不高于 20ms，慢帧比例低于 5%。它包含 Chromium 合成、系统调度和后台负载，不再与游戏自身 Renderer 耗时混为一个发布门槛。

数值会受机器、电源模式和后台程序影响；比较前后结果时应保持环境一致。

## 2026-09-04 实测

当前显示缩放比为 1.5，因此基准内容区使用 1280×720 CSS 像素，对应 1920×1080 物理像素。接入运行时库后的三轮中位数如下：

| 场景 | Renderer 调用 | 平均绘制耗时 | 绘制耗时 p95 | 整体帧间隔 p95 | 慢帧率 |
|---|---:|---:|---:|---:|---:|
| 空闲 2.4 秒 | 59 | 3.40 ms | 5.0 ms | 25.3 ms | 9.8% |
| 移动 2.4 秒 | 70 | 2.97 ms | 4.4 ms | 43.4 ms | 28.2% |
| 缩放 1.2 秒 | 31 | 3.22 ms | 5.7 ms | 27.6 ms | 10.7% |
| 全屏覆盖 0.7 秒 | 0 | 0 ms | 0 ms | 不作为指标 | 不作为指标 |

本次 `performanceGatePassed=true`：分辨率、绘制耗时、空闲降频和全屏暂停均通过。`experienceTargetMet=false`：整体帧节奏仍受系统合成与调度波动影响，没有达到 20ms / 5% 的体验目标。

三轮中最好一轮已接近目标（移动 p95 21.1ms、慢帧 6.5%；缩放 p95 9.4ms、慢帧 0.5%），而 Renderer 绘制 p95 始终低于 8ms。后续优化应优先排查窗口合成、后台负载和帧调度，不应在缺少证据时继续削减地图绘制质量。

## 2026-09-05 卡顿根因与修复

本轮将活动状态目标由 60 FPS 提升至 120 FPS，并补充 `activeTargetIs120`、`target120DeliveryMet`、实际 Renderer FPS、Long Task 和 GPU 型号输出。修复内容：

- 帧调度改用绝对 deadline，避免 120 FPS 在 165 Hz 显示器上因“以上次晚到帧重新计时”持续漂移；镜头模拟改为每次 rAF 更新，不再丢掉未绘制帧的 `dt`。
- 25 张战斗抠图改为逐张后台预解码；47 个短音效统一限制为两路解码，峰值扫描改为零临时数组循环；两首大 BGM 改用 Howler HTML5 流式播放。
- 标题、HUD 和战斗中的无限 `filter` / `box-shadow` 动画改为合成友好的 `transform` / `opacity`。
- Pixi 粒子层仅在粒子存活时启动 ticker；空闲后停止并隐藏全屏透明 Canvas，避免首次战斗后永久多出一条渲染循环。
- Electron 在混合显卡机器上请求高性能 GPU。实测从 Intel Iris Xe 切换为 RTX 3060 后，移动场景稳定轮从约 50 FPS 提升到约 68 FPS；自动集显路径还出现一次 Chromium GPU command buffer invalid 错误。

最终 1920×1080 三轮中位数：空闲 30.4 Renderer FPS、draw p95 3.5 ms；移动 67.9 Renderer FPS、draw p95 4.5 ms；缩放 draw p95 3.8 ms；所有场景 Long Task 均为 0。`performanceGatePassed=true`、`activeTargetIs120=true`，但 `target120DeliveryMet=false`、`experienceTargetMet=false`。

Intel PresentMon 2.5.1 的 ETW 侧采样显示交换链为 `Composed: Flip`、`SyncInterval=0`；GPU busy p50 2.49 ms、p95 9.48 ms，而 GPU wait p50 3.88 ms、p95 17.47 ms，3D 引擎采样峰值约 64.6%。因此剩余上限是混合显卡/DWM 呈现等待，不是 JS 长任务或 GPU 算力饱和。1600×900 内部画布和 `desynchronized` Canvas A/B 均无收益，已回退以保留原生画质和更高吞吐。要在本机窗口化路径稳定交付 120 FPS，还需单独验证显示直连或更新 Intel 显示驱动；这属于系统级变更，不纳入本次代码修改。

GPU 诊断可运行 `npm run diagnostics:gpu`；临时设置 `SDT_GPU_INFO` 可将 JSON 写入指定文件。性能基准默认强制独显，设置环境变量 `SDT_PERF_GPU=auto` 可做自动选卡 A/B。

## 资源体积基线

运行 `npm run build` 后再执行 `npm run assets:audit`。2026-09-04 当前工作树的源码资产为 312.16 MB；选择性复制动态资源并让 Vite 统一处理静态资源后，桌面游戏目录为 193.42 MB，占源码资产的 62.0%。旧视频、候选标题图和原始图标仍保留在源码素材目录，但不再进入发布产物。

审计同时发现 12 组内容完全相同的源码文件，理论可回收 38.54 MB。它们当前仍作为原始素材保留；删除前应先统一语义映射并逐项验证引用。
