# 当前 Vite → Unity 原样迁移版本矩阵

基线冻结：2026-10-29T18:25:08.096Z。依据当前工作树原始字节与运行导入图，不以提交日期、mtime、旧计划或旧passed报告判定版本。

基线判断：冻结时Unity多处页面复刻的是旧DOM/旧CSS结构。下文的差异、旧实现及Unity指纹均记录当时快照，后续实施与验收状态见工程 MIGRATION.md 和项目本任务 task.json。迁移单位是当前运行模块及其状态、视图、布局和交互边界。老板指示为“直接把原始代码按照架构和效果迁移”；本表仅给原样迁移映射，没有新设计建议。

## 入口和样式事实

- HTML入口 SHA256：`7aeb1753520b6afc4ca78cd45200bb6476eb4edf16f49255cf2d701a2907f567`。唯一生产模块入口为`src/main.js`。
- 当前AST运行图：794个JS/CSS/JSON/HTML源，148个可达CSS，2163条导入边；缺文件0、解析错误0。完整SHA与HTML样式顺序见[runtime-source-manifest.json](runtime-source-manifest.json)。
- index.html中base-camp.css/base-camp-compact.css只是前置层。game.hub.js静态导入base-camp-rework及v7/v12层，并动态载入game.hub.runtime.js。正式根节点明确base-frame-v7 + data-base-layout="open-menu"。
- card/layout、HUD和各页还受模块import CSS及CSS @import影响；按行列出的文件是该页面当前明确维护层。CSS选择器/状态/重要性决定最终声明，不能把“最后一个文件名”当全局赢家。本次后台审查没有读取浏览器computed style。
- index.html注释中的cover-remaining.css不运行；base-design-preview-v7.js等预览不因存在文件而成为生产基线。完整导入链与每行SHA见[version-matrix.json](version-matrix.json)。

## 迁移依赖顺序

1. P0公共组件：UI缩放/卡面与特写 → run-top-bar → 基地共享壳 → 房间与奖励共享壳 → 战斗stage/hand。
2. P0主流程：基地首页 → 选人 → 整备 → 地图 → 房间/奖励 → 战斗。保持原状态所有者、稳定身份和局部更新边界。
3. P1页面按下表迁入原模块：档案、后勤/人物/建设、设置、照相馆、成就、交易、收藏、庭院、结算。原生UI适配只翻译技术载体，不改当前信息结构、比例、素材和交互语义。

## 对照索引

| ID | 页面 | 优先 | 当前源码标记 | Unity快照位置 |
| --- | --- | --- | --- | --- |
| 01-home | 首页（独立重建，仅冻结版本） | P0 | #title.home-composed | Screens/Menu/TitleScreen.cs<br>Screens/Menu/CreditsScreen.cs |
| 02-slots | 选档 | P1 | .pg.slot-page / .slot-deck / .slot-card | Screens/Menu/SlotPickerScreen.cs |
| 03-base-shell | 基地共用外壳与导航 | P0 | #hubMain.base-frame-v7[data-base-layout="open-menu"] | Screens/Hub/HubScreen.cs |
| 04-base-home | 基地首页 | P0 | .base-home-v7 | Screens/Hub/HubScreen.cs |
| 05-base-logistics | 后勤/建设/人物房间 | P1 | .warehouse-v3 / .personnel-v12 / .facilities-v12 | Screens/Hub/HubScreen.cs<br>Screens/Hub/HubPets.cs<br>Screens/Hub/CharacterAppearanceScreen.cs |
| 06-character | 出征选人 | P0 | .cls2-page.roster-reference[data-base-departure] | Screens/Run/ClassChoiceScreen.cs |
| 07-departure | 出征整备 | P0 | #depMain[data-departure-view="cover-v3"] | Screens/Hub/DepartPrepScreen.cs<br>Screens/Hub/PreparationScreen.cs |
| 08-bag | 背包主界面 | P0 | .bag-v2.ui-design-system.bag-art-v3 | Screens/Bag/BagScreen.cs<br>Screens/Bag/BagCardDetail.cs |
| 09-safe-pocket | 安全格/消耗区 | P1 | .bag-grid[data-zone="safe/pocket"] | Screens/Bag/BagScreen.cs<br>Screens/Bag/BagCardDetail.cs |
| 10-containers | 锦囊/珍珠盒 | P1 | .container-store.collection-workspace | Screens/Bag/ContainerScreen.cs |
| 11-settings | 设置 | P1 | .settings-page.settings-tabbed / .settings-layout | Screens/Menu/MenuDialogs.cs |
| 12-photo | 照相馆 | P1 | .photo-studio-v3.studio-unified.studio-archive | Screens/Misc/CardLibraryScreen.cs |
| 13-photo-detail | 照片详情/背签 | P1 | #cardZoom.cz-photo / .cz-photo-layout | Screens/Misc/PhotoDetailScreen.cs |
| 14-achievements | 成就总览 | P1 | .achievement-gallery | Screens/Menu/MenuDialogs.cs |
| 15-trade | 交易所 | P1 | .trade-v5.trade-v12 | Screens/Hub/HubModernPages.cs |
| 16-archive | 收藏室/卡背/故事 | P1 | .archive-v12 / .av3-* | Screens/Hub/HubModernPages.cs<br>Screens/Hub/HubScreen.cs<br>Screens/Hub/CardBackPickerScreen.cs<br>Screens/Hub/StoryArchiveScreen.cs |
| 17-courtyard | 庭院 | P1 | .courtyard-v3.courtyard-zzz | Screens/Hub/CourtyardScreen.cs<br>Screens/Hub/KoiPondGraphic.cs |
| 18-events | 事件/入城/火堆/拾取共用插画房间 | P0 | .event-themed.illustrated-node | Screens/Run/RunUi.cs<br>Screens/Run/EventDialogScreen.cs<br>Screens/Run/EventDialogChoices.cs<br>Screens/Run/EntrySupplyScreen.cs<br>Screens/Run/FireRestScreen.cs<br>Screens/Run/PickupScreen.cs |
| 19-rewards | 奖励/宝箱/战后领取 | P0 | .reward-v14.room-reward / .cqo-frame | Screens/Run/ChestOpenScreen.cs<br>Screens/Run/PickupScreen.cs |
| 20-extraction | 撤离整理 | P1 | #exMain / .exr-* | Screens/Run/ExtractScreens.cs |
| 21-settlement | 撤离完成/失败/放弃结算 | P1 | .settlement-report / #exDone / [data-leave-step="complete"] | Screens/Run/ExtractScreens.cs<br>Screens/Menu/MenuDialogs.cs |
| 22-map-hud | 地图HUD | P0 | #runTopBar / #sidebar[data-expedition-layout="map"] | Kit/DesktopRunHud.cs |
| 23-battle-hud | 战斗场景/HUD | P0 | .battle-stage.sts / .sts-resource-dock / .sts-hud | Screens/Battle/BattleScreen.cs<br>Screens/Battle/BattleWidgets.cs<br>Screens/Battle/BattleSubpages.cs |
| 24-hand | 手牌/指向/翻栏 | P0 | .sts-hand / .bt-slot / .bt-card[data-hand-state] | Screens/Battle/HandPanel.cs<br>Screens/Battle/BattleScreen.cs<br>Screens/Battle/AimArrow.cs |

