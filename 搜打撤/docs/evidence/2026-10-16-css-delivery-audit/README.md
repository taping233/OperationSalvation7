# CSS 发布与首屏加载只读审查

## 结论与建议

**首选先把入口 CSS 最后的基地/出征连续尾段改成真正按入口加载，所有声明、选择器、图片和字体保留，并固定它原来的级联槽位。** 基地入口和直接选角入口共同等待同一份 CSS；共享卡面、卡牌浏览器、放大详情、标题及加载幕继续保持现状。不要仅把 CSS import 移到 lazy runtime 后就算完成。

保留的 R3 生产产物可精确映射这段源码：16 个源文件中 15 个有规则，1 个只有注释。静态拆分模拟使入口 CSS gzip **161,030 → 136,279 字节，即 157.3 → 133.1 KiB，减少 24.2 KiB（15.4%）**。这一段只需 1 个保序的延迟 CSS 槽，不必先拆冬日全局皮肤。

**这项建议解决首屏交付，不解决现行总 CSS 预算。** 原门禁统计全部发布 CSS，含尚未请求的异步样式。保留 R3 构建基线总量 200,290 字节（195.6 KiB），门限 139,264 字节（136 KiB），相差 61,026 字节（59.6 KiB）。首选方案静态模拟的总量反而增加约 1,072 字节，因此不得报告预算通过，不应改变预算或把样式藏进 JS 来变更统计口径。

本轮仅审查并写入本证据目录；未改源码、测试、配置、预算、共享台账或已有未提交改动，未启动服务/浏览器、未运行 Vite build、未提交。

## 证据与重现

- 已逐个核对当前源码与保留 R3 快照的 98 个相关 CSS/入口/管线文件。审查中 battle-stage.css 出现并发变更，最新为 97 个一致、1 个不一致；首选尾段 16 个文件和基地整组仍全部一致。见 [measurements.json](measurements.json) 的 fingerprints / fingerprintMismatches
- 保留产物来自既有 R3 构建，不是本轮重新构建；位置、各文件 SHA、gzip 与 Node/Vite/esbuild 版本均在测量 JSON 中
- [measure.mjs](measure.mjs) 用项目现有 Acorn 架构图解析静态/动态 import，展开 CSS 的真实 @import，在内存使用当前 esbuild 压缩；不调用 Vite 构建钩子
- 对候选源文件压缩后按完整顶层规则序列匹配真实入口产物，仅规范化 Vite 改写后的 url()，不依靠类名使用频次猜测死样式。首选 16 个文件均匹配成功（注释文件是 0 规则）
- 产物区间使用 PostCSS 的半开 offset，拆后每段重新解析，重组字串与原产物完全一致；再次压缩完整原产物也逐字与原产物相同
- 所有体积用 Node gzipSync 的实际字节计算。对多槽位方案，分别压缩各个首屏片段后求和，不能把非相邻片段拼成一个虚构首屏包来夸大收益

在项目目录重现（只重写本证据目录的测量文件）：

```sh
PATH=/workspace/shared/toolchains/node-v22.23.3-linux-x64/bin:$PATH \
  node docs/evidence/2026-10-16-css-delivery-audit/measure.mjs \
  > docs/evidence/2026-10-16-css-delivery-audit/measurement-summary.json
```

这是确定性静态交付模拟。资源 hash、真实 Vite 分块、HTML 预载与 CSS 请求时序须在获准实施后正常构建及内置浏览器复核；本报告不声称视觉或运行时验收通过。

## R3 发布基线与当前加载架构

