# 事件风险预告与装备说明样板

状态：代码和定向回归完成；当前窗口实页由主会话集中验收。未启动服务、未 build、未提交、未联网。

## 当前行为

- 隧道血契按真实生命显示扣除 5 点后的余额，生命 5/1 时明确显示“会致死”，生命 6 时显示剩余 1；塌方采掘点深挖按已核实的 3 点伤害显示同类预告。
- 装备征用令按当前金币显示差额或支付 3 币后的余额；领取补给木材按已有 capacityCard/canRun 显示可容纳或选择后整理背包。整理返回重新计算提示。
- 仅显式 healthCost/coinCost 和已有准入谓词参与预告，不从叙事文案猜代价。原选择、确认、支付、容量整理、奖励、死亡和存档规则保留；预告不禁用选项，不预扣资源。
- 装备名称/规则/主动技能说明改用现有 data-ui-tip 委托。可用技能按钮保留原动作；禁用技能以外层可聚焦说明入口保留阅读，被动装备支持键盘聚焦。

## 文件与边界

新增 `game/src/ui/event-option-state.js`、`game/css/event-option-state.css`、`game/src/ui/equipment-info.js`、`tests/event-option-state.test.js`。

修改 `game/src/run/game.run.events.js`：仅声明已核实的预告元数据和渲染端口；`game/src/run/game.run.flow.js`：从原有装配入口注入 UI 渲染器；`game/src/battle/view/battle.layers.js`：仅装备 HTML 改用共享说明样板。

扩充 `tests/event-node-binding-cloud.test.js`、`tests/event-signal-puzzle-integration.test.js`、`tests/term-tips-lifecycle.test.js` 的现有行为回归。以上已有文件原字节备份在 `../.tmp/sts-polish-1020/ui-before/`，保留任务前他人现状；补丁未改动他人已有实现。

## 验证

`npm run test:target -- tests/event-option-state.test.js tests/event-node-binding-cloud.test.js tests/term-tips-lifecycle.test.js tests/event-signal-puzzle-integration.test.js tests/contracts.test.js tests/architecture-boundaries.test.js tests/event-scene-selection.test.js tests/run-event-controller-ownership.test.js`

结果：8 文件、88 项全部通过。覆盖生命 6/5/1 的实际死亡/开箱行为、满包整理返回后的状态重算与奖励幂等、金币预告不扣款、装备聚焦不发动且原按钮点击仍有效、禁用装备不能发动、被动装备键盘阅读、选择确认、端口所有权及架构/契约守卫。

上述修改和新增 JS/测试目标 ESLint 通过。

首轮架构守卫发现领域工厂直接导入 UI 的方向错误，已沿原 flow 装配点注入，守卫原样保留并通过。

## 待实页核验与覆盖限制

主会话在当前平台内置浏览器、当前窗口核验风险文字/描边、满包整理返回、装备说明落点及与目标交互不冲突；自动测试不能证明实际字号、遮挡和对比度。

本批只覆盖明确数值的上述事件与已有容量元数据；随机后果、非致死 sacrificeLife 和未知自定义叙事不推断预告。未改战斗常驻信息布局。
