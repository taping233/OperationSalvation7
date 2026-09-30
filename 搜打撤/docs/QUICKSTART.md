# QUICKSTART：5 分钟上手搜打撤开发

> 新会话/新开发者从这里开始。本页只指路，现行事实以源码、实时 Git 与台账为准；细节入口在各节末尾。

## 0. 一次性环境核验

- Node 22+，`npm install`（依赖锁定在 package-lock）。
- **提交门挂载**：`git config core.hooksPath` 应指向 `搜打撤/.githooks`；新克隆/新机器执行一次 `node scripts/setup-commit-gate.mjs`——不挂=提交没有门，红灯用例会直接进主干。
- 只开发 Vite 版；Godot/Unity/EXE 冻结。游戏验收只用当前平台内置浏览器（当前窗口）；主线 dev 端口 5200，产物 preview 8139。

## 1. 接手（1 分钟）

```sh
cd 搜打撤 && npm run handoff
```

一条命令看 HEAD、工作树、并行占用、待拍板。多会话在场（占用>1）时改共享文件先登记 `docs/PARALLEL-REGISTRY.md`；单会话占用时说明类小修免登记直改。

## 2. 定任务

- 单问直接答；小修直改并验相关范围。
- 玩法新规则 / 存档契约 / 跨域接口不明确：先用一页规格（[SPEC-PROCESS](SPEC-PROCESS.md)）。
- 确需老板拍板的进 [PENDING](PENDING.md)，不阻塞手头其他事。

## 3. 做改动 + 验证（秒级）

```sh
npm run test:target -- tests/<相关测试>.test.js   # 定向测试（秒级）
npm run check:staged:plan                          # 预演：提交门会选什么
```

- **混树提醒**：工作树有其他会话的未暂存改动时，`check:staged:plan` 会拒绝并列出来源（设计内保护）；此时用 `npm run check:staged:isolate -- --plan` 冻结 index 单独验证自己的暂存内容。

- 提交钩子按暂存路径**自动**选定向测试并打印理由；数据/剧情/fixture/纯删除走定向，包配置/公共状态边界回退全量。
- **全量以 CI 为准**；本地全量 `npm test`（并行约 1.5 分钟）只在阶段收尾且 CI 不可用时跑。全量红灯先查 PENDING 是否已知，不冒充全绿。
- 验收分级（纯文档 / A 档删除 / B 档语义各自怎么验）：[质量门](quality-gates.md)一张表。

## 4. 提交与收官

- `git commit` 触发门：过了就是 PASS，红灯看门打印的理由，按理由处理，不 `--no-verify` 绕过。
- 提交/推送/发布须老板**明确授权**；任务完成不自动提交。
- **打包提交默认**：老板授权提交后，受理会话负责打包落库工作树全部完成未提交改动（分组提交、代写缺失文档、台账销账）；仅排除 PENDING 待拍板的未跟踪目录与 `.sfx-work/` 类中间文件。
- 收官：handoff 复核 → 登记行销账（`workflow -- ledger registry close`）→ 证据入 `docs/evidence/<日期>-<任务>/`。

## 卡住了找谁

| 情况 | 入口 |
| --- | --- |
| 工具怎么用（task/ledger/verify/sweep） | [WORKFLOW-TOOLS](WORKFLOW-TOOLS.md) |
| 测试/验收口径、为什么红了 | [质量门](quality-gates.md)、[开发指南](development.md) |
| 改某块之前先看什么 | [文档导航·按改动找文档](README.md) |
| 并行会话冲突、资源占用 | [热点登记](PARALLEL-REGISTRY.md) |
| 停滞/中断任务盘点 | `npm run --silent workflow -- sweep` |