1. game/index.html:15–56 挂载 **40 份同步 stylesheet**。Vite 将它们与启动 JS 静态图中的样式并入一个入口 CSS；R3 只有 1 个 HTML CSS 请求，但 gzip 157.3 KiB，解析全部页面规则
2. 4 个 HTML 模块入口合起来有 199 个初始静态源码模块、352 个包含动态叶页的源码模块。初始图加 HTML 共 74 个直接 CSS 入口；真实 @import 另外包括 ui-scale.css → title-p0.css、base-camp.css → base-camp-roster.css
3. game.hub.js:7–28 明确保留 **21 个 eager CSS import**，JS 才由第 39 行动态加载 runtime。相同路径被 runtime/叶模块重复 import 仍由 Vite 去重，不能把重复源码 import 次数当成发布重复字节
4. 现有真正 CSS code splitting 已生效：battle-hand-overhaul、菜单页、照相馆、home.scene 分别随动态 JS 加载。Vite 配置没有关闭 cssCodeSplit；其余现象是静态依赖仍可达，不是分块开关失效
5. title-credits 的静态链，以及 overlay.js → motion-transitions，还通过 new URL(...css, import.meta.url) 在运行时注入 5 个 stylesheet。它们在启动即执行，实际约 **12,316 字节 / 12.0 KiB gzip**。所以 HTML 中的单一 CSS 文件不是完整启动 CSS 网络负载
6. vite.config.js 使用 publicDir:false，复制钩子只复制指定动态资产族，不是把整个 css 目录无差别复制到产品。无需清理未进入发布图的 CSS 来改善当前产物
7. scripts/css-asset-minification.mjs 已处理 new URL 样式的空白压缩，尊重 sourcemap、cssMinify:false 和许可证注释；普通入口 CSS 已经压缩。再加一个普通 minify 开关不是主要空间来源

### 保留 R3 的 10 个发布 CSS

| 产物角色 | gzip 字节 | 是否启动即请求 |
| --- | ---: | --- |
| index | 161,030 | HTML 同步 |
| home-polish | 6,599 | 启动注入 |
| home-layers | 1,771 | 启动注入 |
| home-menu-motion | 973 | 启动注入 |
| interface-motion | 971 | 启动注入 |
| motion-transitions | 2,002 | 启动注入 |
| game.menu | 9,387 | 菜单叶页入口 |
| game.cardslib | 13,367 | 照相馆/制作坊入口 |
| battle | 2,217 | 战斗域入口 |
| home | 1,973 | 基地 home.scene 入口 |
| **全部** | **200,290** | 现行门禁全部计入 |

检查每个产物内同条件、完整文本相同的整条规则，重复数为 0；重复整文件 SHA 也不存在。不同选择器或不同值的重复属性并不等于可删除。本轮不把后写覆盖、兼容回退或跨页共用样式当死代码；此前清退报告的机械去重空间也远小于总预算缺口。

## 首屏必需与非首屏边界

### 先保留的启动层

- base.css 的字体、tokens、全局布局/控件；overlays 的基础可见性/遮罩；ui-scale 连带 title-p0 的横屏与标题规则
- winter.css、expedition.css、ak-skin.css 混有全局变量、通用控件和标题覆盖，expedition.css 直接修饰 #title 与字标。不能按文件名整体推迟
- title-credits / home-linked-interactions / 标题装饰及动效 / page-loading / page-visual-ready 等已有立即可用交互与加载视觉
- card-layout-selected.css、cards.css、card-browser.css、inventory-zoom.css 等跨页共用正本。首选不增加它们的消费者协调成本

### 适合现有门面按需加载的域

- 基地、整备、人物、后勤、收藏/设施：已有 game.hub.js 的 request/token/slot 检验、取消、异常重试与 runPageLoading，可加入 CSS readiness
- 直接人物选择：game.run.class-choice.js 也是异步门面。roster-reference.css 的规则适用于普通 .cls2-page，不仅基地出征；必须共同等待，不能只在 hub 加载时处理
- 选档/设置/数据页/成就：已有 game.menu.js → game.menu.pages.js 门面，但现行部分页面皮肤仍在 HTML，可列下一批。game.menu.pages 自有 CSS 已异步，需防双重发布
- 战斗：battle-loader 有 ensureBattleReady；但 battle.css 自身包含战斗入场失败提示及可操作回退，挪动时须保留加载/失败覆盖。当前 battle-hand-overhaul 已异步
- 事件/地图/奖励/背包：当前同步业务路径多、共享规则广，需要先列入口和读档恢复边界，不适合本轮按名称批量搬运

