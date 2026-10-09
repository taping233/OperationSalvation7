# 照相馆性能专项（2026-09-29 起，持续推进任务）

文档身份：09-29 照相馆专项的过程与测量记录。“当前”“持续”和待办指记录时点；当前任务从[状态入口](STATUS.md)查询，测量方法见[性能文档](performance.md)。

> 任务来源：老板 2026-09-29 拍板「定为持续推进任务，先定计划再执行，直到完成照相馆的卡顿」，并补充「刚点进去也挺卡的」。
> 范围：只动照相馆（卡牌库页）链路。基地其他页、战斗、地图均不碰。不自行提交，改完工作树留待老板验收。

## 一、症状与证据（改前）

| 症状 | 证据 |
|---|---|
| 目录连续滚动卡 | PERF-LEDGER-2026-09-29：`photo-scroll` rAF 中位 **48.4ms（20.5 FPS）**、P95 66.6ms、>20ms 慢帧占比 99.2%、LoAF 47 次最大 78.2ms；滚动沿途挂载 DOM 24→271 张，`scrollHeight` 2094→23083 |
| 刚点进去卡 | 老板主诉；09-24 历史留言「全量渲染 271 张打开冻结 ~1.4s」同域（后已改窗口挂载，但进入时刻从未单独测量）。本任务补「打开耗时」基线 |

## 二、根因（已核代码）

1. **挂载只进不出**：`libMountMore()`（`game.cardslib.page.js:214`）哨兵接近视口追加一批（24 张），从不卸载——滚完全程 271 张「相纸」全在 DOM，绘制/布局面随滚动增大。
2. **每批全量重绑**：`bindLibGridNavigation()`（:273）每挂一批就 `querySelectorAll` 重建整张 `libCardNodeById` Map——满滚动 12 批 × 最多 271 节点，O(n²)。
3. **滚动途中建图/解码叠加**：每批挂载同步走 `bindLibGridNavigation` + `warmLibArt`（图已有 IO 懒加载，但节点插入/布局/绑定仍在滚动风暴中同步发生）。

## 三、方案（改动面）

- `game/src/hub/game.cardslib.page.js`：
  1. **稳定占位网格**：`libGridContentsHTML` 一次性渲染全部 `.lib-item` 空壳（保留 `photoStyle` 落影变量与 `data-i`），滚动高度一次到位（滚动条不再跳）；
  2. **挂载/卸载双向窗口化**：逐壳 IntersectionObserver（rootMargin ≈ 100%），进窗注内容、出窗清回空壳；焦点卡/选中卡/彩蛋进行中不卸载；
  3. **Map 增量维护**：挂载 set / 卸载 delete，废弃全量 `querySelectorAll` 重建；网格级事件委托保留只绑一次；
  4. **`ensureLibMountedIndex`/`switchLibPage` 适配**：壳常在 → 定位先滚壳，聚焦前同步挂单卡；
  5. **jsdom 降级保留**：无 IntersectionObserver 环境一次性全量挂载（现有测试不破）。
- `game/src/hub/game.cardslib.art-warm.js`：仅按需适配（壳卸载后重挂需重新观察新图节点）。
- 进入路径：先测基线数字，再按数字定点（候选：首批挂载挪到首帧后、预览构建时点），**不做没数字支撑的优化**。
- CSS：不动现有规则；空壳如需占位样式只加最小规则。

## 四、验收线（同口径前后对照）

| 指标 | 改前基线 | 通过线 |
|---|---|---|
| `photo-scroll` rAF 中位 | 48.4ms | **≤16.7ms（60 FPS 底线）**，争取 ≤8.3ms |
| `photo-scroll` LoAF 次数 | 47 | ≤5 |
| `photo-catalog`（静止） | 6.1ms | 不劣化 |
| 打开同步渲染耗时 + 打开窗口 LoAF | 本任务补测 | 长帧（>50ms）=0；同步耗时对照基线不劣化或明确改善 |
| 定向测试 | 全绿 | `card-library-lazy-boundary.test.js` 等照相馆相关全绿 |
| 实页功能 | — | 进入/滚完全程/筛选/键盘翻格/选片台/彩蛋/关闭回基不破 |

