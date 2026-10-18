# 地图道路预览局部失效

切换预览目标时，仅连接旧、新目标的道路重新裁剪与烘焙。路径高亮、箭头和节点状态仍逐帧读取；缩放、视口和奖励原位修改继续使缓存失效。

基准使用真实 v5 生成器、固定种子 `deep-runtime-1018-map`，四层节点数为 7/11/16/16，测量最大层。加载真实 renderer、状态投影、道路曲线与笔刷模块；Image 和 Canvas 由受控后端代替。预热后以交替顺序运行 30 批、每批 30 次操作。计时不作为测试通过门槛。

| 单次绘制的批均值分布 | 基线 median / p95 ms | 改后 median / p95 ms |
| --- | --- | --- |
| 平移 | 0.0775 / 0.1029 | 0.0782 / 0.0985 |
| 连续缩放 | 0.2223 / 0.3084 | 0.2164 / 0.2525 |
| 预览切换 | 0.1998 / 0.2496 | 0.1006 / 0.1645 |

主要收益在预览切换，约减少 0.10ms JS 绘制耗时。平移和缩放未据此声明收益。160 组输出对比覆盖缩放 0.35–1.775、预览、visited 原位变化、补给待领/已领，曲线、端点裁剪、透明度逐数值相等；其中 80 组预览序列的 section 更换数从 1360 降至 539。该数表示重烘焙输入失效次数，不是帧率。

CPU 采样确认旧路径中道路笔刷、曲线查询占用执行时间。曲线求值缓存另做过候选，但缩放计时没有稳定收益，未纳入生产改动。Windows 短批次 process.cpuUsage 粒度不足，保留原值供复核，不将其作为节省量。

本轮按老板要求未继续实玩。以上仅测 JS 与受控绘制命令，不覆盖实际栅格化、GPU、帧率或原生 EXE。长期回归为 `tests/renderer-road-invalidation.test.js`，与现有道路及生命周期测试共 21 项通过；补充覆盖清空预览及离屏期间多次切换目标。

复现：把本目录的 `profile.test.js`、`vitest.config.mjs`、`renderer.baseline.txt` 复制到 `.tmp/deep-perf-1018/map/`，在项目根运行 `node node_modules/vitest/vitest.mjs run --config .tmp/deep-perf-1018/map/vitest.config.mjs`。基线为本任务父提交的原文件。原始 CPU profile 留在 `.tmp/deep-perf-1018/map/baseline.cpuprofile`，由集成清单记录 SHA256；[report.json](report.json) 和 [profile.log.txt](profile.log.txt) 为本次结果。
