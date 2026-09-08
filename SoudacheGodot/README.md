# 升格会的的冬日猜想 · Godot 迁移工程

这是原 Web/Electron 游戏的并行 Godot 4.7 C# 迁移工程。原版保留在 `../搜打撤`，迁移期间不覆盖原版。

## 当前可运行内容

- 响应式主菜单、运行页、地图页和战斗页。
- 从原版源码确定性导出 243 张正式卡牌、5 名角色和 3 层地图数据。
- 纯 C# 领域层：稳定 ID、确定性随机数、动作队列、四类伤害、状态、战斗状态、基地仓库与五槽原子存档。
- 243 张正式卡牌均由数据目录加载；战斗卡和远征/资源卡分层执行，伤害、状态、发现、注能、延迟、装备和特殊效果进入统一解释器。
- 三层环形地图分别有 28/20/12 个节点，使用三面骰推进；资源房、战斗、商店、营火、宝箱、事件、门、祭坛和撤离已接入状态机。
- 数据、Core 和 Godot UI 已接线：角色选择、基地升级、背包/安全袋/仓库、掷骰、动态房间操作、多敌人目标、玩家目标、注能材料、战后奖励、撤离结算与五槽存读均由快照驱动。
- 普通战斗直接使用随身战斗卡，打出的卡进入消耗口袋；首领战选择至多 15 张非道具牌并加入 5 张初始攻击，使用抽牌/弃牌循环。
- 已接入原项目五名角色立绘、敌人头像、场景图、地图图标、卡面类别图、双 BGM 与 UI/战斗音效；完整来源记录见 `docs/asset-manifest.json`。
- 提供 `tools/import-localstorage.mjs`，将用户主动导出的 Web localStorage JSON 转成 Godot v3 存档；不会读取浏览器隐私目录。
- 手牌位置表经用户授权直接适配自 `.tmp/sts2-reverse` 的 `HandPosHelper.cs`；玩法、数值、卡牌文本仍只来自本项目。详见 `src/UI/REFERENCE_SOURCES.md`。

## 验证

```powershell
node tools/export_data.mjs
node tools/validate_data.mjs
node tests/Data/data-contract.test.mjs
dotnet run --project tests/Core/Core.Tests.csproj
dotnet run --project tests/Combat/Combat.Tests.csproj
dotnet run --project tests/Run/Run.Tests.csproj
node tests/Save/save-import.test.mjs
node tests/UI/ui-smoke.test.mjs
dotnet build SoudacheGodot.csproj
```

项目使用 Godot 4.7.2 Mono。当前工作区的便携编辑器位于被 Git 忽略的 `../.tools/godot-4.7.2-mono/`。

## 启动与导出

```powershell
& '..\.tools\godot-4.7.2-mono\Godot_v4.7.2-stable_mono_win64\Godot_v4.7.2-stable_mono_win64.exe' --editor --path .
& '..\.tools\godot-4.7.2-mono\Godot_v4.7.2-stable_mono_win64\Godot_v4.7.2-stable_mono_win64_console.exe' --headless --path . --export-release 'Windows Desktop'
```

Windows 导出物写入被 Git 忽略的 `build/windows/`。原 Web/Electron 版本仍保留在 `../搜打撤`，其玩法数据继续作为迁移对照基线。
