# 战斗中已打出牌进入本场消耗牌堆

状态：按老板追加规则完成，未提交。普通战消耗牌堆的显示集合为played与consumed的UID去重并集；底层账本与恢复/洗回玩法保持原语义。

## 最小接线

- `battle.engine.factory.js` 在快照输入传递played，`battle.snapshot.js` 复制并冻结played；同步快照类型，兼容旧测试输入缺省空数组。
- `battle.piles.view.js` 的 `consumedPileUids` 统一供战场徽标及 `overlays.renderGrave` 读取。普通战列played+consumed，boss仍只列grave；不把boss的discard纳入不可洗回的消耗堆。
- `BattleSession.commands.openGrave` 已支持普通战；牌堆详情经UID读取effective卡面，无需修改此入口。
- keepInHand结算完成时原逻辑会从played移除并回手，因此不会误列为已消耗。
- 99库的本场临时初始攻击在granted中仍可查卡面；战后spentCards原过滤normal-sha- UID，不污染永久背包。
- 道具栏直接使用与出牌区分：永久道具继续立即移出ownedCards，不新增战后结算/复原资格；本场临时道具原本以played登记，现可经同一并集查看，不可重复使用。

未修改runtime.played/consumed/grave/discard的入账方式；未改变restoreConsumed、牌库回收、永久道具消费或战后规则。

## 验证

- `npx vitest run tests/sts2-consumed-pile.test.js tests/normal-starter-deck.test.js tests/battle-pile-readability.test.js tests/battle-snapshot.test.js tests/battle-snapshot-integration.test.js --reporter=dot`：5文件31项通过，约2.65秒。
- 专属7项：并集去重且不写源账本；真实普通打出进入可查看牌堆；支付源与材料均可见；keepInHand排除；boss discard/grave分离；99临时攻击可查看且战后不入永久背包；道具栏两种来源的既有语义保持。
- 目标ESLint通过：factory、snapshot、piles.view与专属测试。
- `npx tsc -p jsconfig.battle-snapshot.json --noEmit`通过。
- 相关源文件`git diff --check`通过。

未build、未启服、未提交。实页由root合并验证；本报告只记录定向测试与静态检查。

编辑前字节在本目录`.tmp/consumed-before-*.txt`，追加自有增量在`consumed-*.diff`；生产文件已释放冻结。
