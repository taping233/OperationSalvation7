# 当前战斗预测与快照复核

本轮直接执行 `../搜打撤/game` 当前 Vite 模块，生成源结果，再用独立 .NET 8 工程编译当前生产 `Assets/Scripts/Sdt.Core/**/*.cs` 对照。没有使用旧移植报告作为预期值，没有启动 Unity、浏览器、共享编译目录或外部服务。

现行结果：新增源对照及契约断言 **289/289 通过**；现有 `card-semantics-fix` 的 **167/167 通过**。这里的真实回合指生产领域命令执行，输入由程序构造，不代表原生编辑器、离屏渲染或系统真实输入验收。

## 已修正

- 预测、真实敌人行动和意图共用当前 `battle.enemy-plan.js` 的判断顺序；补全运行态 stunned、首回合蓄力 noFirstAttack、偶数回合、冻结和双击。noFirstAttack 从敌人输入传入运行态及快照，入场检查点复制与重启也保留该字段；stunned 不添加到原始敌人定义入口。
- 死亡保险在防御消耗后拦截致命攻击，保留受击前生命、消耗一次保险并获得本回合免疫，返回实际伤害 0。结构化自伤共用保险判断；无保险自伤立即战败。重复登记保险替换次数，和当前源一致。毒伤不由保险拦截；实际玩家生命保留源负值，预测展示生命仍钳至 0。
- 玩家潜行先于护卫分流判断；护卫承伤仅使用敌人攻击值。随从自动攻击放在玩家毒伤及死亡检查之后；冻结阻止随从攻击，造成伤害会破除随从潜行。
- 敌人及随从防御、意图快照与运行态分离；预测只修改复制的状态。消耗牌堆按 played/consumed/discard/grave 顺序去重并排除手牌、抽牌堆、正在结算道具。
- Phase 使用源字符串 start/player/targeting/resolving/enemy/victory/defeat；相位由对应命令推进，未使用 busy 推测。撤退与取消编组沿源保留其原相位，结束状态由原有 over 字段表达。BattleToken 在同场内稳定，新场更换。
- 意图元数据及流血增伤直接按当前 `calculateEnemyIntent` 迁移。既有 `FoeIntent.damage` 整数接口保持兼容，以 `HasDamage=false` 表示源 `damage:null`；hits/bleedBonus 保留源值。快照按当前状态重新推导意图，避免状态改变后沿用旧提示。

## 精确覆盖

| 范围 | 数量 | 内容 |
| --- | ---: | --- |
| 纯预测 | 37 | 中毒、致死毒、护盾/护甲/格挡、冻结、死亡、奇偶攻击、蓄力、首回合、双击、隐身、免疫、闪避、无属性/死亡/隐身随从、多个护卫、防御消耗、保险、额外回合、负血与空列表 |
| 预测不修改输入 | 37 | 对每个输入序列化前后核对；源返回对象冻结另行核对 |
| 敌人共用计划 | 44 | 回合 0/1/2/3，跳过条件的先后顺序、词缀及行为 |
| 意图 | 116 | 跳过状态、全部现行元数据、未知行为回退、流血 0/3、双击与单击 |
| 领域 EndTurn | 18 | 源引擎和当前 C# 生产命令的生命、保险、毒、随从生命/死亡、蓄力清除、结束状态、回合编号 |
| 领域单次受击 | 6 | 公共 playerTakeHit 与 C# 对应入口；保险、防御、闪避、免疫、负血 |
| 结构化自伤 | 3 | 保险拦截、致死即结束、非致死 |
| 其他契约 | 28 | 重复保险登记、集合、快照分离、首回合输入与检查点/重启接线、令牌和相位生命周期 |

TimeRune=true 只进入纯预测 DTO 向量，没有接入研究所第二地图或研究玩法；当前第一地图快照为 false。预测遵源保留注记：回合末触发、随从攻击和随机效果可能改变最终结果。纯预测不擅自模拟这些被注记排除的效果。

## 证据与复现

- `source-oracle.mjs`：Vite SSR 加载当前模块并执行；`source-vectors.json` 保存输入、源输出和直接权威源 SHA256。
- `Audit.cs` / `Audit.csproj`：独立输出目录编译当前生产 Core；`unity-results.json` 保存逐条实际值、预期值和结论。
- `baseline.json`：修复前首次对照 94/108；其中一条仅为 JSON 键序误判，比较器已按对象键无序修正。未将该误判算作玩法缺陷。
- `receipt.json`：收官时的输入、生产源码和证据指纹；原生验收状态明确为未执行。

在 `SoudacheUnity` 运行：

```powershell
node _planning/migration-1029/current-forecast/source-oracle.mjs
dotnet run --no-restore --project _planning/migration-1029/current-forecast/Audit.csproj
dotnet run --no-restore --project _planning/migration-1029/card-semantics-fix/Audit.csproj
```

未提交、未推送。原生编译、画面和真实输入由主会话在线路冻结后集中验收。
