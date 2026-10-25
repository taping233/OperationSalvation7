# Run / Agent 逐文件覆盖表

当前 77 个 JS 文件均作静态语法树及词法读引用检查；源码不执行。局部范围内的 import 引用附真实行号。未发现未消费的私有绑定，不代表各文件无逻辑 bug。

人工审查复用前两轮已取得的原文证据并补查；混合文件只覆盖其纯业务段，DOM、页面、动画均排除。保存/发现/战斗返修属地不修改。当前目录内没有 import 时，公开导出也不判死。

| 文件 | 覆盖及结论 | 局部直接消费引用 |
| --- | --- | --- |
| game/src/run/chest-opening-art.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/chests.js:17 |
| game/src/run/chest-reward-save.js | 人工纯逻辑审查；其余保留 | game/src/run/chests.js:15<br>game/src/run/game.run.flow.js:23 |
| game/src/run/chests.js | 仅声明/词法检查；混合页面/表现模块排除 | 局部无直接导入；导出契约保留 |
| game/src/run/encounter-meta.js | 人工纯逻辑审查；其余保留 | 局部无直接导入；导出契约保留 |
| game/src/run/encounter-selector.js | 人工纯逻辑审查；其余保留 | game/src/run/game.run.scenes.js:24 |
| game/src/run/event-card-choice.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.flow.js:21 |
| game/src/run/event-commands.js | 人工纯逻辑审查；其余保留 | game/src/run/event-card-choice.js:6<br>game/src/run/event-runtime.js:2<br>game/src/run/game.run.events.js:10 |
| game/src/run/event-lifecycle.js | 人工检查装配/私有引用；页面与生命周期实现保留 | game/src/run/game.run.events.js:11<br>game/src/run/game.run.flow.js:22 |
| game/src/run/event-recode-candidates.js | 人工纯逻辑审查；其余保留 | game/src/run/event-commands.js:1<br>game/src/run/game.run.events.js:8 |
| game/src/run/event-runtime.js | 人工检查装配/私有引用；页面与生命周期实现保留 | game/src/run/game.run.flow.js:368 |
| game/src/run/expedition-tool-art.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/expedition.view.js:2 |
| game/src/run/expedition.view.js | 仅声明/词法检查；混合页面/表现模块排除 | 局部无直接导入；导出契约保留 |
| game/src/run/extraction-preview.js | 人工纯逻辑审查；其余保留 | 局部无直接导入；导出契约保留 |
| game/src/run/game-session-departure.js | 词法检查；保存/结算返修属地保护，不修改 | game/src/run/game.session.js:3 |
| game/src/run/game-session-persistence.js | 词法检查；保存/结算返修属地保护，不修改 | game/src/run/game.session.js:1 |
| game/src/run/game-session-restoration.js | 词法检查；保存/结算返修属地保护，不修改 | game/src/run/game.session.js:2 |
| game/src/run/game.nest.js | 仅声明/词法检查；混合页面/表现模块排除 | 局部无直接导入；导出契约保留 |
| game/src/run/game.run.altar.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.dev.js:4<br>game/src/run/game.run.flow.js:19<br>game/src/run/game.run.js:4 |
| game/src/run/game.run.class-choice.js | 人工检查装配/私有引用；页面与生命周期实现保留 | game/src/run/game.run.altar.js:14 |
| game/src/run/game.run.class-choice.page.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.class-choice.js:12 |
| game/src/run/game.run.data.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.events.js:5<br>game/src/run/game.run.scenes.js:14 |
| game/src/run/game.run.dev-loader.js | 人工检查装配/私有引用；页面与生命周期实现保留 | game/src/run/game.run.js:6 |
| game/src/run/game.run.dev.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.dev-loader.js:14<br>game/src/agent/agent.scenes.runtime.js:20 |
| game/src/run/game.run.events.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/event-runtime.js:1 |
| game/src/run/game.run.flow.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.dev.js:5<br>game/src/run/game.run.js:5<br>game/src/agent/agent.action-router.js:6 |
| game/src/run/game.run.js | 人工纯逻辑审查；本轮等价精简 | 局部无直接导入；导出契约保留 |
| game/src/run/game.run.resources.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.flow.js:24 |
| game/src/run/game.run.scenes.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.altar.js:32<br>game/src/run/game.run.class-choice.page.js:11<br>game/src/run/game.run.dev.js:3<br>game/src/run/game.run.flow.js:18<br>其余见 scope-scan.json |
| game/src/run/game.run.shop.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.scenes.js:18 |
| game/src/run/game.session.bag.js | 人工纯逻辑审查；其余保留 | game/src/run/game.session.js:40<br>game/src/run/game.session.js:177 |
| game/src/run/game.session.board.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.session.js:43<br>game/src/run/game.session.js:179 |
| game/src/run/game.session.browser.js | 仅声明/词法检查；混合页面/表现模块排除 | 局部无直接导入；导出契约保留 |
| game/src/run/game.session.death.js | 词法检查；保存/结算返修属地保护，不修改 | game/src/run/game.session.js:44 |
| game/src/run/game.session.js | 词法检查；保存/结算返修属地保护，不修改 | game/src/run/game.nest.js:16<br>game/src/run/game.run.altar.js:24<br>game/src/run/game.run.class-choice.js:2<br>game/src/run/game.run.class-choice.page.js:4<br>其余见 scope-scan.json |
| game/src/run/game.session.kernel.js | 人工纯逻辑审查；其余保留 | game/src/run/game.session.bag.js:7<br>game/src/run/game.session.board.js:4<br>game/src/run/game.session.js:38<br>game/src/run/game.session.js:175<br>其余见 scope-scan.json |
| game/src/run/game.session.map.js | 人工派生数据检查；几何表现保留 | game/src/run/game.session.js:42<br>game/src/run/game.session.js:178 |
| game/src/run/game.session.modes.js | 人工纯逻辑审查；其余保留 | game/src/run/game.session.bag.js:8<br>game/src/run/game.session.js:39<br>game/src/run/game.session.js:176 |
| game/src/run/lab.ending.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.nest.js:24 |
| game/src/run/layeredMap.js | 人工纯逻辑审查；其余保留 | game/src/run/game.session.map.js:7<br>game/src/run/map-snapshot.js:7 |
| game/src/run/map-generation-rules.js | 人工纯逻辑审查；其余保留 | game/src/run/game.session.map.js:9<br>game/src/run/map-generator-v4.js:6<br>game/src/run/map-route-v2.js:4<br>game/src/run/map-snapshot.js:9 |
| game/src/run/map-generator-v4.js | 人工纯逻辑审查；其余保留 | game/src/run/layeredMap.js:3 |
| game/src/run/map-generator.js | 定义/调用检查；冻结 3/9，未改算法 | game/src/run/game.session.js:36<br>game/src/run/game.session.map.js:8<br>game/src/run/layeredMap.js:2<br>game/src/run/map-generation-rules.js:2<br>其余见 scope-scan.json |
| game/src/run/map-graph.js | 人工纯逻辑审查；其余保留 | game/src/run/game.session.map.js:6 |
| game/src/run/map-route-v2.js | 人工纯逻辑审查；其余保留 | game/src/run/game.session.map.js:11<br>game/src/run/map-snapshot.js:8<br>game/src/run/route-choice-preview.js:2 |
| game/src/run/map-snapshot.js | 人工纯逻辑审查；其余保留 | game/src/run/game.session.js:37 |
| game/src/run/map-travel-motion.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.flow.js:16 |
| game/src/run/map-travel-path.js | 人工纯逻辑审查；其余保留 | game/src/run/expedition.view.js:9<br>game/src/run/expedition.view.js:10<br>game/src/run/game.run.flow.js:15<br>game/src/run/map-travel-motion.js:1 |
| game/src/run/node-restore-state.js | 人工纯逻辑审查；其余保留 | game/src/run/game.run.altar.js:20<br>game/src/run/game.run.scenes.js:23<br>game/src/run/node-reward-state.js:1 |
| game/src/run/node-reward-state.js | 人工纯逻辑审查；其余保留 | game/src/run/event-card-choice.js:2<br>game/src/run/event-lifecycle.js:2<br>game/src/run/game.run.altar.js:19<br>game/src/run/game.run.class-choice.page.js:6<br>其余见 scope-scan.json |
| game/src/run/route-choice-preview.js | 人工纯逻辑审查；其余保留 | game/src/run/expedition.view.js:4 |
| game/src/run/shop-browse-state.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.shop.js:12 |
| game/src/run/shop-commands.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.shop.js:15<br>game/src/run/shop-commission.js:5<br>game/src/run/shop-commission.js:6 |
| game/src/run/shop-commission.js | 人工检查装配/私有引用；页面与生命周期实现保留 | game/src/run/game.run.shop.js:13 |
| game/src/agent/agent.action-router.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.runner.js:2<br>game/src/agent/agent.runner.runtime.js:7 |
| game/src/agent/agent.battle-stats.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.recorder.js:23 |
| game/src/agent/agent.console.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.dev.js:7 |
| game/src/agent/agent.data.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/run/game.run.dev.js:8<br>game/src/run/game.session.js:32<br>game/src/agent/agent.js:24 |
| game/src/agent/agent.js | 人工纯逻辑审查；其余保留 | 局部无直接导入；导出契约保留 |
| game/src/agent/agent.llm-parser.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.llm.js:11<br>game/src/agent/agent.llm.runtime.js:3 |
| game/src/agent/agent.llm.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.js:20 |
| game/src/agent/agent.llm.runtime.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.llm.js:57 |
| game/src/agent/agent.policy.js | 人工纯逻辑审查；本轮等价精简 | game/src/agent/agent.js:19<br>game/src/agent/agent.llm.js:12<br>game/src/agent/agent.scenes.runtime.js:17 |
| game/src/agent/agent.protocol.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.action-router.js:2<br>game/src/agent/agent.js:17<br>game/src/agent/agent.llm.runtime.js:2<br>game/src/agent/agent.replay.runtime.js:6<br>其余见 scope-scan.json |
| game/src/agent/agent.recorder.js | 人工纯逻辑审查；其余保留 | game/src/run/game.session.js:33<br>game/src/agent/agent.data.js:9<br>game/src/agent/agent.js:21<br>game/src/agent/agent.runner.js:4<br>其余见 scope-scan.json |
| game/src/agent/agent.replay-state.js | 人工纯逻辑审查；本轮等价精简 | game/src/agent/agent.replay.runtime.js:7 |
| game/src/agent/agent.replay.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.js:25 |
| game/src/agent/agent.replay.runtime.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.replay.js:5 |
| game/src/agent/agent.run-control.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.runner.js:5<br>game/src/agent/agent.runner.runtime.js:8 |
| game/src/agent/agent.runner.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.js:16<br>game/src/agent/agent.replay.runtime.js:5<br>game/src/agent/agent.scenes.runtime.js:16 |
| game/src/agent/agent.runner.runtime.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.runner.js:14 |
| game/src/agent/agent.scenes.catalog.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.scenes.js:15<br>game/src/agent/agent.scenes.runtime.js:22 |
| game/src/agent/agent.scenes.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.js:23 |
| game/src/agent/agent.scenes.runtime.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.scenes.js:24 |
| game/src/agent/agent.state.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.action-router.js:5<br>game/src/agent/agent.js:15<br>game/src/agent/agent.replay-state.js:7<br>game/src/agent/agent.runner.js:3<br>其余见 scope-scan.json |
| game/src/agent/agent.stats.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.data.js:10<br>game/src/agent/agent.js:22 |
| game/src/agent/agent.surface.js | 仅声明/词法检查；混合页面/表现模块排除 | game/src/agent/agent.action-router.js:3<br>game/src/agent/agent.runner.runtime.js:2<br>game/src/agent/agent.state.js:13 |
| game/src/agent/agent.weights.js | 人工纯逻辑审查；其余保留 | game/src/agent/agent.policy.js:10 |
