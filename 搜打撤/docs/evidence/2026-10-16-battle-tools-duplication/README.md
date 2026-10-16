# 战斗工具栏重复：生命周期修复

结论：重复来自常驻玩家节点带回旧工具栏后，挂载函数再次选中旧栏，遗漏新 HUD 中的工具栏。已在共用挂载处修正模板所有权，不改 CSS、战斗规则或按钮绑定规则。

## 现场与根因

- 来源：[第三轮白塔第二层，第 2 回合现场](../2026-10-16-WF-cloud-play-eight-hours/screenshots/61-battle-tools-duplicated-after-choice.png)，截图 SHA256 为 `b3a51be70b8a9dc22a2b5d0adba168caf6c039da9b8465f0ecd9ae1756752d60`
- 实际操作：神灯选敌，抉择「冰冻 2 名角色，获得 5 点护甲」，返回战斗后出现两套搜刮与手牌分页，下一回合仍存在
- 父任务已核对实际 DOM：一套直属 `#btSelf`，另一套直属 `.sts-hud`；两者实际可见，不是辅助树缓存
- `showBattleStage` 在选择面板返回时全量重建舞台；`mountUnitLayer` 接回常驻 `selfUnit`，旧工具栏也随之接回
- 原 `body.querySelector('.sts-hand-tools')` 按文档顺序先选中 arena 内的旧栏，于是跳过搬移 HUD 中的新栏
- 后续局部 patch 同样先命中人物内的旧按钮；HUD 那套保留重建时的 disabled/结算中文案，造成持续重影

## 修正范围

生产代码只修改 `game/src/battle/view/battle.layers.js` 的一个挂载块：

1. 明确查询新模板的 `.sts-hud > .sts-hand-tools`
2. 若常驻玩家已有直属工具栏，用新模板工具栏替换它；否则首次追加
3. 普通局部 patch 没有 HUD 占位栏，继续保留当前人物内节点，沿用既有单次绑定守卫

新模板负责当前状态，旧工具栏脱离 DOM；不靠隐藏、删除按钮行为或放宽 disabled 规避问题。没有改 `battle.view.js`、`battle.hand-layout.js`、CSS、规则、资产路径或资源生成逻辑。

- [本轮纯源码差异](source-change.patch)
- [接手前已有 layers 差异](pre-existing-layers.patch)，仅作保护归属与重建基线，不计本轮实现
- [逐字保护验证](source-preservation.json)：仅反向替换本轮一个块，即与接手前全部字节一致
- [限定 handoff](handoff.txt)

## 验证

新增 `tests/battle-tools-lifecycle.test.js`，直接使用生产 renderer、layers、卡牌和战斗命令；在 jsdom 中构造隔离游戏，不读写真实存档。固定随机种子；资源就绪与 GPU 帧层使用替身，`startAim` 仅用 spy 统计手势入口，未声称验证真实拖拽。

10 项覆盖：

- 全量重建保留玩家节点，但替换旧 disabled 工具栏为新 ready 状态
- 墓地、背包、设置分别重复四次打开与返回，期间插入普通局部 patch
- 生产神灯选敌、第三项抉择、真实获得 5 甲、结束回合至下一回合
- 生产寻宝发现选卡返回，以及后续能量不足/恢复状态
- 取消选敌、取消注能、致命回合警告返回
- 多次重绘与返回后，每次 pointerdown 只有一次手势入口；分页每点一次只切一栏
- 生产搜刮仅扣一次费用，used 状态跨面板返回保留，下回合恢复 ready
- 分页在回合边界移除与重新出现，新战斗不继承旧玩家工具栏

最终结果：

| 检查 | 实际结果 | 证据 |
| --- | --- | --- |
| 最终同一测试文件 + 修前 layers，隔离副本 | 9 失败、1 通过；失败全部为重复栏/旧按钮仍连接的回归断言 | [修前最终夹具](pre-fix-final-fixture-test.log) |
| 新专测 + 7 个近邻/架构文件 | 8 文件、146 项全部通过；新专测 10 项包含在内 | [定向日志](targeted-tests.log) |
| 定向 ESLint：layers + 新测试 | 退出 0 | [lint](lint.log) |
| 语法 | 425 个工程文件通过 | [syntax](syntax.log) |
| 类型 | 8 配置全部通过 | [typecheck](typecheck.log) |
| 工程文档守卫 | 461 个链接通过；按工具边界不扫描 evidence，本文相对链接另行逐个核对 | [docs check](docs-check.log) |
| 本轮及已有相关源码 diff 格式 | `git diff --check` 退出 0 | 本任务最终命令结果 |

定向命令：

```sh
node node_modules/vitest/vitest.mjs run tests/battle-tools-lifecycle.test.js tests/battle-entry-view.test.js tests/battle-hand-inspector.test.js tests/battle-hand-layout.test.js tests/battle-decision-readability.test.js tests/battle-infusion-action-layout.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot
node node_modules/eslint/bin/eslint.js game/src/battle/view/battle.layers.js tests/battle-tools-lifecycle.test.js
npm run --silent check:syntax
npm run --silent typecheck
```

修前对照在 `/tmp` 自有隔离副本复制源码、数据、样式与最终测试，仅把 layers 替换为接手前原字节；复用依赖，无生产回滚、无服务、无 build。初版 `pre-fix-test.log` 含两个尚未校准的夹具断言，`post-fix-test.log` 是追加第十项前的中间检查，均不用于最终结论。

## 指纹与未核范围

layers SHA256：

- 修前：`9e7550ed5c4ed75d54f158430e1cf83fc652e5086c7309a5c6d1b48c78797ab0`
- 修后：`9196a64ce8f64e75620fffbcddf01c5fc1effaeda763551c1859841d09bfb475`

消费者审定由父任务负责；本子任务没有刷新任何资产消费者指纹。完整相关输入见 [修前](source-before.sha256)、[修后](source-after.sha256)。`battle.view.js` 与 `battle.hand-layout.js` 的前后指纹一致。

本子任务未操作浏览器、真实战斗状态、服务、构建、Git index、提交或推送。修后真实输入与视觉验收由父任务在重启后、下次自然发现/抉择返回时补验；这里的逻辑与合成事件断言不代替实机截图。全量测试与 build 未运行，不冒充已被先前 R4 验收覆盖。