## 首选实施设计（待批准）

### 1. 只拆连续尾段，源文件原样保留

按当前产物顺序建 1 份受 Vite 管线处理的 CSS 聚合入口：

1. base-reward-feedback.css
2. base-collection-v4.css
3. base-courtyard-v3.css
4. base-panel-layout.css（只有注释，保留文件）
5. base-cohesion-v5.css
6. base-framework-v7.css
7. base-rooms-v7.css
8. base-personnel-v12.css
9. base-logistics-trade-v12.css
10. base-archive-facilities-v12.css
11. base-page-motion-v7.css
12. base-home-v7.css
13. departure-selected.css
14. roster-reference.css
15. base-shop-v3.css
16. base-archive-v3.css

真实入口产物中有规则部分是连续半开字符区间 [718774, 913582)，原 CSS 194,812 字节。聚合可用 @import 按上述顺序原样展开；通过 CSS ?url 取得生产哈希 URL，并由统一 loader 按需挂 link。已查安装的 Vite 6.4.4：CSS ?url 走 transform-only、CSS URL 重写及 finalizeCss，不是读取原文后绕开资源处理。不要用未经 CSS 变换的 raw asset 或把 CSS 字串装入 JS 代替外部 CSS。

同一规则源不再同时作为普通副作用 import 发布：需要调整 game.hub.js 及 runtime/叶模块中这 16 个文件的重复 import。独立开发预览若使用它们，保留预览自己的样式入口；不要为了清除游戏重复发布而破坏预览。

### 2. 固定原顺序槽位

生产顺序必须是：原 eager 入口 CSS → 新的基地尾段 CSS → 既有运行时动效 CSS / 后续异步页面 CSS。

单纯让 Vite 动态 import 自动 append 会把基地样式插到 home/interface/motion 等运行时覆盖之后，改变级联。应在 startup stylesheet 尾部预留固定槽位，loader 在该槽位插入 link，不随请求完成顺序排列。dev 与 production 都须显式验证同样的相对覆盖关系；不得只验证一边。此处可能需要小型 HTML/CSS-order 构建辅助，应纳入获批改动范围。

### 3. 只在用户入口等待

- 在 hub 与 class-choice 两个轻门面发起 CSS 和 JS 的并行准备，两者成功后重新核验原 token/slot/context，再挂目的页
- 热入口复用完成的 CSS，不加新定时等待，不做标题 idle 预取；runtime 内部同步 redraw 的契约保持不变
- CSS link.onerror / 超时进入现有失败路径，来源按钮、存档、选档、aria-busy 和可重试状态保持；失败清缓存，使下一次点击能重新请求
- 消费者取消不移除其他消费者正在用的共享 link，也不能由旧请求 finally 清掉新请求；CSS 迟到完成只填槽位，不自行触发页面挂载
- 通过 CSS 资源路径保留图片/字体 hash、相对路径、版本参数与 Electron file 协议兼容

### 4. 不改变总 CSS 门禁

正常构建仍用原 perf-budget。可以额外输出“HTML 入口 CSS / 启动注入 CSS / 按需 CSS”诊断，不能用首屏统计替换全部 CSS 检查。相对 R3 基线，预计总 CSS gzip 从 195.6 增至约 196.6 KiB，继续如实报告失败；真正总量收敛需要另行获得现行样式整合授权与视觉证据。

## 可复核的后续选项及代价

下表相对保留 R3 产物，按原级联顺序切成固定槽位，首屏片段分别 gzip 后求和；不包含新 loader JS 和 HTML 标签开销。原入口是 161,030 字节。首选/基地/菜单候选源文件与该产物一致。battle-stage.css 的并发变化使战斗及联合选项失去当前源码闭合证据，因此不列其收益承诺；最新完整构建总量未知。

