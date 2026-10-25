# 正向退役 DOM 规则清退

已按父会话登记的 [19 个精确 CSS 路径](manifest.json)执行，保留原文件、全部注释、活声明、声明顺序与 live selector specificity，未展平此前的 native scopes。实际减少 **32,734 规范化字节**；新增正式纯 helper 与专测共 **8,992 字节**，扣除后本片正式源码净减 **23,742 字节**。其余本次审计工具、证明 JSON 与旧源码 oracle 属证据，不作为运行代码减量。

## 变更与来源证明

删除条件是选择器分支必须依赖当前已不生产的正向 class/id；`:not` 内容不作死亡证明，`:is/:where/:has` 只有全部替代都要求缺失节点时才判死。只删必死完整规则或顶层死分支；没有改写函数内部替代列表。

- [计划](plan.json)和[实施清单](manifest.json)包含每条旧 selector、完整有效 selector、缺失 token、生产者证明、前后 SHA256 与逐文件净量。
- [执行时来源证明](consumer-proof.json)冻结 1,933 份 JS/HTML/JSON 输入；AST 字符串、模板及拼接保守检索覆盖 1,712 个 JS/内联脚本、112 HTML，HTML 属性另用 parse5 解析。独立子代理交叉核对真实 HTML、className、classList、setAttribute 生产，分离注释、源码查询、regex 与断言。
- 108 个缺失 token 均未命中当前来源或已知动态前缀；27 类动态命名族保留。仍有实际 dev/测试消费者的 route 节点及文档承诺的 `.xl` 尺寸保留。
- 原始增量按实际工作树字节保存于本地忽略缓存 `node_modules/.cache/project-lean10-dead-dom-before/`，没有恢复 HEAD 或整文件删除。

## 等价与测试

[实盘验证](validation.json)核对前后 SHA，以及原生和实际编译视图下全部活声明、顺序、权重与所有注释。纯逻辑已提取到正式 `tests/helpers/css-reachability.js`；[纯 helper oracle](pure-helper-oracle.json)再次从 19 份缓存原文生成当前结果，19/19 相同。

正式专测 `tests/css-dead-dom-reachability.test.js` 只依赖纯 helper 与正式编译源码，不读历史 JSON/cache；6/6 通过，相关 ESLint 通过。抽离首轮遗漏内部 `reasons` 闭包，补齐后专测与 lint 复验通过，CSS 本身未因此改写。

首次按路径名闭包抓到 15 文件、218 项，其中 2 个工程测试只引用 mock CSS 路径，不是真实 CSS 消费者；完整失败日志保留于 `tests-first.log`，未扩修其 Git 夹具/工作树选择问题。13 个真实 CSS/生产者测试为 **136 通过、5 失败**；既有断言、预期与 skip 均未修改。

5 项失败来自 `card-face-presentation`、`css-dead-dom-budget`、`wf-feedback1021-c-return-map`；使用修改前测试原文和冻结游戏文本在内存复跑，**58 通过、同名同诊断 5 失败**，见 [旧失败对照](baseline-comparison.json)。实际运行 JS 导入仍为当前源码，该文本读取对照不冒充完整旧版本执行。

## 冻结与最终来源回执

本片已冻结，不再寻找候选或扩大范围。没有 build、新服务、提交或推送。父会话待测试夹具分片冻结后，可运行：

```powershell
node docs/evidence/2026-10-24-project-lean10/round2/dead-dom/audit.mjs --verify
```

该命令复核实际 CSS 并重新检查生产者，另写 `consumer-proof-final.json` 与 `validation.json`；执行时的原始来源证明和计划不覆盖。
