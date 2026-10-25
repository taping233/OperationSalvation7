# 卡牌校验重复执行体归一

仅修改 `game/src/cards/card-rules.schema.js`，把 42 处重复校验归一到 3 个私有执行体。相对本轮原文 **+60/-126，实际净减 66 行、2901 字节**，文件从 1304 行降至 1238 行。前批未提交修改保留，没有新增导入、导出、叶子文件或迁移数据。

| 重复类型 | 原位置数 | 归一后的执行体 |
| --- | ---: | --- |
| 有值时必须为正整数 | 17 | `validateOptionalPositiveInteger` |
| 有值时必须等于 true | 14 | `validateOptionalTrue` |
| 逐键报告操作白名单外字段 | 11 | `validateOperationKeys` |

每处仍在原校验顺序调用。可选字段保留第一次读取后的短路和第二次读取，没有把 getter 值提前缓存。白名单校验仍先调用 Object.keys，再按原顺序逐键检查、报错；动态 op 的字符串转换保留在每个未知字段的原错误分支中。错误路径、错误文字、error 回调次序与其他校验分支保持。

## 静态证明

原文和候选均以 Acorn 解析。将三个新增私有函数的调用按实参替换后展开，规范化等价的点号/字符串键访问与静态模板字符串，再比较**整个模块 AST**，结果一致。没有求值游戏模块、校验函数或测试；候选生成只解析、展开和比较源码。

只选对象为局部标识符、谓词和消息完全相同的 42 处。保留嵌套 getter 链、特殊错误文字、必填值、非负整数、范围检查和其他条件，例如 `bonus.pct` 的百分比提示、hits 的嵌套访问和 `playerStealthed` 的不同提示都未强行套用 helper。

修改前保存原文字节，应用前再次核对 SHA：

- 原文：`653dd808f5799bf8548fe38c024ed5ea4700ad99fa46b7e9557f2047e4c45e3f`
- 最终：`fc4a5b4fa65194db88779dff8fac6233353bc24773be987b97f88c92681830ff`

单文件静态语法与 diff 检查退出码均为 0。全库检索确认三个新增私有名称只在 schema 中定义/使用；同步工具仍从现有 CARDS_MODULE_ORDER 装载完整 schema 源码，没有新增手工 VM 依赖或别名。

## 覆盖与保留

- `card-rules.schema.js`：全文件 AST 模式扫描与展开比较；定向读取操作、效果、诅咒、装备、触发、背包、目标及费用约束，实施本报告的 42 处归一。
- `builtin-card-previous-variants.js`：16 行、3 份不同历史指纹，由现有迁移器按 ID 加入 expected 列表；没有可删的重复执行体，保持原文。
- 第四轮重复片段报告仅复用为线索，没有将旧行号当作当前源码证据，也没有重复提出已否决的单例、M1—M11 或文本兼容整片删除。
- 避让本轮活跃 UI、status、图标消费者及 combat.factory；没有编辑这些路径。

证据：[receipt.json](receipt.json) 记录精确修改范围、42 处原文行号与 helper、增删计数和验证退出码；[changes.patch](changes.patch) 为相对本轮原文的补丁；[card-rules.schema.js.before.txt](card-rules.schema.js.before.txt) 保存原文字节；[apply-schema.cjs.txt](apply-schema.cjs.txt) 保存静态证明程序。

沿用老板要求：未测试、未构建、未开实页、未提交、未删除文件。完成未提交，schema 编辑占用可释放。
