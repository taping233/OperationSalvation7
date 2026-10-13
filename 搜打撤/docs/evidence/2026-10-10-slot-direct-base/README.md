# 进入存档直达基地

老板要求删除进入存档时的抵达转场。`game/src/ui/game.menu.js` 的无未完成对局分支直接调用 `runtime.openBaseHub('deploy')`，不再创建或等待900ms转场。

- 定向验证：`npm run test:target -- tests/menu-recovery-entry.test.js tests/e4-async-entry.test.js tests/agent-command-results.test.js`，3文件51项通过；自有源码 `git diff --check` 通过。
- 实页：2026-10-10，Codex内置浏览器，http://127.0.0.1:5200/，当前窗口，真实输入点击进入城市、档位01进入存档，返回基地出发页；当前标签页error日志零条。
- 截图：[基地出发页](base-after.png)。截图证明落点；转场删除由源码差异核验。
- 复用现有5200服务，未创建服务、未build、未提交。继续对局分支由定向测试覆盖，本次未在实页恢复对局。
