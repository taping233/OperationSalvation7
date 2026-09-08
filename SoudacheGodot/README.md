# 升格会的的冬日猜想 · Godot 迁移工程

这是原 Web/Electron 游戏的并行 Godot 4.7 C# 迁移工程。原版保留在 `../搜打撤`，迁移期间不覆盖原版。

## 当前可运行内容

- 响应式主菜单、运行页、地图页和战斗页。
- 从原版源码确定性导出 243 张正式卡牌、5 名角色和 3 层地图数据。
- 纯 C# 领域层：稳定 ID、确定性随机数、牌库/手牌/弃牌/消耗区、动作队列、四类伤害、状态、战斗状态与五槽原子存档。
- 243 张正式卡牌均可由数据目录加载，基础伤害、格挡、治疗、抽牌、能量与状态效果已进入统一解释器。
- 三层环形地图分别有 28/20/12 个节点，使用三面骰推进；资源房、战斗、商店、营火、宝箱、事件、门、祭坛和撤离已接入状态机。
- 数据、Core 和 Godot UI 已接线：可选角色开始远征、掷骰与结算房间、进入战斗、出牌和结束回合，并在安全节点保存/恢复五个档位。
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
dotnet build SoudacheGodot.csproj
```

项目使用 Godot 4.7.2 Mono。当前工作区的便携编辑器位于被 Git 忽略的 `../.tools/godot-4.7.2-mono/`。

## 仍待迁移

1. 将条件触发、发现/灌注、延迟效果及敌人特殊行动逐项补进卡牌解释器，并建立 Web/Godot 规则对照测试。
2. 补齐专业宝箱池、角色营火奖励、完整叙事选择、背包/仓库转移、卡牌商店与出售、首领专属战斗规则。
3. 将当前功能型地图网格升级为正式三环交互表现，并迁移项目自有美术、动画与音频。
4. 完成 Windows 导出模板、便携包、长流程存档兼容及性能验收。

不在本阶段处理暂缓的角色图片问题。
