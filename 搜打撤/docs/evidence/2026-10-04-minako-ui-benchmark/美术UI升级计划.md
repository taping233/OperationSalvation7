# 美术 UI 升级计划——以《米娜可：孤注一掷》PV 为基准

> 2026-10-04 Friday 拆解并撰写；**同日修订 v3：新增附录 A《全界面清单与逐页改动映射》（32 界面全覆盖）与附录 B《开合动画五档参数表》，批次补逐页落点与前置协调（WF-photolib-perf）**。v2 变更：D13 首页排版重做 + D9-T4 全界面开合 + §2A 布局构图原则。证据帧见本目录 `frames/`（清单与局限见 `README.md`）。
> 待老板拍板后按批次实施；拍板项汇总在 §8 / PENDING #37。

## 0. 结论速览

米娜可 PV 的「好看」= 三层叠加：**漫画波普 UI 皮 + 等距纸模型场景 + 标准 tween 动效库**。其中与《代号柒》兼容、值得抄的是**手法层**（转场三件套、通讯演出、分段进度条、贴纸语汇、stagger 节奏、**非对称左轴排版**），全部可在现有 HTML/CSS/JS + token 体系内落地，不动战斗域、不推翻冷青+暖金定稿。总量预估 P0-A+P0-B+P1 约 700 行 CSS + 200 行 JS。**不建议抄**：波普撞色整体配色、等距城市资产、卡牌本体、高频帧闪。

## 1. 背景与范围

- 基准：BV1PL3c6gEKF（52s，结构：0-2s 标题帧闪 → 2.5-5.9s 截图卡轮播 → 5.9-22.8s **一镜到底 17s UI 演出**（聊天→面板→加载，无硬切）→ 22.8-28.4s **5.6s 内 12 刀快切** → 28.4-52s 经营实录+蓝图建造+定格）。
- 范围：玩家可见的美术 UI 与动效升级规划。**不含**：玩法、卡牌数值、音频（基准 PV 音频未验）、B 站 PV 制作（另列 P2 素材准备）。
- 本计划是对「视觉语言已定稿」（冷青+暖金、工业战术终端）的**增量**，不是重做。

## 2. 判定原则（每条方案的准入门）

1. **借形制不搬素材**：只抄手法/结构/节奏，零像素级复制（版权；同 onetake PolyForm 口径）。
2. **定稿语言优先**：新元素用既有 token（`--gold-main` 三档 / `--exp-*` / fx 语义色），不引入新色相体系。
3. **战斗域硬约束不变**（page-battle-ui.css 头注）：零常驻循环动画、零 filter 动画、只走 transform/opacity、`.18s` fast 档。本计划全部新增动效**只挂非战斗域**。
4. **性能红线**（棱彩卡 10fps 事故教训）：禁 `background-position`/大面积渐变逐帧动画；转场用整层 transform 位移；闸门期间避免与 `backdrop-filter`（overlay blur(6px)）同帧叠加。
5. **reduced-motion**：winter.css 已有全局 kill 开关，新模式自动被覆盖——每批验收必含 reduce 场景（退化即时不闪跳）。
6. **缓动只从既有 5 token 选**（`--ease-entrance/pop/spring/fly/float`，base.css:69-73）；stagger 沿用 akIn 70/140/210ms 三波惯例（winter.css）。

### 2A. 布局构图原则（v2 新增，D13 的依据；来源 scene-01/02 排版复析）

1. **单一纵轴**：主信息沿左列 0-32% 宽堆叠（标题上、菜单中、副信息下），右侧 ≥60% 让给画面主体——它的标题卡与菜单页同构，整套 UI 只有一条轴。
2. **尺寸断崖**：主标题最大（第一落点）→ 主 CTA 次之 → 菜单行统一再小一档；层级靠尺寸差，不靠多色。
3. **密度对比**：轴内密、轴外疏；密列内部等高等距（行按钮同规格、同 gap）。
4. **指向元素**：箭头牌/斜切角把视线引向 CTA（咱们可用切角+徽记弱化实现，不搬箭头牌原件）。
5. **小字贴边沉底**：版本/制作者沿底缘，不与主轴争。
6. 一句话：**单一纵轴 + 尺寸断崖 + 一侧留白**。

