# 当前卡牌语义定向修复

2026-10-30：11组已复现缺陷完成修复，正式Core源码隔离编译与状态断言 **167/167通过**。原始审查失败保留，生产文件已冻结，交主会统一原生验证。本报告仅证明下列场景，不代表291张卡逐卡验收通过。

## 修复与观察结果

| 组 | 正式入口改动 | 已验证行为 |
| --- | --- | --- |
| 1 护身 | `HitFoe`记录实际击敌，玩家受伤不再设置击敌标记 | 未击敌10甲；击敌后6甲；全吸收命中仍10甲；新回合重置 |
| 2 双相星盘 | 每件装备保存装备回合/本次触发回合；按完成前的类型计数判断首次 | 武/法/武同回合返能1/0/0；次回合首次法术返1；中途装备不补发同类型第二次；双装备各返1 |
| 3 浪掷风吟 | `fillHand`使用正式随机发现池与临时卡入口，按实际置入法术数治疗并遵守禁疗 | 置入6张合格法术、回复18血，原牌库顺序不变；空池停止；禁疗不回血 |
| 4 混乱套牌 | `trigger:false`直接进弃牌；只替换武术/法术/装备的同类型下一稀有度；置换替换结果的费用 | 普通/首脑战其余手牌不进消耗/墓地、不计注能；3个种子逐牌ID/类型/稀有度/费用与Vite一致；能力卡/衍生卡保留 |
| 5 偷取攻击 | 独立登记每次敌方归还与玩家临时攻击期限 | 8攻压至1后到期还原8、玩家增益归零；不同持续时间分别到期 |
| 6 毒爆/花鸩 | `adjustCurse`使用正式`TickPoison`；翻倍走诅咒入口 | 毒3甲5触发两次后HP94、甲5；免疫挡毒；翻倍层数与伤害正确；致死更新敌人状态 |
| 7 多火焰形态 | 注能增幅按注册实例保存独立材料计数 | 两形态两材料法强4；晚注册实例从零计数 |
| 8 自动出牌 | 选牌、手牌释放、抽到后释放、生成施法统一进入`ExecPlay`的免费执行分支；子牌先完成再继续父牌 | 记录played与首脑弃牌；直释视为已注能但不消耗材料；5张抽到武术全部记账；嵌套选择与随机连施暂停/继续顺序正确 |
| 9 抽到触发 | 非双剑结构化onDraw卡离手进弃牌；双剑仍留手 | 禁咒I不留手、进入弃牌；天启剑留手 |
| 10 中毒Boss修正 | `TickPoison`依Vite先算伤害上限，再乘死灵暴露，破甲解除上限 | 16个cap/exposure/破甲/免疫组合逐状态与Vite一致 |
| 11 狂乱附咒 | 敌人实际造成伤害后才施加狂乱诅咒 | 甲50全吸收不附咒；实际命中两次附两层 |

第3组复核时补齐了同族阿猫获取边界：`AddTempCard`与`AddDeckCard`统一派发`onAcquire`，同一获取栈按卡身份防递归；去掉Acquire、Discover、职业技能及BattleItems既有手动调用，避免重复触发。新增10条断言覆盖浪掷生成阿猫、额外给牌、临时卡/牌库/发现各触发一次。Vite正式`addTempCard`运行桩确认获取事件会触发一次。

## 验证与证据

- `node _planning/migration-1029/card-semantics-fix/source-oracle.mjs`：直接加载当前Vite正式模块，输出11条可执行结果与边界向量。`source-results.json`、`boundary-source-vectors.json`、`source-run.txt`保留输出。
- `dotnet run --project _planning/migration-1029/card-semantics-fix/Audit.csproj --configuration Release --no-restore`：编译当前全部正式Core源码、运行167个状态断言，退出0；详见`unity-results.json`。
- 167项包含原9组复现断言、64项既有Boss状态回归、3个混乱套牌精确种子对照、16个中毒修正向量及本轮边界。64项Boss向量复用独立审查的`boss-source-vectors.json`，未冒充本线重新生成。
- `baseline-first-failures.json`为独立审查首批失败原字节快照；SHA256 `6AF3AD763D5338FF3951595511E284E626D34D3E7B881AAEC2B337104AB8E183`。收官复核仍与原始`current-card-audit/first-failures.json`一致。
- `baseline-expanded-results.json`保留新增9组时的15条失败；`baseline-eleven-groups.json`保留11组阶段85项中的18条失败。审查原文件未改。
- `receipt.json`记录正式Core、源模块、测试和输出的SHA256；源码冻结后如发生变化须补验受影响范围。

## 修改边界与未验范围

生产文件仅`StructuredRules.cs`、`BattleSession.cs`、`CombatResolver.cs`、`BattleItems.cs`；最后一项只删除公共获取hook的重复调用。本线未改Boot/UI/Run/Editor，未启动Unity或播放器，未占共享编译目录、未新增服务、未提交。

Checkpoint已核对：当前仅保存入场重开信息，不保存战斗中间规则状态；新增运行时状态在初始化时清空，无需修改存档字段。

自动出牌的Vite正式记账链按`battle.selection-flow.domain.js → queueCardExecution → battle.exec-play.domain.js`核对；本线执行了Unity真实Core入口与嵌套选择测试，未为Vite整场异步引擎另造完整替身。偷攻玩家增益到期在Vite按`addBlessing(..., duration)`源码确认，Unity执行完整`EndTurn`验证。全291逐卡覆盖、原生编辑器/播放器输入与画面留给主会统一验收。