## 可执行条目

### 01-home 首页（独立重建，仅冻结版本） (P0)

**当前原始代码契约：** index.html内home-scene七壁纸层；左home-command品牌+进入城市/生存指南，右home-support收藏/系统；footer静音/留言/壁纸；制作名单dialog，壁纸纯欣赏按钮。

**Unity已证实差异：** 此页独立代理负责重建；本表不使用旧planning和旧passed判断当前实现。

**旧实现不可直接复用部分：** 沿旧版标题入口的按钮位置与分组不能作为版本基线。

**可观察完成条件：** 以index.html当前DOM、上述控制器和CSS原值映射；七壁纸、只看壁纸、footer、制作名单入口可逐项观察。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/ui/game-title-controller.js `45696c507f59`；game/src/ui/title-wallpaper.js `825c8fc8d9b3`；game/src/ui/home-menu-motion.js `4d0f2b613c9d`；game/src/ui/home-fx.js `57281b9a9c25`；game/src/ui/title-credits.js `93b238bf0d72`。

CSS：game/css/title-p0.css `b8ffa57c729c`；game/css/home-ui-tokens.css `cf985b45cf4f`；game/css/home-menu-motion.css `d8d06606f2e1`；game/css/home-polish.css `c3c4a76fa783`；game/css/title-credits.css `3c76c2fd6b88`；game/css/home-linked-interactions.css `ca5e34915fc8`。

Unity快照：UnityUI/Screens/Menu/TitleScreen.cs `081b38961165`；UnityUI/Screens/Menu/CreditsScreen.cs `a3d348e00274`。

### 02-slots 选档 (P1)

**当前原始代码契约：** 五档；真实SLOT_EMBLEMS；当前局层数/人物/生命/金币/上次保存，游玩与成就置于details“更多档案信息”；最近档案状态；page-slot-select卡宽264～280、间隔clamp24～44、卡角框。

**Unity已证实差异：** Unity固定1560×560、5×280×540，徽记SlotGlyph字形；SlotInfo仅游玩时间与成就；背景只有随机光斑，缺当前源SVG剪影。

**旧实现不可直接复用部分：** SlotInfo信息树、SlotGlyph、固定deck尺寸、纯光斑背景不等价。可复用读档/确认命令须另审守卫。

**可观察完成条件：** 新档/有基地无run/进行中run/读取错误四态字段、CTA与可用性逐项对应；更多信息可展开；徽记与源原图形一致。

**功能证据边界：** 已证实选档呈现缺run进度/资源/保存时间；读档业务结果待验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/ui/menu-slots.js `205c9869427b`；game/src/ui/menu-slot-view.js `25c1e9e00f24`；game/src/ui/slot-emblems.js `0bf838627ed1`。

CSS：game/css/page-slot-select.css `864b16a583bc`；game/css/archive-back.css `d893b6a0396f`；game/css/review-ui.css `911bd4c7a4d5`。

Unity快照：UnityUI/Screens/Menu/SlotPickerScreen.cs `95d8b209cd5a`。

### 03-base-shell 基地共用外壳与导航 (P0)

**当前原始代码契约：** game.hub.js静态样式+动态runtime；头84px、返回路径/房间标题/档案/四资源胶囊；内容grid下方104px七房间底部导航。顺序基地/人物/后勤/交易所/收藏室/建设/庭院。共享base-v12玻璃与base-operations-v5背景。

**Unity已证实差异：** Unity HubScreen.Build为纯深蓝纵布局、顶部帮助/资源文字chips、顶部8旧页签，另设ach与collection；返回直接主菜单。

**旧实现不可直接复用部分：** Build壳的旧页签结构、顶部导航、无房间标题/档案、旧closeBase目标不可直接沿用。

**可观察完成条件：** 所有七房间共用同一84px头和104px底导航，位置/选中/待领数一致；基地返回选档，子页按hubBackTarget返回；tab切换保留源规定滚动/焦点与入场生命周期。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/hub/game.hub.js `a8a10366a8ca`；game/src/hub/game.hub.runtime.js `7b86625bfb0c`；game/src/hub/hub.presentation.js `abf38aeb0909`；game/src/hub/hub.navigation-v7.js `a5af60b6fe8a`；game/src/hub/hub.materials.js `25d9e187ef7f`。

