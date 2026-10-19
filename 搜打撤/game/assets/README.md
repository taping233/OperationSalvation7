# Vite 游戏素材目录

2026-10-19已按批准清单清理195项不再使用的旧素材：旧宝箱/人物帧、旧地图与转场、退役场景和被新映射覆盖的卡图/缩略图；对应资源登记与生成缩略索引已同步。精确路径、原始指纹和验收边界见[清理记录](../../docs/evidence/2026-10-19-unused-cleanup/README.md)。当前素材映射、人物sprite-v1、许可证和可编辑源按各自入口维护，不用旧路径推断现行素材仍存在。

本目录存放 Vite 版游戏的图片、字体和音频。是否在当前运行时被引用，应核对 `game/data/art-mapping.json`、`game/src/` 的加载路径与 `game/assets/asset-manifest.json`；仅凭文件存在或清单条目不能判断素材可删。

第一层普通战斗使用 `scenes/battle/stage-reset-1015/{backdrop,ground,foreground}.webp` 三层独立场景，来源为 NAI 起稿后内置重绘，接入见 `src/battle/view/battle.scenery.js`。地板的远沿过渡由 `css/battle-stage.css` 维护；后续章节及首脑场景仍按场景目录选择。[来源与实装记录](../../docs/evidence/2026-10-15-battle-stage-reset/README.md)注明本轮按老板要求未做实装验收。

`ui/home-nodes-1015/` 保留首页节点图标试作，当前首页使用原SVG线框图标；原稿、提示词与转换图SHA见[试作记录](../../docs/evidence/2026-10-15-home-nodes-set/README.md)。

可编辑原稿与生成过程放在 `game/art-source/`；人物定稿时点的参考快照放在 `docs/character-bible/ref-images/`；设计比较图、历史截图和验收证据放在 `docs/previews/`、`docs/evidence/` 等目录。它们与本目录的运行素材用途不同。以上路径均相对项目根目录。

新素材应记录来源与授权；已有字体、音效和卡图的来源说明分别见本目录下的 `fonts/`、`sfx/` 和 `cards/items/`。替换或删除素材前，先检查实际引用、来源记录及对应的视觉回归。

首页当前使用 `reconstruction/wallpaper-snow-road-1016.webp`（老板指定雪原公路图，保持1672×941原尺寸），设置页沿用同图；切换壁纸功能保留，当前列表为1张。原 `wallpaper-wu-1004.webp` 与 `wallpaper-ensemble-1005.webp` 已退出首页选项、保留文件作退役存档。来源与哈希见[接入记录](../../docs/evidence/2026-10-16-home-snow-road/receipt.json)。

无的“春日·机车”“新春·旗袍”“盛夏·水枪”分别使用 `portraits/full/wu-casual-v14.webp`、`wu-spring-v15.webp`、`wu-beach.webp`，三图均已按当前人物大图容器约1.30:1补绘上下场景并实装；来源、备份和逐图预览见[扩图记录](../../docs/evidence/2026-10-15-wu-skin-fill/README.md)。泳装此前的NAI构图及默认v1.0重绘过程见[泳装来源](../../docs/evidence/2026-10-15-wu-swim-nai/README.md)。

常无欲的战斗Sprite使用 portraits/frames/changwuyu/sprite-v1/（animations.json维护帧序和时长），静态兜底与新待机一致；四动作实装来源见 [10-10实装记录](../../docs/evidence/2026-10-10-changwuyu-install/README.md)。

白塔、黑像、星月的战斗Sprite使用 `portraits/frames/<角色>/sprite-v1/`。三人统一向右（含视线和姿势），待机、攻击、受击、死亡采用固定画布与各动作原稿时间步；攻击/受击首尾与待机同图，死亡末帧保持到结算。白塔和星月施法复用各自的攻击施法动作，黑像施法沿用静态基准。源图、透明帧、制作提示及验证边界见 [三人重制记录](../../docs/evidence/2026-10-10-three-role-sprites/README.md)。选人立绘保留当前版本，战斗静态兜底由播放器使用新待机基准。

## 常规宝箱开箱帧（2026-10-16）

小型物资箱、密封物资箱、军用保险柜分别使用 `scenes/chests/supply-opening-v6/{small,medium,large}/frame-00.webp` 至 `frame-03.webp`，对应灰绿、烟紫、香槟金黑；总览闭合图与开箱动作同源。`fx/frame-00.webp` 至 `frame-03.webp` 是独立闪光，随解锁、爆光、余辉同步播放，帧内光效保留。职业箱与首脑箱仍使用原 `safe-simple-v7/`。

本轮素材来源、SHA256与接入边界见[实装记录](../../docs/evidence/2026-10-16-WF-chest-install-v6/README.md)。老板明确要求接入后不检测，本轮不宣称测试或游戏内验收通过。