## 3. 全维度对照与方案

判定分三档：**抄**（新增件）/ **升级抄**（既有件换用法）/ **不抄**（含理由）。

### D1 色彩与点缀节奏 — 不抄
基准用高饱和四色撞色（品红×青×黄×黑）制造冲击；咱们 fx token 体系（base.css:57-67）已覆盖反馈语义色，冷青+暖金定稿不推翻。无动作。

### D2 排版与信息层级 — v2 改判：元素级不抄、页面级抄
元素级（小标签+大数字、等宽 kicker）与咱们 resHud（base.css:118-130）、hp-hud-label（base.css:171-176）同构，无动作。**页面级构图**（整页信息怎么摆）原判「不抄」过于保守，v2 按老板令改判为抄——见 §2A 与 D13 首页排版重做。

### D3 面板容器语言 — 升级抄：贴纸标签子语汇
- 基准：贴纸/胶带/歪斜小标签打破均质面板网格（sheetA）。
- 现状：hub-card 封条顶线+眉题金化已定型（preparation.css 头注、winter.css）。
- 方案：新增「贴纸标签」组件类——金/青双色、1px 描边、旋转 ±2°、投影 1 层——用于**图鉴、收集、备战页**的分组角标与状态标记（如「新获得」「本局限定」），不进战斗。
- 落点：`expedition-library.css`、`preparation.css` 追加；避开 WF-ach-gallery 在途的 title-achievements.css。
- 验收：实页截图对比；标签 3 处以上使用不显乱；reduce 下旋转归零可选（静态装饰非动效，不强求）。

### D4 按钮与交互反馈 — 不抄
现状三档节奏+按压快进慢弹+金焦点环（page-battle-ui.css 头注④）已高于基准。无动作。

### D5 进度与数值呈现 — 抄：分段刻度进度条
- 基准：加载条逐格点亮（burst2 右段），非连续填充，军械感强。
- 现状：hpBar 连续填充+hpShine 扫光（base.css:225-237）；hpBar 保持不动。
- 方案：新增 `segmented-bar` 组件（grid 8-12 格 + 每格 `transition-delay` 递增点亮），用于**撤离倒计时/读条类演出**（game.run.flow）与加载屏，与 D11 组合。
- 验收：格子点亮有序差 30-60ms；reduce 下直接显示终态；单屏实例 ≤2（防噪）。

### D6 图标与装饰语汇 — 升级抄：警示斜纹升格为语汇
- 基准：黄黑警示斜纹贯穿转场与危险标识（sheetA 3-5 格、burst2 帧1）。
- 现状：battle.css:577、page-deploy.css:409 已有斜纹但只作静态纹理。
- 方案：① 提 `--hazard` 渐变变量（暖金×深青双色版，不用黄黑原色）；② 斜纹用于**危险操作徽记**（删除/放弃确认）与 **T1 闸门遮罩**（见 D9）；③ 密度降到基准的 1/3（克制基调）。
- 验收：同一渐变变量三处复用；不出现大面积黄黑块。

### D7 卡牌本体 — 不抄
hs-card 类型/稀有度体系完整（cards.css），且有棱彩卡性能重做史；基准卡牌信息层次不高于咱们。无动作。

### D8 立绘呈现 — 限域抄：idle 微摆
- 基准：标题卡立绘 ±5° 低频摆动（burst1）。
- 现状：立绘全静态。
- 方案：仅**标题页/Hub/备战页**立绘容器加 `rotate(±1.5°)` 呼吸摆（4-6s 周期，transform 单属性）；战斗域（sts-figure）禁入。P2 批次。
- 验收：实页观察不晕不抢；reduce 下静止；无 compositor 抖动（Performance 面板抽查）。

