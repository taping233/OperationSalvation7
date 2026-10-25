# 7/9探索支路与未知区域纵深

老板要求地图出现真正的死胡同，并加入未知区域空间纵深，沿用现有模糊剪影画风。本轮已接入普通新局；已有进行中地图保持原快照。

## 实现

- `map-generator-v7.js` 从旧6/9候选几何中按地图独立子流稀疏化双向道路。首层至少1个非入口/出口的单路尽头，后面每层至少2个；分叉下限1/2/2/2，每层至多1个回环。所有地点仍可达、可原路返回，每层至少一个尽头为宝箱/物资/事件。节点数量和类型配额不增加，火堆两战、首层先战、设施深度、连战及终局距离规则仍检查。候选最多64次，固定保底走相同最终门。
- 新普通远征使用7/9，无旧L2路线叠层，保存无路线协议的snapshotVersion=1。旧3/9、4/9、5/9、6/9和既有v1/v2路线按原规则恢复；新快照检查探索结构。旧生成器、旧适配层和旧路线覆盖保持本轮前字节，冻结检查通过。`CURRENT_GENERATOR_VERSION`历史公共常量保持6供冻结代码使用，新局使用显式`EXPLORATION_GENERATOR_VERSION=7`。
- `map-frontier-depth.js`在背景与道路之间绘制冷灰远雾和不规则软边；只读取已揭示坐标，不读取隐藏节点坐标/类型/连边。全层揭示后退出，按揭示几何及采样尺度缓存，平移不重新烘焙，不创建动画循环。沿用既有背景剪影与前轮岸坡素材。
- 保留原工作树已有修改，不改奖励内容、存档数据或已有地图。不build、不提交、不新建服务。

## 验证

最终核心8文件108项通过：`map-exploration`、`map-frontier-depth`、`map-version-compat`、`map-fire-pacing`、`map-route-v2`、`map-generator-v4`、`contracts`、`architecture-boundaries`。新增测试独立检查128种子的可达性/反向边/尽头/分叉/回环/火堆路径/终局距离、新旧快照逐字往返、随机流不推进、64次故障回退及雾层不读取隐藏几何、平移缓存复用。

另采样256种子，最大候选9次、无保底，1024层中215层保留一个回环。该采样只说明这批种子，不是性能基准。

扩展10文件：82项通过、6项失败。8个通过文件为`r5a-map-snapshot`、`map-snapshot-copy-cost`、`map-connectivity`、`map-overview-review`、`map-asset-registration`、`map-render-performance`、`map-rng-bit-equivalence`、`random-stream-version`。失败5项来自`map-decoration-budget`的CSS暂停/减少动态字符串断言，1项来自`map-travel-path`构造预览期待“2/2”而当前文案为“地点预览”。这些断言读取的CSS/地点预览实现非本轮修改；未修复、未算通过，也未用HEAD隔离重跑证明更早版本状态。

本轮11个JS文件ESLint通过（首次最终清单9个生产/预览文件及2个测试）；新增雾测试单独运行通过。`docs:check -- --json`通过，768个相对链接无发现；`git diff --check`通过。

## 当前窗口实页

平台：Codex内置浏览器；地址`http://localhost:5200/dev/map-exploration-review.html`，复用原5200/PID46172；当前窗口1617×956，未改尺寸。试览调用正式7/9生成器、正式地图绘制器及现有镜头；内存数据隔离，不连接老板存档，不结算真实战斗/交易/奖励。

实际点击检查四层、已知/未知切换；种子25各层探索尽头2/2/6/5，回环0/0/0/1。第二层从入口依次点入两个事件地点，再点入下方宝箱单路尽头，点回事件叉口成功；雾缘随已知区域展开，未知路网不显示。页面错误日志为空。共享开发服务期间有热更新重置试览，最终核心测试完成后重新执行了探索/尽头/返回操作并保存截图。

截图：`layer2-overview.png`、`layer3-overview.png`、`layer4-overview.png`、`layer2-frontier.png`、`dead-end.png`、`returned-to-fork.png`。完整存档跑局、真实战斗后往返和连续拖拽缩放性能未验；未做多尺寸、全量测试或构建。
