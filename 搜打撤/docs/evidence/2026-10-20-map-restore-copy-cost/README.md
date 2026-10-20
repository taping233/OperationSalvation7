# 地图恢复：移除重复校验和逐节点 JSON 往返

本轮只修改地图恢复的内部数据流。公开 `validateMapSnapshot` / `hydrateMapSnapshot` 仍做完整校验；`planMapRestore` 在当前调用内把校验所生成的独立副本交给私有还原函数，不保存长期“已校验”标记。已校验边是双整数数组，节点定义、边界和门为固定标量记录，因此直接复制仍保持输入、快照、运行节点及逻辑节点的可变引用隔离。

没有修改 schema、生成器、路线、奖励、容量、事务、持久化写盘或保存时序。旧3/9无快照重建仍有生成后自检和位置校验，只消除最后还原时的第三次整图校验。

## 检查

- 13个定向测试文件、195项通过：地图快照/版本/路线/设施/火堆约束、session菜单、E5装载恢复与坏档验证、奖励中断、prev恢复、基地快照及旧档兼容。
- 新增9项回归覆盖：固定JSON调用预算；输入/快照/运行与逻辑记录引用隔离；公开入口每次重新验证；循环、危险键、undefined、函数、非有限数拒绝；旧3/9与位置守卫。
- `npx eslint game/src/run/map-snapshot.js tests/map-snapshot-copy-cost.test.js` 退出0。
- 最初小副本缺少index.html/CSS使3个集成测试文件无法装配；复制这些只读输入后完整重跑上述13文件，195项通过。初次装配失败不计作通过。
- 全量、构建、真实浏览器读档尚未验证。测试使用独立小副本、依赖符号链接、显式jsdom配置，未使用主树构建配置；Node v24.19.0，与项目推荐Node22不同。

## 同输入成本

来自真实生成器的固定seed `audit-map-20261017-0`，不是扩大后的极端随机数据；每次新旧输出深等比较。调用与累计字符计数包含内部路线验证。字符不是UTF-8字节或堆占用；耗时为Node/Vitest重复恢复微基准，不代表真实设备载入时延或帧率。

| 输入 | 节点/快照字符 | stringify次数前→后 | parse次数前→后 | stringify累计字符前→后 | parse累计字符前→后 | 中位毫秒前→后 |
| --- | --- | --- | --- | --- | --- | --- |
| 旧3/9快照 | 53 / 7160 | 175→2 | 173→1 | 33366→14320 | 19046→7160 | 0.590→0.238 |
| 现行6/9快照 | 50 / 6784 | 166→2 | 164→1 | 31539→13568 | 17971→6784 | 0.673→0.294 |
| 现行6/9带守卫路线 | 50 / 7030 | 174→6 | 168→3 | 79919→37758 | 45593→20595 | 2.152→1.032 |
| 无快照旧3/9重建 | 53 / 无输入快照 | 242→69 | 239→67 | 48876→29830 | 27396→15510 | 1.070→0.640 |

每种输入先各预热25次，再交替顺序跑7组各100次。精确输入SHA256与计数、中位数见 `benchmark-results.json`；原始7组样本保留在外部 `/workspace/scratch/b7a53a06c872/map-save-perf/benchmark-results.json`。JSON克隆对应一组stringify+parse；校验的大小检查只stringify，故不能将stringify次数一概称为克隆次数。直接复制仍有必需对象分配，不声称零克隆或零分配。

## 复现

在独立源码小副本中，将外部基线 `/workspace/scratch/b7a53a06c872/map-save-perf/baseline/map-snapshot.js` 复制到 `game/src/run/map-snapshot.baseline.js`，将 `benchmark.test.js` 复制到 `tests/map-snapshot-benchmark.local.test.js`，准备 `export default { test: { environment: 'jsdom' } };` 的vitest配置，然后运行 `npx vitest run --config vitest.config.mjs tests/map-snapshot-benchmark.local.test.js`。基准会输出 `benchmark-results.json`。这两个临时源码/测试文件不属于交付的生产路径。

## 外部原始证据

不随补丁落库的原始文件保留在云端副本：

- 基线源码：`/workspace/scratch/b7a53a06c872/map-save-perf/baseline/map-snapshot.js`，SHA256 `f90c34ed9322e43b31e540c99ce03382bcb4e41d69e2d10f26f81fc5b3d50f85`。
- 195项回归原始日志：`/workspace/scratch/b7a53a06c872/map-save-perf/regression-final.log`，SHA256 `7c73156defa27096fcef051aac299881e9aa30c6a6ffeb8a93d555a86e60321c`。
- 获取方式：从本次云端任务工作区读取上述路径；云端副本生命周期结束后需按输入版本和复现步骤重新生成。