### D9 页面转场与全界面开合（P0 核心，老板两度点名：过场动画 + 「点开任何界面和退出都要有对应的过渡动画」）

**页面级转场三件套：**

| 编号 | 手法 | 基准出处 | 实现 | 参数 |
|---|---|---|---|---|
| T1 | 斜纹闸门 wipe | burst2 帧1-3（0.5-0.75s） | 全屏遮罩层（`--hazard` 渐变）transform 斜向扫过 + 内容轻微 scaleX 挤压 | 0.55s，`--ease-pop`；遮罩单合成层 |
| T2 | 失焦退场 | burst3 帧4（模糊缓冲帧） | 旧页退出时 `blur(3px)+scale(.985)` 0.2s 再卸载（一次性 filter，非常驻） | 仅低频整页切换；战斗域禁用 |
| T3 | 界面即过场 | 5.9-22.8s 一镜到底 | flow-transition 升级：旧面板压缩淡出（0.2s）→ T1 闸门 → 新面板展开（0.35s），全程无黑帧 | 总时长 ≤0.8s；hub→deploy→map 链路 |

**T4 全界面开合过渡（v2 新增，老板 10-04 令）：**
- 现状：弹层只有容器级淡入淡出（overlays.css:358-366，`.15s` 均一）；内容级入场仅设置页有 setPageIn（overlays.css:3）；**关闭零内容级动画**；hub 页签切换无过渡。
- 方案：**成对同源反向**——每个界面「开=X，关=X 的反向缩短版」：
  - 标准弹层卡：开=translateY(22px)+scale(.988)→原位（0.3s，`--ease-entrance`）；关=原位→translateY(14px)+scale(.985)+fade（0.18-0.22s）。关闭**纯 CSS 挂 `#overlay.closing` 现有生命周期**（容器已加 .closing 再卸载，只需把容器淡出时长对齐 0.22s，预计 JS 仅改 ui/overlay.js 一处时序常量）。
  - 全屏页（背包/照相馆/成就/设置）：开=T1 短版斜纹闸门（0.3s）或 scale(.97)+fade；关=镜像。
  - hub 页签切换：新页签内容 translateY(10px)+fade 入（0.28s），旧内容即时让位（页签是轻切换，不做重转场）。
  - 战斗域内弹层（发现/墓地/设置）**同样必须有开合**，但走既有 `.18s` fast 档轻量版（fade+4px 微位移），不违战斗硬约束。
- 验收：抽查 ≥6 类界面（设置/照相馆/成就/背包页/商店/手册+战斗内发现弹层）开合录屏，开与关成对出现、方向一致；reduce 下全部直出无闪跳；高频连开连关（快速 Esc×5）不叠加不残影；docs:check + 定向 vitest 不回归。

**落点（D9 全部）**：新文件 `game/css/motion-transitions.css`（加载顺序在 winter.css 后）+ `game/src/ui/` 转场编排约 60-80 行 JS + ui/overlay.js 关闭时序 1 处微调；流程页切换钩子挂 game.hub.pages / game.run.flow。

### D10 叙事演出 UI — 抄：无线电通讯列表（P0 核心）
- 基准：手机聊天界面承载 17s 叙事（气泡逐条 pop、旧消息上推、底部加载条），是 PV 完成度最高的演出件（burst2）。
- 方案：**无线电/终端通讯风** comm-feed 组件（撤离题材天然契合）：消息条=终端行+时间戳（非气泡，贴工业终端语言），新条目 `--ease-spring` 弹入+旧条目 translateY 上推，可叠「传输中…」打字指示与 D5 分段条。
- 用途：任务简报、撤离阶段播报、关键 NPC 通讯（game.run.flow 现有剧情流位）。
- 落点：comm-feed CSS（新文件或并入 motion-transitions.css）+ JS 约 100 行；文案先复用现有 flow 文案，不动数值。
- 验收：实页演示（≥5 条消息含播报）；连点不堆叠错位；reduce 下全部直接呈现；战斗中不触发。

