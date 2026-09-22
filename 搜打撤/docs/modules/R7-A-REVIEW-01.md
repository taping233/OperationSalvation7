# R7-a 首轮根接线审查：样本隔离需修订

实现中提前审查，尚未启动样本UI，未损害玩家档。

1. `battle.core.js/finish`先发送全局`battle:end`，正式主线有订阅者时不走fixture自己的`onBattleEnd`。仅传独立game对象不足以证明不会触发真实结算。
2. `battle.view.js`部分背包入口直接读取`SDT.game`。fixture状态与全局真局状态可能分离，样本不能借此读写真实玩家局。
3. 样本不改变主game.battleActive，原`canStart...`在一次启动后仍可能成立；异步双调用需独立loading/active门。
4. 首版`buildEncounterGroup`传`entries:[]`，但selector先拒绝无entry，样本永远无法打开。需复用实际group解析规则，而非以不满足前提的数据调用普通抽取器。
5. 首版checkpoint测试只断言序列化字段，没有实际restore；正式selector接线、护盾完全挡住不附状态、已有档案零写入测试仍必须完成。

修订方向已派Sol：优先独立`@fs`场景验收页，加载正式BattleSession/战斗视图与同一真实catalog，隔离main经济订阅者，不更改战斗bus协议来服务测试。若继续正式标题入口，须先证明完整bus/背包/重入隔离，根审放行前不能实际运行。场景样本与正式随机流程证据各记各的，不把样本声称普通出征整局。

真实状态时点：afterEnemies有共享回合钟；灼烧刚追加2回合，不代表进入下一玩家回合仍显示2。验收按真实时点断言，不为迎合猜测修改原AI。
