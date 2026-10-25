# Cards 结构重写：最终收拢结果

最终只交付操作定义、字段约束和 requirements/costModifiers 的统一验证组织。公开校验结果与错误顺序保留；旧文本和结构化执行继续使用各自已验证路径。

- 本阶段净减 **996 有效 token、4921 规范字节、81 行**；新元数据模块的 102 token 与同步脚本新增项均已计入。
- 对原始全项目基线 836141 token / 6601166 规范字节，本阶段自有改动贡献 **0.1191 个 token 百分点**、0.0745 个字节百分点；不是全项目累计结果。
- cards 子系统按阶段前 71958 token 计，净减 **1.387%**；schema 入口自身净减 9.449%。
- 加上首批自有改动，累计净减 1527 token / 7023 规范字节；不包含其他代理成果。

## 改动

统一 OPERATION_SCHEMAS 同时维护操作白名单、逐操作参数键、简单字段校验与复杂验证入口。全局键白名单从该表派生，显式保留旧 cleanse 参数和 transform.cost 的历史诊断差异；pending 名单由元数据派生。字段检查共享 required/optional 与消息约束，requirements/costModifiers 共用保序列表入口。新增纯元数据叶模块 card-healing-program.js 仅提供 heal/armor/draw 的 sources/keys，不含程序解释或战斗执行。

scripts/sync-cards-from-live.mjs 仅在手工装配清单补入真实元数据依赖。父缓存未覆盖 scripts；该脚本前值由当前源码去掉唯一自有清单行重建，单列于 added-scope-before，不能冒充父冻结原文。对应来源与 SHA 见 changes.json。

## 试验没有作为收益交付

治疗/护甲/抽牌 CardProgram 新层成本 2106 token、旧块退役收益 1493 token，试验净增 613 token，因此终止。按父指令逐块撤掉新增执行/适配层；resolution、recovery、kills、cards.rules、structured-description 五消费者与阶段前规范化原文完全一致，没有用整份 before 覆盖共享文件。无未引用 VM 文件、无文件删除。

## 验证

最终定向 **17 文件 212 项全部通过**；原文差分 **14351 例**通过，包含 523 条原始内建记录、282 条真实启动迁移后记录、空声明、未知键、数值边界、混合目标和错误顺序。schema-differential.mjs 是证据工具，依赖本地前值缓存，不进入默认 CI。

card-sync-slices 的两项旧失败在本阶段 before 隔离加载下复现（4 通过、2 失败），单独记录，不标通过。目标语法和 ESLint 通过；运行时类型检查本属地零诊断，其他在途 UI/hub 诊断已交父和 UI 代理。实页、全局类型收官和远端 CI 未由本代理验收。未提交。