测量口径：`node scripts/perf-ledger-capture.mjs --only photo --rounds 3 --duration 6000 --wt "D:/素材/代号柒/搜打撤" --out docs/evidence/photolib-perf-task-2026-09-29/<baseline|after>`；打开耗时用独立探针 `docs/evidence/photolib-perf-task-2026-09-29/open-probe.mjs`（DEV + `?photoFps=1` 口径，标题态开门，量同步渲染 ms + 双 rAF 首帧 ms + 打开窗口 LoAF）。

## 五、执行记录（随做随记）

- 2026-09-29 18:00 前后 计划落档；基线采集（本机独显 RTX 3060 无头 Edge，与 09-29 账本核显口径数字略有出入但同量级）：
  - `photo-scroll` rAF 中位 **41.7ms（约 24 FPS）**、P95 69.4ms；`photo-catalog` 6.9ms 健康。
  - 打开探针（`open-baseline.json`）：冷启首帧 391.6ms + LoAF 最大 991.6ms（游戏自带探针 render-sync 121.7ms）；热重开 32~44ms，但**第 2 轮重开尖峰 1285.8ms / LoAF 2016.9ms**（后证实可复现）。
- 2026-09-29 18:15 第一批（page.js）：`libCardNodeById` 增量认领（`claimMountedTiles`/`rebuildLibNodeMap`，废每批 querySelectorAll 全库重扫）+ 批量 24→10 + 预挂 100%→150%。复测（step1/）：34.8ms——方向对但不够。
- 2026-09-29 18:30 第二刀：瓦片高度分布实测（`tile-heights.json`：271 张全距仅 320~323px、行高 340px）→ CVA 占位改吃实测值（`--lib-tile-h`，`syncLibTileIntrinsicSize`）。复测（step2/）：41.8ms——**无效**（占位只作用于已挂载离屏瓦片，未挂载区本就不在 DOM，增长理论不成立；保留该改动因回滚无重排仍有收益）。
- 2026-09-29 19:00 归因五连测（DEV 门 `?libPerfDiag=*` + 账本同口径，diag-*/ 证据目录）：

  | 变体 | photo-scroll rAF 中位 |
  |---|---:|
  | 去图片滤镜 nofilter | 41.7ms（不动） |
  | 去相纸落影 noshadow | 34.8~41.7ms（边缘） |
  | 去纸纹/反光罩层 nooverlay | 41.6ms（不动） |
  | **连缩略图都不画 noimg** | 41.7~48.7ms（**仍不动**） |
  | **瓦片 will-change:transform alllayer** | **6.9~7.0ms（满帧率）** |

  结论：滚动卡=「每帧新露出条带整体重栅格化」，与具体绘制层无关；瓦片合成层化后滚动变纯合成。
- 2026-09-29 19:05 第三刀（expedition-library.css）：`.lib-item` 加 `will-change:transform`（09-23 拍板的 3D 侧倾已删，此 hint 无视觉影响）。
- 2026-09-29 19:10 **最终复测（final/）：`photo-scroll` rAF 中位 41.7→6.9ms（P95 7.1），`photo-catalog` 6.9ms 不劣化，堆内存持平 ~12.8MiB。滚动达标（验收线 ≤16.7ms，争取线 ≤8.3ms 双过）。**
- 2026-09-29 19:17 打开复测（`open-final.json`）：冷启首帧 519ms/LoAF 655ms、render-sync 127.9ms（与基线同量级——冷启大头是 dev 模式模块瀑布，产物构建不存在此项；render-sync ~120ms 是真实代码成本）；**热重开第 2 轮尖峰复现（1632ms/LoAF 1478ms），3-5 轮 31~33ms**。
- 2026-09-29 19:30 重入尖峰归因实验（`reopen-exp.mjs`）：对照组确认尖峰固定落在首次重开（1790ms），其后 34~41ms——一次性工作（疑似首轮垃圾 GC/模块释放）砸进重开窗口；处理组实验因 Edge 全新档案推广页噪音（edge://sync 与 tampermonkey.net 随机插入目标列表，**非游戏行为**，已核实游戏源码无任何外跳）未能完成，留下一班。
- 2026-09-29 19:40 实页截图验收（snap-top/bottom.png）：顶部/滚底布局、落影、题注、深位瓦片渲染全部正常；36 项照相馆定向测试全绿（boot/lazy-boundary/photo-notes/presentation/zoom-lifecycle）。

