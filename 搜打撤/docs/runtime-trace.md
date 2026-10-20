# 真实交互与录屏时间轴

生产页和开发页均可显式使用 `?runtimeTrace=1`（已有查询参数时追加 `&runtimeTrace=1`）。普通启动不加载此模块，也不创建诊断观察器、输入监听或 rAF。原 DEV `perfProbe` / `flightRecord` 不变。

## 操作

1. 在当前获准浏览器打开同一游戏页面并附加开关，正常操作游戏。右下角显示「本地交互诊断」。本功能不负责录屏、不改游戏状态、不绕过登录。
2. 开始已有录屏后点击「视频对时」，画面会显示编号；记下该编号在源视频中首次可见的秒数。DOM标记与视频编码帧之间存在人工对时误差。
3. 复现切页或出牌问题。「停止」终止采集并保留结果；「清空」删除内存记录；运行中清空后继续采集。记录最多400条，旧记录淘汰量写入 `dropped`。对时标记若被淘汰，需要重新取证，不能猜视频起点。
4. 点击「下载JSON」得到本机 `sdt-runtime-trace.json`。刷新或离开页面会停止该次采集；不写 localStorage，不自动上传。返回 bfcache 页面后本次采集保持停止，需要重载才能重新开始。
5. 用已有离线工具关联主视频，例如：

```sh
node scripts/video-review.mjs --input recording.webm --out new-review --trace sdt-runtime-trace.json --trace-marker 1 --trace-video-seconds 4.2
```

打开输出 `index.html` 的「本地交互时间轴」，结合采样候选回看原片。完整结构在 `report.json.runtimeTrace`。传入 `--compare` 时诊断只对齐主视频，不能把这份时间轴用于对比视频。视频分段的对时秒数仍是完整源视频秒数，不是片段相对秒数。

## 指标边界

- `input` 是真实UI事件路径的类别：按钮点击、手牌按下/释放或 Escape。按下和释放分别编号；它们不证明卡牌合法打出或结算成功。不会读取卡牌ID、按钮文字、输入值或坐标。
- `dom-update` 是输入后10秒内 overlay 子树结构变化，关联最近输入；页面只归类为基地、出击、战斗、其他覆盖层或底层。不读取整段DOM、存档、URL/query或凭据。异步变化可能由其他原因触发，不能视为因果归属或完成时刻。
- `frame-opportunity` 是输入捕获后第二个 rAF 回调的延迟，表示一次潜在渲染机会，不是屏幕FPS、实际paint或整段动画完成时间。最多32个待处理回调，隐藏时取消，避免后台等待混入。
- `longtask` 采用 PerformanceObserver 的开始时刻与持续毫秒数。API不可用会显示降级，并写入 `longTaskSupport`；缺记录不代表没有长任务。隐藏状态单独记录，隐藏期间条目有 `visible:false`，应排除后台区间分析。
- 所有记录共用 `performance.now()` 单调时轴，JSON标注 `timeOriginMs`、`traceStartMs` 和采集器修订号 `revision`。`buildVersion` 保存 Vite 注入的游戏构建标签（非构建环境为 `dev`），不从 URL 取值。采集器修订号不是游戏Git SHA；构建标签对应的部署提交仍由发布清单核验。
- 采集器运行会增加少量观察和读DOM开销，因此比较应使用相同开关。它用于定位交互时段，再结合浏览器性能工具核因，不替代真实帧率或完整性能剖析。

JSON文件是本地数据；只有明确执行下载才产生文件。离线复核仅接受本地小于1MiB的诊断JSON，再次白名单过滤。视频分析和对时不产生外部请求。

## 比较两次真实阶段采样

无需视频或人工对时锚点，可复用同一脚本离线比较：

```sh
node scripts/runtime-trace-alignment.mjs --before before.json --after after.json > stage-comparison.json
```

输入各限本地1MiB、400行；输出只保留白名单阶段的样本数、中位数、范围，以及每个interaction唯一overlay-sync与navigation-sync的同步合计。重复或不完整边界不强行配对；module/visual异步等待不加入同步合计。仅统计visible=true且字段有效的完成记录，另报排除量和dropped。按是否观察到module-wait拆分样本，未观察到不等于已证明热加载。可用同一工具复查设置前后采样，而不把不同会话的interaction编号强行逐个配对。

长任务只报告可见记录数和与阶段区间重叠的记录数，同一长任务不重复计数；不同会话观察时长不一，不能按总数推导改善。API不可用、零记录、丢弃或取消会影响解释。少量样本只描述本次观察，不证明因果、统计显著性、实际呈现或FPS；实际部署身份和浏览器条件须另核对。JSON中的limitations随结果保留。

## 浏览器事件时序（仍由原开关开启）

`runtimeTrace=1` 在支持 `event` PerformanceObserver 的浏览器请求后续事件条目，`buffered:false`、`durationThreshold:16`。普通启动仍完全关闭。`eventTimingSupport` 区分 supported / unsupported / unavailable；supported只表示观察器已注册，不保证interactionId可用、阈值被实现采纳或本次有样本。不同浏览器/版本可能缺少这些能力，以本机检测和实际条目为准。

只关联原已允许的按钮click、手牌pointerdown/pointerup和Escape的可信事件，按事件类型及原始timeStamp严格唯一匹配。时间精度不一致、同类同时间戳歧义、晚到/淘汰、隐藏跨界条目直接放弃，不猜最近输入。不会观察普通键入内容或读取PerformanceEntry.target、selector、DOM文字、URL、坐标。匹配表和匿名映射各至多400项，记录总量仍400条；停止断开观察器，清空/隐藏清除待匹配项，pagehide停止。事件可能延迟提交，停止瞬间尚未报告的条目可能缺失。

新增 `event-timing` 行复用原 `interaction` 关联阶段，`browserInteraction` 将非零浏览器interactionId映射为本次采集匿名序号；不保留原浏览器编号，不与原input序号混用。同一手势可能有多条事件，不能把duration相加。映射淘汰或跨隐藏后不保证完整手势分组，清空不会复用旧匿名序号。没有browserInteraction表示未得到有效非零ID，不代表没有交互。

- `inputDelayMs = processingStart - startTime`：事件开始到浏览器开始派发的排队时间，补足原捕获监听之前不可见的等待。
- `processingMs = processingEnd - processingStart`：浏览器事件派发区间，不等于设置页面专属CPU，也不覆盖其后全部异步工作。
- `durationMs`：浏览器报告的事件到随后渲染更新时长，按8ms粒度报告；不是精确屏幕呈现时间或完整异步响应。未绘制/隐藏等实现边界会影响值。

规范默认阈值104ms、可请求最低16ms；低于阈值事件不会完整报告，连续移动/滚动不在本采集范围，合成事件不会产生真实Event Timing。离线原入口的 `eventTiming` 输出只描述匹配可见子集的duration/inputDelay/processing样本中位数和范围；零样本不作零延迟，不能据此计算页面INP或FPS。原视频对时JSON和HTML均保留新增时序字段；对时HTML的duration仍按各kind解释。

官方依据（2026-10-20核对）：[W3C Event Timing工作草案](https://www.w3.org/TR/2026/WD-event-timing-20261013/) §1.4/1.5、§2.1、§4；[Google自定义性能指标](https://web.dev/articles/custom-metrics#event_timing_api)。规范为工作草案，采集器不假设所有浏览器统一实现。不增加依赖，不自动上传。