### D11 加载与等待体验 — 组合件（不新增手法）
flowScan（scenes.css:50-62）已有扫描线；加载/等待 = flowScan + D5 分段条 + 一行状态文案流（「正在建立链路…」「校验载荷…」）。验收：等待 ≥1s 的场景才出现，防闪烁。

### D12 空态与反馈 — 升级抄
空背包/无结果列表用 D3 贴纸标签 + 单行提示替代纯文字（基准 sheetA 贴纸空态）。验收：三处空态统一。

### D13 首页排版重做 — v2 新增（P0-B，老板 10-04 令：「图可以不换，但是排版可以换」）

**现状 DOM**（index.html:181-276 + winter.css ak-hud 域 + title-p0.css）：左上 title-heading（kicker/wordmark/lead）；上缘 ak-tl（退出/静音）+ ak-pillrow（手册/信箱）+ ak-user（档案号/时长，右上）；**三个圆形入口（成就 ak-ach 右上区/照相馆 ak-lib 左中/设置 ak-set 左下）散点绝对定位**；ak-sec 撤离次数右中；ak-start 开始按钮右下（余烬光晕）；底缘 quote/credits。

**痛点**：①散点无轴线，视觉重心全靠壁纸撑；②三个入口等尺寸等权重，无层级断崖；③可读性押在壁纸上（hover 才亮）；④响应式靠 winter.css @media 1100px/740px 两段**绝对坐标硬调**，维护贵；⑤ak-veins 装饰线与入口抢左半幅。

**基准规则**：§2A 六条（单一纵轴/尺寸断崖/密度对比/指向元素/小字沉底）。有利条件：title-p0.css 的压暗渐变本来就把左 57% 压暗给文字用——左轴方案与现有光照天然吻合，壁纸不用动。

**方案三选（老板拍板，建议 A）**：
- **A 左轴纵列（推荐）**：title-heading 保留左上；左中起**等高纵排行按钮**（手册/信箱/成就/照相馆/设置：图标+文字+一行一入口，等距）；ak-start 移到主轴末端**放大为主 CTA**（斜切角+金描边，全页唯一大按钮=尺寸断崖）；ak-user/ak-sec 沉底缘与 quote/credits 同层；删散点圆钮与 ak-veins。右 60% 完整让给壁纸。
- **B 底缘汇流**：入口全收成底部 dock 横栏，start 居中放大。改动最小，但底缘信息已密（quote/credits），且壁纸下部有压暗渐变，dock 会显得沉。
- **C 左轴+右下锚点**：次入口左轴纵列 + start 保持右下原位只放大。改动感知最小，但两处重心，断崖弱于 A。

**共同硬约束**：壁纸/wordmark/立绘等图资产**零更换**；全部 id 与事件绑定原样（mStart/mAch/btnCardLib/mSettings/mGuide/mInbox/btnTitleExit/btnTitleMute）；新排版 flex/grid 实现，**砍掉两段媒体查询坐标硬调**；入场动画沿用 akIn 三波 stagger；Tab 焦点序=视觉序。

**落点**：index.html title 段 DOM 重排 + 新文件 `game/css/title-relayout.css`（或并入 title-p0.css 大版本），winter.css 中 ak-circle/ak-veins/两段 @media 坐标块随之退役；JS 仅成就入口渲染钩子对接 WF-ach-gallery 落库版。

**验收**：1280×720 与窄窗（≤1100）实页录屏对比改前后；六入口（含退出/静音）全部一级可达、键盘可 Tab 到位；无横向滚动；壁纸主体遮挡率目测 <15%（新 UI 占画面面积比旧散点更小）；docs:check+定向 vitest；**开工前置：WF-ach-gallery 在途属地（成就入口 game.menu.js+title-achievements.css）已落库或协调完毕**。

## 4. 动效模式库规范（新模式准入清单）

