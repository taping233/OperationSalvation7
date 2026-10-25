# 战斗与卡牌大块重复归一

本轮将 79 份托管规则模板归一到两个纯构造函数，四份卡牌运行源码合计 **+92/-725，实际净减 633 行、5741 字节**。这是重复结构的共同构造，保留全部卡牌 ID、规则值和迁移兼容。未删除文件，未改战斗结算或先前报告的 bug，未运行测试、构建或实页。

| 源码 | 修改前 → 修改后行数 | 处理 |
| --- | ---: | --- |
| `game/src/cards/builtin-card-previous-rules.js` | 475 → 111 | 38 份基础模板、9 份带目标模板改为构造调用；51 个旧规则 ID 保留 |
| `game/src/cards/builtin-equipment-previous-rules.js` | 171 → 23 | 15 份基础模板、4 份带目标模板改为构造调用；19 个旧规则 ID 保留 |
| `game/src/cards/cards.data.js` | 924 → 793 | TABLETOP13 中 13 份带目标模板归一，其他卡面和规则节点保留 |
| 新增 `game/src/cards/hosted-rule-snapshot.js` | 0 → 10 | 两个无依赖纯构造函数，新增行已扣除 |

`scripts/sync-cards-from-live.mjs` 的手工 VM 装配由主会话维护，不在本报告四文件计数内；主会话已把该叶子安排在历史规则和定版数据消费者之前。主会话同时处理第四轮快照比较器的装配与导入别名，源码归属不与子代理交叉。

## 等价依据

基础构造保留 `{version:1,battle:{hosted:[name]}}` 的完整字段顺序；带目标构造保留 `{version:1,battle:{target:{side,area:false},hosted:[name]}}` 的完整字段顺序。每次调用分别新建 rules、battle、hosted 数组；带目标模板另新建 target 对象。不缓存、不共享嵌套对象、不读牌库、不冻结对象、不注册服务，也不访问回调或随机源。

第一组以 Acorn 解析静态字面量，仅解释允许的声明节点，逐项与整表核对 JSON 字符串及属性描述符。两历史表各自原有的 173、62 个独立对象在解释后的候选中保持，无任何别名共享。第二组将新构造函数的字面量返回式按实参展开后，对三个完整模块作 AST 比较；除新增导入及目标构造调用之外，整份模块结构一致。此方式没有执行游戏模块、迁移函数或测试。

四份不匹配标准模板的旧规则保持原文字面量：`tt2-frostsword` 有装备条件，`tt8-hero-sealer` 有不可打出要求，`cmtn1ntxzoc4` 有触发器，`cc-rot-seed` 的 battle 字段顺序是 hosted 后 target。最后一项虽然字段值相似，JSON 指纹顺序不同，不能用带目标构造替换。

原 `builtin-card-execution.js:171-186` 的递归冻结范围、时点和聚合顺序没有变化；公开导出仍为原有 `const` 表。最终冻结前的可变性、冻结后的共享范围和每个 ID 的对象身份关系均保持。`builtin-card-execution.js`、`builtin-equipment-execution.js`、`cards.sync.builtin.js`、`battle.hosted.js` 在第一组编辑前后的 SHA 一致，见阶段收据。

卡牌迁移在 `builtin-card-execution.js:203-204` 用 JSON 字符串匹配旧规则；启动入口 `cards.js:227` 经 `card-migrations.js` 调用 `ensureBuiltinExecutionRules`，局内 `battle.hosted.js:28` 同样调用迁移器。模板归一保留历史指纹，不能把历史表作为退役数据删除。全库生产、工具和测试引用记录见 [references.txt](references.txt)。

## 大块候选保留结论

| 方向 | 当前结论及证据 | 可直接删除量 |
| --- | --- | ---: |
| 单例运行时兼容整片 | 保留。`battle.default-context.js:1/18` 把 defaultBattleRuntime 注入现行工厂；`battle.core.js:14-19` 消费其具名活绑定；`:269-270` 读取三个兼容模块的值生成回放状态，`agent.replay-state.js:51` 进一步消费。运行时工厂与兼容模块指向同一份状态，未发现第二套退役状态。 | 0 |
| `battle.state.js` 状态机 | 保留。`battle.runtime.factory.js:10/153/158` 实际创建状态、迁移阶段、取消目标；领域与 action runner 也直接使用。它不是旧单例的空壳。 | 0 |
| M1—M11 迁移模块整套 | 保留。11 份模块的执行骨架已经统一为 createRuleBackfiller，`card-migrations.js` 仍逐项注册并有序执行。差异是各批数据、marker、canonical 来源顺序、旧规则快照及回填字段。删批次会损失未迁移存档兼容。 | 0 |
| 结构化与文本执行双轨 | 保留。`card-execution-plan.js` 根据卡牌声明选择唯一执行权；自定义卡、未精确匹配历史指纹的旧卡仍可走文本适配。`battle.hosted.js:31-35` 有显式定版身份、声明和触发器守卫，没有证明整片文本实现不可达。 | 0 |
| 历史规则模板 | 已实施本报告归一；70 个历史 ID 保留，66 份相同结构使用共同构造，4 份例外保持。定版数据另归一 13 份。 | 净减 633 |

本轮逐文件覆盖与读取深度见 [coverage.json](coverage.json)。复用主会话入口图与第四轮重复片段报告，只把它们作为入口和重复线索；没有把“入口可达”当作每个函数都存活的证明。

## 验证与证据

- [final-receipt.json](final-receipt.json)：四份源码的原文/最终 SHA、真实 +92/-725 计数、原文路径；四份静态语法检查与差异检查退出码均为 0。
- [changes.patch](changes.patch)：相对本轮各文件编辑前原文的精确补丁，保留前批未提交内容。
- [receipt.json](receipt.json)：53 份基础模板的声明值、顺序、对象独立性和消费者 SHA 证据。
- [targeted-receipt.json](targeted-receipt.json)：26 份带目标模板的逐处范围、原/后 SHA、完整模块 AST 等价证据。
- `*.before.txt` / `*.targeted-before.txt`：两阶段的原文字节；`*.candidate.txt` 保留可审预览。
- `*.cjs.txt`：本轮只解析与比较源码的静态证据程序归档；实际业务模块未被求值。

沿用老板“不用测试”的要求，测试/构建/浏览器验证均未运行。完成未提交，四份源码编辑占用可释放。
