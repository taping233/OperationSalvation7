# 测试环境夹具结构精简：本批完成并冻结

28个具名夹具族替代201份测试中的383处重复准备语句或连续对象成员。新增公共体为 tests/helpers/environment-fixtures.js，独立形状专测为 tests/environment-fixtures.test.js。本片没有游戏运行源码变化；测试净减 **28,253规范字节 / 28,090去注释字节 / 10,537 tokens**，已扣公共夹具、全部调用与导入、4,575字节正式专测成本。

范围严格按父登记的 [plan.json](plan.json)。排除 battle-persistent-stage、全部命中的 project-bug* 等11份冲突测试；没有扩充原30候选，最终保留28族。旧原文冻结于 ignored cache 的 round2/tests/before/tests/，归属和前后SHA见 [source-manifest.json](source-manifest.json)。

公共工厂每次直接创建对象；原位置spread保留属性顺序，原method/arrow语法保留函数形状。可变导入/外部绑定通过延迟reader在原位置读取，既存const holder按原引用传入。没有顶层副作用，也没有vi.hoisted体引用新helper；helper只依赖浏览器/JS全局，正式专测不依赖cache。

验证结果：

- 28族383处逐参数、reader和局部变量反向还原AST完全一致；19,507个原断言AST节点及2,629个用例注册、skip、hook、timeout记录全部一致。见 [static.json](static.json)、[ast-equivalence.json](ast-equivalence.json)。
- 新形状专测 **26/26通过**；检查字段顺序、普通数据descriptor、独立嵌套容器、method元信息及const-holder后续读取。
- 201份目标测试：184份通过，17份失败；2,485项通过，51项失败。17份失败测试通过独立Vite预变换注入冻结原文，未覆盖共享源，263项中仍是同一51项失败；逐文件、完整用例名、状态和报错首行均相同，隔离期间runtime源码SHA无变化。见 [test-baseline.json](test-baseline.json)。
- 203路径ESLint仅旧 chest-batch-receipt.test.js 的未使用index一项；冻结原文stdin隔离同规则复现，未修旁支。新helper及新专测lint通过。见 [lint.json](lint.json)。
- 函数推断名疑点未命中：16处battleViewMocks rich实参均为原有Identifier，原句为shorthand rich；没有把原property inline arrow移作实参。
- 独立二审对353处属性片段做旧新VM对照，shape、descriptor、name、length、对象独立性及构造调用顺序全部一致；5项延迟读取变化、16处rich严格引用和全部静态导入顺序均通过。见 [independent-review.json](independent-review.json)。

原始测试JSON和日志留在cache，不把大输出入git；获取方式、大小及SHA见 [artifact-index.json](artifact-index.json)。没有build、安装、新服务、浏览器、提交或删除。完成此批后停止扩展，父会话统一登记暂停。