- 属性白名单：`transform / opacity / clip-path`（一次性 filter 例外：T2 退场 0.2s）。
- 时长档位：转场 0.5-0.75s｜入场 0.3-0.55s｜通讯条目 0.28s｜战斗 `.18s` 不变。
- stagger：沿用三波 70/140/210ms；同屏动效元素 >12 时降为两波。
- 挂载域：`body:not(.scene-battle-3d)` 作用域类或仅挂非战斗页面容器，结构性防误入战斗。

## 5. 批次计划（每批独立验收、独立提交窗口）

| 批 | 内容 | 逐页落点（附录 A） | 预估规模 | 验收门槛 |
|---|---|---|---|---|
| **P0-A** | D9 转场四件套（T1 闸门/T2 失焦/T3 界面即过场/T4 全界面开合）+ D10 通讯演出（含 demo 数据开关） | T4=附录 A 全表逐界面（五档按附录 B）；T1/T3=A-2 deploy↔A-3 地图/场景链路；D10=A-3 场景页首挂点 | ~350 行 CSS + ~200 行 JS | 实页录屏全链路+T4 按附录 A 抽查每区域 ≥1 界面；reduce/性能/docs:check/定向测试四绿；demo 可关 |
| **P0-B** | D13 首页排版重做（老板点名；方案 A/B/C 待拍板） | A-1 标题区三行 | ~250 行 CSS + index.html title 段重排 + ~30 行 JS | 见 D13 验收；**前置=WF-ach-gallery 落库或协调** |
| **P1** | D5 分段进度条 + D3/D12 贴纸语汇 + 图鉴 stagger 入场 | D5=A-2 备战、A-3 祭坛/撤离/结算；D3/D12=A-2 全部页签+A-3+A-5 信箱/背包；stagger=A-5 照相馆 | ~200 行 CSS | 图鉴/备战实页；四绿同上；**前置=WF-photolib-perf 归因结论协调**（expedition-library.css 属地） |
| **P2** | D8 立绘微摆 + B 站 PV 素材准备清单 | D8=A-1 标题页+hub 首屏；PV 清单纯文档 | ~50 行 CSS + 文档 | 标题页实页；PV 清单为纯文档 |

依赖关系：P0-A 的 `--hazard` 变量被 P1 复用；P0-A 与 P0-B 无相互依赖，可并行或换序（P0-B 有外部前置）；各件之间独立。P1 避开 WF-ach-gallery 在途属地；开工前 `npm run handoff` 复核并行。

## 6. 风险与对策

- **R1 性能**：闸门全屏动画→单合成层+`will-change: transform` 用后即除；与 overlay blur 同帧冲突→闸门期临时关 backdrop-filter（D9 验收项）。
- **R2 级联冲突**：winter.css 尾批 `!important` 定版——motion-transitions.css 加载在其后、选择器加页面作用域前缀，不覆盖定版五件（page-battle-ui.css 头注「老板定版让路」）。
- **R3 属地**：title-achievements.css（WF-ach-gallery 在途）不碰；图鉴页开工前核 handoff。
- **R4 版权**：只借形制；PV 帧仅存本目录作内部证据。
- **R5 可访问性**：全部动效被全局 reduce 开关覆盖；通讯消息内容不依赖动画呈现（reduce 下全量直出）。
- **R6 开合动画性能（v2）**：T4 覆盖全部界面开合后，动画触发频次升高——战斗域一律 fast 档轻量版；连开连关用 `animation-fill-mode` + 单例容器防叠加；开合期间不新增常驻属性动画。
- **R7 属地协调（v3 扩）**：与在途会话相交的批次前置——D13/P0-B 与 WF-ach-gallery（成就入口 game.menu.js+title-achievements.css）；P1 图鉴 stagger 与 WF-photolib-perf（候选属地 expedition-library.css，等其归因结论）；A-3 dossier 相关零接触 WF-xart-z1 刚交付件。title-p0.css/winter.css 对 #title 的定版让路注释逐条核对后再动手。

## 7. 与既有资产的关系

- 不新增缓动/色彩 token（原则 2/6）；`--hazard` 是既有纹样的变量化，不算新色相。
- flow-transition/scenes.css 既有入场不动，T3 是其外层编排。
- 战斗域（battle.css / page-battle-ui.css / cards.css）零改动。

