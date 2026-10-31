# 当前源与原生图独立效果审查

结论：`current-visual-2` 已生成可读的原生图，但本批不能认定原样迁移通过。基地首页存在阻断布局错误；地图/战斗共用顶栏、当前人物序列帧仍未迁入；首页描边字与预设目标区存在明确呈现差异。

## 证据边界

- 权威：本轮直接读取 `搜打撤/game/index.html → src/main.js` 的实际静态/延迟模块，以及最终 CSS 覆盖。版本矩阵仅用于定位；每条结论均回读原始源。
- 新图：`搜打撤/docs/evidence/2026-10-29-unity-desktop/current-visual-2/` 的 `title.png`、`hub.png`、`preparation.png`、`battle.png`、`cards-and-icons.png`、`map.png`，均已逐张查看。
- 图对应 Unity 输入见该批 `source-before.json` / `source-after.json`；`process.json` 记录 `inputsUnchanged:true`、退出码 0。这只证明该批渲染执行完成，不证明视觉迁移通过。
- `current-visual-1` 在首页构建阶段因 CanvasGroup 缺失中止，没有可审图；不作为效果通过证据。主会已对该共性问题修正并生成第 2 批。
- 原 Vite `2026-10-29-home-option-light/home-focus.png` 仅用于识别构图与效果；窗口不同且有调试浮层，未作整图像素硬比。
- 仅后台源审查与现有图读取；本审查未启动 Unity、浏览器、前台窗口、编译或运行验证，未改生产文件。
- 依主会转达的既定拍板，Agent、旧 Web 档兼容、研究第二图/研究所远征条件入口、关闭制作坊排除。Bag/Settings/照相馆仍在迁移，本轮旧图只作未完成基线，不重复列缺陷。

## 已证实差距

### P1 E01：基地首页内容宽度塌缩，主要操作不可读

- 新图 `hub.png`：左侧事务标题与说明变成约一字宽竖列，溢出面板；右侧人物/卡牌事实、出征按钮、模式、携带预设同样塌缩并重叠。七个目的地名称与图标可见，但不能据此认定基地页完成。
- 原始源：`game/src/hub/hub.home-v3.js:28` 开始的首页 DOM；`game/css/base-home-v7.css:6/10/21/23/28/39` 分别定义 380px 事务卡、横向事务网格、420px 整备卡、两列事实、三列出征按钮、两列难度选择。
- 图对应 Unity：`Assets/Scripts/Sdt.UI/Screens/Hub/HubScreen.cs:125` 的 `Column(affairs,...)` 与 `:134` 的 `Column(prep,...)` 没有填满无布局组件的宿主；`HubCurrentLayout.cs:34` 的 Column 只创建默认 RectTransform 和纵向布局，布局根仍保持默认尺寸。右卡还固定 620px 高，原始源由内容自然决定高度并设 max-height。
- 最小建议：先让两处内容根按宿主的实际可用宽度布局，再按源 padding/gap、事实网格、按钮网格和内容高度复原；不继续用默认 100px 宽根节点容纳内容。检查共用 Column 其他落点只限后续实际新图发现的同因问题。
- 验收条件：当前窗口原生新图中事务、事实、CTA、难度与服务均横排清楚，文字不越卡；右卡按源自然内容高度收束。首次目标、空事务、继续整备和直入敌腹至少覆盖相关差异态。

### P1 E02：地图仍用旧整条栏，战斗缺当前共用顶栏

- 新图 `map.png`：顶部是深色整栏加“背包 B / 保存 / 离开”大方钮，底部是深色整栏加“查看”按钮。`battle.png` 完全缺地图与战斗共用的系统操作、头像/生命、章节、金币与攻击顶栏。
- 原始源：`game/src/ui/run-top-bar.js:77` 起安装同一物理 header；`run-top-bar.css:2` 定义 104px 透明顶栏，`:25` 起系统/人物/资源横向分组，`:104` 起约束公共按钮。`game/src/run/expedition.view.js:3` 引入 `game/css/map-floating-tools.css`，后者 `:4/14/29/35` 定义底部 88px 无外框浮动工具组、64px 图标和 20/23px 文案。
- 图对应 Unity：`Assets/Scripts/Sdt.UI/Kit/DesktopRunHud.cs:34/40/63` 仍建旧 MakeBar；`:134` 的可见性要求 `!UiStack.Blocked`，战斗覆盖时该栏被隐藏。BattlePresentation 只自建回合/资源/战术区，没有这套共用顶栏。
- 最小建议：按当前 run-top-bar 与地图工具入口迁入公共组件，让地图和战斗消费同一呈现与数据更新；地图选路可继续由现有 runtime 命令负责，视图按源结构接线。
- 验收条件：地图与战斗的公共顶栏内容、位置、资源与系统入口一致；地图底部工具按源有图标、容量和文案，不再由旧整条 MakeBar 代替。静帧与实际入口输入分开验证。

### P1 E03：战斗人物使用旧静态兜底，现行动作资源链遗漏