## 六、最终改动清单（工作树未提交，等老板验收）

> 改动基线 9114001；当前 master 2bcfc23（并行会话在我施工期间落的三笔 docs 提交 0bac1f3/643434f/2bcfc23，与本次两文件改动无交集，且已在 PARALLEL-REGISTRY 登记本两文件在途）。

- `game/src/hub/game.cardslib.page.js`（+74/-6）：① `?libPerfDiag` DEV 诊断钩子；② `LIB_MOUNT_BATCH` 24→10；③ 哨兵 rootMargin 100%→150%；④ `claimMountedTiles`/`rebuildLibNodeMap` Map 增量维护（`bindLibGridNavigation` 只留事件委托）；⑤ `syncLibTileIntrinsicSize` 喂 CVA 占位。
- `game/css/expedition-library.css`（+9/-1）：`.lib-item` `contain-intrinsic-size` 改 `var(--lib-tile-h, 270px)` + `will-change:transform`（注释带归因数据）。
- 新增证据与探针（docs/evidence/photolib-perf-task-2026-09-29/，含失败探针的日志一并保留）：baseline/ step1/ step2/ diag-×5/ final/ 八组账本数据、open-baseline/open-final.json、tile-heights.json、snap-top/bottom.png、五个探针脚本（open-probe/tile-height-probe/scroll-ab/scroll-ab2/reopen-exp/snap）、过程日志。
- 新增任务文档：本文档。

## 七、遗留与下一步

1. **重入尖峰（下一班主线）**：开→关→再开的第一次重开 1.3~1.8s 冻结，可复现，疑似首轮垃圾 GC/模块释放；`reopen-exp.mjs` 处理组实验（关后清空弹层子树）待补，若证实则 closeLibPage 释放网格 DOM 是候选修法。二期壳常驻重构后需重测。
2. **冷启打开（dev 口径）**：大头是 dev 模式动态 import 模块瀑布（产物构建不存在）；真实代码成本 render-sync ~120ms。产物口径测量待工作区干净（并行会话在途改动多，不能 build）。
3. `?libPerfDiag` 诊断钩子按 `?photoFps` 先例做成 DEV 门（生产零开销）；拍板项已登记 PENDING #9。
4. **二期遗留**：hover→预览重建链（UI._hoverHandler 90ms 去抖后仍整块 innerHTML 重建）真实贡献未量化——合成事件测不到 ：hover 与 data-card 命中，需 CDP 真实鼠标路径补测（`trace-probe.mjs` 骨架已备）。

---

## 八、二期：老板实测仍卡 → 真实口径归因与壳常驻重构（2026-09-29 晚）

### 8.1 老板验收环境发现的干扰（重要）

- 老板在 **8138（我起的工作树源码服）** 上实测后反馈「还是不行」。查 8138 服务器日志：20:05-20:06 **并行会话正在改游戏源码**（renderer.icons.js 317 行大改 + agent/battle/boot/home/run 共 7 文件），每次保存都对老板页面整页刷新——**验收环境被并行改动实时污染**，且页面混合了对方半成品图标系统。
- 处置：从 2bcfc23 建隔离 worktree `.photolib-acc`，只叠加本次专项两个文件，junction node_modules，起**隔离验收服 8137**（独立 cacheDir，不与任何会话并发写）。8138 保留但不再作验收用。

### 8.2 真实口径测量（此前所有数字都是「程序化线性滚动、零鼠标事件」口径）

| 口径 | rAF 中位 / P95 | LoAF |
|---|---|---|
| 无头线性（账本口径，一期已修） | 6.9 / 7.1ms | 0 |
| **有头+鼠标+步进（一期修复后，8138 混合树）** | **17.8 / 56.9ms** | **18 个，最大 1328ms**，renderTime/styleLayout 全 0、脚本仅 ~20ms=浏览器内部工作（栅格化背压签名） |

结论：真人体感卡与无头账本是两个世界；`will-change` 全量层化 271 瓦片在真实环境（Electron/核显/系统缩放 1.5）打爆层预算，合成器退化回逐帧重栅格化。

