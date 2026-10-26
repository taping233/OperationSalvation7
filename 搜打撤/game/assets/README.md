# Vite 游戏素材目录

五位主角的战斗显示按待机透明边界换算身体尺寸，与敌方共用脚底基线；常无欲286、无278、白塔/星月270、低重心黑像252逻辑像素。战斗特效统一使用 `battle/fx-atlas.webp` 的16格透明图集：低饱和、开放笔锋与碎片轨迹，命中/元素/状态/治疗/卡牌流转按事件映射；旧伤害飘字、欢呼贴纸、道具与追加施放文字动效已退役，回合大字保留。来源与本轮未测试范围见[主角比例与特效记录](../../docs/evidence/2026-10-26-battle-fit-fx/README.md)。

剧情敌图已逐张核对27种，其中16种使用NAI4.5起稿＋内置imagegen重绘，包含10种非人形污染畸变体与6种现代人形；其余11种沿用符合设定的原图。运行图使用 `portraits/enemies/<id>.webp`，透明WebP与缩略图同步，侧向静止朝左；ID、数值、行为与奖励沿用。现行名称、逐张提示、来源及旧图备份见[本批记录](../../docs/evidence/2026-10-25-enemies-nai45/README.md)。

战斗实际使用 `portraits/cut/enemies/<id>.webp` 预烘图；上述16张已同步到这一路径。更新敌图时同步战斗派生图及 `game/src/core/enemy-portrait-presentation.js` 的轮廓/内容版本，避免战斗仍显示旧图。当前27种敌人的体型、脚底与中心对齐接入见[战斗比例记录](../../docs/evidence/2026-10-25-enemy-battle-fit/README.md)。

第十三批13张卡面当前为1:1正方形，原图1254×1254、缩略图448×448；沿老板逐轮选定版本适配方图，保留常无欲灵魂契约、星月三张星牌与收刀白花手下留情。完整提示词、原横版备份及原图/缩略图SHA256见[方图接入回执](../../docs/evidence/2026-10-20-tt13-card-art/square-1020/receipt.json)。

第十三批13张新增卡已补专属插画，由NAI4.5 Full沿现行v3.4画师链起稿、内置生图按游戏默认画风重绘；原图与缩略图通过`art-mapping.json`逐卡接入。完整提示词、生成参数与来源哈希见[本批记录](../../docs/evidence/2026-10-20-tt13-card-art/README.md)。

2026-10-19已按批准清单清理195项不再使用的旧素材：旧搜刮点/人物帧、旧地图与转场、退役场景和被新映射覆盖的卡图/缩略图；对应资源登记与生成缩略索引已同步。精确路径、原始指纹和验收边界见[清理记录](../../docs/evidence/2026-10-19-unused-cleanup/README.md)。当前素材映射、人物sprite-v1、许可证和可编辑源按各自入口维护，不用旧路径推断现行素材仍存在。

本目录存放 Vite 版游戏的图片、字体和音频。是否在当前运行时被引用，应核对 `game/data/art-mapping.json`、`game/src/` 的加载路径与 `game/assets/asset-manifest.json`；仅凭文件存在或清单条目不能判断素材可删。

普通战与首脑战的入口过场分别复用 `scenes/transition-battle-v2.webp` 和 `scenes/transition-boss-v2.webp`；选图由 `camp-entry.js` 与 `enterNode` 维护，现有文案、时长和战场准备流程沿用。接入与验证边界见[专用过场恢复记录](../../docs/evidence/2026-10-21-battle-cuts-reuse/README.md)。

战斗撤退、大门、祭坛、商店的过场使用 `scenes/transitions-1021/{retreat,door,altar,shop}.webp`，由 `transition-art.js` 维护独立映射；节点内容页与紧急撤离点仍沿用原背景。四图来源与接入验证见[重绘记录](../../docs/evidence/2026-10-21-four-transition-redraw/README.md)。

紧急撤离点、事件入口使用 `scenes/transitions-1021/{emergency-exit,event}.webp`，由 `transition-art.js` 选图；跨层、返回探索分别使用同目录 `layer-passage.webp`、`map-return.webp`，由 `transition-illustrations.css` 装饰现有遮层；普通加载等待通过 `page-loading.js` 显式选用 `loading.webp`，HTML预载三张公共图。内容页背景、照相馆专用切幕及原流程时长沿用；标题统一由 `transition-heading.js/css` 管理，随插画切幕一起退出。五图经NAI4.5起稿、默认画风内置简化重绘，[来源与接入记录](../../docs/evidence/2026-10-21-transition-12-16-remake/README.md)。

第一层普通战斗使用 `scenes/battle/stage-reset-1015/{backdrop,ground,foreground}.webp` 三层独立场景，来源为 NAI 起稿后内置重绘，接入见 `src/battle/view/battle.scenery.js`。地板的远沿过渡由 `css/battle-stage.css` 维护；后续章节及首脑场景仍按场景目录选择。[来源与实装记录](../../docs/evidence/2026-10-15-battle-stage-reset/README.md)注明本轮按老板要求未做实装验收。

`ui/home-nodes-1015/` 保留首页节点图标试作，当前首页使用原SVG线框图标；原稿、提示词与转换图SHA见[试作记录](../../docs/evidence/2026-10-15-home-nodes-set/README.md)。

