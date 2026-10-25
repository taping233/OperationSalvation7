# 第三轮 cards 逐文件覆盖

本轮重点新增 cards 迁移、规则规范与数据表的审查，不重复把前两轮战斗运行态当新增覆盖。下表路径统一相对 `game/src/cards/`。

“定向审读”表示人工读实现或目标片段并核对消费者；“结构/引用”表示解析整个文件 AST、检查导入/导出/声明及相关消费者，不等于逐卡数值或全部业务审计。表内 47 个文件均通过当前工作区静态 AST 解析；此次结构扫描只覆盖重复字面键/Map 键/无条件退出后语句，没有证明任意条件分支不可达。

| 文件 | 本轮深度 | 处理与理由 |
| --- | --- | --- |
| builtin-card-execution.js | 定向审读 | 保留；native 所有权、规则冻结及旧指纹升级仍被启动迁移和数值推导调用，旧声明不是死数据。 |
| builtin-card-field-defaults.js | 结构/引用 | 保留；nativeNumericField/nativeDamageType 按 id 读取默认值，未逐条重审数值。 |
| builtin-card-identities.js | 定向审读 | 保留；稳定身份集合供 isBuiltinExecutableCard 和 native 所有权使用。 |
| builtin-card-numeric-fields.js | 定向审读 | 保留；显式字段、literal operation 与缺省字段优先级各有用途。 |
| builtin-card-previous-rules.js | 结构/引用 | 保留；migrateBuiltinExecutionCard 比较旧规则指纹，既有测试也直接读取；未逐条重审 475 行快照。 |
| builtin-card-previous-variants.js | 定向审读 | 保留；补充神灯/挖宝等已发行变体指纹，不是当前规则重复副本。 |
| builtin-choice-execution.js | 定向审读 | 保留；现行抉择与历史指纹分别参与执行/迁移。 |
| builtin-equipment-execution.js | 定向审读 | 保留；装备结构化声明供现行执行；arrowIds/gunIds 在声明中使用。 |
| builtin-equipment-previous-rules.js | 结构/引用 | 保留；统一迁移查找表读取其历史指纹，不能移除老档入口。 |
| card-compatibility.js | 定向审读 | 保留；特定身份的旧文本抑制和掉落例外各有消费者，不泛化为通用条件。 |
| card-execution-plan.js | 定向审读 | 保留；触发器/装备/预检/合成执行视图服务不同入口，空声明所有权不能删。 |
| card-instance-fields.js | 定向审读 | 保留；实例瞬态字段与未知扩展保留规则被创建/刷新调用。 |
| card-instance.js | 定向审读 | 保留；深克隆和瞬态字段清理分别保证模板、运行副本隔离。 |
| card-legacy-battle-policy.js | 结构/引用 | 保留；隔离旧卡身份判断的叶子模块，本轮未修改实时战斗兼容规则。 |
| card-migrations.js | 定向审读 | 保留；启动清单引用 M1-M11、独立修订与批次播种，执行顺序不能仅因历史 marker 删掉。 |
| card-rarity.js | 定向审读 | 保留；职业/英雄谱系/衍生链与环路兜底分别覆盖不同数据。 |
| card-rules.capability.js | 定向审读 | 保留；能力表在 schema 通过后仍拦截尚无生产执行的组合；不是重复形状检查。 |
| card-rules.schema.js | 结构/引用 | 保留；读取规则表、验证函数路由并解析全部 AST；未宣称穷举 1330 行交叉契约。 |
| card-semantic-contract.js | 定向审读 | 保留；语义操作识别与参数规范分开使用，受限参数仍需拒绝非法自制输入。 |
| card-trigger-contract.js | 定向审读 | 保留；各时点词表和空声明所有权被执行、校验共同读取。 |
| cards.catalog.js | 定向审读 | 保留；canonical id/ref 解析、重复和缺失检查在数据表装配时运行。 |
| cards.consts.js | 定向审读 | 保留；marker、退役列表和职业集被启动清单/迁移使用。 |
| cards.data.js | 结构/引用 | 保留；dataSlice 由 cards.js 装配，TT10/11 使用 canonical 引用；没有把历史批次直接当死表。 |
| cards.js | 结构/引用 | 保留；核对 slices 与 runCardMigrations 装配；存储/并发修复不属本轮修改路径。 |
| cards.rules.js | 定向审读 | 保留；词条推导、掉落与职业池当前仍有消费者，自制卡文本兜底不删。 |
| cards.sync.backfiller.js | 定向审读 | 保留；M 批共享骨架有缓存一致、缺卡、双门和失败重试约束；与 E8 语义不完全相同。 |
| cards.sync.builtin.js | 定向审读 | 保留；启动/晚导入规则修订入口，会校验迁移结果后保存。 |
| cards.sync.catalog.js | 定向审读并精简 | 三套同步执行体共享为私有 helper，净减 12 行；各 marker、retire/source 及 receiver 语义保持。 |
| cards.sync.face-refresh.js | 定向审读 | 保留；已盖章卡库仍需幂等定版刷新，不能依赖一次性迁移替代。 |
| cards.sync.js | 定向审读 | 保留；启动兼容装配及惰性端口，公开方法 receiver 仍有意义。 |
| cards.sync.m1.js | 定向定义/参数 | 保留；初始攻击等独立迁移集合和 marker；共用 backfiller 已消除重复骨架。 |
| cards.sync.m2.js | 定向定义/参数 | 保留；费用/混合效果定义与独立来源映射，仍在迁移清单。 |
| cards.sync.m3.js | 定向审读 | 保留；当前工作区含实时修复的新规则和 previousRulesById；未覆盖他人变化。 |
| cards.sync.m4.js | 定向审读 | 保留；深海咒印仍有定义，单个小工厂不为凑行数强行内联。 |
| cards.sync.m5.js | 定向审读 | 保留；延迟/抽到规则与 faceFieldsById 有不同迁移语义。 |
| cards.sync.m6.js | 定向审读 | 保留；道具规则与 python-potion 历史修订指纹有当前用途。 |
| cards.sync.m7.js | 定向审读并精简 | 去掉 archdemon 重复映射项，最终 Map 值和插入顺序保持；其他装备/时点规则保留。 |
| cards.sync.m8.js | 定向审读 | 保留；持续触发、手牌代价和特殊计数已声明，不能并入更早批次绕过 marker。 |
| cards.sync.m9.js | 定向定义/参数 | 保留；hosted 名单及旧银河之旅规则仍供迁移指纹/宿主消费。 |
| cards.sync.m10.js | 定向定义/参数 | 保留；装备 hosted 迁移与 frost-sword 历史修订指纹仍使用。 |
| cards.sync.m11.js | 定向定义/参数 | 保留；精确宿主表与 canonicalOrder 仍用于启动迁移。 |
| cards.sync.numeric.js | 定向审读 | 保留；补伤害类型、效果字段和伤害值的条件/字段不同，未合并成过宽写入。 |
| cards.sync.persistence.js | 定向审读 | 保留；成功写入快照必须逐字复读匹配才盖章的单一来源。 |
| cards.sync.renames.js | 定向审读 | 保留；历史身份、名称、归属和显式旧值迁移边界各异，不删除老档/自制卡兼容。 |
| cards.sync.rule-backfill.js | 定向审读 | 保留；A3 合并式回填与 E8 整卡匹配不同；顶层 foundIds/失败处理不删。 |
| pierce-arrow-revision.js | 定向审读 | 保留；只修精确旧指纹，不能用强制全卡覆盖代替。 |
| rot-seed-revision.js | 定向审读 | 保留；历史文案匹配修订入口仍在启动清单，当前不能据名称过时判冗余。 |

以下 12 个 cards 文件涉及表现、卡面文案或编辑交互，本轮明确排除，未算入 47 个纯规则/数据覆盖：battle-value-context.js、card-battle-start-explanation.js、card-description-links.js、card-description-text.js、card-draw-explanation.js、card-frame-presentation.js、card-photo-notes.js、card-render-context.js、card-state-presentation.js、cards.view.js、mech-sentences.js、structured-card-description.js。

后续补充：主会话协调确认释放后，已应用上两轮的 combat 自测迁出与 acquire 循环合并候选，详见 `pending-applied/report.md`。这 5 个补充源文件/测试文件不混入上表 47 个 cards 纯规则覆盖。
