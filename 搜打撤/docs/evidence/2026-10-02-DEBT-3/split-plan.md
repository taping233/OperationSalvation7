# DEBT-3 battle.engine 拆分边界方案（2026-10-02 结构分析）

## 定性修正（重要）

battle.engine.js（1408 行）**不是 83 函数泥球**：它只有 1 个 export（`createBattleEngine` 工厂），31 个 import 全是 battle 域已拆好的协作模块（effects/runtime/bag/view/core 子工厂）。1408 行是**组装层的广度**，不是单点复杂度深度。code-map 按行数标巨型，结构上它已经是"组装者"形态。

## 拆分可行性（实测耦合数据）

- 工厂内 48 个 function 声明 + ~20 个 const 协作实例；
- `battleState.` 全文仅 6 处引用——**闭包共享状态极少**，共享物主要是模块实例（bag/equipment/selectionFlow/execPlayFlow/triggersM…）；
- 函数名天然成族：seal 族（checkSealTransformation/injectSealCards/sealCardById/tryUnlockSeal/isSealHeroSelected/replaceShaInDeck…）、infuse 族（beginInfuse/cancelInfuse/confirmInfuse/toggleInfusePick/resolveInfusedFuel）、curse 族（addCurse/addPlayerCurse/elCurse/frenzyCurse）、受击/伤害族（hitFoe/damagePlayer/playerTakeHit/aegisBlocked/applyKillRewards）、trigger/discover 族。

## 拆分方案（下一阶段实施）

1. 每族提为 `createXxxSubengine(ctx)` 模块（battle/core/engine/ 子目录），ctx=显式参数对象（传入所需协作实例与少量状态访问器）——与 DEBT-1 定性一致：新增状态走访问器/setter 口径，不引入原位变异新通道。
2. 顺序：先独立族（infuse/curse，语义自洽）→ 后交互族（hit/trigger）。每族迁移后跑定向（battle-engine-facade + battle-snapshot-integration + contracts）→ 全批后全量。
3. 机械搬家（函数体原样+import 修正）可派 Flash；ctx 切面设计、族边界裁定、快照契约核对由 Friday 主刀。
4. doneWhen 不变：engine ≤600 行或合理子模块化；`battle-engine-facade.test.js` 导出基线 65 逐项绿；快照重投影契约测试绿；全量绿。

## 风险与回退

- 最大风险：闭包变量提升为 ctx 参数时遗漏隐式引用（this/arguments 无；闭包捕获靠 lint+运行时测试兜底——facade 64 项导出基线+54 邻近测试）。
- 回退：逐族独立提交粒度，单族出问题 `git revert` 单笔即可（集成归 Friday，不混批）。
