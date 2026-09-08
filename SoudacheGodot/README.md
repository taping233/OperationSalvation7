# 升格会的的冬日猜想 · Godot 迁移工程

这是原 Web/Electron 游戏的并行 Godot 4.7 C# 迁移工程。原版保留在 `../搜打撤`，迁移期间不覆盖原版。

## 当前可运行纵切

- 响应式主菜单、运行页、地图页和战斗页。
- 从原版源码确定性导出 243 张正式卡牌、5 名角色和 3 层地图数据。
- 纯 C# 领域层：稳定 ID、确定性随机数、牌库/手牌/弃牌/消耗区、动作队列、战斗状态、原子存档。
- 数据、Core 和 Godot UI 已接线：进入战斗页后可抽牌、出牌、消耗能量、造成伤害/获得格挡/治疗、查看牌堆与结束回合。
- 手牌位置表经用户授权直接适配自 `.tmp/sts2-reverse` 的 `HandPosHelper.cs`；玩法、数值、卡牌文本仍只来自本项目。详见 `src/UI/REFERENCE_SOURCES.md`。

## 验证

```powershell
node tools/export_data.mjs
node tools/validate_data.mjs
node --test tests/Data/data-contract.test.mjs
dotnet run --project tests/Core/Core.Tests.csproj
dotnet build SoudacheGodot.csproj
```

项目使用 Godot 4.7.2 Mono。当前工作区的便携编辑器位于被 Git 忽略的 `../.tools/godot-4.7.2-mono/`。

## 迁移顺序

1. 当前纵切：工程、数据导出、Core、场景导航和基础战斗闭环。
2. 将原版完整卡牌效果、敌人行动、状态与结算逐项映射到动作队列，并建立 Web/Godot 规则对照测试。
3. 迁移环形地图、商店、事件、营地、背包和五槽存档导入。
4. 迁移项目自有美术、动画与音频；最后替换表现层占位内容并做打包验收。

不在本阶段处理暂缓的角色图片问题。