CSS：game/css/base-camp-rework.css `2d3d0a2c9926`；game/css/base-glass-tokens.css `789fcd0ddfcd`；game/css/base-controls-v4.css `1fece298187d`；game/css/base-panel-layout.css `b96271698eff`；game/css/base-cohesion-v5.css `54f4c89bdbdd`；game/css/base-framework-v7.css `2c0bf5d41221`；game/css/base-rooms-v7.css `39a0e8821703`；game/css/base-page-motion-v7.css `3fe8d76dcc52`。

Unity快照：UnityUI/Screens/Hub/HubScreen.cs `5ebfcf53cdb3`。

### 04-base-home 基地首页 (P0)

**当前原始代码契约：** 左上事务卡：首次目标/可扩建/可孵化/待领，或空态；右420px整备卡top clamp40px,14%,120px、right48px：人物/带牌事实、出征整备或继续整备、正常入城/直入敌腹、携带预设、条件研究所/待复原。base-room-art自身display:none，背景由壳token供给。

**Unity已证实差异：** Unity BuildDeploy旧选择玩法card列表+出征预报+宝藏大门，与源的事务/整备两面板结构和信息层级不同。

**旧实现不可直接复用部分：** BuildDeploy全部旧呈现几何/分组；不能只加背景或改颜色宣称迁移完成。

**可观察完成条件：** 空档、首次目标、可扩建/孵化/奖励、已有整备草稿、两难度、研究所已解锁、待复原等条件下，出现/隐藏、文字、路由和布局与源一一对应。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/hub/game.hub.depart.js `2c637b4d4acf`；game/src/hub/hub.home-v3.js `c941b3575798`；game/src/hub/hub.home-icons-v10.js `1f8a8a580596`。

CSS：game/css/base-home-v7.css `09be7ac2ad87`；game/css/base-glass-tokens.css `789fcd0ddfcd`；game/css/base-framework-v7.css `2c0bf5d41221`。

Unity快照：UnityUI/Screens/Hub/HubScreen.cs `5ebfcf53cdb3`。

### 05-base-logistics 后勤/建设/人物房间 (P1)

**当前原始代码契约：** pages仅组织陈列，warehouse/personnel/facilities分别持有视图与绑定；后勤cards/pocket及过滤浏览，卡牌直接inventory-zoom操作台；人物由personnel分组/详情/伙伴管理；建设由设施目录+详情与缺料状态组织。

**Unity已证实差异：** Unity BuildStash/BuildUpgrade/BuildClasses仍Section和逐行文字/进度条，人物另列宠物与外观屏；未复现当前各独立房间工作台结构。

**旧实现不可直接复用部分：** BuildStash/Upgrade/Classes呈现层、旧StashItemModal信息组织与独立列表式宠物入口不能当当前源房间模板。

**可观察完成条件：** 沿源的三个模块分工迁入；后勤详情返回定位/筛选、人物主类与伙伴切换、设施选中/缺料/操作反馈保持；不新增替代流程。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/hub/game.hub.pages.js `5bab54467230`；game/src/hub/hub.warehouse.js `d99bcf65c9ac`；game/src/hub/hub.personnel.js `37796e2e5664`；game/src/hub/hub.facilities.js `a6ce60246e47`。

CSS：game/css/base-rooms-v7.css `39a0e8821703`；game/css/base-personnel-v12.css `55b4ee0a9d24`；game/css/base-logistics-trade-v12.css `962d79109e0d`；game/css/base-archive-facilities-v12.css `16dd8568baef`；game/css/card-browser.css `b4ff6b96ff25`；game/css/inventory-zoom.css `573455d016b5`。

Unity快照：UnityUI/Screens/Hub/HubScreen.cs `5ebfcf53cdb3`；UnityUI/Screens/Hub/HubPets.cs `f8d9c07ee447`；UnityUI/Screens/Hub/CharacterAppearanceScreen.cs `def56f9f869d`。

### 06-character 出征选人 (P0)

**当前原始代码契约：** cls2-stage全身人物舞台+右信息，底部头像strip；机制/生命攻击/每回合技能/折叠成长/皮肤/完整卡池；01模式→02人物→03整备；标准立绘按roster-reference中人物透明边界参数定位。

**Unity已证实差异：** Unity cls-page左3列150×190小立绘网格+右故事/任务详情，未用当前cls2舞台、机制层级和皮肤条；正常流程在整备NewRun后才ClassChoiceOpened。

**旧实现不可直接复用部分：** ClassChoiceScreen.Build主体、旧故事/任务优先布局及禁止Esc的单一规则不可原封复用到基地选择态。

**可观察完成条件：** 人物页在整备之前；同选五人物、标准/皮肤、机制技能、成长、卡池详情及返回确认的步骤/坐标/当前人物标记可与源逐项对拍。

**功能证据边界：** 已证实页面结构错版；GameRuntime.NewRunCore在characterId=null发ClassChoiceOpened，默认整备先于选人，与Vite顺序不同。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/run/game.run.class-choice.page.js `1afc1f86e94c`；game/src/run/game.run.class-choice.js `a81dfce40a84`；game/src/ui/character-idle.js `0c9b1bda408f`；game/src/ui/character-view-motion.js `7d72aa15f10a`。

CSS：game/css/expedition-roster.css `0d684bf10cd2`；game/css/roster-departure-v2.css `be88e89679b9`；game/css/base-camp-rework.css `2d3d0a2c9926`；game/css/roster-reference.css `01bc6f688eab`；game/css/character-idle.css `f9adedfa29c2`。

Unity快照：UnityUI/Screens/Run/ClassChoiceScreen.cs `a06ab28e3c99`。

### 07-departure 出征整备 (P0)

**当前原始代码契约：** 已选人物后进入；左真实仓库卡面含剩余/已带、rarity/type/cost筛选，右背包格子含固定初始牌，拖放/点击看卡；人物/伙伴/推荐与撤销按源状态模块；稳定stackKey与草稿跨返回保留；view-updates局部更新。

