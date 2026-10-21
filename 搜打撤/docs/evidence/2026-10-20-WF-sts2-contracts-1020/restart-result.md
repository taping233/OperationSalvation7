# 设置中的本场战斗重开

已在完整设置的“常规”页及战斗内齿轮设置加入“重新开始本场战斗”。入口仅在进行中的本场战斗存在有效 `restartVersion: 1` 检查点时显示，一次点击调用现有 `BattleSession.serialize()` / `restore(game, checkpoint)`，随后刷新战斗页面。

## 改动范围

- 新增 `game/src/ui/settings-battle-restart.js`：共用按钮、绑定与反馈。以注入的 Battle 服务、game、当前页面及可选 `isCurrentContext` 端口校验当前战斗；辅助模块无 import，避免经过 battle-loader 回到 battle.view 的循环。
- `game/src/ui/game.menu.pages.js`：常规设置插入按钮，传入现有 `captureBattleContext(game, getActiveSlot)` 校验。
- `game/src/battle/view/battle.view.js`：只在 `btSettings` 小段插入同一按钮及绑定，保留该文件其他会话的候选/预测/时序改动。
- 新增 `tests/sts2-battle-settings-restart.test.js`，9 项真实 BattleSession 定向集成测试。
- 未修改 core、战斗恢复实现、整局存档或整局重开入口。编辑前字节保存在 `.tmp/restart-before-*.txt`；自有增量为 `restart-game.menu.pages.js.diff` 与 `restart-battle.view.js.diff`。

## 已验证行为

真实普通战打牌及进入第二回合后，点击恢复开战血量、能量、敌方血量、手牌、牌堆、RNG、金币与道具；保留 run 身份，不调用战后回调、整局保存或清档。真实 Boss 战保持已确认编组，恢复后不再进入选牌编组。已挂起出牌队列在重开后作废，旧 readiness 继续完成也不会扣费或伤害新战斗。

无进行中战斗、缺少或无效检查点时隐藏按钮；旧设置页、不同场战斗拒绝恢复；同一页重复调用只恢复一次；restore 失败保留当前设置页并显示反馈。

成功后依赖现有 restore 与 refreshView 调度战斗视图，不调用 hideOverlay，以免隐藏随后创建的新战斗页面。此处复用既有检查点语义；不提供任意中途状态回滚。

## 验证结果（2026-10-20）

1. `npx vitest run tests/sts2-battle-settings-restart.test.js tests/settings-page.test.js tests/battle-restart.test.js --reporter=dot`：3 文件、23 项通过。
2. 消除 helper 循环依赖后执行 `npx eslint game/src/ui/settings-battle-restart.js game/src/ui/game.menu.pages.js game/src/battle/view/battle.view.js tests/sts2-battle-settings-restart.test.js`：通过。
3. 随后执行 `npx vitest run tests/sts2-battle-settings-restart.test.js tests/settings-page.test.js tests/battle-restart.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot`：5 文件、80 项，79 通过、1 失败（退出码 1）。按钮/恢复/设置与 contracts 均通过；唯一失败是 architecture-boundaries 的现行依赖校验，涉及他线新增的 `battle.card-play.js:2`、`battle.damage.js:2`、`battle.card-inspection.js:2` 对 `battle.default-context.js` 的依赖，已交主会话协调，未在本子任务修改。
4. `git diff --check -- game/src/ui/game.menu.pages.js game/src/battle/view/battle.view.js`：通过。

本子任务未 build、启服、提交或做实页操作。主会话负责当前窗口内置浏览器的最终实页验收。
