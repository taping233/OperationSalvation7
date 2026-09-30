# 流程减负落地（WF-workflow-simplify）收官证据

- 时间：2026-10-01；基线 HEAD：`fd38468`（全程无新提交，本目录随收官提交入库）
- 任务来源：老板拍板四项（全流程审查后），批准「你先改」
- 占用：登记于 PARALLEL-REGISTRY，已收官销账；多会话在场（fix-perf、acceptance-scenes 编辑中，未碰其属地）

## 交付物

1. **验收门回退面收窄**：`scripts/acceptance-gate.mjs`
   - 数据/剧情进依赖图定向（数据 json 为叶子节点）；fixture/helpers 按测试内引用定向；lockfile 单独变化只跑架构哨兵；纯删除跑引用测试+哨兵（对齐 A 档）；脚本映射补 4 项（acceptance-gate/architecture-graph/generate-compendium/sync-cards-from-live）；定向上限 20→30；重命名/类型变化仍全量
   - 同步断言：`tests/acceptance-gate.test.js`
2. **口径改「全量以 CI 为准」**：`docs/quality-gates.md`（正源，「落库」不自动触发本地全量）；根 `AGENTS.md` 对应行同步
3. **单会话免仪式规则**：根 `AGENTS.md`、`docs/README.md`、`docs/PARALLEL-REGISTRY.md` 规则节（后与免登合并为一条）
4. **全量红灯挂账**：PENDING #22（boot.test 超时、hub-flow-regression、m7-battle，归属待拍板）

## 验证

- 定向 `test:target`：tests/acceptance-gate.test.js + tests/workflow-scope.test.js = 28/28 通过
- ESLint 改动两文件干净；`workflow docs` 文档守卫通过
- 真探针核预期：pets.json→5 测试、cards-sync.json→9 测试（含快照守卫）、narrative→compendium、lockfile→2 哨兵、删除文件→引用测试+哨兵

## 未做与边界

- tests/ 目录物理分层（unit/guards/audit/integration）：推迟，等 fix-perf/acceptance-scenes 收官后另批搬迁
- 全量 3 红灯未修复（PENDING #22 待拍板归属）；本轮未跑全量（新口径下不需要）
- 未提交内容：本轮全部改动待老板授权提交（本证据目录随演示提交先行入库）