**Unity已证实差异：** Unity左右都是卡名stepper纵列，Open重置_pick和预选人物；普通ConfirmDeploy用null人物启动局后再选人；未接当前卡面网格与拖放结构。

**旧实现不可直接复用部分：** 旧文本stepper视图、Open无条件清空草稿、整备先于选人的生命周期不能复用。

**可观察完成条件：** 人物→整备→返回再进保留草稿；推荐/撤销、筛选、剩余张数、背包容量、伙伴与固定牌、拖回移除、确认锁和失败保留均沿原模块职责迁入。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/hub/game.hub.depart.js `2c637b4d4acf`；game/src/hub/departure.view-updates.js `08d3e8e64236`；game/src/hub/departure.drag.js `c2b00eddd459`；game/src/hub/departure.summary.js `552e175a199e`；game/src/hub/departure.selection-state.js `c4d0ae39cc85`。

CSS：game/css/departure-selected.css `e5eee8332021`；game/css/base-camp-rework.css `2d3d0a2c9926`；game/css/preparation.css `62f6d8156938`。

Unity快照：UnityUI/Screens/Hub/DepartPrepScreen.cs `36f02b2ef656`；UnityUI/Screens/Hub/PreparationScreen.cs `48474346bc9a`。

### 08-bag 背包主界面 (P0)

**当前原始代码契约：** view2为纯渲染，壳持动作；地图氛围背景+bag-shell；左竖轨关闭/背包/安全格/消耗区，右单区容量/张数/筛选/排序/整理与真实卡面；点击inventory-zoom操作台，卡堆有稳定UID。

**Unity已证实差异：** Unity旧bag-view顶4chips，同屏背包格+安全格+右消耗口袋，且flip3d双击翻背，不是当前单区切换结构。

**旧实现不可直接复用部分：** Build的bag-head/bag-layout树和flip3d主交互不能作为当前view2；容量与UID命令是否复用另核。

**可观察完成条件：** 背包单区切换、卡牌张数与占格分别显示、资源卡面、筛选空态/显示全部、排序禁用/整理、点击特写、关闭B/Esc均与源对应。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/hub/game.bag.js `b0203137bf7c`；game/src/hub/game.bag.view2.js `2fa98640901f`；game/src/hub/game.bag.rules.js `631f5316a1d2`。

CSS：game/css/expedition-inventory.css `7136bc5273a8`；game/css/page-rewards-bag-help.css `82d3871b5ffc`；game/css/bag-design-system.css `f334253767c5`；game/css/feedback-1018.css `f7044bbef00d`；game/css/ui-design-system.css `604ae07fae7b`。

Unity快照：UnityUI/Screens/Bag/BagScreen.cs `291217c144b9`；UnityUI/Screens/Bag/BagCardDetail.cs `27a2517eb5c7`。

### 09-safe-pocket 安全格/消耗区 (P1)

**当前原始代码契约：** 与背包同壳单区；safe占格/卡牌数与押运状态，pocket张数/不限容量与已消耗卡面；按道具/装备或招式给火堆不可复原/可复原状态。

**Unity已证实差异：** Unity安全格为主列第二个网格；消耗口袋是右列文字清单；不具源竖轨、标题容量和消耗卡面层级。

**旧实现不可直接复用部分：** 右口袋文字列表和始终显示双网格的几何不可复用。

**可观察完成条件：** 相同UID堆进入safe/pocket后，单区标题、数量、押运/复原状态、允许动作和返回背包状态与源一致；模型存取另以真实输入核验。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/hub/game.bag.view2.js `2fa98640901f`；game/src/hub/game.bag.js `b0203137bf7c`；game/src/hub/game.bag.rules.js `631f5316a1d2`。

CSS：game/css/bag-design-system.css `f334253767c5`；game/css/feedback-1018.css `f7044bbef00d`。

Unity快照：UnityUI/Screens/Bag/BagScreen.cs `291217c144b9`；UnityUI/Screens/Bag/BagCardDetail.cs `27a2517eb5c7`。

### 10-containers 锦囊/珍珠盒 (P1)

**当前原始代码契约：** 共用纯containerStoreHTML；双栏已存入/随身背包真卡面，整叠存取按钮与查看详情分离；容量条、逐堆阻塞原因、折叠收纳说明；重绘保留focus/scroll/helpOpen。

**Unity已证实差异：** Unity单纵向滚动中的文字存/取按钮，缺卡面双栏、独立查看详情、阻塞原因展示和视图状态保留结构。

**旧实现不可直接复用部分：** ContainerScreen.Build单列文字按钮树不可复用；TryTransferStack命令仍需对原规则复核。

**可观察完成条件：** 空/满/容量不足/禁止类型/同名多堆下卡面与禁用原因一致，查看详情不触发转移，整叠操作后滚动/焦点/帮助展开按源保留。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/hub/game.container-store.view.js `caea9ade67f7`；game/src/hub/game.bag.js `b0203137bf7c`。

CSS：game/css/container-store.css `3318d1e8f4de`；game/css/collection-workspace.css `fb0d6e01f7e6`；game/css/battle-decision.css `6a91d4666c61`。

Unity快照：UnityUI/Screens/Bag/ContainerScreen.cs `701ab7a590b7`。

### 11-settings 设置 (P1)

**当前原始代码契约：** 四类通用/画面与反馈/音频/输入；左260px导航，右单panel；通用折叠数据与档案/危险操作/来源；音频实时值与失败恢复；性能、震动、减少动态、大字、结束长按、输入绑定与战斗重启条件入口。

**Unity已证实差异：** Unity SettingsScreen通用+音频+危险区平铺单列，只有4通用开关/两音频开关滑杆和清空；缺当前分类与其余控件。

**旧实现不可直接复用部分：** Build的单列分组、旧中英混排文案与危险区常显层级不可复用。

