# 地图风雪与城市意象

当前接入：老板选定抽象A冷蓝残影，追加“不用测试”。`city-ghost-props-a-1012.webp`作为四道具透明图集接入；原几何城市层已改为原画采样，四象限以26%透明度烘焙于地图外围，图集就绪时失效背景缓存；既有风雪保留。本轮按老板要求未测试、未实页验收、未build或提交，无新服务。来源、编码与SHA见[接入回执](install-a-receipt.json)。以下选稿和初版验证为历史。

最新选稿：老板进一步要求模糊、隐约、抽象，带少量光效；前三套细节过多。已内置生成新A冷蓝残影/B暖光薄雾/C最淡城市印象，全部已看；按工具展示顺序为A、C、B。仅透明独立装饰候选，未接入；原图路径与提示词见[新版请求](abstract-props-request.json)及[新版结果](abstract-props-results.json)，透明度/尺寸/SHA见[新版回执](abstract-props-receipt.json)。

最新状态：老板否决下面的初版代码城市轮廓，明确改用内置生图、独立道具，先多版选稿。已生成A城市设施/B废弃交通/C未来装置三套，每套四个分隔道具；仅候选展示，未接入。三图RGBA均含透明区域，A有较大外围光晕，选定后需收敛；B/C边缘干净。原图留在Codex生成目录，均超过1MB，不进git；路径、SHA与获取方式见[请求](prop-candidates-request.json)及[回执](prop-candidates-receipt.json)。以下检查只覆盖被否决初版，不代表美术通过。

老板要求地图加少量风雪与城市意象。保留现有未提交地图样式，在背景缓存中加入两侧模块楼群、屋顶积雪、高架、路灯与自动设施；稀疏斜向飘雪、低处雪雾由独立CSS叠层播放，中央路线和节点保持清楚。

## 验证

- 新模块与renderer语法通过；新增模块ESLint、地图CSS解析、自有diff空白检查通过。
- contracts / architecture-boundaries：2文件37项通过（2026-10-12 18:13，Vitest3.2.7）。
- renderer整体ESLint有4项已有错误：rrect、COLORS、setDash、标签局部walked未使用；本轮只新增import与背景调用，没有修改这些声明。
- Codex内置浏览器当前窗口1606×956、DPR1.25，复用localhost:5200；真实点击首页进入城市→继续档位05，仅观察入口地图，未移动节点。楼群、高架和飘雪已可见，节点文字清楚。两次只读采样的snow/haze矩阵变化，确认动画运行；pointer-events为none。当前标签页console error/warn为0。
- [当前窗口截图](current-window.png)、[风雪状态](browser-state.json)、[第二次动画采样](animation-second-sample.json)、[标准DOM采集](browser-export.json)。截图来源为cua内置浏览器，schema导入只核对格式，不替代来源与真实输入证据。

减少动态停播、其他层与房间隐藏为静态代码检查，未实走这些分支；未做多尺寸、全量、build或性能测量。复用既有服务，无新后台进程。完成未提交。
