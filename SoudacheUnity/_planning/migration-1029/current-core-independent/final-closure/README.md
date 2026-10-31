# 最终独立闭环：PASS（限定复核范围）

当前生产Core重新冻结为本目录43个C#源码快照，与收官时生产43文件逐一SHA一致，漂移0。源677个JS/JSON输入重新核对，较上轮manifest变化0。原修复、扫描新增缺口与复杂消费者关键路径全部重新执行，**69个场景执行通过对应比较，无真实差异**。这不是全291卡所有组合通过声明。

## 实际执行与断言

| 批次 | 场景数 | 本轮重新执行的断言 | 结果 |
| --- | ---: | --- | --- |
| 原8+7向量 | 15 | 自有原SSR夹具fresh执行；当前Core新公开支付/目标命令；50项支付/卡区/血甲/能量/费用/目标/燃料比较 | PASS |
| 新增6卡 | 6 | 满月形态、沐愈光辉、坚冰结界、急行军、致命射线、感染射线；比较玩家/敌方实际数值、状态及稳定卡身份/费用/伤害/卡区 | 6/6完全一致 |
| V8随机诅咒后续RNG | 12 | 两张射线各seed 0/1/2/123/999/2147483647；源真实引擎结果与Core结果、generation随机流最终状态 | 12/12状态及RNG一致 |
| 三组复杂消费者及邻接 | 36 | 8种子×4门场景，征召状态/毒亡/计时3场景，真实灵能召唤发现龙焰1场景 | 36/36实际状态与适用RNG比较一致 |

69为场景执行数，含同卡多种子/多条件重跑，不能当成69张独立卡。没有重新执行129卡扫描。

复杂36场景涵盖：

- 天国之门对玩家与两个步兵的逐单位祝福、优先补缺、purify条件和armor+5；两门自动开启后第3/4回合结果及随机流，验证重复延迟任务注册顺序。
- 精神控制复制受伤敌人的防御/诅咒/祝福，立即状态、两次完整EndTurn，毒亡和stealth计时变化。
- seed1真实打灵能召唤、读取发现候选并选龙焰射线，随后手动打出该免材料实例；伤害13、未进入注能选择，玩家能量及敌状态同源。
- 我补录并独立比较了该发现的完整候选顺序 `[tt12-felguard, tt3sp-bloodstorm, tt12-raydragon]`，以及后续随机流状态2507273141。真实source SeededRandomService的generation序列在第5次到达该状态，3候选生成消费5次随机，覆盖完整池重复候选重试的邻接变化；不是只检查最终选中ID。

## Oracle与独立性

所有源场景本轮都经Vite SSR加载当前 `Cards` ensure链与 `createBattleEngineInstance`，执行真实start/submitCardPlay/choice/discover/payment/endTurn。Core只使用新生产快照独立编译运行，没有用旧快照重演，也没有读取实施者comparison/passed作为通过依据。

原15与6卡/RNG夹具沿用本代理先前代码并限定输入。复杂36场景复用修复片的输入准备与驱动代码，在私有目录fresh运行；不复用它的oracle输出、Core输出或通过结论。自有compare-complex.mjs重新按name+seed唯一匹配、检查36行完整性，逐状态和RNG比较；额外加入发现候选顺序/RNG记录。这种复用节省准备流程，比较真值仍来自本轮真实源进程。

比较文件：

- closure-comparison.json：15场景、50断言、pass=true。
- scan-comparison.json：只含指定6卡，tested=6、identical=6、mismatches=[]。
- rng-comparison.json：12场景，state/rng均true，保存双方最终流状态。
- complex-comparison.json：36场景逐键断言、无差异。

## 关键消费者核对

源仍以 `battle.resolution.domain.js` 的阈值治疗/能量上限政策、`battle.status-operations.domain.js` 的extend和随机排序、`battle.exec-play.domain.js` 主结算后末手检查为准。新Core `BattleStructuredSourceSemantics` 在对应消费者读取同一语义，针对当前V8六元素随机排序的调用顺序由真实引擎12向量核对最终RNG。

源 `choice-semantic-operations` 的逐目标补缺和两门delayed注册顺序、`battle.infusion` 的实例免注能语义、`card-semantic-operations` 的精神控制实体克隆及敌方阶段随从生命周期，是复杂片的判定依据。新Core `BattleComplexSourceSemantics` 和相邻消费者确实被上述真实公开命令调用，非仅存在同名函数或JSON字段。

## 输入、命令与构建

inputs-sha256.json列源677文件、生产快照43文件、全部JSON结果SHA，以及收官productionDrift=[]、sourceChangedFromPrior=[]。主要生产文件SHA：

- BattleSession.cs：7DC534371BD2552A25F337A4749CFC688D216CD635A83B2534275807CA662B99
- StructuredRules.cs：9F639275A45C1037B68F1A5FA08A326F709CAE5EBAAD8A363FE55D635D83B7F1
- BattleStructuredSourceSemantics.cs：D9511196DF1D295A9D5115542798C05A4237D59AD8CFF1EAAC7B9CC80EF83DD0
- BattleComplexSourceSemantics.cs：2790FA44A8FD60FC81DB80ED880F69EF8FA703897ADAB19329DE06E653C18082

本目录运行的源命令：node source.mjs、node source-round2.mjs、node source-six.mjs、node source-complex.mjs、node source-rng.mjs。五个私有工程分别 `dotnet build <r1|r2|six|complex|rng>/Audit.csproj --ignore-failed-sources -v:q`，随后显式 `dotnet <工程>/bin/Debug/net8.0/Audit.dll`；避免同名工程的dotnet run缓存路径歧义。5次独立构建最终各0错误0警告，运行及比较命令均退出0。比较使用compare-closure/compare-scan/compare-rng/compare-complex.mjs。

## 边界与收官

这是指定缺口的最终闭环，未穷举当前schema的任意自定义组合、所有发现池/职业/同名卡、全部首脑setup五件时序、任意深度施放续接、全部状态与敌人特殊机制组合。复杂随机祝福固定8种子，V8随机诅咒固定6种子，不宣称无限种子或不同JS运行时保证。原15中的首脑向量保持此前真实编组后条件化同一合法手牌的边界。

timeRune按Root已确认的唯一opts入口与研究第二图排除边界处理，本轮未扩展；未操作Unity、CUA或前台。生产零修改、未提交。原生receipts4/滚动/完整旅程由Root并行验收，本报告不替代真实原生输入与画面验收。达到本轮完成标准，报告freeze，无新增待修真实差异。
