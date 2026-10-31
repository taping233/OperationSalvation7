# 失败结算收尾与抢运一致

战斗中放弃完成后正式收尾，终局重试保持入口与原请求，抢运记录和报告沿实际卡牌清单。

状态：修改完成、编辑释放，保留未提交，由老板统一验收。

- `terminal.commands.js`只在锁内明确拒绝的基地单独版本变化、原对局身份/修订仍匹配时允许重新准备。`terminal-settlement.js`保留旧attempt用于先查成功回执，再沿原卡牌清单和对局重备；结果未确认及其他失败继续原attempt，呈现重试沿既有分支。
- 终局等待/失败/呈现重试页使用`data-terminal-settlement`。公共overlay隔离顶栏，系统菜单入口在`terminalPending`时保留当前结算页，避免覆盖后丢失重试。
- 正式`Battle.commands.endRun(game)`沿既有四文件转发链取消旧动作、交互和呈现，释放战斗状态。主动放弃在提交成功后调用，再捕获报告完成上下文，回基地按正常入口执行；正常胜负的统计、战后结算和奖励顺序保留。
- 战斗放弃按快照的played/consumed/discard排除已用UID，复原已清账的牌按现有保护规则处理，单独grave放逐语义保留。读取失败在原确认页恢复操作，不进入未核清单的结算。
- 新`run-rescue-cards.js`共用安全格及珍珠盒保护查询，死亡和主动放弃保留各自既有带入卡规则。主动放弃补齐安全格珍珠盒资源抢运；确认数量和实际提交同源。死亡记录改为实际`token.cards`，包含盒内资源的估值与入库数量一致。
- 放弃报告明确“当前仍随身的带入卡”数量、消耗区散失及合并卡面的实际×count，沿原卡牌布局呈现。

实施路径：`hub/terminal.commands.js`、`hub/run-rescue-cards.js`、`ui/terminal-settlement.js`、`ui/menu-leave.js`、`ui/overlay.js`、`run/game.session.death.js`；战斗`core/battle.lifecycle.domain.js`、`battle.engine.factory.domain.js`、`battle.engine.js`、`battle.core.js`。三名6.1-sol/high分片，主会话共用抢运查询、源码/相关差异回读与记录集成。

本批未运行测试、lint、构建、检查脚本或实页验收，无新服务、文件删除、暂存、提交或推送。统一验收关注：普通战斗放弃后回基地；终局保存失败及基地版本变化后重试；失败页菜单隔离；本场已用/已复原安全牌；安全格珍珠盒资源、同名多张报告和跑局记录。
