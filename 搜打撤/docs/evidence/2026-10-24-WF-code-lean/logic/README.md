# 卡牌迁移与条件装备精简

本批 8 个既有文件与 1 个新共享构造器净减 406 行、30,940 字节。Acorn 非注释 token 从 7,175 降至 6,425（净减 750）；字节减少还包含已在迁移归档保存的历史过程注释，不能全部视为可执行代码收益。逐文件前后行数、字节与 SHA256 见 `changes.json`。

- M1/M2/M3 共用 onPlay 定义构造；M5/M8 共用触发器定义构造，保留未声明 battle 与空 onPlay 的差异。
- 7 批 canonical 来源从完整重复 ID 表改为默认源表加显式例外；marker、旧规则兼容与卡面覆盖字段保持原值。
- 条件装备的结构化与文本来源共用差量结算；技能文字共用一次匹配，结构化空技能仍不显示。
- 移除的迁移过程长注改为现有 `docs/archive/card-migration-2026-09-27/` 对应结果文档指针；现行消费、兼容和结算边界保留。

验证：

- 7 批完整迁移 spec 前后等价（definitions、有序操作、canonical 来源、marker、卡面覆盖、旧规则）；见 `migration-equivalence.json`。
- 装备 37 组旧/新对照，包括 210 次诅咒状态切换，比较增益调用、日志、最终状态、已应用加成与技能文字；见 `equipment-equivalence.json`。
- 12 个测试文件：412 通过、1 跳过、0 失败；见 `vitest.json`、`vitest.log`。范围为 M1～M6/M8、装备合成、结构化装备权威、BOSS 编组与 contracts/architecture 哨兵。跳过项不计通过。
- 9 个源码 Acorn 语法与 ESLint、精确路径差异空白检查通过。ESLint 日志为空，退出码为 0。

完整修改前源码保留在忽略缓存 `node_modules/.cache/code-lean-before/logic/`，不进入 Git；原始指纹见 `baseline.json`。本批未 build、未启动服务、未浏览器实页、未提交或推送。类型检查由主代理统一执行；定向通过不代表项目全量通过。
