# 卡实例字段生命周期核对

2026-10-20。对 `game/src/**/*.js` 与 `game/data/**/*.json` 用 rg 盘点点号下划线属性及下划线对象键，再核对卡面字段的真实读写。原始 527 行匹配保存在 `instance-underscore-usage.txt`；该原始结果同时包含 UI、单位、事务对象及字符串匹配，并非527个卡字段。

本轮只将已证实属于卡面的字段放入 `cards/card-instance-fields.js`。处理发生在新拥有牌的制造与按卡库刷新；战斗内复制、发现、抽到施放和临时覆盖沿原流程，不调用本轮收牌工厂。

| 生命周期 | 字段/数据 | 当前依据 | 制造/刷新规则 |
| --- | --- | --- | --- |
| 长期内容定义 | 普通字段，包括 `rules/meta/mechanics` 及作者扩展 | `cards.js` 可编辑缓存；实际收牌此前对象浅拷贝 | 深拷贝全部JSON数据；刷新时现行同ID定义仍覆盖旧普通字段 |
| 长期兼容扩展 | 未登记的 `_...` 字段，包括历史自定义载荷、作者元数据 | 旧 `refreshCardClones` 保留所有下划线键；无法证明未知字段可丢弃 | 继续保留并深拷贝，不把未知字段当损坏数据删除 |
| 单局兼容数据 | `_pouch` | `battle.engine.factory.js` 载入/清空镜像；`battle.discover-flow.js` 读取锦囊内容 | 保留并深拷贝，不递归修剪其中的旧卡内容 |
| 单场费用展示基值 | `_baseCost` | `battle.card-cost.js:18`；`effect-steps.damage.js:196`；`battle.layers.js:299` | 新收牌/定义刷新不继承；战斗内费用覆盖流程未改 |
| 单场牌效标记 | `_noInfuse`、`_castOnDraw` | `battle.discover-flow.js:150,224` 制造临时牌；`battle.infusion.js:6`、`battle.draw.js:70` 消费 | 新收牌/定义刷新不继承；战斗内临时牌的原标记仍生效 |
| 单次执行/投影 | `_battleTransformMissing` | `battle.card-inspection.js:67` 生成缺失转换目标投影 | 新收牌/定义刷新清理 |
| 单次执行 | `_registeredTriggers`、`_triggerPoint`、`_soulEcho` | `battle.exec-play.js` 合成执行卡；`battle.triggers.m2.js:43`；`requested-card-runtime.js:25` | 新收牌/定义刷新清理，不携带合成执行上下文 |
| 展示 | `_preview` | `game.cardslib.designer.js:256`、`cards.view.js:122` | 新收牌/定义刷新清理 |

其他匹配属于不同对象。例如 `_sourceUid/_battleToken/_formationPoolKey` 位于DOM节点；`_condApplied` 位于装备包装对象；`_atkDownAmount/_stealRestore` 位于战斗单位；`_m01/_r2` 位于存档事务；UI的 `_last*` 位于显示缓存。这些字段未加入卡面清理表，也没有修改其属地。

费用子任务确认没有新增卡面字段：自然法杖的新到期记录仍放在既有 `zeroFeeUntil` Map。`cardOverrides` 的既有费用递减与本轮工厂合同相互独立。

库外自定义牌或已无模板的旧牌维持原刷新语义：找不到同ID模板时整张牌不改，连已知临时字段也不在这个分支清理。内容编辑卡库仍可变；没有冻结卡库、修改卡数据或迁移存档格式。
