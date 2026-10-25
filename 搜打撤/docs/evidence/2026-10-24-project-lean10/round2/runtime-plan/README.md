# 第二轮 runtime 兼容片结构精简

父已授权实施量化后的最小替代，五份 ESM 兼容片与现有公共 helper 已完成并冻结。运行 JS 连同 helper 新增 **605B** 成本后，实际净减 **6,859 原始字节 / 6,736 归一化字节 / 1,032 非注释 JS tokens**。实际稿补足泛型推断约束并保留原文件换行形式，因此与初稿数字略有差别。全部功能、91 字段白名单及原守卫断言保留；没有构建、删除文件、安装依赖或修改共享台账。

## 已核边界

复用本轮定向 handoff：`battle/runtime`、`battle/core`、`hub`、`run` 的编辑占用为 0；已有完成未提交改动保留。当前源码含第一轮已完成的状态 getter/setter 和动态 engine 门面重构，本方案从这些当前文件继续测量，不重复计算第一轮收益。

## 已实施范围

| 文件 | 改前字节 | 实际减少字节 |
| --- | ---: | ---: |
| `game/src/battle/runtime/battle.runtime.session.js` | 3,391 | 1,597 |
| `game/src/battle/runtime/battle.runtime.piles.js` | 2,437 | 1,057 |
| `game/src/battle/runtime/battle.runtime.interaction.js` | 2,992 | 1,351 |
| `game/src/battle/runtime/battle.runtime.effects.js` | 6,189 | 2,872 |
| `game/src/battle/runtime/battle.runtime.presentation.js` | 1,540 | 587 |
| `game/src/core/live-bindings.js` | 1,424 | −605（新增辅助函数成本） |

每片把连续 `export let field = runtime.field` 改成具名解构声明，把 switch 的同形赋值分支改成“字段 → 回绑函数”表。连续方法别名改成 `export const { ... } = runtime`。公共 `subscribeStateBindings(runtime, bindings)` 只负责 own-key 检查和调用与本次字段相符的回绑函数。

这些修改移除重复状态装配表达，不重命名业务变量、不压缩空行、不删除注释或测试。`measure-plan.mjs` 默认从 round2 冻结源在内存生成替代源，由 Acorn 解析，随后写入 `measurement.json`；同时逐字验证当前六份运行源与稿件一致。`--apply` 仅在六份源全部仍匹配冻结 SHA 时写入已授权范围，冻结后不能重复应用。默认复算方法：

```powershell
node docs/evidence/2026-10-24-project-lean10/round2/runtime-plan/measure-plan.mjs
```

必须保持以下设计，不能为进一步减少字节合并成一个总订阅器：

- 五片各自注册一次同步 subscriber，仍在原位置注册，保留独立导入与中间外部订阅的时序。
- 导出的变量仍是模块级 `let`，原消费端、barrel 和具名 ESM live binding 保留。
- 仅与本次 key 匹配的 own 回绑函数读取一次对应状态；未知 key、Symbol、`constructor`、`__proto__` 不触发继承属性。
- 导出方法直接保留 runtime 的原函数引用，维持函数 name/length、constructability、getter、冻结对象和方法顺序；特殊 `handInfuseCounts` 复制仍由现有 setter 承担。
- 各片仍指向原 default runtime，独立实例和 dynamic engine 切换链不改。

## 继续扩装配链的收益边界

当前全 `game/src` 的纯 rest 转发函数体共有 140 个、原体积合计仅 7,799B；engine factory 的 60 个占 2,254B。四个纯 runtime 对象投影体共 1,851B。这些是**不扣新 schema/helper/注解成本的毛上界**，部分与端口候选重叠，不能累加当作实际净减。

独立审计确认：effect assembly 的 101 个对象箭头属性合计 10,777B；engine factory 的 105 个合计 8,624B（其中 6 个 `readState` 合计 2,861B）。这约 19.4KB 包含大量独有业务逻辑，并非重复实现。资源、队列和读端口相同部分约 2–3KB；叠加通用读投影及晚绑定 commands 装配后，额外可省量估计 5–7KB，尚无经完整内存替代稿证明的净减。

已检查的细分链没有新的大块：runtime 的整组 restore/reset 已有聚合入口；存档采用入场 checkpoint，snapshot 投影包含派生/复制/过滤语义；default context、engine instance 和 enemy-phase 兼容包装各自体积小。不能用统一 state 袋、直接 `readState: () => runtime` 或无差别共用端口对象替代它们：那会改变快照留存、字段读时机、函数身份或键序。

effect assembly 中必须保留的差异包括：文字发现任务直接入队，结构化任务追加 `optionsPlus`；两条 log 回调的 length 不同；部分 flag setter 表达式返回原 setter 结果，另一条显式 void（注入非标准 JS ports 时须比较回传值）；队列、target 选择和击杀回调时点也不能只按最终结果比较。`getPriceOfLastDrawn` 等只有局部变量或等价三元表达式差别的候选可以进一步差分确认，当前未将它们计为已证明净减。

因此，本范围没有进一步扩大为单链 >20KB 或合计 70KB 的公共架构。父单独授权的本次最小替代在上述六份运行源内完成。

## 验证与冻结

十份相关测试共 **86/86 通过**：新增 `battle-runtime-compatibility` 六项、原 `battle-runtime-state-guard` 三项、原 `battle-bindings-equivalence` 四项，以及 runtime instances、independent battles、engine facade、core ports types、battle modules、battle architecture、architecture boundaries。`jsconfig.runtime`、`jsconfig.framework-ports`、`jsconfig.framework-boundaries` 三配置类型检查通过；修改的运行源及测试 ESLint、diff-check 通过。

运行代码净减沿本轮既定 `game` 运行 JS/CSS 口径，含全部运行 helper 成本。正式测试新增及解析器适配共增加 7,208B，单列于 `verification.json`，不计入该口径；未以删除测试抵扣。

`tests/battle-runtime-state-guard.test.js` 只把声明提取器改为 Acorn 解析以识别解构导出，现有 91 字段白名单、setter 豁免和全部三项守卫断言原样保留。新增 `tests/battle-runtime-compatibility.test.js` 六项正式 CI 测试自包含，不读取 cache/evidence；断言固定 188 导出与分片数量、alias 严格引用、初始 getter 次序、91 字段逐一更新、同值赋值、交错订阅重入、未知/Symbol/原型 key 零读取、独立实例和特殊复制 setter。

独立 `differential.mjs` 使用 round2 冻结原文和当前原文作为两个内存 ESM oracle，不覆盖共享源码，也不修改测试断言。冻结原文先按 round2 manifest 核验 SHA；逐项比较 188 导出 descriptor、97 方法 alias 身份及元信息、91 字段的 182 次发布、初始 getter 读取顺序、5 个 compat subscriber 与 5 个穿插外部 subscriber 的重入 trace，以及 7 种未知/Symbol/原型 key 的零状态读取。结果完全一致，详见 `differential-summary.json`。此旧源工具仅用于证据复现，不属于正式 CI 依赖。

初次类型检查发现泛型只从 subscriber 逆向推断会使值成为 `unknown`；已将 runtime 参数声明为 `S & { subscribe(...) }`，保留字段的原值类型，未增加 any 逃逸或削弱现有类型门。后续全部检查在冻结源上通过。源文件 SHA 记录于 `measurement.json`、`differential-summary.json` 和 `verification.json`。
