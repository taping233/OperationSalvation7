# 资源展示计算定向验收

共享URL按完整输入缓存，1024条FIFO，输入和结果各限1024字符；卡框按13种键惰性缓存，返回独立对象。构建常量/布局的模块重载会重建缓存；不缓存网络/解码状态。现行行为见[性能说明](../../performance.md#运行时资源展示计算)。

真实boot顺序迁移后的281张卡×4形态，共1124份HTML前后逐字一致。冷轮URL解析2249→558、框计算1124→12；热轮2248→0、1124→0。31样本中位冷轮8.046→7.479ms、热3轮36.304→24.456ms；环境、输出哈希和计数见[cost.json](cost.json)。测量仅Node24/Linux/jsdom字符串生成，不能代表FPS。Icons路径双方相同，不计入本次URL对照；两侧均有既有martial-melee映射回退告警。

5文件81定向测试与单独1项基准通过；两源码与两新测试ESLint通过。未跑build/全量或内置浏览器；由集成方补实页及资源消费者指纹审查。冷轮收益较小，原始全部样本保留外部供复核。

## 复现

在完整项目目录设置 RESOURCE_PRESENTATION_BENCH=1、RESOURCE_PRESENTATION_BEFORE_DIR 为下列before源码所在目录，运行 `./node_modules/.bin/vitest run tests/resource-presentation-benchmark.test.js`。可另设 RESOURCE_PRESENTATION_OUTPUT 写到指定外部JSON路径；默认只输出、不改仓库证据。普通测试跳过性能基准，缓存行为回归运行 `tests/resource-presentation-cache.test.js`。

## 外部原始证据

旧整源码和长日志未入库，以下为本次云端归档位置及内容哈希；跨环境复现需先取回对应两份before文件并核验哈希。

- `/workspace/scratch/b7a53a06c872/work-resource-perf-20261020/docs/evidence/2026-10-20-resource-presentation-perf/asset-url.before.js` SHA256 `5bbfcf5fd3b9a0f7a1a53779710786133c5c749f8f8a20d635f804699b6d207e`
- `/workspace/scratch/b7a53a06c872/work-resource-perf-20261020/docs/evidence/2026-10-20-resource-presentation-perf/card-frame-presentation.before.js` SHA256 `79ef8241faad2ed89bb1c19b6866f0e352ddd43e9498d1e0842e436335099d9a`
- `/workspace/scratch/b7a53a06c872/work-resource-perf-20261020/docs/evidence/2026-10-20-resource-presentation-perf/benchmark.json` SHA256 `b6cdbf78cc50f1740012b6967ccde10decb82c8e63704ac96bd1a9c2654234d6`
- `/workspace/scratch/b7a53a06c872/work-resource-perf-20261020/docs/evidence/2026-10-20-resource-presentation-perf/benchmark.log` SHA256 `02ff50dcada63fe36b6f8a485bf09fa78d728820e656092c8702edafe99db48f`
- `/workspace/scratch/b7a53a06c872/work-resource-perf-20261020/docs/evidence/2026-10-20-resource-presentation-perf/tests.log` SHA256 `dbc8356a6131041e17d111e6ee6292441b8ac53bba3d6321c8008228a35ea15b`
- `/workspace/scratch/b7a53a06c872/work-resource-perf-20261020/docs/evidence/2026-10-20-resource-presentation-perf/production.diff` SHA256 `b91f4b030236262ba815fa18f886c54da984fd428f1c1c144bb032f923888663`
