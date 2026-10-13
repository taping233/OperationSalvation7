# Vite 游戏素材目录

本目录存放 Vite 版游戏的图片、字体和音频。是否在当前运行时被引用，应核对 `game/data/art-mapping.json`、`game/src/` 的加载路径与 `game/assets/asset-manifest.json`；仅凭文件存在或清单条目不能判断素材可删。

可编辑原稿与生成过程放在 `game/art-source/`；人物定稿时点的参考快照放在 `docs/character-bible/ref-images/`；设计比较图、历史截图和验收证据放在 `docs/previews/`、`docs/evidence/` 等目录。它们与本目录的运行素材用途不同。以上路径均相对项目根目录。

新素材应记录来源与授权；已有字体、音效和卡图的来源说明分别见本目录下的 `fonts/`、`sfx/` 和 `cards/items/`。替换或删除素材前，先检查实际引用、来源记录及对应的视觉回归。

常无欲的战斗Sprite使用 portraits/frames/changwuyu/sprite-v1/（animations.json维护帧序和时长），静态兜底与新待机一致；四动作实装来源见 [10-10实装记录](../../docs/evidence/2026-10-10-changwuyu-install/README.md)。

白塔、黑像、星月的战斗Sprite使用 `portraits/frames/<角色>/sprite-v1/`。三人统一向右（含视线和姿势），待机、攻击、受击、死亡采用固定画布与各动作原稿时间步；攻击/受击首尾与待机同图，死亡末帧保持到结算。白塔和星月施法复用各自的攻击施法动作，黑像施法沿用静态基准。源图、透明帧、制作提示及验证边界见 [三人重制记录](../../docs/evidence/2026-10-10-three-role-sprites/README.md)。选人立绘保留当前版本，战斗静态兜底由播放器使用新待机基准。
