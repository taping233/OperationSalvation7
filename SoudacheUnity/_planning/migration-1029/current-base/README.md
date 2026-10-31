# 基地现行源转译 · 当前冻结

本线按 `game.hub.runtime.js` 实际生产导入链转译公共基地壳、首页、后勤、人物/伙伴、建设、交易所、收藏室，并按主会扩展授权将庭院嵌入同一壳。当前是**代码与来源已冻结、原生验收未执行**；不以旧 UI 骨架、配色替换或旧模型检查替代现行界面证据。

- 入口：[HubScreen.cs](../../../Assets/Scripts/Sdt.UI/Screens/Hub/HubScreen.cs)。共用 84 顶栏与 104 底部七目的地，背景为源 `base-operations-v5` cover；材质来自同底图采样的圆角玻璃与局部区域动效。
- 后勤沿源分类/筛选/大卡网格/待复原独立子页；人物沿左右立绘档案、五人条、培养/招式/外观/伙伴结构；建设为设施目录/中央原始 SVG/右侧容量材料确认；交易为买卖导航/分类货架/结算台。
- 永久收藏以 `Base.collection` 字典为唯一列表来源，兼容查不到现行卡定义的历史记录。最后一张库存卡消耗或转化后，画廊不依赖剩余库存；详情与缩略分页沿源独立。奖励、里程碑、成就、卡背、故事使用源各自结构。成就使用原始 painted 图集。
- 庭院通过 `CourtyardScreen.BuildCurrentRoom(page)` 挂载；`Open()` 统一进入 Hub 庭院目的地。保留 KoiPondModel/KoiPondGraphic 原文件，新增原始 rain-tableau 的 sceneBackdrop 雨层、岸叶、控制栏/环境设置、输入与声音生命周期。
- 现行 `DepartPrepScreen.Open()` 与草稿只读属性由出征属地拥有；本线只调用。研究所第二地图由主会明确排除，没有新增解锁字段或空入口。

来源 JS/CSS 和输出文件的 SHA256、逐房间映射见 [source-map.json](source-map.json)。中央导入的背景/原始图标/伙伴/成就图集来源与输出指纹沿其资源清单维护，本线未改 Res/Theme/UIKit/Core/Run。

## 已核对

[check-source.ps1](check-source.ps1) 使用已安装编辑器附带 Roslyn，只读解析当前全部脚本并取得本线语法/类型诊断；没有 Emit 程序集、共享编译、启动 Unity、播放器、前台或浏览器。最新输出见 [source-diagnostics.json](source-diagnostics.json)：本线诊断错误为 0。此证据不代表 Unity Shader 导入/程序集构建或原生效果已验收。

## 主会待验

当前窗口的原生截图、真实输入、完整路由/草稿/保存失败回滚、永久收藏末张转化回归及庭院设置/声画生命周期，按 [verification-plan.json](verification-plan.json) 集中验收。旧庭院 Koi 模型 153 项对照只用于已验证的运动/投喂模型，不用于证明本轮现行布局与新雨层一致。

目录内 `port_base.py` 与 `*_integration.py` 等为本次一次性变更记录，按执行历史保留，不能作为幂等迁移脚本重跑。可重跑的检查为 `check-source.ps1`，输出指纹由 `freeze_base.py` 更新。