### 8.3 二期重构：壳常驻 + IO 双向窗口化（`game.cardslib.page.js` + `expedition-library.css`）

- `libGridContentsHTML` 一次性渲染全部 **占位壳**（`.lib-item.lib-ph`，等高 `--lib-tile-h` 实测值），滚动高度一次到位；首批 15 张内联直挂。
- `observeLibTiles`：逐壳 IntersectionObserver（root=grid，rootMargin 100%），进窗 `mountLibTile` 注入卡面、出窗 `unmountLibTile` 卸回壳；焦点/选中/悬停/彩蛋进行中不卸。
- 合成层只给已挂载瓦片：CSS `will-change` 移到 `.lib-item:not(.lib-ph)`——层数有界（几十），不再 271 全量。
- 定位改壳滚动：`switchLibPage` 滚壳（IO 就近挂载）、键盘聚焦 `ensureLibTileMounted` 同步挂单卡；哨兵/`libMountMore`/`libMountedCount` 全退场；jsdom 降级（无 IO）仍一次性全量，现有测试不破。
- 效果（有头+鼠标+步进 12s，8137 隔离服）：**LoAF 18→0、长任务 13→0、P95 56.9→32.2ms（=驱动节拍底噪，无真实停顿尾）**；无头步进复核挂载窗口正确（34 张随滚回收，`io-debug.mjs` 两次行为级验证）。
- 回归：语法过、照相馆 36 项定向测试全绿。

### 8.4 二期遗留

- 有头探针窗（遮挡/后台态）会出现 IO 饿死假象（`mounted=15` 不增长），前台可见窗口不受影响；老板实机为最终裁判。
- 本机 Edge 环境偶发把目标页导航到 tampermonkey.net（游戏源码零外跳已核实，纯环境怪癖），导致部分探针轮次报废，重试即过。

### 8.5 三期：点击放大卡顿定罪与修复（2026-09-29 晚，老板第三轮反馈后）

- 老板第三轮症状：点击照片放大卡、滑动卡、打开卡。其时浏览器仍停在 8138（被并行刷新的混合树）——二期修复他尚未体验到。
- 处置①：8138 工作树服下线，同端口改起 **.photolib-acc 纯净隔离版**，老板原标签页刷新即得二/三期修复；因 vite 在本会话进程环境里会静默退场，加 **守护拉起**（`serve-8138.mjs`，STOP 文件停止）。
- 处置②（点击放大定罪）：`zoom-ab.mjs` A/B——真实点击第 5 张照片放大 2s 采样：
  - 带全屏毛玻璃（`winter.css` `#cardZoom .cz-backdrop` 的 `backdrop-filter:blur(9px)`）：**LoAF 10 个 / 最大 973.4ms / 帧 P95 774.9ms**
  - 去 blur：**LoAF 2 / 54.8ms / P95 7.1ms**
- 修复：`winter.css:549` 去毛玻璃，暗幕保留并加深补偿（.66→.78），注释带数据与回归条件。照相馆页本体在 expedition-library.css:676 早已强制 opaque 无 blur，滚动不吃此税；此税只在点击放大时收。
- 探针环境怪癖升级记录：Edge 会随探针开 tampermonkey.net 标签页，CDP 找目标必须过滤 `http://localhost` 前缀；夜间探针 rAF 产出间歇饿死（headless 也出现），复测以多次重试+行为级验证为准。

### 8.6 三期遗留

- 「打开卡」未再拆：render-sync ~128ms 是真实代码成本（dev 口径另有模块瀑布）；重入尖峰（1.3~1.8s）二期重构后未重测——两者留待老板 8138 实测反馈后定去留。
- hover→选片台预览整块重建链仍未量化（需 CDP 真实鼠标，trace-probe 骨架已备）。

---

## 九、帧率评估复核（2026-09-29 深夜，老板要求数据交底）

老板要求评估帧率；外部 Edge 探针跑完后，老板指示「不要开外部浏览器」，剩余测量改 ZCode 内置浏览器（IAB 1280×720，仍打 8137 隔离服）。原始数据：`docs/evidence/photolib-perf-task-2026-09-29/eval-0929-night/`（iab-measure.json + ledger/）。