**可观察完成条件：** 四分类显示、键盘切类、折叠恢复、所有当前源可用控件及条件显示、即时保存/失败恢复按原值迁入；桌面特定适配明确登记，不静默省略。

**功能证据边界：** 已证实当前Unity设置屏未挂载画面/输入/大字/结束长按等源控件；对应引擎功能是否已在其他处实现未验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/ui/menu-settings.js `d8d1c0a70def`；game/src/ui/settings-navigation.js `53382bc468f9`；game/src/ui/settings-input.js `d00ee46ed1ce`；game/src/ui/settings-audio.js `3541c1f986d7`；game/src/ui/settings-battle-restart.js `7881e7291642`；game/src/ui/performance-settings.js `fc9afd76c425`。

CSS：game/css/page-settings.css `0f8c66f50c22`；game/css/settings-navigation.css `0b2545d10d37`；game/css/settings-audio.css `57c2c3a75bb4`；game/css/performance-settings.css `ca1d7281689d`；game/css/interface-components.css `9744ef4d51fe`。

Unity快照：UnityUI/Screens/Menu/MenuDialogs.cs `fc4248705a41`。

### 12-photo 照相馆 (P1)

**当前原始代码契约：** 正式page延迟入口；照片纸边/稀有度挂载道具/编号，分类/搜索/稀有度/人物/排序，选片台资料与前后/定位，window-mount网格；开发编辑模式单独开启。

**Unity已证实差异：** Unity普通卡面6列网格+左卡预览和上下页，不具照片挂载/房间/选片台形态；筛选用循环按钮取代源控件；当前不能按旧CardLibrary DOM声明为照相馆等价。

**旧实现不可直接复用部分：** CardLibraryScreen.Build、RebuildGrid的普通卡片呈现与固定分页不能复用为当前照片陈列。

**可观察完成条件：** 沿源photo props/mounts/controls/navigation拆分复现照片纸型、原始插画比例、分类筛选、选片台定位和滚动/筛选返回；不以换插画代替照片系统。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/hub/game.cardslib.js `ad502d05463b`；game/src/hub/game.cardslib.page.js `26ee26b09d04`；game/src/hub/photo-studio-presentation.js `b93af0e7507f`；game/src/hub/photo-studio-controls.js `b2a582cad98f`；game/src/hub/photo-studio-navigation.js `b1c23f153cb8`；game/src/ui/collection-chrome.js `6060bae086fb`。

CSS：game/css/expedition-library.css `db8cac5f7f3a`；game/css/collection-chrome.css `c3a859b244ce`；game/css/photo-studio-mounts.css `9c036b4cca8c`；game/css/photo-studio-unified.css `9920efa17a53`；game/css/photo-studio-room-effects.css `fa2b6b95bec7`。

Unity快照：UnityUI/Screens/Misc/CardLibraryScreen.cs `2db8ec3bd1cb`。

### 13-photo-detail 照片详情/背签 (P1)

**当前原始代码契约：** 同一zoom控制器的photo分支：纸照片+右背签两栏1.7:.8、原画尺寸约束、来源照片到zoom动效、前后浏览/返回焦点、手写备注/底稿。

**Unity已证实差异：** Unity纯深底Image+文字输入栏flex2:1、显式保存按钮和循环翻张；缺纸/背签/来源连续动效与源边界规则。

**旧实现不可直接复用部分：** PhotoDetailScreen.Build纯图与输入框不能复用为当前photo zoom呈现；备注保存命令需保留源失败语义。

**可观察完成条件：** 从当前照片打开/关闭回到同一片，原画无裁切；前后可用边界、备注自动/显式保存时机、失败保留和纸背签几何与源对应。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/ui/card-zoom-controller.js `f8a40e519787`；game/src/ui/card-zoom-content.js `12edab3f2514`；game/src/ui/card-zoom-photo-source.js `9ec9f518b740`；game/src/cards/card-photo-notes.js `e5b584cc493c`；game/src/hub/game.cardslib.page.js `26ee26b09d04`。

CSS：game/css/photo-studio-unified.css `9920efa17a53`；game/css/photo-studio-zoom-motion.css `d4918b1effd8`；game/css/photo-studio-mounts.css `9c036b4cca8c`。

Unity快照：UnityUI/Screens/Misc/PhotoDetailScreen.cs `2d225f033431`。

### 14-achievements 成就总览 (P1)

**当前原始代码契约：** 浅灰绿#e5e7e2陈列室；分类奖章+统计/进度，搜索和获得状态筛选，列表/网格切换，右320～420详情，奖章图形、获得方式与奖励、前后/收起、展柜灯光。

**Unity已证实差异：** Unity AchievementsScreen深色普通overlay列表，一行图标/名称描述/领取状态，缺分类搜索、图形奖章、右详情与视图切换。

**旧实现不可直接复用部分：** AchievementsScreen.Build普通列表结构不能作为当前gallery。

**可观察完成条件：** 无档/锁定/解锁/待领/已领均可过滤；分类与列表网格、右详情前后/收起及奖章样式按源可观察；总览保持只读，奖励回基地领取。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/ui/game.menu.pages.js `ea2a39207769`；game/src/ui/menu-guide.js `a4ed310200c6`；game/src/ui/achievement-gallery.js `0f8ec59b6567`；game/src/ui/achievement-medals.js `d47fee5b4c84`；game/src/ui/achievement-motion.js `2c5e23e8d9f3`；game/src/ui/collection-chrome.js `6060bae086fb`。

CSS：game/css/page-ach.css `4595797b2915`；game/css/title-achievements.css `4cccbe4c131c`；game/css/collection-chrome.css `c3a859b244ce`。

Unity快照：UnityUI/Screens/Menu/MenuDialogs.cs `fc4248705a41`。

### 15-trade 交易所 (P1)

