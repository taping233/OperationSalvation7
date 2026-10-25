# 战斗修复收据

2026-10-23。已修 7 类问题，源码已冻结，未提交、未构建。

- 过滤抽牌复用普通抽牌分派，执行 onDraw 并保持跳过牌的库序：`battle/core/battle.draw.domain.js`。
- 复活清理旧形态偷攻、降攻与临时状态归还记录：`battle/core/battle.foe-lifecycle.domain.js`。
- 不同持续时间的偷攻分别归还，兼容旧快照的汇总金额和归还日期：`battle/effects/effect-steps.m2.domain.js`、`battle/core/battle.enemy-phase.domain.js`。
- 随机伤害/诅咒保留仍存活的蓄势目标，目标失效才重选：`battle/core/battle.resolution.domain.js`、`battle/effects/battle.status-operations.domain.js`。
- 铸甲经现有 generator 执行完整消费钩子后加甲，保留同步 API：`battle/effects/effect-steps.m2.domain.js`、`battle/core/battle.resolution.domain.js`。
- execute 只按实际死亡计击杀数，阻挡与复活不占击杀名额：`battle/effects/effect-steps.m2.domain.js`。
- 闪避优先消费最早到期来源，耗尽即移除来源记录，后续到期不重复扣除或损及永久层：`battle/core/combat.factory.js`。保留其他会话刚完成的精简，未编辑 `combat.js` / `battle.acquire-operation.domain.js`。

专门验证（单 worker，均退出 0）：

- 前 6 项：`tests/project-bugfix-battle-1023.test.js`，17 测试通过，2.76 秒。
- 后补闪避：`tests/project-bugfix-dodge-1023.test.js`，3 测试通过，324 毫秒；覆盖已消费来源到期、最早到期优先及永久层混合。

尚未由本子会话复核：修复后的既有集成回归、最终类型/静态检查和游戏实页，由父会话统一执行。本子会话未重复旧测试。此前审查目录中的错误状态复现脚本仅保留修复前证据，不作为修复后通过标准。
