# E6 结构化卡牌规则可执行性与真实入口类型契约

Friday 计划，2026-09-27（Asia/Shanghai）。唯一协调聊天 `01a0e192-baec-7192-ba9f-4e8d1cfe9923`。老板本轮明确要求继续下一批，沿用独立新主指挥、全新团队、持续双向协调及统一本地提交。

## 实时基线

启动实核 HEAD `e8a169be11a06455e4851ddcd65b424ff4a75efa`，tracked/index 干净，原排除未跟踪保留；相对本地 origin/master ahead 13 / behind 0，未 fetch、未 push。E5 已完成代码/独审/全量 168 文件1097项及本地落库，实页未验。当前证据从 README 导航核实，历史卡牌迁移文档里的数量不是当前完成比例。

本轮实际核对：schema 接受部分尚未接线的规则，validateCardRules 的 pending 仍为空；resolution 自有可执行集合与参数守卫，acquire 的 dest×act 组合却到执行该操作时才拒绝，filter 目前透传忽略。exec-play 在进入 resolution 前已支付手牌、能量及注能燃料。现有 GameStore CardRules 使用开放字符串/字段，不等同 schema/解释器完整静态约束。这些为源码事实，实施前须以故障用例证明具体风险。

## Friday 已定范围

1. 建立最小、纯数据的结构化规则可执行性判定单源，区分无结构化规则的合法旧卡、格式非法、格式合法但当前未支持、可执行。沿用 schema 作为形状权威，不另造第二套全量 schema；不把 schema 合法改称运行时可用。保留 validateCardRules 既有返回兼容，可执行性结果另设窄口。
2. 收拢现有 onPlay op/参数、trigger、acquire dest×act 与未消费 filter 等已知能力边界，避免执行列表前段成功、后段才拒绝。未支持能力继续拒绝，不本批实现 summon/延迟/墓地/装备/新时点，不根据 desc 猜规则。先盘点真实现行卡规则使用，若拒绝会影响现行已交付合法机制，回报具体卡与矛盾给 Friday；不得静默砍功能。
3. 生产接线至少覆盖 queueCardExecution 进入手牌支付选择前、实际执行付款前复验，以及直接 resolver/steps 消费前整列表判定。具体入口以实际调用链为准；拒绝不得耗能、消耗手牌/燃料、发奖励或产生部分牌效。可继续使用原 resolver 抛错口径，公开队列/UI 应有明确可见拒绝且不破坏 E4 命令语义。排队后对象变化不得绕过复验，不新增通用任务队列、状态库或回滚事务。旧文本卡和现有结构化卡效果/顺序保留。
4. 对上述真实新能力边界与生产调用适配器建立窄类型契约（判别结果、明确目标/操作及端口），采用独立定向类型配置或现有方式。至少一个实际生产消费者纳入检查，不能只有 d.ts/fixture 通过。外部输入用 unknown 并运行时收窄，不用新增 any、ts-ignore、全局开放索引抹错误。不扩大全仓 checkJs，不顺手重写 GameStore 或完整解释器；报告实际已检查的生产文件及仍未覆盖的边界。
5. 最终记录真实在售/同步规则的支持情况及剩余文本兼容/未接线边界，数量必须注明口径与采样来源；不手改 cards-sync.json，不生成同步数据、不新增数据库、不改变规则版本或卡牌数值。本批不是整库迁移完成证明。

## 协作与单写建议

- Friday 独占本 PLAN、范围裁决、全量/index/提交窗口；只对独立 E6 主指挥沟通。
- A：卡规则纯可执行性模块、窄类型声明/定向配置与专属契约测试；如需 schema 的最小兼容改动由 A 单写，默认不改 schema。
- B：battle.resolution.js、battle.exec-play.js、必要的生产窄适配器、专属真实战斗回归；battle.engine.js 仅在必须保护具体入口时经主指挥回报确认，不预授权改其广泛逻辑。
- 主指挥：RESULT 与实际覆盖说明；先向 Friday 回执确认最终文件分工、结果形状、类型检查根、现行卡兼容盘点，再实施。全新独审只读检查真实 diff、拒绝副作用顺序、旧卡兼容和静态约束真覆盖；不复用 E2–E5 成员。

两实施片共同接口先确定，每文件单写。超过300行先rg再读片段。旧团队全停写；发现未知并发修改先核归属，不覆盖/顺手提交。

## 验证与结束条件

先证具体缺口，再覆盖：合法旧文本、合法现行结构化卡（改名改描述仍只执行一次、顺序不变）、非法结构、未支持参数/trigger/op、acquire组合及filter、前段可执行+后段不可执行的整列表拒绝；真实出牌支付/注能和排队后变更代表场景不得部分生效。复用现有场景/测试，不为每个枚举重复造全套战斗。类型正负例需拒绝错误目标/结果分支/端口参数，实际生产检查根必须编译通过。支持报告按 schema 与 runtime 分别表述。

定向与独审通过后全队停写报精确文件清单，由 Friday 原 pre-commit 全量并本地提交；不要提前跑全量。没有 build/install/push/delete/清理/回滚/amend 授权；所有原排除未跟踪项保留。只开发搜打撤 Vite，Godot/Unity/EXE 冻结。

E2 hover/旧档04/05、E3真实结算/旧档/长局、E4异步实页、E5恢复提示实页继续留 E7 统一验收，未验不等于通过。实质丢档/重复奖励/无法运行/全量失败是阻断。老板停止/暂停立即全队保留现场，不再检查、测试、清理或提交。