**当前原始代码契约：** 左购入/出售/后勤入口，中商品分类（全部/基地补给/战斗卡牌）与货架，右交易台卡面/描述/持有/账面/单张与整堆动作；稳定goodKey/sellKey，保护/缺币/仓满原因。

**Unity已证实差异：** Unity BuildTrade购入逐行后接出售逐行，无模式、分类、选中交易台、整堆出售与账面信息层级。

**旧实现不可直接复用部分：** BuildTrade纵向清单不可复用；TryPurchase/Sell命令仅为候选能力。

**可观察完成条件：** 买卖模式/分类切换保留选中，交易台账面与按钮条件/禁用理由、单张/整堆和保护状态按源展示，交易后视图状态保持。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/hub/game.hub.runtime.js `7b86625bfb0c`；game/src/hub/hub.trade-shop-v5.js `1819d85e12cf`；game/src/hub/stash-sale-price.js `2ba63a9a490b`。

CSS：game/css/base-logistics-trade-v12.css `962d79109e0d`；game/css/base-framework-v7.css `2c0bf5d41221`；game/css/base-glass-tokens.css `789fcd0ddfcd`。

Unity快照：UnityUI/Screens/Hub/HubModernPages.cs `a7216120de3a`。

### 16-archive 收藏室/卡背/故事 (P1)

**当前原始代码契约：** 同一收藏室ach路由六section：已收藏/奖励/成就目标/收藏里程碑/卡背/故事；各section保留选中和详情；与人物培养/后勤动作分工明确。

**Unity已证实差异：** Unity ach与collection是两个顶层旧页签；BuildCollectionRoom混合里程碑奖励、保护与经验转化；卡背/故事为独立旧屏入口。

**旧实现不可直接复用部分：** 两个顶层页签和混排BuildCollectionRoom不能复用为archive-v3；原样迁移须按SECTIONS路由及当前持久化分工。

**可观察完成条件：** 六section和返回路径/选中/奖励提醒等与源对应；永久收藏画廊的fresh scope缺陷由主会处理，本审查不重复定性或扩挖。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/hub/hub.archive-v3.js `6167efee959b`；game/src/hub/hub.collection-v4.js `7bf4f3bed10d`；game/src/hub/hub.archive.js `804424faeb14`；game/src/hub/game.hub.pages.js `5bab54467230`。

CSS：game/css/base-archive-v3.css `0ccce69b4ca4`；game/css/base-collection-v4.css `b4fbc5c58baa`；game/css/base-archive-facilities-v12.css `16dd8568baef`；game/css/base-framework-v7.css `2c0bf5d41221`。

Unity快照：UnityUI/Screens/Hub/HubModernPages.cs `a7216120de3a`；UnityUI/Screens/Hub/HubScreen.cs `5ebfcf53cdb3`；UnityUI/Screens/Hub/CardBackPickerScreen.cs `553305453349`；UnityUI/Screens/Hub/StoryArchiveScreen.cs `d514e60a88b7`。

### 17-courtyard 庭院 (P1)

**当前原始代码契约：** 保持基地同一壳；场景由backdrop/锦鲤/雨三个canvas层；底部玻璃控制条仅提示/进度/雨/投喂，环境设置details上浮：雨势/声/暂停/配色；偏好/延迟加载/失败恢复与dispose。

**Unity已证实差异：** Unity独立全屏CourtyardScreen自带标题返回，底部所有控制平铺一行；图层只有背景Image与KoiPondGraphic，未对应源三层职责。

**旧实现不可直接复用部分：** 独立壳与全部按钮常显不可复用。锦鲤模型可候选复用但需按当前canvas runtime重审渲染/输入/雨。

**可观察完成条件：** 庭院在基地七页壳内，三图层和环境设置收展一致；投喂/发现/偏好与雨关闭禁用、暂停恢复/离开销毁可观察。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/hub/hub.courtyard-v3.js `ad2f0c2bcd96`；game/src/hub/hub.courtyard-runtime.js `f1f4241af290`；game/src/hub/courtyard.rain-tableau.js `9cc5c83974f2`。

CSS：game/css/base-courtyard-v3.css `977142ab7ea8`；game/css/base-framework-v7.css `2c0bf5d41221`。

Unity快照：UnityUI/Screens/Hub/CourtyardScreen.cs `f2b65629aad7`；UnityUI/Screens/Hub/KoiPondGraphic.cs `a4af26325321`。

### 18-events 事件/入城/火堆/拾取共用插画房间 (P0)

**当前原始代码契约：** eventSceneHTML统一故事/决策双区；illustratedNodeLayout和选项ghost；真实共用topbar。多选事件先选中→底部显示选项/详情→取消或确认；单项叙述去重；各原业务caller持guards/reward/storage。

**Unity已证实差异：** Unity NodeShellPanel仍右55%～97%单玻璃框，所有故事/按钮纵列；EventOptButton直接执行；未对应当前共用故事/决策布局与选择确认态。

**旧实现不可直接复用部分：** NodeShellPanel.Build旧右玻璃框和直接点击执行式选项呈现不可复用；事件效果命令保留候选。

**可观察完成条件：** 四类房间按原tone走同一插画壳；同一窗口可观察故事/选项/ghost、选择后确认/取消、禁用理由和共享资源HUD；重复事件fresh scope由主会单独处理。

**功能证据边界：** 仅证实当前共用呈现与选择流程差异；具体事件效果和重复领取不在本项复验。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/ui/node-scene-view.js `e22d43081d8e`；game/src/ui/illustrated-node.js `ad4382691553`；game/src/ui/event-choice-selection.js `04540bcae00a`；game/src/ui/event-option-state.js `1c9ec4488a0f`；game/src/run/game.run.scenes.js `759b53a8fafb`。

CSS：game/css/page-events.css `d2bc908ffc89`；game/css/entry-events.css `c43428a01099`；game/css/illustrated-node.css `7b2dbdf38399`；game/css/event-option-state.css `bf062379e7b7`；game/src/ui/run-top-bar.css `11449375450e`。