- 新图 `battle.png`：无呈花冠、蓝星裙边的旧静态站姿。直接查看当前 `game/assets/portraits/battle/wu.webp` 确认即该兜底素材；查看 `game/assets/portraits/frames/wu/sprite-v1/neutral.webp` 则是现行黑短裙、前倾持剑基准姿，两者身份呈现与轮廓明显不同。
- 原始源：`game/src/battle/view/battle.view.js:40` 导入 attachUnitFrames；`battle.frames.js:12–16/34–40` 引入五位角色当前目录；`battle.frame-catalog.js:1` 从 `assets/portraits/frames/wu/sprite-v1/animations.json` 读取序列与 timings。`battle.frames.js:26–30` 明确序列帧是正常呈现，静态图仅在无帧/未就绪/失败时兜底；当前 Wu catalog 画布为 512×342，idle 首帧是 sprite-v1/neutral。
- 图对应 Unity：`Assets/Scripts/Sdt.UI/Screens/Battle/BattlePresentation.cs:247` 固定赋 `Res.BattlePortrait(character)`。Assets 内未找到该现行 sprite-v1 目录及对应播放消费链，BattleFx 的程序位移/染色不能替代当前序列内容。
- 最小建议：按五人当前 animations/catalog 导入原帧与时间表，原样迁移固定画布、脚底/几何校正与 idle/atk/cast/hurt/death 生命周期；保持源失败兜底。先补资源与播放器，再评估真实动作下的单位布局。
- 验收条件：新战斗入场先看到当前 idle；攻击、施法、受击、死亡按源序列/时长/死亡末帧保持切换。按角色核对脚底、体量及状态切换，不能以旧静态资源存在或单张图可显示称通过。

### P2 E04：首页底部轮廓字变成大片实心字

- 新图 `title.png`：底部 CODE、7、C 是很醒目的实心灰字，遮住壁纸与底部视觉；原 Vite 首页参考中这层仅有很弱的空心轮廓。
- 原始源：`game/src/ui/home-layers.js:31` 创建 ghost；`game/css/home-layers.css:43–57` 对中心做渐变 mask，并设 `color:transparent; -webkit-text-stroke:1px #c7d4df1a`。
- 图对应 Unity：`Assets/Scripts/Sdt.UI/Screens/Menu/CurrentHomeAmbient.cs:66–74` 用透明 Text 加 uGUI Outline，`useGraphicAlpha=false`；uGUI Outline 复制字面三角形形成实心低透明字，未复现只有轮廓的效果；两块 RectMask 也未复现源的软渐变边缘。
- 最小建议：以真正只有字形轮廓的描边材质或从源字体描边生成的透明纹理，保留原来尺寸、运动与渐变 mask；不靠降低整层透明度掩盖实心字形差异。
- 验收条件：字形内部透出原壁纸，只有约 1px 低透明轮廓；中心人物区按源渐隐，底部功能文案保持清楚。首页布局比例/入口已有对应不能替代此材质验收。

### P2 E05：预设收藏目标区的分布与控件宽度不遵循当前源

- 新图 `preparation.png`：计数“追踪 0/3”停在标题附近而非模块右端；“未追踪目标”左对齐且无占整行的虚线空态；选择框与“加入追踪”各占约半宽。
- 原始源：`game/src/hub/preparation.view.js:62–68` 使用独立标题/计数、目标容器与添加行；`game/css/preparation.css:10/20/24–27` 要求标题计数两端对齐、目标三列、空态跨满三列居中虚线框、select 占剩余空间而添加按钮按内容宽度。
- 图对应 Unity：`Assets/Scripts/Sdt.UI/Screens/Hub/PreparationScreen.cs:52` 拼接长空格文本模拟标题/计数，`:53` 直接 Copy 空态；`:64–66` 让 select 与普通 Command 同等参与扩宽。非空目标分支还将 card name/来源/取消追踪纵向排，而源卡片内部为左右 flex。
- 最小建议：直接复原独立 header 两端布局、三列目标容器、跨行空态；添加行仅 select 伸展。目标卡内部信息与取消按钮按源左右组织。
- 验收条件：0/1/3 目标分别复核；计数右对齐，空态有全宽虚线框，添加按钮为内容宽度；非空目标保持三列及卡内左右结构。两列预设与折叠编辑器仍需展开/有卡状态新图，当前空态图不足以判全页通过。

### 静态待验 E06：结束回合长按消费者尚未接入

- 当前源 `battle.view.js:611` 调用 `bindEndTurnHold`；`game/src/ui/end-turn-hold.js:7–34` 在 `sdt-end-turn-hold=1` 时要求按住 650ms，松开/离开/失焦取消，支持空格/Enter；`battle-stage.css:242` 提供 is-holding 反馈。
- 图对应 Unity `BattlePresentation.cs:87` 仍用普通 Button 直接 EndTurn，UI 消费链未发现 hold 处理。静帧不能验证该差距的输入结果；设置迁入该开关时需同批补消费者。
- 验收条件：开关关闭时普通点击；开启时不足 650ms 不结束，足时结束一次，离开/失焦取消，键盘一致。

## 已核对的有限事实与未覆盖项

- 首页七个入口的分组、左右百分比、按钮等级、footer 与七壁纸选择在当前源码已有对应；所看静帧只覆盖默认第 4 张壁纸，不证明切换、只看壁纸、hover、返回、制作名单输入或动态滤镜全部等价。
- 战斗原生图显示三组水平重叠手牌；260×390、190px 优先步进、64px rest drop 与 9 组分页算法对应当前 `battle.hand-layout.js`，但 1/9 组、翻页、新卡槽稳定、hover抬升、瞄准与两侧边界未在该图覆盖。
- `cards-and-icons.png` 的当前纸框、费用标签、插图和图标可显示，未发现足以阻断本批的资产丢失。未据此判定全稀有度材质、棱彩/传说字效、长说明滚动或整库语义全通过。
- `map.png` 的节点图与字可读；map-fonts 的断言不涵盖共用顶栏、底部入口或当前源效果等价。
- 必要后续图：七目的地中的人物、后勤、交易所、收藏室、建设、庭院；选人、整备与带卡/继续整备；预设非空目标/展开编辑；当前人物动作的入场与关键帧；当前公共顶栏下的地图/战斗。无新图场景均未称通过。

本审查已冻结；生产只读，无服务、端口或 Unity 进程由本审查创建。只留下本目录报告，后续修复与复拍由主会统一编排。
