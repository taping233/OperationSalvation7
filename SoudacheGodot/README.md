# 升格会的冬日猜想 · Godot 桌面版（批次 8 交付）

> **老板验收操作说明（2026-09-12，发布候选）**
>
> 1. **双击即玩**：打开 `build/windows/升格会的冬日猜想.exe`（无需安装，整个 `build/windows/` 目录拷到任意位置都可运行；`data_SoudacheGodot_windows_x86_64/` 数据目录必须与 exe 同级）。
> 2. **存档位置**：`C:\Users\太平\AppData\Roaming\Godot\app_userdata\升格会的冬日猜想\saves\`（五槽 save_0..save_4.json，自动落盘；关窗前会强制保存当前对局）。存档自由演进、不兼容网页版旧档（口径 §0.1）。槽 1 为批次 8 的验收演示档（含仓库/口袋/收藏数据，可在选档页删除）。
> 3. **验证要点**（对照网页版 `../搜打撤`）：标题/选档 → 基地五页签（出发预报含攻击/宠物/保护格实值、仓库卖卡、口袋钥匙复原、宠物孵化升级携带、成就·收藏室 ✦ 点亮）→ 四层地图跑图 → 战斗（飘字/飞牌/音效）→ 图鉴 245 张（已收藏卡右上 ✦）→ 撤离结算回到基地。
> 4. **音频**：首次点按界面后战斗音效/双 BGM 生效；音量与设置项持久化（退出前自动保存）。

这是原 Web/Electron 游戏的并行 Godot 4.7 C# 迁移工程。原版保留在 `../搜打撤`，迁移期间不覆盖原版。

## 当前可运行内容

- 响应式主菜单、运行页、地图页和战斗页。
- 从原版源码确定性导出 245 张正式卡牌、5 名角色、宠物 6 只、成就里程碑与四层 60 节点地图数据。
- 纯 C# 领域层：稳定 ID、确定性随机数、动作队列、四类伤害、状态、战斗状态、基地仓库与五槽原子存档。
- 245 张正式卡牌均由数据目录加载；战斗卡和远征/资源卡分层执行，伤害、状态、发现、注能、延迟、装备和特殊效果进入统一解释器。
- 四层地图（TARGETS=[13,15,17,15]）含保底火堆/补给站/搜刮点/战斗、L3 紧急撤离、L4 祭坛→首脑→终局；移动事务与 RNG 快照入档。
- 数据、Core 和 Godot UI 已接线：角色选择、基地升级、背包/安全袋/仓库、商店、宝箱、事件（ink 叙事 + V2 覆盖层）、宠物孵化/升级/携带、收藏室里程碑、撤离结算与五槽存读均由快照驱动。
- 普通战斗直接使用随身战斗卡，打出的卡进入消耗口袋；首领战选择至多 15 张非道具牌并加入 5 张初始攻击，使用抽牌/弃牌循环。
- 已接入原项目五名角色立绘、敌人头像、场景图、地图图标、卡面类别图、双 BGM 与 UI/战斗音效；完整来源记录见 `docs/asset-manifest.json`。
- 手牌位置表经用户授权直接适配自 `.tmp/sts2-reverse` 的 `HandPosHelper.cs`；玩法、数值、卡牌文本仍只来自本项目。详见 `src/UI/REFERENCE_SOURCES.md`。

## 验证

```powershell
node tools/export_data.mjs
node tools/validate_data.mjs
node tests/Data/data-contract.test.mjs
dotnet run --project tests/Core/Core.Tests.csproj
dotnet run --project tests/Combat/Combat.Tests.csproj
dotnet run --project tests/Run/Run.Tests.csproj
dotnet run --project tests/Narrative/Narrative.Tests.csproj
dotnet run --project tests/App/App.Tests.csproj
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
