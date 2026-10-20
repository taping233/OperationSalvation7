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
