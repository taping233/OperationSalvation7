# 2026-10-22 候选增量验证记录（历史）

2026-10-24 从 `docs/quality-gates.md` 迁出。以下保留原记录，不刷新当时状态；当前交付须查对应版本的新证据。

### 2026-10-22 候选增量验证说明

本批仍是未验证候选，不表示已合并、部署或满足主线合并条件。仅包含以下修复与本节说明：

- `scripts/gate-plan.mjs` 为 `scripts/dependency-audit-diagnostics.mjs` 登记原生 Vitest bridge，配套更新 `tests/scripts-contract.test.js`、`tests/acceptance-gate.test.js` 并新增 `tests/dependency-audit-diagnostics.test.js`；不增加豁免、不跳过测试。定向验证为 5 文件、155 项通过，8 个 Node fixture 由一个 bridge 用例校验，不额外算作 8 项 Vitest。此前两轮失败保留，不计为通过。
- `game/src/ui/interface-motion.js` 仅在各同步读取组复用基地节点查询；hook 前后分别读取，不跨 hook 缓存，也未删除存档副作用。配套 `tests/interface-hub-query-reuse.test.js` 与 `tests/real-return-query.test.js`。基线和候选各 8 文件、63 项通过；真实 Rules/Settings 返回流程各重复两次，同步 JS 查询从 17 次降至 16 次，其中 `#hubMain` 从 3 次降至 2 次。此处仅是调用计数，不是 FPS、耗时或实机性能证明，浏览器实页验收仍待补。
- `package-lock.json` 仅将 `source-map-js` 的 version/resolved/integrity 三字段由 1.2.1 更新到 1.2.2，其余 619 个条目及 `package.json` 不变，针对 [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)。两版本普通 roundtrip、有效 gap、PostCSS 与 css-tree 用例通过，新版本的耗尽文本与小非法 offset 用例通过；但 indexed consumer → generator 在两版本均报相同 `sourceRoot undefined` 旧异常，各 Node 进程退出 1。矩阵收集器退出 0 仅表示收集结束，不能称全部通过或安全告警清零；前两轮失败也保留。仍待整包 CI、构建及依赖审计。

基底 `ccbe87426905ece8e6303e93104b8c3333eaa437` 的 [FULL CI 39762771536](https://github.com/taping233/OperationSalvation7/actions/runs/39762771536) 为 8528 passed、1 failed、6 skipped，唯一失败是上述新脚本未登记；同基底 [Vite 39762771525](https://github.com/taping233/OperationSalvation7/actions/runs/39762771525) 成功。本批 155 项定向通过不是新的 FULL 通过，也不将旧构建成功套用于本批；新候选需以其自身 Actions 结果为准。
