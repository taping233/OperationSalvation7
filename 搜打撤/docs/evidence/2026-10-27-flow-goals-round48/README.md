# 战斗目标提示与手选装备取消

卡牌目标条件同时用于灰态和高亮，纯手选装备效果完成后提交本场次数。

状态：修改完成、编辑释放，保留未提交，由老板统一验收。

- `battle.layers.js`普通非材料态手牌直接读取现有`getCardPlayAvailability`的拒绝原因，`battle.view.js`当前行动提示同源；费用继续沿`effCostOf`。吞噬没有合法敌人、精神控制没有符合条件目标时，手牌状态与正式命令一致。
- `battle.layers.js`与`battle.aim.js`卡牌目标高亮在原存活/排除条件上复用同一可用性入口，合法与不合法敌人按当前条件区分；材料、注能、道具和技能各自路径保留。未增加快照字段或复制卡牌ID门槛。
- `battle.equipment.domain.js`对纯单条手选技能，在完成效果回调中核对原战斗、token和装备实例后提交`used`，取消可再发动。混合技能沿原消耗时点；准备选择时的日志按实际阶段显示。
- `battle.selection-flow.domain.js`的复制、零费分支补齐共用完成回调；`card-semantic-operations.js`、`battle.resolution.domain.js`和工厂适配器只传递可选回调上下文，类型同步。执行继续经过原解析器和沉默规则，未新增等待玩家选择的悬挂Promise。
- 道具片只读核对可用性、目标、预留释放和复原后清账，未发现本批可证明的新缺口，沿既有入口处理。

实施路径：三份战斗view；`battle.equipment.domain.js`、`battle.selection-flow.domain.js`、`battle.resolution.domain.js`、`card-semantic-operations.js`、`battle.engine.factory.domain.js`、`battle.core-ports.types.d.ts`。两名6.1-sol/high按视图/完成回调实施，另一片只读，主会话适配器与类型接线、源码/相关差异回读和记录集成。

本批未运行测试、lint、构建、检查脚本或实页验收，无新服务、文件删除、暂存、提交或推送。统一验收关注：吞噬/精神控制无合法目标与混合目标；手牌灰态、悬停和高亮一致；自然法杖/深红丝袋取消重选及成功后次数；连弩与混合主动原路径；原注能材料取消。