## 接管确认

独立主指挥 `01a0e1b1-fcce-7250-bc4c-9e4739d36d2e` 已回执，双向通信正常，Friday 确认启动。A 单写新 cards/card-rules.capability.js、相应 types.d.ts、jsconfig.card-rules.json、e6-card-rules-capability/types 两测试；B 单写 battle.resolution.js、battle.exec-play.js、新 battle.rule-guard.js 与 e6-card-rules-execution.test.js；主指挥写 RESULT 兼支持覆盖说明。battle.engine.js 仍需具体必要性确认。

确认 inspectCardRuleCapability(unknown) 返回 legacy/supported 成功或 invalid/unsupported 及可读 issues。legacy 仅限合法卡片对象无 rules；未知 null/标量不能当旧卡通过。checked 的真实生产根为 capability 与 rule-guard，后者给断言与带 warn 端口的拒绝适配，不宣称完整 exec-play/resolution 静态覆盖。操作/目标/结果/端口类型须实际用于生产实现，不能仅供fixture。

主指挥内存盘点生产 Cards.ensureTabletop/all 回报：272 卡，68 structured、204 legacy；原 CARDS_SYNC 55 条无 rules；当时 schema 与已知能力冲突为0。此为该次内存盘点口径，后续专属正式回归复核，不代表整库已经迁移或浏览器验收。

## 实施裁决补记

独审发现公开 engine.play 在 queue 新守卫前先执行 unplayableReason/effCostOf，requirements 或 costModifiers 中 null 会提前抛错；独立 beginInfuse 同样先消费费用规则。Friday 已核实际调用位置，批准 B 单写 battle.engine.js 的最小补充：导入同一 rejectUnsupportedCard，在这两入口取 card 后、规则/费用读取前返回 false 并明确提示；不改规则/费用算法，保留 queue/exec/resolver 的全部复验。要求专属真实入口红绿证据。相关旧测试 fixture 只可补其 schema 合法前提，保留原行为断言，不放宽生产校验。

## 统一落库窗口

2026-09-27 15:28（Asia/Shanghai）Friday 实核实际diff、新能力模块/guard、两个生产类型检查根、负例接线及 RESULT。团队12文件加自有PLAN共13文件；HEAD仍 e8a169b，index空，原排除未跟踪全部保留；本地 origin/master ahead13/behind0，未fetch未push。14测试文件186项定向通过，独审阻断0，全队停写。队列付款、resolver整列表及两公开入口拒绝的真实红绿证据详见RESULT；未放宽schema或修改卡库数据。现进入原pre-commit全量/index/本地提交窗口，结果以后续记录为准，定向通过不冒充全量或实页。

首轮门禁15:29:20启动，227.14秒结束：170文件通过/1失败，1118项通过/1失败，另1未处理异常；提交被拦。快照集成测试探针缺rules.version且用未知battle.extension，未进入待选目标；批准原B最小修该fixture为schema合法嵌套规则，保留快照复用/源对象可变/嵌套深冻结/变化重新投影全部意图，不放宽生产guard。另bag-item-rule-baseline环境拆除后boot的定时回调报告requestAnimationFrame未定义，要求先诊断生命周期并提最小修复，不忽略、不靠重复全量碰运气。当前暂存13文件保留，团队仅获指定测试/RESULT补修和定向窗口，生产停写。

定时异常诊断：独审原bag单测10/10通过、未单独复现，但实际afterAll只restoreAllMocks，boot闭包保留250ms timeout→rAF。Friday核源码后批准仅该测试生命周期修复：main导入前可控fake计时器，按原0/280ms定量推进，结束清除剩余计时器并核0、finally还原；不runAllTimers、不压制未处理异常、不改boot。保留全部业务断言，补修与快照测试一起定向/独审后再交全量。

15:38 补修交回：原B单写两测试，独审通过，全队停写。快照以合法version/onPlay操作数组替代非法扩展，前后schema/capability检查通过并保留全部隔离意图；bag验证window/global三类计时器受控，结束清零并还原，原10业务断言不变。15:37:36两文件11项全部通过、无未处理异常；首轮门禁红灯不因此作废，需完整重验。Friday已读两文件实际diff，新增两文件使本批总15文件，原生产变更未再修改；准备再次运行原门禁。

## 最终本地落库结果

2026-09-27 15:44（Asia/Shanghai）Friday 实核：15:40:39 启动第二轮原 pre-commit 全量，171 文件 / 1119 项全部通过，无未处理异常，Vitest 耗时227.57秒；完整日志 `.git/gate-full-test.log`。未绕过门禁，15文件已提交为 `8c73f88a008d2c8ef8b98af5cec69a08b3316b2a`（fix: reject unsupported card rules before battle payment）。首轮快照失败与teardown异常经上述补修及新完整门禁关闭。

提交后 tracked/index 干净，原排除未跟踪内容保留；相对本地 origin/master ahead14/behind0，未fetch、未push，非服务器实时状态。本段随后单独提交验收记录，不改变已验代码。此记录更新RESULT中全量/本地提交待Friday的时间状态：E6代码、独审、定向、全量及本地落库完成；两个真实能力/guard模块受静态检查，不宣称整个解释器或整库规则已静态化/迁移完成。E2–E5积压及E6拒绝提示实页仍留E7，未build、未改玩家档，不自动启动E7。