## 8. 待拍板项（已登记 PENDING #37）

1. P0-A 是否启动（转场四件套含全界面开合 + 通讯演出）。
2. **首页排版方案 A/B/C**（D13，建议 A 左轴纵列：壁纸右侧天然留白、现有压暗渐变就是给左轴准备的）。
3. 贴纸标签用色：金主 / 青主 / 双色并行（建议：金=获得类、青=状态类）。
4. 通讯演出文案来源：复用现有 flow 文案（建议，零文案工作）vs 新写。
5. D8 立绘微摆做否（收益一般，老板此前未点名）。
6. 闸门用色：暖金×深青双色版（建议）vs 纯中性灰。
7. 战斗域开合动画档位确认（T4 要求战斗内弹层也有开合，走 `.18s` fast 轻量版——确认接受）。

## 附录 A（v3）全界面清单与逐页改动映射

盘点来源：index.html 容器 × css 页面文件（24 个 page-*/expedition-*）× hub 页签键（home/stash/shop/ach/deploy）× run flow 节点（altar/chest/fire/shop/death）× showOverlay 标题枚举，交叉核对。**「适用项」里的编号即正文维度/手法；未列出的项=该界面明确不动。**

### A-1 标题区

| 界面（文件域） | 适用项 | 改动说明 |
|---|---|---|
| 标题页 #title（title-p0.css / winter.css ak-hud 域） | **D13**、P2-D8 | 排版重做主战场（A/B/C 案见 D13）；入场沿用 akIn 三波；壁纸/wordmark 零更换 |
| 退出屏 #exitScr（winter.css） | D13 配套 | 跟随新排版统一按钮语言（menu-btn），不重排 |
| 选档页 slot-select（page-slot-select.css） | T4-全屏档 | 开合走闸门短版；slotMist/silBreathe/birdsDrift 氛围动画**保留不动** |

### A-2 集散地/基地区（hub 域）

| 界面（文件域） | 适用项 | 改动说明 |
|---|---|---|
| Hub 主体+五页签 home/stash/shop/ach/deploy（page-hub.css/hub.css/expedition-hub.css） | T4-页签档、D3 | 页签切换过渡（新内容 translateY+fade 0.28s）；贴纸标签用于页签徽标位 |
| 基地家园场景（home-scene.css：热点/陈列/编辑器） | 仅 T4 | 编辑器抽屉开合纳入 T4；热点样式**不动**（刚稳定） |
| 仓库页签 stash（page-stash.css / expedition-inventory.css） | D3、D12 | 宠物蛋/孵化/锁定状态贴纸化；空仓空态贴纸化 |
| 商店页签 shop（page-shop.css） | D3、D12 | 限购/售罄/新品贴纸；空货架空态 |
| 升级页签 upgrade（page-upgrade.css） | D3 | 三卡分级标识贴纸化（贴纸只做状态角标，不重排） |
| 人物档案 dossier（expedition-hub.css class-dossier*） | **不动** | WF-xart-z1 在途刚交付，本计划零接触 |
| 职业选择 cls（page-classes.css） | D3、D12 轻量 | 锁定职业贴纸；D12 空态 |
| 备战页 preparation（preparation.css） | D3、D5 | 就绪/缺失状态贴纸；备战进度用 D5 分段条 |
| 部署/出击 deploy（page-deploy.css） | T3、D6 | hub→deploy→map 转场链路终点；gate-strip 斜纹换 `--hazard` 变量（视觉等价） |

### A-3 远征流程区（run 域）

