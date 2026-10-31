# 战斗与数据移植（2026-10-29）

本目录保存本轮可重复生成工具和纯 C# 验证；现行 Vite 源只读。原 `_planning/tools/dump-data/dump.mjs` 的未提交成果保留。

## 已有结果

- 按现行启动迁移管线导出 291 条卡牌，其中 231 条保留完整声明式规则；五名角色使用无、常无欲、白塔、黑像、星月及当前稳定 ID。
- 复用 C# BattleSession/CombatResolver/EffectExecutor；声明式规则由 StructuredRules 承接，未声明规则保留原解释路径。
- 复用现有 CardDatabase/SceneCopy/GameRules/CharacterTable 公共入口；宝箱表从现行 map.json 生成 CurrentChestData。
- 保持纯 C# 核心无 UnityEngine、JSON 和 Agent 依赖。

## 可重复检查

```powershell
node _planning/migration-1029/battle/export-current.mjs
node _planning/migration-1029/battle/generate-current.mjs
node _planning/migration-1029/battle/generate-current.mjs --check
dotnet run --project _planning/migration-1029/battle/CoreChecks.csproj --no-restore --no-launch-profile -- --smoke
```

`--check` 只核对生成字节，不写 Assets。导出器只将 cards.view 替换为空展示函数，卡库播种、规则迁移、随机服务和生成数据均执行现行源实现。

## 验证依据及边界

- 当前通过 38 项核心行为断言，包括出牌只结算一次、法强、治疗/护甲顺序、诅咒、普通战临时初始牌库、银河费用、职业技能、盟友、选择与装备主动技能。
- `source-vectors.json` 来自现行 Vite 源函数：112 组伤害输入、24 次随机调用、12 组四层掉落、24 组普通/职业/首脑宝箱内容。C# 对照共 692 个字段断言通过。
- 宝箱参考通过 Acorn 定位 `chests.js` 中原 `rollDrops/rollContents/panelSeen` 函数后执行；没有另写一套掉落公式当参考。
- 203 条可入手战斗卡烟测：197 执行、6 条按使用条件拒绝、0 异常；覆盖选择/发现和首个回合。这仅证明所经路径无异常，不证明全部卡牌与原版完全等价。
- 本线集中编译已通过（0 错误、7 条已有警告）；完整游戏验收、Unity 原生运行和视觉交互由主会话负责。本目录领域测试不单独推定迁移完成。

## 事件、检查点与规则审阅

- `export-events.mjs` 从当前 `eventChoiceSpec` 的实际函数导出 19 个事件、44 个选项、四层效果；`generate-events.mjs` 生成唯一事件表。骰子、候选、费用、更换来源、赌约尝试、商店凭据和领取进度均随节点保存。
- 事件测试执行 176 条选项层级路径，并逐阶段保存/重启；四个真实保存故障分别核对结算、投骰、付费、凭据确认不丢状态。最终本轮结果为 1442 个事件断言、315 次阶段重启，见 `events/data-20261029-160838-821/result.json`。
- 现行 Vite 的 `battle.core.js` 保存**入场检查点**，中途退出后撤销本场受伤、消费和变化，按原敌人、随机状态与已确认首脑套牌重新开战。Core 提供纯 DTO `PrepareCheckpoint/CaptureCheckpoint/ValidateCheckpoint/RestoreCheckpoint`；Run 与 Boot 负责开战前完整玩家状态和持久化。42 项领域断言覆盖普通战、待选择、已确认首脑套牌、确定首抽与无效记录；不宣称恢复任意中场局面。
- `BattleItems.cs` 接当前战斗道具栏，普通战可用随身道具，首脑战仅本场生成道具；复原移动原 UID 并清除旧消费账。26 组实际 `resolveBagOperations` 源函数结果对照与领域回归共 1148 项断言。`BattleResult.SpentCards` 只携带已使用或已消耗的生成卡快照，供战后账本按原 UID 接入；未使用临时卡继续消散。普通战五张临时初始攻击另记 UID 集合并排除持久模板；真实带入初始攻击继续入消耗区。此边界由直接提取的生产 `GameBattleHost.ToPocket` 方法验证，方法指纹见 `events/pocket-source-receipt.json`，仅日志使用适配替身。
- 当前七种首脑中的新增四种机制已接齐：见证会教皇受击反应、畸变母体召唤、神秘拦路人开场与洗咒、死灵能力者撕牌与最终伤害倍率。59 组实际源函数输入形成 69 项断言；既有军威、狂乱、隔膜机制沿用 Core，Boot 补传现行首脑词缀。
- `CurrentBattlePools` 复用现行池边界：通用发现排除道具、资源、职业和能力；指定职业、类型、费用、注能及诅咒招式分别按源筛选。52 组实际源候选列表逐 ID 对照；加上全配置、原 UID 挖宝、免注能、保留其余候选、装备触发与稀有度价格，共 91 项断言。
- 旧商店权重已改为当前 60/28/9/3；`generate-balance.mjs` 从当前 `RULE_CONFIG` 和 `Cards.PRICE/SHOP_WEIGHTS/DROP_WEIGHTS` 生成配置与表。另修复空库错误自动回收、普通战错误手牌上限、非金币击杀误发 1 币、装备错误响应其它卡被消耗、未声明 equip 子节点的装备未占装备位等差距。
- 203 卡烟测仍只是首个可执行路径覆盖；未对每张复杂卡的每种组合逐一证明等价。研究所第二图的龙巢规则与 `reviveKill` 仍随已确认范围暂缓，当前提供统计字段并保留为 0。

```powershell
node _planning/migration-1029/battle/generate-current.mjs --check
node _planning/migration-1029/battle/generate-events.mjs --check
node _planning/migration-1029/battle/generate-balance.mjs --check
dotnet run --project _planning/migration-1029/battle/events/EventsChecks.csproj --no-restore --no-launch-profile
```

实际源对照导出分别由 `export-item-vectors.mjs`、`export-boss-vectors.mjs`、`export-pool-vectors.mjs` 维护。平台与音频接口在纯 C# 领域测试中使用适配替身；原生装配与真实玩家输入独立验收。

## 卡面图标与现行纸卡（2026-10-30）

`CardFace`、`HandPanel` 共用 `CardVisual`，复用现行 13 种纸卡边框、开孔坐标和 2:3 比例。费用按真实值显示并保留增减色，道具等类型按展示场景隐藏费用，资源始终隐藏；售价使用现行卖出价。伤害类型的图标与记号保留语义数据，实际卡面沿最终 `card-layout-selected.css` 隐藏伤害角标。原有宿主卡槽尺寸保留，长描述展示使用卡内滚动，战斗手牌保持拖拽。

`card-visual/export-source.mjs` 直接执行现行 `Cards.cardHTML`，导出 291 张卡、两种费用展示场景和四种实际费用，共 2328 个向量；`CardVisualChecks.csproj` 逐字段核对边框、费用可见性/数值/颜色、伤害格式/图标及售价，并核对全部 13 帧开孔，17519 项断言通过，结果见 `card-visual/result.json`。该测试使用独立输出目录；全工程编译和后台原生画面由主会话集中执行，数据对照不替代原生画面验收。

```powershell
node _planning/migration-1029/battle/card-visual/export-source.mjs
dotnet run --project _planning/migration-1029/battle/card-visual/CardVisualChecks.csproj --configuration Release
```
