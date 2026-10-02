# 2026-10-02 工具箱清理（PENDING #29 执行，老板令「弄完」）

## ① page-snapshot.mjs 合并删除（A 档删除三证据）

- **幸存正本**：功能 100% 在 `scripts/workflow-browser.mjs`（`importBrowserEvidence`/`writeBrowserComparison`），统一入口 `npm run workflow -- browser import/compare`；27 行壳为纯转发（删前 cat 全文核对）。
- **全库零残留**：rg 核验 scripts/tests/package.json 零引用；删后受影响测试全绿（scripts-contract 37 + cli-integration 5 + dependencies/scope/tools 26）。
- **删除获批**：PENDING #29 ① 10-01 挂账，10-02 老板令「弄完」执行。
- 同步六处：npm script 删除、acceptance-gate WORKFLOW_TESTS 映射行删除、workflow-dependencies 两处清单、quality-gates/WORKFLOW-TOOLS 口径改统一入口、iab-drive 注释、cli-integration 旧断言改为唯一入口断言（spawnSync 死引用一并清）。

## ② perf-ledger-capture.mjs 保留定性

967 行性能台账采集，evidence 有使用史（2026-09-30 批次）与复跑链路价值——不删。

## ③ 措辞项

旧「六连序」残留已随 10-01/10-02 两轮文档收敛清零。

## code-map 入库（同批）

老板拍板验收通过（免实机验收）：三件套 generate.mjs/index.html/data.js 入库；服务 5301 已随原会话结束，复跑 `node code-map/generate.mjs && 任意静态服 code-map/` 即可。
