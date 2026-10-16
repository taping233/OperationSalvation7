# R3 全量发现的菜单集成契约补修

仅修 `tests/agent-console-jump.test.js`、`tests/selftest-paths.test.js` 和 `game/selftest.js`。生产菜单、控制台、存档、预算、consumer 指纹均未修改。

R3 独立全量的 4 个红灯来自 2 个文件：控制台设置跳转仍按立即同步渲染消费，首项结束时异步跳转仍在途，影响后续控制台动作表；零依赖 selftest 的聚合源码清单没有随面板搬移纳入 `ui/game.menu.pages.js`，导致原 PLAYTIME/ACHIEVEMENTS 条件读不到实际实现。

## 最小修复

- 自测只给 GAME_PARTS 增加现行 `ui/game.menu.pages.js`；原“档位概览仅展示游玩时间与已解锁成就”条件和全部其他条件不变。selftest-paths 额外要求输出该条件确实通过
- 控制台继续使用真实 DOM click；spy 仅捕获原 devcGoto 的 Promise，明确等待真实 jump 和页面载入完成后，执行原 overlay、动作表、关闭钮和控制台被替换断言
- 未知页面明确等待原异步返回 false 后再检查控制台；每例主动取消未完成请求、关闭当前控制台并还原来源，避免在途工作跨用例泄漏
- 增加真实冷设置 Escape 集成测试：只在模块交付处设一个可控等待门，返回的仍是实际 pages 模块。先确认生产懒加载已请求且页面未挂载，再通过真实 KeyboardEvent 取消；释放迟到模块后设置页仍不能覆盖控制台，原 devcGoto/devcClose 必须保留
- 原四页签 Ctrl+L 来源恢复、重复按键和直接监听器存活断言均保留

## 实际验证

- 首轮两个红灯文件：2 文件 5 项全部通过（原 4 项和新增取消项）
- 最终回归：10 文件 152 项全部通过，见 `final-target.log`
- `node game/selftest.js`：exit 0，包含原档位概览检查通过，见 `selftest.log`
- `node --check game/selftest.js`、精确两测试 ESLint、项目语法检查均 exit 0，见 `lint.log`、`syntax.log`

最终回归还含菜单冷/热/取消、开发工具懒加载、完整启动链、基地与选角懒加载、页面仲裁、contracts 与 architecture-boundaries。没有 skip、削弱旧断言或放宽门禁。

本轮没有跑全量或 build。R3 失败原始记录仍在 `/workspace/shared/cloud-iteration-verification-r3-20261016/logs/test.log`。正常全量是否已通过，必须由父任务在补修后的独立输入再验；本定向结果不能替代。菜单体积收益沿用父任务独立 R3 正常构建结果，本补修没有更改该生产输入。
