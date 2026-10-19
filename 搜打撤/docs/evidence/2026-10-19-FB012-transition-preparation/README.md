# FB012：过场与独立准备并行

完成未提交，2026-10-19（UTC+8）。普通战斗、首脑战斗、撤退回营、职业选择后出发共用准备边界。650/1050/1600ms 过场原时长保留。没有实页耗时、FPS 或视觉改善结论。

## 时序与接口

原普通/首脑入口先等待 650ms 并隐藏过场，再执行 startBattle 的模块准备。现在模块准备与原过场同时开始，两个条件均满足且场景仍有效才进入 startBattle。慢模块等待期间保留原幕；成功由真实战斗首个 render 替换，避免 start 返回到下一帧之间提前隐藏。战斗图片/帧就绪门不变。

`prepareTransition(prepare, { signal, isCurrent })` 返回 settled outcome：成功 `{ok:true,value}`，失败 `{ok:false,error}`，取消 `{ok:false,cancelled:true}`。过期时不启动 prepare，取消及时结束本次等待，并处理已启动任务的迟到拒绝。共享模块导入本身无法物理取消；旧页不得继续开战。

`showRunTransition` 可选 `prepare` 回调，返回 promise 上提供 `preparation`、`isCurrent`、`release`。准备失败不等于资源就绪；入战继续由原 startBattle 重试和错误处理决定结果。失败结束后仅释放自己持有的幕；成功不抢先关闭真实战斗 render 接管的幕。换场由已有 surface lifetime 取消旧等待。

撤退 1050ms 和职业选择出发 1600ms 内仅并行调用 Renderer.warm，不提前结算、不新增准备等待；实际地图首帧保护仍由原入口承担。

## 真实消费者核对

- flow 的普通战斗回调直接返回 openBattleCell，后者明确 return startBattle。
- altar 的首脑回调明确 return startBattle。
- 全部生产 enterNode 调用已搜索，没有 combat 回调丢失 promise 的入口。
- 未改战斗规则、快照或职业选择数据规则。

## 集中验证

10 文件 155 项通过：transition-preparation、e4-async-entry、e4-battle-loader、nightshift-u10-settle-transition、battle-settlement-retry、four-player-event-regressions、transition-diagnostic-policy、battle-entry-readiness、contracts、architecture-boundaries。运行参数 `--maxWorkers=2 --reporter=dot`。定向 ESLint 与 git diff --check 通过。

覆盖：过期不启动、prepare throw/reject、取消及迟到失败、普通/首脑模块在 650ms 前开始、慢模块持幕、加载失败恢复 idle 并释放自有幕、替页不旧开战、撤退与出发预热且保留原时序。模拟时钟只证明等待关系，不代表设备实测延迟。

内置浏览器实页环境阻塞，未改用 headless/CDP；没有新服务、build、commit 或 push。

## 资源消费者审查

`scripts/runtime-asset-redundancy-review.mjs` retired-scenes 中 game.run.scenes.js 已审 SHA 为 `037c34da347c73f933fb216b2aa8da8942ed18b7e50f666f1986afa8b7bbebb1`，与当前 HEAD 文件 SHA 完全一致。此次 diff 仅调整准备/取消/持幕时序。

逐段对比 HEAD：scenePreload 至事件选中段、cityCut 资源 HTML 段、transitions 节点映射段均字节一致；资源/URL 字符串清单一致。资源选择、集合、降级均未改变。建议主会话独立收官更新为 `019d6c5b68cb39456b158e8b730f1a2c7495b2bfc3f6d6070a4301f222ecb701`，本批未修改守卫。

scripts 下全部 *review* 静态搜索中，game.bag.settle.js、game.run.class-choice.page.js、transition-preparation.js 无相关指纹条目。