Unity快照：UnityUI/Screens/Run/RunUi.cs `ae948c9074db`；UnityUI/Screens/Run/EventDialogScreen.cs `27e9385224ee`；UnityUI/Screens/Run/EventDialogChoices.cs `6f35725191bd`；UnityUI/Screens/Run/EntrySupplyScreen.cs `97dad6d8af5f`；UnityUI/Screens/Run/FireRestScreen.cs `e1d300c8a19d`；UnityUI/Screens/Run/PickupScreen.cs `b366cd5dab48`。

### 19-rewards 奖励/宝箱/战后领取 (P0)

**当前原始代码契约：** rewardSceneHTML纯展示+调用者结算；真实卡面独立查看与claim，one/all模式和附赠分组；待领/已收/放弃状态、容量不足转整理、固定footer；patch保持卡面与滚动连接；宝箱总览/逐箱切换。

**Unity已证实差异：** Unity ChestOpenScreen以CardFace+普通领取按钮和尾部全部/整理/返回为主，缺当前reward-unit模式层级与原完成回执呈现；共享rewardScene层未建立。

**旧实现不可直接复用部分：** 旧宝箱独立按钮布局和pickup旧NodeShell不能代表reward-v14；纯展示和结算命令需按源分离。

**可观察完成条件：** 互斥选择/全取/独立附赠、查看返回、满包整理回归、已收与放弃卡面状态、总览和完成回执逐态对应，操作后不重置阅读位置。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/run/chests.js `fd42e9bde3b8`；game/src/ui/reward-scene-view.js `51ecb9a8bbed`；game/src/ui/reward-interaction.js `143a5072221e`；game/src/ui/chest-reward-overview.js `ef62cef740d1`；game/src/ui/reward-card-feedback.js `4809cc164e23`。

CSS：game/css/room-rewards.css `9cb3c421c390`；game/css/room-footer.css `74323c44d305`；game/css/chest-reward-overview.css `f1e37047dfa0`；game/css/reward-completion-receipt.css `0bfa74955b4e`。

Unity快照：UnityUI/Screens/Run/ChestOpenScreen.cs `ff222540ec88`；UnityUI/Screens/Run/PickupScreen.cs `b366cd5dab48`。

### 20-extraction 撤离整理 (P1)

**当前原始代码契约：** 真实卡面按稀有度显示，原index保留；待入库/已入库、容量/材料、待复原/散失分项、智能入库、剩余与完成确认、失败待重试的pendingDeposit，人物成长与本局纪念。

**Unity已证实差异：** Unity ExtractStashScreen旧两栏文本行+入库按钮/自动入库四行，无当前卡面/待存已存分区和原源详细回执结构。

**旧实现不可直接复用部分：** ExtractStashScreen.Build与旧纯文本两栏不可复用。实际结算/保存逻辑由主会功能审查单列。

**可观察完成条件：** 逐张/整堆容量、智能入库顺序、部分可放数量、待存重试、完成确认、材料与口袋说明按源原输出对应；清理不改变待入库命令索引。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/ui/extraction-rewards-view.js `10b9fcf20e77`；game/src/hub/extraction.commands.js `225e3a8c4788`；game/src/ui/extraction-stash-update.js `217f91b8a7ae`；game/src/ui/run-memento-view.js `08fa5be93d95`。

CSS：game/css/extraction-rewards.css `c9894114a4f5`；game/css/run-memento.css `10fc0784cfdd`；game/css/interface-components.css `9744ef4d51fe`。

Unity快照：UnityUI/Screens/Run/ExtractScreens.cs `d0de5144724a`。

### 21-settlement 撤离完成/失败/放弃结算 (P1)

**当前原始代码契约：** 统一报告壳heading/content/actions，max1000px、固定动作与中部滚动；facts/说明折叠/成长/纪念；bindSettlementActions统一busy/失败提示/重试且调用者持持久化。

**Unity已证实差异：** Unity ExtractDone仍NodeShell、Death旧overlay文本，与当前统一报告组件职责和信息分区不同。

**旧实现不可直接复用部分：** 旧ExtractDone/Death呈现树与普通返回按钮分散守卫不能直接复用。

**可观察完成条件：** 成功/死亡/放弃各自用当前caller输出的字段、保留/损失/成长/纪念、CTA顺序，跳转失败留报告并可重试，重复按键只执行一次。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/ui/settlement-report.js `4eba53111674`；game/src/ui/extraction-rewards-view.js `10b9fcf20e77`；game/src/run/game.session.death.js `58250eacf239`；game/src/ui/menu-leave.js `990177a9afaa`；game/src/ui/run-memento-view.js `08fa5be93d95`。

CSS：game/css/settlement-report.css `0c47e22e8717`；game/css/extraction-rewards.css `c9894114a4f5`；game/css/run-memento.css `10fc0784cfdd`；game/css/ui-design-system.css `604ae07fae7b`；game/css/interface-components.css `9744ef4d51fe`。

Unity快照：UnityUI/Screens/Run/ExtractScreens.cs `d0de5144724a`；UnityUI/Screens/Menu/MenuDialogs.cs `fc4248705a41`。

### 22-map-hud 地图HUD (P0)

**当前原始代码契约：** 实体共用104px透明顶栏：系统/头像生命/章节/金币攻击资源；底部88px悬浮无外框工具组，64px绘制图标、20/23px文案与容量细条；地图节点与目标由expedition.view输出。

**Unity已证实差异：** Unity独立MapStatus深色整条文字+背包/保存/离开，底部MapRoutes深色整条路线按钮；没有原topbar共用节点/底部浮动工具群。

**旧实现不可直接复用部分：** DesktopRunHud.Initialize/MakeBar的整条面板与汇总字符串不能复用；路由选择模型可候选保留。