| 界面（文件域） | 适用项 | 改动说明 |
|---|---|---|
| 远征地图（expedition-map.css） | T3、T4 | 结点进入转场；章节列表/总览按钮开合 |
| 场景/事件页（scenes.css / page-events.css） | T3、D10 | sceneArtIn/sceneItemIn 保留；D10 通讯演出**首挂点**（任务简报类场景改通讯流呈现） |
| 跑局数据页（page-datapage.css） | 仅 T4、D12 | 开合+空态 |
| 远征选探 roster（expedition-roster.css） | 仅 T4 | 开合 |
| 节点房间：祭坛/火堆/箱子/商店（expedition-rewards.css node-pg + game.run.flow.js） | T4、D5 | 开合标准档；祭坛/开启类读条用 D5 分段条 |
| 撤离报告（expedition-rewards.css extraction reports） | D5、扫光复用、T4 | 撤离读条=分段条；成功瞬间复用 flowScan 白扫光 |
| 终局结算（terminal-settlement.js） | D5、T4 | 结算数字分段递进点亮；扫光 |
| 死亡/撤离失败页（game.session.death.js） | T4、D12 | 开合+空态（无损失物时空态贴纸） |
| 珍珠盒/锦囊/墓地等 run 内弹层 | T4-标准档 | 统一开合 |

### A-4 战斗区（硬约束域）

| 界面（文件域） | 适用项 | 改动说明 |
|---|---|---|
| 战斗主界面（battle.css / page-battle-ui.css / expedition-battle.css） | **仅 T4-fast 档** | 发现/选卡、墓地、战斗设置、choice-list、药水确认五类弹层补开合（fade+4px 微位移 .18s）；其余零改动 |
| 战斗立绘 sts-figure | **不动** | D8 明确禁入；恒久循环动画禁令继续 |

### A-5 全局/系统区

| 界面（文件域） | 适用项 | 改动说明 |
|---|---|---|
| 照相馆/卡牌收藏馆（page-cardslib.css + expedition-library.css） | T4、D12、P1-stagger | 全屏开合；空态；大列表错峰入场（P1 主战场）；**前置=WF-photolib-perf 归因结论协调**（该会话候选属地含 expedition-library.css） |
| 成就总览（title-achievements.css 在途重做） | 仅 T4 | **前置=WF-ach-gallery 落库**；其余零接触 |
| 设置页（page-settings.css） | T4 收编 | 已有 setPageIn/setPanelIn/setRowIn 并入 T4 统一体系（关方向补齐），内部 stagger 保留 |
| 背包全屏 bag-page + 背包弹层（base.css bag 域） | T4、D12 | 开合；空包空态 |
| 远征手册/帮助弹层（mGuide / help-body） | 仅 T4 | 开合 |
| 留言信箱（mInbox） | T4、D12 | 开合+空信箱空态 |
| 导入/导出/确认小窗 | T4-fast 档 | 轻量开合（与战斗同档，小窗不需要重动画） |
| 开发者面板 devPanel / HUD 家族（resHud/hpHud/layerBanner/sidebar） | **不动** | 开发工具与既有 HUD 达标（D2/D4），零接触 |

## 附录 B（v3）T4 开合动画五档参数表

| 档位 | 适用 | 开 | 关 | 备注 |
|---|---|---|---|---|
| 全屏页 | bag-page/照相馆/设置/成就/选档 | T1 短版闸门 0.3s 或 scale(.97)+fade | 镜像 0.24s | 闸门与 backdrop-filter 不同帧 |
| 标准弹层 | 珍珠盒/锦囊/墓地/节点房间/手册/信箱 | translateY(22px)+scale(.988) 0.3s `--ease-entrance` | 反向 0.2s translateY(14px) | 关闭纯 CSS 挂 `#overlay.closing` |
| 确认小窗 | 导入导出/离开对局/确认框 | fade+scale(.98) 0.22s | 反向 0.16s | 与 fast 档几乎重合，复用 |
| hub 页签 | 五页签切换 | 内容 translateY(10px)+fade 0.28s | 无（旧内容即时让位） | 轻切换，不做重转场 |
| 战斗弹层 | 发现/选卡/墓地/战斗设置/choice/药水 | fade+4px 位移 `.18s` fast 档 | 反向 `.14s` | 战斗硬约束内；连开连关防叠加 |

逐界面归属以附录 A 为准；同界面同档，不混档。
