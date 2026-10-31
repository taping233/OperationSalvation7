# 任务包 E：战斗 viewApi 适配层（接力包，与 A/B/C/D 零冲突）

> 2026-09-05 由主会话（Friday）签发。**开工时机**：C 组（`C-run-screens.md`）完工回报后接力；或开第三个对话并行（本包与所有在途任务文件零冲突）。
> 本包只**新建一个文件**，不改任何现有文件。

## 背景

- 战斗 UI（Sdt.UI/Screens/Battle/）只消费**快照**（`BattleSnapshot`/`FoeSnapshot`）和门面接口 `IBattleViewApi`（定义在 `Sdt.UI/Screens/Battle/BattleEvents.cs`，47-75 行附近）。
- 接口的实现类**尚不存在**：`BattleView.Api`（BattleEvents.cs:91，静态注入点）没有赋值方，战斗界面跑不起来。
- 真源参照：`D:\素材\代号柒\搜打撤\game\src\battle.core.js` 第 798 行起 `const viewApi = Object.freeze({...})`，逐方法对照移植，文案/数值逐字照抄。
- Core 侧能力（只读参照，勿改）：
  - `Sdt.Core/Battle/BattleSession.cs`：BattleSession 实例（foes/AegisBlocked(foe)/AffixMeta 表）；`SnapshotChanged`/`BattleEnded` 静态事件；快照由 foe 生成的映射逻辑可参照（FoeSnapshot 的 id 字段可反查 session 内 BattleFoe）。
  - `Sdt.Core/CombatResolver.cs:208`：`PreviewDamage(Combatant attacker, Combatant target, int amount, string type)`。
  - `Sdt.Core` GameRules 静态数值（BattleStartDraw/BattleTurnDraw/BattleEnergy/StarterSha/BossDeckSize 对应字段自行 grep 确认真名）。

## 交付物（唯一）

新文件 `Assets/Scripts/Sdt.Boot/BattleViewApi.cs`：

- `// ported from src/battle.core.js viewApi` 头注释。
- `public sealed class BattleViewApi : Sdt.UI.Screens.Battle.IBattleViewApi`，全部接口方法实现，语义对照 battle.core.js viewApi 逐条对齐。
- 类内提供当前会话引用的静态槽 + 安装方法：
  ```csharp
  public static BattleSession Session;                 // Boot 接线时赋值
  public static void Install() { BattleView.Api = new BattleViewApi(); }
  ```
- 若接口方法在当前 BattleSession 里找不到对应能力（例如接口缺方法或 Core 缺数据），**不要改接口/不要改 Core**——在类里写 `TODO(接线):` 注释给合理兜底实现，并在完工汇报里列出缺口清单。

## 硬性约束

1. **只新建上述一个文件**，不改任何现有文件（包括 BattleEvents.cs/接口/Boot 装配代码——`Install()` 的调用点由主会话合并时接）。
2. 禁止跑 `python _planning/tools/compile-check.py` 和 git 写操作；自查可用：
   `dotnet build _planning/tools/ccbuild/Sdt.Boot.csproj -v q --nologo -p:RestorePackages=false`
   （Sdt.Boot 当前因 Sdt.UI 连带错误必然 FAIL——**只看本文件 BattleViewApi.cs 有没有报错**，其他文件的错无视。改完源码后需先跑一次 `python _planning/tools/compile-check.py Sdt.Boot` 重新生成 csproj 再 build，因为 csproj 的 Compile 列表不自动收录新文件。）
3. 用 Edit/Write 工具改文件（bash 重定向写文件有静默丢字节坑）。
4. 文案/数值逐字照抄源码，禁止润色。

## 完成标准（验收）

1. `BattleViewApi.cs` 编译 0 错（按上面第 2 条方式自查）。
2. 接口全部方法有实现，注释标明对应 viewApi 字段名；AegisBlocked/PreviewDamage 经 FoeSnapshot.id 反查 BattleFoe 的路径有注释说明。
3. 完工向老板汇报：新增文件路径 + 逐方法一行摘要 + 缺口清单（如有）。
