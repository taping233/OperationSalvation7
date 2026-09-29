# 并行派工手册（PARALLEL-DISPATCH-PLAYBOOK）

> 适用场景：老板点名使用子代理或多会话并行推进时。2026-09-26~09-29 多轮实战沉淀，细节见文末先例索引。

## 派工前

- **默认不用子代理，老板点名才用**；任务书给「验收标准 + 属地边界」，不规定步骤（老板原则 4）。
- 任务书四要素：**目标 / 验收标准**（做成什么样算完成、如何验证）**/ 属地边界**（只许改哪些文件）**/ 回报格式**。
- **并发上限 2**：平台额度 2 且常有并行会话占流；第三任务会被「并发弹射」（model concurrency limit exceeded），弹射不伤工作树。策略：等一个收工后补派（2+1 补派制），再弹就弹谁单独重跑。

## 工作树与环境

- 工作树惯例：`~/.codex/worktrees/<slug>/代号柒`，建于当前 HEAD；`搜打撤/desktop-app/*` 下是打包副本**不是工作树**。
- 工作树无 node_modules：junction 到主线（`cmd //c "mklink /J ..."`）或 `node 主线/node_modules/vitest/vitest.mjs --root <WT>/搜打撤`。
- 主线 node_modules 有 vite/vitest、**无 puppeteer**；`git worktree remove` 对中文目录报 `Invalid argument`，手动删 + `git worktree prune` 可解。
- 实机观察用**隔离副本**（HMR 整页刷新会杀实机会话）：`.exp-observe` 式纯副本 + 手动同步改文件；junction 跨根会让 Vite 解析失败；改副本内文件也触发重启，跑局前冻结编辑。

## 上下文打包（repomix）

- 给子代理喂大上下文用 repomix（已全局安装，`repomix --version` 验证）：
  `repomix --include "game/src/battle/**" --style xml --output <产物路径>`（battle 域约 850KB 实测）
- 产物给子代理当只读知识包，**不进 git**（写 .tmp 或系统临时目录）；属地纪律不变——
  子代理仍只改任务书属地内的文件，打包只是省它逐文件 rg 的探查成本。
- 全仓打包前先剔除 evidence/报告类目录（`--ignore`），避免把带日期记录喂进上下文。

## 协作纪律

- 跨域协作用**编号请求协议**（EXP/CODE/ART-xxx）：各线各记各文件、保存窗口预告、联合验证窗口（先例：`docs/zcode-dual-track-9h-20260927/` 三文件制）。
- **外部属地文件绝不混提**（先例：M 批期间 onetake 会话 10 文件绝不代提交）。
- 改共享文件 / 开长任务先登记 `docs/PARALLEL-REGISTRY.md`，收官销账；**对方半成品在场绝不 build**。
- 子代理产出必须**主会话实机/定向复核后才算验收**；评估代理只出清单，属地内自行修、跨域发编号请求。
- 收尾即落库；确需压树等指示的（如审计批次），在 REGISTRY 与记忆速览表标注压树状态。

## 实战先例索引

| 先例 | 记忆条目（~/.zcode/.../memory/） |
|---|---|
| 三子代理质量批（工作树+弹射实证） | soudache-parallel-quality-batch-2026-09-28、soudache-triple-parallel-quality-2026-09-28 |
| 三线 9h 协作（编号协议+隔离副本） | soudache-tripline-code-2026-09-28、soudache-exp-tri-track-2026-09-28 |
| 美术 UI 双线并行 | soudache-art-line-dual-track-20260927 |
| 大规模审计派工（5 组子代理） | soudache-battle-audit-fixes-2026-09-29 |
