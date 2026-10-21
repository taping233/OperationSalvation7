# I-02 底座集成修复已冻结

完整类型门通过，实际实现检查537/537；其中49/537为原严格配置的有效实现检查。新增两份他会话已批准过场JS纳入分母并保留。全域实现配置仍为非strict，原10配置与负例门保持。

## 修改与运行语义

- `scripts/gate-plan.mjs`为覆盖脚本登记真实专属测试。工作流指纹原本已包含全部根类型配置；集成测试现在沿check-types的显式具名import读取共享TYPE_CONFIGS字面量，保留独立来源、重复项、全量配置与证据指纹断言，无eval或从指纹反推期望。
- 自有52份改变过的运行JS逐文件复核Acorn AST。46份除注释、类型或导出既有挂载初始化值外完全相同。6份余项已逐一说明：Error数值转串、DOMStringMap数值转串、Unicode identity escape等价写法、同一animate函数的类型端口别名，以及接班前已存在的mapData/renderer.fx改动。详见[I02 AST记录](I02-owned-ast-review.json)。
- 恢复了为类型改过的判断、DOM选择器、被删的忽略参数、callback默认undefined、策略额外参数和原QA赋值。原`ease-out`字符串恢复；本地motion-dom实现将其映射为native默认，之前Bezier替换并不等价，现已撤销。中央card泛型透传原始操作/卡片字段，以NoInfer保留默认严格反例；战斗端不因类型新增运行校验。
- [等价实验](I02-semantics.json)：327680组Unicode输入/后缀的RegExp.exec零差异；有限网格坐标的原/显式字符串DOM赋值相同；HTTP状态码的Error消息相同。

## 精确消费者审查

先读取现行审查机制与历史授权证据，再核对完整资源构造AST、实际输入源和所有候选引用。battle与hubrun确认相关消费者冻结后，统一更新21个消费者、30处完整LF SHA256；不改变排除算法、类别、195个候选或保护测试。所有动态构造AST均与已审基线相同；唯一非类型路径差异是另一会话已获批准并完成的battle/boss v2过场复用，两路径均不在省略候选。

完整审定见[I02资产审查](I02-asset-review.json)。保留3个不参与本次失效的历史指纹，未替它们追认未知历史差异。当前真实全源码扫描返回`excludedAssets=195, warnings=[]`；新引用、改选择器、新opaque消费者与完整模块图保护仍生效。

## 完整相关组验证

| 命令/范围 | 结果 |
| --- | --- |
| Vitest scripts-contract + workflow-cli-integration，完整两文件 | 69/69通过，exit 0 |
| Vitest retired-scenes-publication + runtime-asset-redundancy + runtime-asset-redundancy-plugin，完整三文件 | 32/32通过，exit 0 |
| 自有运行JS/类型脚本定向ESLint，另含gate-plan/review/workflow集成测试 | exit 0 |
| `node scripts/check-types.mjs`，原10配置+runtime+真实逐文件编译探针 | exit 0；537/537实现、49/537 strict |

最后类型门前后完整fingerprint一致，输入稳定；code组为`e4b8afb504a1ead131a0942cd19f36d87a8cef40601db5846a50ba0912aabc80`。完整逐文件输入及环境见[I02输入清单](I02-input-manifest.json)，命令/退出码/日志SHA见[I02门回执](I02-typecheck-receipt.json)，逐文件实现/strict覆盖见[最终覆盖](coverage-I02-final.json)。原始日志留`.tmp/types-full/I02-typecheck.log`及`i02-{tool-contracts-full,assets-full}.txt`。

未执行build、全量测试、实页或服务操作，未提交推送。新一轮stable full与浏览器能力核验由integration安排；输入未变时可复用本轮有效静态证据。源码与审定索引自此冻结。
