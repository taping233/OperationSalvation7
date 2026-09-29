# 并行会话热点登记（PARALLEL-REGISTRY）

> **规则（09-29 起）**：
> 1. 会话要改**共享文件**（AGENTS.md / docs 公共文档 / MEMORY.md / 其他会话热点）或开**长任务**（工作树 / 端口服务 / 后台进程）前，先在「活跃登记」加一行；收官/释放后把行移入「近期已释放」。
> 2. 发现**无主改动/文件**（归属不明的 M 文件、陌生未跟踪产物）登记到「无主物品」，**只记录勿动**，等认领或老板处置；认领者把行移入活跃登记。
> 3. 本文件是占用登记的唯一真源；MEMORY 速览表只放指针不复制内容。

## 活跃登记


| 会话/来源 | 属地（文件/端口/工作树） | 事项 | 登记时间 | 状态 |
|---|---|---|---|---|
| Friday（照相馆性能专项会话） | game/css/expedition-library.css、game/src/hub/game.cardslib.page.js、docs/PHOTOLIB-PERF-TASK-2026-09-29.md、docs/evidence/photolib-perf-task-2026-09-29/、worktree .photolib-acc（2bcfc23+上述两文件）、端口 8137（隔离验收服）、8138（工作树源码服，已污染勿用） | 照相馆性能专项二期：壳常驻+IO 窗口化重构，等老板 8137 验收 | 09-29 晚 | 在途 |


## 无主物品（只记录勿动，等认领/处置）

| 物品 | 现象 | 发现时间 | 备注 |
|---|---|---|---|
| `搜打撤/package-lock.json` | 已修改未提交（M），改动者不明 | 09-29 深夜 | 疑似某会话依赖变更在途；认领前不还原不提交 |

## 近期已释放（保留最近 10 条，更早删除）

| 会话/来源 | 属地 | 事项 | 时段 |
|---|---|---|---|
| Friday（记忆v2会话） | 根 AGENTS.md、docs/README.md、本文件、docs/PENDING.md、docs/PARALLEL-DISPATCH-PLAYBOOK.md、docs/STATUS.md、记忆 MEMORY/ARCHIVE | 工作流标准化七项+落库双提交（0bac1f3+643434f） | 09-29 深夜，已完成 |
| Friday（同上） | game/src 6 文件+tests/run-architecture+knip.json、docs/STATUS+PENDING | knip A 类死代码清理双提交（20c4e25+041fd65） | 09-29 深夜，已完成 |
| Friday（同上） | ui/terminal-settlement.js 新建、death/menu/battle.resolution、evidence/jscpd-2026-09-29/、STATUS+PENDING #12 | jscpd 档一收敛双提交（506ccea+落档） | 09-29 深夜，已完成 |
| Friday（同上） | SPEC-PROCESS/UI-TOKEN-SYSTEM-PROPOSAL 新建、README 路由、派工手册 repomix 节 | GitHub 调研三项落地（5b3aef7） | 09-29 深夜，已完成 |
