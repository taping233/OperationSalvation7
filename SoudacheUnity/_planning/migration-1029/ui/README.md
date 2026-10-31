# Unity 桌面迁移：界面与资源

本线续用现有 UIKit、页面类、Res 和 Ink 运行时；源 Vite 只读，没有重新生成美术。

## 已接入

- `sync_assets.py` 从现行 `art-mapping.json`、人物表、场景 CSS、音乐和采样目录生成 `CurrentAssets.cs`。422 个源文件按需导入，270 个卡牌专属映射、5 人三组立绘、8 套外观、31 敌人、42 场景别名、106 音效事件。新增现行地图节点、四层环境和主页七入口图。WebP 转 PNG 保留源像素；现行 BGM 转为 Unity 可导入的 Vorbis，其他采样按字节复制。来源、目标 SHA256 和尺寸见 `assets-receipt.json`。
- Res 保留旧调用入口，增加人物 full/battle/avatar、当前卡牌插画、分层战场和现行音频入口。动态创建 Sprite 按路径缓存，避免每次重绘重复创建。
- 地图 HUD 使用相邻节点的预览/二次确认；保存失败有可见提示。旧掷骰快捷键已停止调用。选档读取失败留页并保留损坏档。
- 界面只读卡牌收藏，制作坊及写卡入口关闭。入城补给、物资候选、祭坛/紧急撤离献祭、独立营火操作和终局撤离调用 GameRuntime 统一命令。
- 宝箱候选和领取进度进入节点收据；关闭不代选、不领取、不重掷；满背包和保存失败保留结果并允许重试。
- 战斗沿用现有手牌/选靶，加结构化效果选项、手牌必选、装备主动技能和职业技能入口；场景使用现行站台三层图。
- 盟友快照显示生命、攻击和状态；战斗页关闭时立即退订重绘。死亡页接收长整型损失价值，阻止 Escape 跳过结算。
- 独立战斗道具列表读取 `BattleSnapshot.Items`，使用命令为 `IBattleCommands.UseItem`；需目标的道具点选敌人，其余直接使用。实际可用范围由核心判定，不能通过界面绕过首脑战限制。
- UIKit 的默认文本使用已有中文字体，图标文字统一为可布局的单个 Text；滚动视口保留布局空间及裁剪。图标文字暂为字形降级，未宣称视觉完全等价。
- 基地新增交易所与收藏室页，人物页接外观预览/应用；新 Run partial 复用主会话事务入口，承接购买、收藏奖励、卡牌转化及外观保存。照相馆复用旧卡库的搜索/分类/卡图，增加放大连续浏览与人工备注，不把 `photo-props` 的陈列视觉误作消耗道具。
- 撤离整理改调运行时事务命令，`ExtractStashChanged` 驱动单一整理页；失败不关页，读档继续同一整理回执。
- 背包道具使用、持久发现候选和通行证合成调用 `BagItemCommands`，替换旧描述正则。准备页用运行时 `PreviewDeparture`，正确显示三叠、装备、珍珠盒和宠物起始牌；储备币留在基地。
- 基地宠物选择、喂养升级、宠物蛋孵化、仓库资源卡转换、消耗区钥匙复原和卡背选择均接公共事务命令。`CurrentPets.json` 与现行宠物数据原字节一致。
- 19事件使用运行时阶段回执；投骰后需确认，重编、选择、赌约和奖励页可保留进度。商队凭据使用单独两枚骰子确认界面，再显示已提交的免费货位。
- 祭坛接三卡激活后二选一、手选复原、固定战利品、两碎片职业能力与道具献祭。关闭只回地图，离开节点才由运行时作废未领取机会。
- 宝箱生成与领取均通过 `TryPersistMutation`；界面每次读取当前收据，保存失败回滚后可继续重试。生成时顺序推进宠物蛋保底，不在关闭或领取时重复计数。
- 新增整备双预设和最多三项追踪目标；预设可预览、应用到整备或直接出发，均复用运行时容量与新档事务。仓库经济卡包保留五张冻结候选，容量不足或保存失败不消费卡包。
- 故事档案移植 `story.last-lamp.js` 的严格三段、每局一次、双结局状态与命令，收藏室可重读已记录段落。当前源的 `storyCommands` 没有任何运行时调用，`lastLampNarrative` 只有收藏室阅览消费，因此本轮保持现行可达行为，没有新增随机触发。
- 首胜耗材教学复用当前镭射与初攻卡面。胜败音效由领域结算播放，展示页不重复播放。

## 验证与缺口