| 候选 | 首屏 CSS gzip | 首屏减少 | 延迟槽位 | 全 CSS gzip 预计增加 |
| --- | ---: | ---: | ---: | ---: |
| **首选：连续基地尾段** | **136,279 B / 133.1 KiB** | **24,751 B / 24.2 KiB** | **1** | **1,072 B / 1.0 KiB** |
| 基地/选角整组，保留 card-browser / inventory-zoom 共用正本 | 121,024 B / 118.2 KiB | 40,006 B / 39.1 KiB | 3 | 3,727 B / 3.6 KiB |
| 单独 HTML 菜单皮肤四份 | 153,288 B / 149.7 KiB | 7,742 B / 7.6 KiB | 1 | 1,784 B / 1.7 KiB |

多槽位方案也要拆首屏片段，压缩字典损失明显。例如基地/选角整组若把所有剩余规则虚构合并成一个包，会显示约 40.3 KiB 收益；真正保留 3 个首屏片段的原插入位置只能得到约 39.1 KiB。故不建议一开始追求最大拆分清单或每页每文件一个请求。

## 必补测试与验收

1. **CSS loader 单测**：标题等待/空闲不发 CSS 请求；并发入口同 promise/同 link；成功后热复用；CSS 单独失败及超时可重试；取消/换档/回标题/新导航时迟到 CSS 不挂旧页面；旧 finally 不清新 busy；取消一个消费者不影响另一个
2. **顺序及发布契约**：原 eager + deferred 全部规则在固定槽位连接后与基线有序规则等价；selector、声明顺序、important、@media、@supports、关键帧、字体及资源 URL 保留；游戏产物中目标规则只发布一次；新增 CSS ?url 经过真实 Vite 的 minify/@import/url/version 管线；无二次原始 CSS 副本
3. **更新现有约束而非绕开**：tests/hub-lazy-entry.test.js:251–256 当前明确要求 base-personnel-v12.css eager import。这是旧“只延迟 JS”决定的守卫，实施时应替换为等待 CSS 且保序的新契约，保留所有请求/取消/失败断言。新测试不能仅断言删掉 import
4. **定向回归**：hub-lazy-entry、departure-selection-state、e4-async-entry、hub-flow-regression、menu-pages-lazy-entry、base-departure、card-face-presentation、card-reading-typography、backpack-layout、base-subpage-header-readability、hub-personnel-portrait、css-dead-dom-budget、css-asset-minification、contracts、architecture-boundaries。若修改 Vite 配置/公共启动边界，按既有 acceptance-gate 规则升级检查，不自行豁免
5. **内置浏览器，原窗口**：冷启动标题及壁纸/制作名单/立即切设置；标题→选档→基地→各大子页→整备→选角→卡池→卡牌详情→返回；直接无基地新局选角；终局回基地；hub→照相馆→设置快速切换；模拟 CSS 失败/慢到/取消/重试；reduce-motion。分别比较首帧、完成态截图与关键 computed style，确认没有 FOUC、字号/位置/滚动/焦点/动效变化
6. **独立正常生产构建**：获准后由父任务按混树约束在隔离快照执行，验证全部源码检查、当前总预算及实际 CSS 分块。实际网络证据应区分“标题可见时收到的 CSS”和“HTML 预载清单”，并确认新尾段在标题停留时没有被 modulepreload、JS 静态 CSS 边或其他入口提前请求

## 本轮已执行与未执行

已执行：AGENTS/QUICKSTART/WORKFLOW/quality-gates 读取；限定路径 handoff；现行源码、测试和安装 Vite 实现只读核对；98 个输入 SHA 对照（已明确 1 个并发变化）；完整 CSS 产物重压缩同字节验证；候选完整规则映射与有序区间重组验证；测量脚本语法及本目录检查，见 [checks.json](checks.json)。

未执行：游戏测试、全量测试、正常构建、浏览器、服务、开发或生产网络时序/视觉验证。没有把模拟收益写成已发布效果。待批准后才实施。
