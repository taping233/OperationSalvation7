# Codex / ZCode 双端效率对齐

2026-10-05，老板明确要求两端都修。只改两端规则/相关记忆、共用检索工具与项目流程文档；不改游戏或config，不提交。修改清单、文件哈希与实测结果见 [verification.json](verification.json)。

两端全局约定同步：按依赖边界合并独立查询与确定操作，逐项核对结果/退出码，失败即停；同轮有效证据复用，已知路径直接查，有经验缺口才查记忆。必要澄清和授权边界仍有效；ZCode原有当前分派偏好保留，没有从历史记忆新增授权。

ZCode不再硬编码项目hash作为唯一入口，先discover唯一匹配当前仓库。MEMORY索引的一律handoff/全节扫主题改为按条件查询，启动与澄清记忆补当前口径；TOPICS去掉重复交付战报，保留所有主题链接，原正文与旧迁移库保留。

```powershell
npm run --silent workflow -- memory --source codex --query "task.json" --limit 1 --json
npm run --silent workflow -- memory --source zcode --query "任务启动" --limit 1 --json
npm run --silent workflow -- memory --source both --query "workflow task" --limit 2 --json
```

默认source仍codex，无query仍只发现索引。ZCode只从唯一匹配项目MEMORY/TOPICS的命中钩子读取一层本库主题，拒绝路径越界/junction与旧库兜底；正文每篇≤64KiB、片段≤1600字符。both交替保留两端命中，合计受limit约束，并分别列来源状态/partial，不把一端有结果说成双端完整。

验证：7个定向测试文件、131项通过，含原CLI/流程契约、ZCode索引链、多库歧义、旧迁移库、缺失/截断主题、越界链接与junction。报告见 [workflow verify](2026-10-05T03-22-46.843Z-95bd1d70.json)。触及脚本/测试lint通过；[docs检查](docs-check.json)343链接0发现。两端共同约定文字核对通过；ZCode常驻索引2402B、TOPICS12249B，符合3KiB/12KiB预算。

验证范围是本地规则文件与共享工具在实际两端库上的检索，没有启动ZCode模型会话；已打开ZCode聊天的规则自动重载未核。未做两端模型端到端速度对照，不沿用此前Codex单端74%的字符减少比例作为ZCode成绩。HEAD/跟踪上游差异以verification.json记录为准；编辑占用收官释放，完成未提交。