资源同步复跑成功；`verify_assets.py` 独立核对 422 个源/输出 SHA、418 条资源映射，42 张代表图（包括新增节点、环境与主页图）解码像素逐字节一致。结果在 `assets-verification.json`。实际 Unity 程序集集中编译已多次通过；最终原生编译和真实玩家输入由主会话集中验证，本线不启动 Unity。

新增基地功能通过 290 个断言和 4 次真实文件写失败：36 组现行 JS 预设预览、归一化、4 条故事分支（双结局）、坏档拒绝、4 组拆包容量边界、重启，以及预设实际出征与失败回滚。源函数直接执行于 `source-hub-vectors.mjs`；生产 C# 检查为 `HubFeatureChecks.csproj`，最终记录为 `features-20261029-160253-338/result.json`。该验证不包含真实界面输入。

原生检查发现 `PageIn` 使用 `GetComponent<CanvasGroup>() ?? AddComponent` 会误判 Unity 的缺失组件句柄；已改为 Awake 初始化和引擎 `== null` 检查，整备页同类三处一并修正。生命周期修复仍以主会话后续原生重开、重绘和关页检查为准。

现行源美术清单有两处旧图片引用缺失：`cards/equip-tt3-dark-blade.webp`、`cards/spell-cc-manasupply.webp`；对照现役 291 张卡库，这两个 ID 均已不在当前卡库。未重画或替换正式素材，缺口仍在收据列明。

旧 Unity 基地只有出发、仓库、升级、人物、成就五页。本轮已接交易所、照相馆、外观、伙伴和收藏奖励，庭院由主会话负责。页面布局沿既有 Unity 组件，尚未证明与当前 Vite 视觉完全一致；购买容量、奖励重复领取、满级转化及存档失败须以集成验证结果为准。已修复旧基地淡入反复相乘透明度、仓库索引闭包和重复堆叠基地页的问题。

## 重跑

在 Unity 工程目录运行 `python _planning/migration-1029/ui/sync_assets.py`，使用现有 Python/Pillow 与 Node，无联网、安装或源项目写入。旧资源和 meta 不删除；已验证未变化的输入复用已有输出。

克隆恢复时保留父仓库的同级布局：`SoudacheUnity/` 与 `搜打撤/game/`。本目录脚本从该游戏原料目录读取，不依赖开发机盘符。运行前准备 Python/Pillow、Node；当前 BGM 转 Vorbis 还需 ffmpeg，字体转换需 fontTools 与其 WOFF2/Brotli 支持。

节点、主页、归档与相册的专有图形转换还需 CairoSVG 及可加载的原生 Cairo 库，主页、归档与相册另需 NumPy。节点恢复从 Unity 工程目录运行 `python _planning/migration-1029/current-node-rooms/export_assets.py --output Assets/Resources`，显式写入正式 Resources；不传该参数仍保留旧的 `draft/Resources` 草稿目标。节点脚本同时需要同目录 `source-data.json` 与八个 `source-svg/*.svg`。主页保留 `Art/Current/title-wordmark.png.meta`，商店转换保留至少一个 `Art/CurrentGuide/*.png.meta` 作为现行导入模板；这些均随源码清单提供。

先运行 `python _planning/migration-1029/ui/sync_fonts.py --check-sources`，只检查字体原料与已有来源 SHA，不写资源或收据。随后运行 `sync_assets.py` 恢复本片图像及音频，再运行 `python _planning/migration-1029/ui/sync_fonts.py` 恢复正式十个字体：八个 WOFF2 解码为 TTF，HarmonyOS Sans SC Regular/Bold 原字节复制，并保留三份现行字体许可。`.meta` 继续使用仓库中的导入配置。其他页面专有媒体恢复入口及排除文件清单见 `_planning/github-sync-1101/resource-rebuild.json`；本段不代替那些专有转换步骤。

战斗特效图集与结算失败插图也由 `sync_assets.py` 恢复到专有路径 `Art/Current/BattleFxAtlas.png` 和 `Art/Current/Settlement/rewards-convoy-fail.png`；无需执行同时修改生产代码的旧部署脚本。重建转换仍验证源尺寸与字体字形/度量；跨 Pillow、ffmpeg、fontTools 版本或字体时间戳的产物 SHA 相同不作保证，源 SHA 与现行收据分别保留。

## 集成验收边界

前轮列出的宝箱选择/额外蛋、nullable安全格、容器、固定商店、19事件、448px分页缩略图和顶层键盘路由均已接入。仍需主会话以真实窗口与输入复核布局、完整流程及保存故障提示；本线的编译与资源核对不替代原生验收。
