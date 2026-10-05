# WF-process-trim-1004 流程瘦身证据

## 老板令与范围

老板令「现在的流程太长了，把没用的流程都删掉」。AskUserQuestion 四项全批：

1. **A+B+C 文档冗余全清**：历史记录归档、重复条款合并、命令模板压缩
2. **D7 任务仪式降级**：task.json/ship 跟踪链改为只在老板点名派工或跨会话长任务时用，日常小修零仪式
3. **D8 REGISTRY 台账瘦身**：历史行移入归档文件，只留活跃行
4. **quality-gates 深剪**：选择器大表只留分级结论，技术细节指向 acceptance-gate.mjs

不动的：提交门/验收分级/handoff 等防事故机制；QUICKSTART.md（本就 1.7KB 且锚点全部有效）；代码/脚本/测试逻辑（docs-consistency.test.js 锁定的示例骨架原样保留）。

## 改动清单

| 文件 | 前 | 后 | 内容 |
| --- | --- | --- | --- |
| 根 `AGENTS.md` | 4842B | 4499B | 「日常路径/流程登记」重复条款合并；授权红线句（提交/删除/登记/端口/冻结引擎/证据目录/浏览器边界）原文保留 |
| `docs/WORKFLOW-TOOLS.md` | 12265B | 7401B | 75 行 PowerShell 模板周边解释删除，保留测试锁定的 task start/close 示例行与混树命令链；D7 口径入「信息只维护一次」表与「仅需跨会话跟踪时」节 |
| `docs/quality-gates.md` | 13821B | 8586B | 删 09-23/09-28 历史验收段与已决红灯时间线；选择表 11 行→9 行（10-01 拍板的 package.json/lockfile 口径保留）；验收分级签名与 A 档三证据保留 |
| `docs/README.md` | 8662B | 7043B | 记忆入口 4 行表+平台适配段压成一段；「带时间的记录与证据」7 条→2 条 |
| `docs/PARALLEL-REGISTRY.md` | 88328B | 39868B | 「近期已释放」57 行历史+活跃表 8 行已落库终结行移入归档；三节结构与表头保留 |
| `docs/archive/PARALLEL-REGISTRY-2026-10-04.md` | 新建 | 50567B | 上述 65 行原字节归档，带头注；销账历史不删 |
| `docs/evidence/2026-10-04-WF-process-trim/` | 新建 | — | 本证据 |

以上均为 `wc -c` 实测（2026-10-04）。docs 流程四页合计 36416B → 24698B（预算 ≤36KB）；根 AGENTS.md 4842B → 4499B（预算 ≤6KB，每轮常驻注入减 343B）。

## 验证（2026-10-04，HEAD 425d03920e）

- `npm run docs:check -- --json`：ok:true，341 相对链接，findings=[]，reviewRequired:false
- `npx vitest run tests/docs-consistency.test.js tests/workflow-handoff.test.js tests/workflow-index.test.js`：3 文件 43/43 通过（含 WORKFLOW-TOOLS 示例骨架锁定断言、REGISTRY 解析断言）
- `npm run handoff` 复核：简报正常输出，维护审计「已落库待移行 8→1」，编辑占用正常显示本会话行

## 边界与未核项

- QUICKSTART.md 未改动（检查后锚点 `#定向反馈`/`#按授权收官`/`#两条操作路径` 均仍存在）
- handoff warnings 中 9 条 `overlapping-path｜docs` 为本会话登记行与其他会话在 docs 目录级共存的提示，文件级零冲突，销账后消失；其余 warnings 为他人行既有疑点未动
- 改动全部完成未提交，无提交授权；未跑全量（纯流程文档改动，定向+docs:check 已覆盖）；远端 CI 未核