| 口径 | rAF 中位 / P95 | LoAF | 要点 |
|---|---|---|---|
| 无头账本（5330 自起隔离服） | 滚动 7 / 13.9ms，静止 6.9 / 7.1ms | 0 | 达标线 ≤16.7ms 维持 |
| IAB 滚动全程（步进+合成 hover，滚到底） | 17 / 26.5ms，max 132 | 3 个全 render=0（合成器侧，脚本 0 贡献） | 滚到底仅挂 30 张，窗口化健康 |
| IAB 静止 / 热重开 | 7 / 7.2ms；重开首帧 52~63ms | 0 | 壳常驻生效 |
| 外部 Edge 有头+合成鼠标 | 17.3 / 29.8ms | 10 个 max 675ms（合成器侧） | 轮次方差大；旧 mouse1/mouse0 原始 JSON 被本轮覆盖（数字留底本档 8.2/8.3） |
| 外部 CDP 真实输入（trusted） | 7 / 34.9ms，max 159.8 | — | **真 hover 链 8s 触发 44 次预览重建**（合成事件口径测不到的那段）；timeline 归因未采到（trace-probe 骨架缺口） |

结论：滚动帧率达标（60Hz 节拍满帧，长停顿全程仅 3 次且非脚本）；「刚点进去」残余=首次开门异步初始化 ~150ms LoAF（同步段≈0，网格构建在开门后头几帧完成）；历史重开尖峰本轮未复现（不作根治宣布）。剩余嫌疑收敛：①真 hover 预览重建链（44 次/8s，未归因）；②合成器侧偶发栅格化停顿。

---

## 十、三期：120 帧目标施工（2026-09-29 深夜起，老板拍板「我要120帧」+「一步一步进行」）

目标线：滚动与真实悬停扫过 rAF P95 ≤ 8.3ms（120Hz 预算）。刀序：①CSS 消歧+hover 裁剪延迟 → ②setLibSelection O(1) → ③选片台预览增量更新（先测剩余压力定深度）→ ④warmLibArt 零回扫；每刀独立可验。

### 代码评估对九节的修正（重要）

- `.lib-item` 的 transition/hover 规则**不止 expedition-library.css**：`page-cardslib.css:169`（09-28 三方体验夜班 T1a 切片）`transition: transform var(--lib-lift)!important` 与 expedition-library 同特异性且**文件序在后恒赢**——非 hover 态 transition 真源在 T1a。`.lib-item:hover` 全项目唯一在 expedition-library.css。此前 CSS 评估只扫单文件属遗漏，已修正。
- `unmountLibTile` 的 `:hover` 保护（page.js:269）+ CSS `:hover` 均为即时态；JS 预览有 90ms 去抖而 CSS 裁剪开关无延迟——扫过时每格一次「开裁剪→关裁剪」重栅格化，这是真 hover 链的 CSS 侧成本。

### 第一刀（已完成 09-29 深夜）：CSS 消歧 + hover 裁剪延迟开关

改动（仅 `game/css/expedition-library.css`，主树与 .photolib-acc 隔离树已同步一致）：

1. 删 `contain-intrinsic-size:auto 344px`（原 :27，恒输旧声明）与 `auto 300px!important`（原 :208，恒压二期 `--lib-tile-h` 实测占位——二期二刀意图本次才真正生效）；占位统一走 `var(--lib-tile-h)`（实测 321px）。
2. 删 `transition:transform .26s!important`（原 :209）与 photo-studio-v3 块内 transition 声明（原 :563）——恒输给 page-cardslib.css T1a，改注释指路。
3. 删恒输 hover 规则 `z-index:4 / translateY(-3px)`（原 :570-573，特异性输给 .card-library-page 口径的 z:5!important / -9px!important）与死规则 `.lib-mount-sentinel`（原 :575，二期哨兵已退场）。
4. **hover 裁剪延迟开关**（:219 hover 规则）：`content-visibility` 的放开改走离散 transition delay 0.12s——滚动扫过（每格停留 <120ms）不再反复开关 paint 裁剪，只有停留悬停才放开辉光；移开即收回（非 hover 态无 cv 过渡声明=离散立即翻转）。与 JS 预览 90ms 去抖同一语义。Chromium 105+ 支持；不支持环境退化为旧行为（立即放开）。

