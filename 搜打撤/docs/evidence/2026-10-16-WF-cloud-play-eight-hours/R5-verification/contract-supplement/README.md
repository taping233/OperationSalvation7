# R5 旧测试接线与自测契约修复

原失败在相同工作区定向复现，修复后四文件 17 项全部通过，未出现 unhandled error。只修改三份测试的 mock 接口与 `game/selftest.js` 的必要断言，没有修改生产玩法或奖励逻辑，没有删测试、放宽既有行为断言或修改 skip。

## 变更

- `tests/map-travel-motion.test.js`、`tests/node-flow-confirmation.test.js`、`tests/r6-story-flow.repro.test.js`：为 `game.run.scenes.js` mock 补齐现有 `openFixedRewardsOnCell` 导出，使 flow 延迟装配领奖控制器时能使用完整依赖接口。保留原有全部行为断言。
- `game/selftest.js`：将依赖旧中文注释与固定空格的正则，替换为对现行 `hub/game.bag.settle.js` 的 AST 核对：领奖续流 `afterRewards` 必须为 async，末尾先设 `settlement.phase = 'saving'`，再 `return await settle()`。保留整理背包退役入口零调用断言。注释改写不再误报，断开保存、等待或结算仍报错。
- 原有 `GAME_PARTS` 加入 `ui/game.menu.pages.js` 的未提交修改已保留；不归入本次修复补丁。

基线 HEAD：`f0e84c5dc34afcbc1176b1519258d2c3010c62cb`。本任务没有 stage、commit、push；改动为完成未提交状态。

本次独立补丁：`repair.patch`，SHA256 `57ccd1b2031da1799fe937afcd16bd3c3434aa978cff123ea041f1f103e04c70`。文件级 before/after SHA256 与生产输入指纹见 `verification-summary.json`、`before-files.sha256`、`after-files.sha256`。

## 验证

1. 修复前同组四文件：4 文件失败，14 项失败、3 项通过，1 项 unhandled error，exit 1。见 `before-targeted.log`
2. 修复后同组四文件：4 文件通过，17 项通过，0 skipped，无 unhandled error，exit 0。见 `after-targeted.log`
3. contracts / architecture-boundaries 哨兵：2 文件、41 项通过，exit 0。见 `sentinels.log`
4. 四个改动文件 ESLint：exit 0，无输出。见 `lint.log`
5. 隔离 selftest 变异验证：6/6 符合预期。基线及仅改注释均 exit 0；保存阶段改错、删除 await、跳过 settle、重新引入整理页调用均 exit 1，证明新契约仍能检出代码倒退。见 `selftest-contract-mutations.json` 与各 `mutation-*.log`
6. 自有路径 `git diff --check` 通过。生产 `game.run.flow.js` / `game.bag.settle.js` 输入 SHA256 未变

定向命令（修复前后相同）：

```sh
node_modules/.bin/vitest run tests/map-travel-motion.test.js tests/node-flow-confirmation.test.js tests/r6-story-flow.repro.test.js tests/selftest-paths.test.js --reporter=verbose
node_modules/.bin/vitest run tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=verbose
node_modules/.bin/eslint tests/map-travel-motion.test.js tests/node-flow-confirmation.test.js tests/r6-story-flow.repro.test.js game/selftest.js
node docs/evidence/2026-10-16-r5-contract-repair/selftest-contract-mutations.mjs
```

变异脚本仅在独立临时目录复制并修改输入，未改工作区生产文件。原始 R5 日志 `/workspace/shared/cloud-iteration-verification-r5-20261016/logs/test.log` 保持原样，SHA256 校验见 `original-r5-test.sha256` 与 `input-integrity.log`。

本次是内部测试/自测契约修复，仅声明上述定向反馈。未以此替代 R5 整体复验、构建、实页或远端 CI；整体复验由主验收任务执行。