**可观察完成条件：** 地图/事件/战斗切换同一资源顶栏不重复，头像详情/生命/金币/攻击/离开/静音可用；底部工具图标与容量态、当前目标与节点交互按原职责/数值迁入。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/run/expedition.view.js `5b3f04a046c8`；game/src/ui/run-top-bar.js `03ecd9f1672f`；game/src/ui/hud.js `9ddfca03add6`；game/src/ui/map-health-hud.js `e7516d707e2a`；game/src/core/renderer.js `b5ae9222fb5a`。

CSS：game/css/page-expedition-hud.css `a24477c92627`；game/css/expedition-map.css `77162927f051`；game/css/map-floating-tools.css `69049b91d706`；game/css/map-node-status.css `702b4b308c3f`；game/src/ui/run-top-bar.css `11449375450e`。

Unity快照：UnityUI/Kit/DesktopRunHud.cs `12b3169c1237`。

### 23-battle-hud 战斗场景/HUD (P0)

**当前原始代码契约：** loader动态view；stage-view留存区域/独立单位手牌层，当前winter-platform-minimal场景参数；共享104pxtopbar，场景左人物27%与右54%～90%敌群地面线；HUD满场绝对布局：edge56/bottom40，左资源dock176×76，手牌页104高，右战术宽248。

**Unity已证实差异：** Unity Render清空_stageRoot重建；arena26%～100%、HUD5.5%～20%三栏，左62px圆能量球；没有当前共享顶部栏与资源dock结构。

**旧实现不可直接复用部分：** Render全树重建、BuildHud的百分比三栏/能量球、旧场景分区参数不能复用当前stage。

**可观察完成条件：** 沿原stage-view区域与layers更新边界迁入；同源背景/人物敌群比例地面线、资源/能量/回合/状态/装备/战术与共享HUD匹配；busy/敌回合/菜单/子页往返状态保持。

**功能证据边界：** 仅证实结构/呈现/控件差异；业务结算和持久化未运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/battle/battle-loader.js `165eeddf61fe`；game/src/battle/view/battle.view.js `eb0f9bc90353`；game/src/battle/view/battle.stage-view.js `def5ad3701fd`；game/src/battle/view/battle.layers.js `747d2f12bf58`；game/src/ui/run-top-bar.js `03ecd9f1672f`；game/src/ui/battle-hud-info.js `88a61273bed1`。

CSS：game/css/battle-stage.css `ccebad0f54d6`；game/css/battle-scene-polish.css `26eb7f5d38a3`；game/css/battle-hud-clarity.css `e401617971de`；game/css/battle-equipment.css `6be571461bba`；game/css/battle-status-chips.css `e65afb9a61b4`；game/src/ui/run-top-bar.css `11449375450e`。

Unity快照：UnityUI/Screens/Battle/BattleScreen.cs `6c2b9795d517`；UnityUI/Screens/Battle/BattleWidgets.cs `e1f3bd8f1d24`；UnityUI/Screens/Battle/BattleSubpages.cs `1caf4994c584`。

### 24-hand 手牌/指向/翻栏 (P0)

**当前原始代码契约：** 每栏最多9组；handDisplayLayout CARD_WIDTH260、PREFERRED_STEP190、REST_DROP64，rot0/scale1，根据可用宽压叠距；stage手牌高300、卡260×390，常态下沉64，hover/focus抬到-30，选中/blocked/敌回合独立态；页前后边界与数字键/指向/回落。

**Unity已证实差异：** Unity HandPanel旧fan：rot=off*min(5,44/N)，pivot卡顶上方260，CardSize.Sm，hover上36×1.14/拖42×1.2；旧HUD中排，未对应源9组翻栏与水平布局。

**旧实现不可直接复用部分：** ApplyPose和Layout扇形公式、旧小卡尺寸/hover与逐帧全树重建不可复用；卡UID和业务调用保持独立。

**可观察完成条件：** 1/5/9/10+组按原同窗宽公式对拍；第2栏/新获得页提示、hover/键盘阅读、选中目标/取消/提交回落/blocked/敌回合、数字1～9选当前栏与源一致。

**功能证据边界：** 已证实布局公式与显示尺寸错版，现Unity手牌无原9组翻栏呈现；全部指向命令规则未在本审查运行验证。 原生输入、当前窗口像素/材质/动画与Vite实页对拍待主会统一验收。

JS：game/src/battle/view/battle.hand-layout.js `341c75ac4471`；game/src/battle/view/battle.layers.js `747d2f12bf58`；game/src/battle/view/battle.aim.js `96bcab11040b`；game/src/battle/view/battle.view.js `eb0f9bc90353`。

CSS：game/css/battle-stage.css `ccebad0f54d6`；game/css/battle-hand-overhaul.css `66985d7a2955`；game/css/battle-card-consumption-fx.css `a616a779ff17`；game/css/card-state-motion.css `c98e045a7472`。

Unity快照：UnityUI/Screens/Battle/HandPanel.cs `a73bd2f60316`；UnityUI/Screens/Battle/BattleScreen.cs `6c2b9795d517`；UnityUI/Screens/Battle/AimArrow.cs `cd47367dbdc6`。

## 冻结与验证边界

- 生成时逐项确认所列原始JS/CSS都在当前入口AST导入图内；保留完整SHA，未生成产品修改。完整入口链/源指纹/Unity原始快照都可机器核对。
- “已证实”仅限本文列举的源码结构、页面字段/控件和调用顺序；UI是否实际可点击、结算是否持久化、真实窗口渲染和动画均未执行。本表不冒充视觉验收。
- 父会话并行迁移会使Unity指纹自然漂移；这份快照用于确定本轮迁移差距，实施后的验收必须回读新SHA。
- 仅本目录产出：README.md、version-matrix.json、runtime-source-manifest.json及两份捕获脚本。无Unity启动、无前台动作、无compile/build、无生产写入。