可编辑原稿与生成过程放在 `game/art-source/`；人物定稿时点的参考快照放在 `docs/character-bible/ref-images/`；设计比较图、历史截图和验收证据放在 `docs/previews/`、`docs/evidence/` 等目录。它们与本目录的运行素材用途不同。以上路径均相对项目根目录。

旧搜刮点高分辨率帧与内联天气替代源图共91项仍保留登记，构建只在源字节与消费者审查都匹配时省略发布，规则见[性能说明](../../docs/performance.md#生产资源发布规则)。本地未跟踪的4份旧大箱原帧另存 `game/art-source/chests/large-rig-v1-local/`，保留原大小与SHA、不进Git；原位置与恢复依据见[档案记录](../../docs/evidence/2026-10-21-WF-github-perf-integrate-1021/local-source-archive.json)。

新素材应记录来源与授权；已有字体、音效和卡图的来源说明分别见本目录下的 `fonts/`、`sfx/` 和 `cards/items/`。替换或删除素材前，先检查实际引用、来源记录及对应的视觉回归。

首页壁纸列表为雪原公路、白塔与黑像、星月钢琴、无贝斯、白塔车站、星月芦苇、五人共餐七张；没有有效壁纸偏好时默认展示无贝斯，已有选择继续保留。各图采用独立图层，切换时以0.5秒交叉淡入淡出。五人共餐与选档界面共用 `slot-bg-knight-fantasy.webp`，采用疤痕与眼神修正版，来源与哈希见[接入记录](../../docs/evidence/2026-10-25-dinner-wallpaper-install/receipt.json)。无贝斯采用1672×941默认块面厚涂扩图版，来源与哈希见[接入记录](../../docs/evidence/2026-10-20-wu-bass-remix/install-receipt.json)；雪原公路来源见[记录](../../docs/evidence/2026-10-16-home-snow-road/receipt.json)。设置页背景仍用雪原公路。原 `wallpaper-wu-1004.webp` 与 `wallpaper-ensemble-1005.webp` 保留为退役存档。

星月芦苇使用1672×941夕照光影细化扩图版，加入第六张轮换，来源与哈希见[接入记录](../../docs/evidence/2026-10-20-xingyue-reeds-light-wallpaper/install-receipt.json)。

无的“春日·机车”“新春·旗袍”“盛夏·水枪”分别使用 `portraits/full/wu-casual-v14.webp`、`wu-spring-v15.webp`、`wu-beach.webp`，均为约1.30:1场景图。“春日·机车”采用2026-10-25 NAI5图生图＋内置默认画风重绘的减噪修订版，整理衣褶、发动机和轮毂细节，保留蓝衬衫黑短裤、坐姿与樱花机车场景，来源和旧图备份见[接入记录](../../docs/evidence/2026-10-25-wu-motorcycle-clean/install-receipt.json)。其余两图的扩图来源见[扩图记录](../../docs/evidence/2026-10-15-wu-skin-fill/README.md)。泳装此前的NAI构图及默认v1.0重绘过程见[泳装来源](../../docs/evidence/2026-10-15-wu-swim-nai/README.md)。

常无欲的战斗Sprite使用 portraits/frames/changwuyu/sprite-v1/（animations.json维护帧序和时长），静态兜底与新待机一致；四动作实装来源见 [10-10实装记录](../../docs/evidence/2026-10-10-changwuyu-install/README.md)。

白塔、黑像、星月的战斗Sprite使用 `portraits/frames/<角色>/sprite-v1/`。三人统一向右（含视线和姿势），待机、攻击、受击、死亡采用固定画布与各动作原稿时间步；攻击/受击首尾与待机同图，死亡末帧保持到结算。白塔和星月施法复用各自的攻击施法动作，黑像施法沿用静态基准。源图、透明帧、制作提示及验证边界见 [三人重制记录](../../docs/evidence/2026-10-10-three-role-sprites/README.md)。选人立绘保留当前版本，战斗静态兜底由播放器使用新待机基准。

## 常规搜刮点开箱帧（2026-10-16）

小型物资箱、密封物资箱、军用保险柜分别使用 `scenes/chests/supply-opening-v6/{small,medium,large}/frame-00.webp` 至 `frame-03.webp`，对应灰绿、烟紫、香槟金黑；总览闭合图与开箱动作同源。`fx/frame-00.webp` 至 `frame-03.webp` 是独立闪光，随解锁、爆光、余辉同步播放，帧内光效保留。职业箱与首脑箱仍使用原 `safe-simple-v7/`。

本轮素材来源、SHA256与接入边界见[实装记录](../../docs/evidence/2026-10-16-WF-chest-install-v6/README.md)。老板明确要求接入后不检测，本轮不宣称测试或游戏内验收通过。

白塔车站使用老板选定的持票手修订版扩图至1672×941，加入第五张轮换，来源与哈希见[接入记录](../../docs/evidence/2026-10-20-baita-station-wallpaper/receipt.json)。

无贝斯壁纸已在原图上移除按弦手右下角多余指尖，保留原手型；来源与哈希见[修订记录](../../docs/evidence/2026-10-26-wu-bass-hand/receipt.json)。
