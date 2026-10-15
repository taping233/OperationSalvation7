# 奖励与节点流程修复

奖励线源码与定向测试已完成，等待主会话使用当前窗口内置浏览器验收。未提交、未构建、未启动服务；共享登记由主会话维护。

## 玩家行为

| 编号 | 本轮实际修改 |
| --- | --- |
| F01 | 祭坛选择传说卡与装备卡后，沿原池各抽一张并排除同奖励重复，固定为现有持久化领奖页；不再在旧二选一页发奖后仅改成 idle。逐张领取、整理、确认放弃与继续探索均使用同一奖励页生命周期，旧选择和旧领取回调不能重复发奖。 |
| F02 | 动力锤、空投卡牌、珍珠匣、两张火球、弹药柜及旧叙事卡牌奖励使用现有待领宝箱保存。节点选择已确定后，容量失败保留固定卡牌和已领取索引，读档继续领奖，不重新随机、不将拒收卡标为遗失。 |
| F06 | 三选一明确“其余卡牌永久放弃，无法找回”；领取后与确认离开的状态统一为“已永久放弃”，持久化该状态。没有新增留地拾取。 |
| F15 | 资源二选一逐张预检容量，放不下时原位显示整理按钮，特写页同口径；祭坛碎片兑换提前说明容量条件，失败原位显示碎片已保留，并提供背包整理入口。 |
| F16 | 火堆确认前显示口袋可复原张数、最多复原数、当前背包容量、全都放不下时的零张预告、消耗一次机会及额外职业卡容量风险，并可先整理。复原按真实 canReceiveCard 判定，允许同名未满叠放，不能放下的卡保留在口袋。 |
| F35 | 闸门确认前可返回当前层或整理背包；返回不会换层，旧进入回调失效。源码存在双向层间边且路径判定支持直接跨层邻接，故没有把“跨层后绝对不可回返”写成现行规则。 |
| F40 | 仅配送无人机增加互斥选项：1 碎片＋1 木材，或 1 碎片＋2 币。木材方案在任何发奖前检查容量，满包时保留节点、碎片和选择并原位说明；可以整理后重试或改选货币。两种成功方案均只结算一次并保存。 |
| F41 | 资源二选一成功后保留已入包/已放弃结果，点击继续探索才关页；宝箱未完成按钮改为返回地图，完成后显示继续探索；仍有后续宝箱时明确显示下一批及剩余批数。批量领取放不下的卡留在本页，整理后可重试。 |
| F42 | 已确认奖励演出原本支持点击和定时关闭。两处提示改成“点击收起 · 稍后自动收起”，未改演出队列或时序。 |
| B01 协作 | 首脑挑战前显示独立牌库、基础编牌数、初始攻击、起手抽牌、每回合抽牌及手牌上限，数值读取 MAP.rules；提供继续迎战、整理和返回。战内回看规则由战斗代理负责。 |

## 修改路径

- `game/src/run/game.run.altar.js`
- `game/src/run/game.run.flow.js`
- `game/src/run/game.run.scenes.js`
- `game/src/run/chests.js`
- `game/src/ui/cinematics.js`（R-UI-01 已由主会话批准）
- `tests/event-callback-lifecycle-audit.test.js`
- `tests/sys03-altar-restore-txn.test.js`

固定领奖使用原有 `chest-reward-save` 的 version 1、current.cards/taken/lost 和恢复入口，未改存档版本或校验契约。可选 title/source 仅用于展示，旧档没有这两个字段时沿用既有标题与来源回退；该补充由主会话明确批准。固定奖励直接展示在领奖页，逐张领取不另叠加获得演出。

## 验证

以下均退出码 0：

```text
npm run test:target -- tests/chest-click-flow.test.js tests/chest-multi-queue-regression.test.js tests/chest-callback-lifecycle-audit.test.js tests/event-callback-lifecycle-audit.test.js tests/event-scene-selection.test.js tests/node-reward-state.test.js tests/sys03-altar-restore-txn.test.js tests/contracts.test.js tests/architecture-boundaries.test.js
9 文件，110 例通过。

npm run test:target -- tests/node-retrigger.test.js tests/four-player-chest-reload.test.js tests/events-0919.test.js
3 文件，8 例通过。

npm run test:target -- tests/event-callback-lifecycle-audit.test.js tests/sys03-altar-restore-txn.test.js
最后文案调整后补验：2 文件，47 例通过（包含在前述 110 例中）。

node node_modules/eslint/bin/eslint.js game/src/run/game.run.altar.js game/src/run/game.run.flow.js game/src/run/game.run.scenes.js game/src/run/chests.js game/src/ui/cinematics.js tests/sys03-altar-restore-txn.test.js tests/event-callback-lifecycle-audit.test.js
通过。

git diff --check -- <本轮七个源码/测试文件>
通过。
```

首轮定向测试曾有一条旧火堆日志字面断言失败；将提示准确写为“背包已满或可用格不足”后通过。测试运行有既有 Vitest 废弃配置提示、jsdom 音频编解码警告，不影响退出码。

新增或修订回归覆盖：满包拒收保留固定奖励、祭坛候选刷新不重掷、领取索引刷新幂等、三选一永久放弃、批量失败可重试、资源结果页、火堆容量预告、闸门返回、无人机两分支及失败不发碎片、首脑说明、演出手动/自动关闭。

## 未核范围

主会话仍需当前窗口内置浏览器复核上述可见页面与真实输入，包括满包整理返回、祭坛完整献祭领奖、刷新续领、配送无人机两项选择及首脑过渡。没有本地全量、构建或实页通过结论；本代理未操作浏览器。没有新增老板决策项。