验证：照相馆定向 22 项全绿（lazy-boundary/photo-notes/presentation/zoom-lifecycle）；IAB 真实鼠标（cua）实测——hover 态 computed `transition: transform 0s, content-visibility 0.12s`、cv=visible、z=5、translateY(-9px)，移开 cv=auto 立即收回；悬停辉光/抬升/黄铜夹/选片台联动截图完好；`--lib-tile-h=321px` 已生效，滚动注入正常。「快速掠过不放开裁剪」的行为级验证受 IAB 指令 RPC 延迟（>120ms）限制无法直接观测，留统一验收以帧采样结果验证（delay 0.12s 的 computed 规则在案，离散 delay 为标准行为）。

**测量坑（复测必读）**：8137 服务的是 `.photolib-acc` worktree 副本——主树改动必须 `cp` 同步过去；且页面 `<link>` 吃磁盘缓存，须 `link.href += '?cb=' + Date.now()` cache-bust（或硬刷新）后 computed 才见新值。本次曾因此误判「改动无效」一轮。

### 第二刀（已完成 09-29 深夜）：setLibSelection O(1) 化

改动（`game/src/hub/game.cardslib.page.js`，两树已同步）：新增模块级 `_prevSelectedWrap` 缓存上一个选中卡面节点，换选清态不再做 2 次全网格 `querySelector`；`isConnected` 兜底整页/整格 innerHTML 重建后的失效节点（重建后新选中态由壳/瓦片模板自带）；`closeLibPage` 同步清缓存。

验证：22 项定向测试全绿；IAB 实测——hover 依次换选 3 张卡（选片台 pos 1/271→2/271→3/271 同步）、任意时刻 `aria-current="true"` 与 `.lib-item.selected` 恒各 1 个（4 次 hover 往返 + 键盘方向键路径）、切页签筛选往返后选中保持正确。

### 三/四刀裁决（09-29 深夜）：实测无数字支撑，不做

按「不做没数字支撑的优化」铁律，两刀施工前先做 IAB 真实鼠标（cua trusted 输入）压力测量（eval-0929-night/ 过程在本节，采样器 `window.__hp` 口径）：

| 场景（IAB 1280×720 前台） | rAF 中位 / P95 | LoAF | 预览重建 |
|---|---|---|---|
| 静止目录 | 7 / 7.2ms | 0 | — |
| 定点悬停扫动（4 卡×350ms 循环 12s，最重路径） | **6.9 / 7.1ms** | **0** | 32 次 |
| 滚动+悬停组合（真实滚轮 12s，滚 8300px） | 7 / 27.8ms（P99 48.6，max 76.5） | 3 个 51~61ms **scripts 全空** | 19 次 |

裁决依据：①悬停扫动 32 次预览重建全程 med 6.9/零 LoAF——一、二刀落地后 hover 链已不破帧，第三刀（预览增量更新）失去数字支撑，**不做**；②滚动+悬停的 P95 27.8ms 与纯滚动底噪（第九节 IAB 纯滚动 P95 26.5）同量级且长帧全部 render/scripts 空（合成器侧栅格化），第四刀 warmLibArt（脚本侧）同样无证据，**不做**；③剩余滚动 P95 是「视觉成本 × 层预算」的结构性权衡（一期归因五连测已证代码侧无可动，全量层化真机会打爆层预算），若老板要继续压该数字，走视觉拍板（减投影层数/blur），不走代码刀。

回归确认：无头账本终测（ledger-after-p3/）photo-scroll 中位 7ms、LT 0、堆 12.7MiB 稳定；22 项定向测试全绿；主树与 .photolib-acc 两树两文件已同步一致。**三期实际落地=第一刀+第二刀，工作树等老板 8137 实机验收。**

验收环境补充：IAB 面板被遮挡时 rAF 全停（测量全零假象），帧率测量须面板前台可见；被遮挡判定可用「800ms 帧计数 <20」快速识别。

### ✅ 老板实机验收通过（2026-09-29 深夜）

老板在 8137 实机验收，反馈原话「好神奇，真的不卡了」——三期两刀（CSS 消歧+裁剪延迟 / setLibSelection O(1)）连同二期壳常驻一并验收通过。改动仍压树未提交，落库等老板明确指示。
