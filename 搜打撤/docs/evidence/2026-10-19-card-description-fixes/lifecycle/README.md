# 生命周期修复交付

父会话已完成整批集中验证，结果和实页范围见 [统一验证记录](../verification.md)。下文保留代理交接时的实施与待验清单，“未运行”指交接时点。本批未build、提交或推送。

## 七张卡

| 卡 ID | 实现变化 |
| --- | --- |
| tt12-chargeray | 每次真实注能消耗时给当时仍在手牌的各 UID 累计一次。晚入手不继承全局历史；离手暂停，回手保留已有累计；不同副本隔离。注能钩后来新抽到的牌不追溯该次事件。 |
| cmtn1lbhbqi4 | 回合开始直接识别有效卡牌的本牌成长描述，不依赖首次打出登记。保留原有手牌/抽牌堆/弃牌堆/墓地扫描范围；同 UID 每回合只增长一次，读取描述中的实际数值。 |
| tt3-noon-duel | 延迟任务保存 foes 数组稳定位置 targetIndex；存活原目标继续承受延迟效果。原目标死亡/缺失以及旧任务没有该字段时，回退第一名存活敌人，与现有直接施放回退一致。结构化延迟执行走分段反馈与取消守卫。 |
| tt2-wreck | 到期消耗复用普通 onHandConsumed，触发随机获取 2 张。 |
| tt3-azure-sword | 到期普通消耗钩排队施放一次初始攻击。 |
| tt3-sapper-bomb | 到期普通消耗钩对可用目标造成固定 4。 |
| tt7-arcanescroll | 到期普通消耗钩抽 3 张；普通战沿既有规则获得初始攻击。 |

到期任务按 UID 去重并跳过已消耗实例；取消前和终局后停止处理。到期消耗不再误触发“被注能时”，真正作为注能燃料的 execPlay 路径继续保留被注能钩与正常消耗钩。

## 本代理改动文件

- `game/src/battle/core/battle.engine.js`：成长、延迟目标与回放、到期消耗、快照输入及跨组端口。
- `game/src/battle/core/battle.exec-play.js`：在燃料真正进入 consumed 后、燃料效果执行前记录在手注能事件。
- `game/src/battle/runtime/battle.runtime.effects.js`：handInfuseCounts、事件登记、恢复和跨战清零。
- `game/src/battle/runtime/battle.snapshot.js`：计数的冻结副本投影。
- `game/src/battle/battle.snapshot.types.d.ts`：快照计数字段类型。
- `tests/card-description-fix-lifecycle.test.js`：新生命周期回归。
- `tests/battle-runtime-state-guard.test.js`：新增状态白名单，总数 90 → 91。
- `tests/m2-contract.test.js`：旧全局计数契约改为按实例在手事件登记。

跨组配合：pools 代理在 `battle.resolution.js` 接入 getHandInfuseCount(uid)、getFoeIndex(target)，创建延迟任务时带 targetIndex，文本 registerTurnStart 传入第三参 target；并在 `effect-steps.ctx.js` 接入 getFrozenTargetBonus。以上文件由该代理独占编辑。

## 接口与存档边界

新增运行态 handInfuseCounts 是 UID → 次数的普通数据对象。restoreEffectRules 克隆恢复；旧状态无字段时初始化为空，不从全局 infuseFuels 推断；resetBattleEffectFlags 在新战/结束清空。BattleSnapshot 暴露冻结副本；计数变化进入快照签名，已取快照不会随后变化。

当前正式 serialize 仍只保存入场检查点，读档从本场开始重开，因此不会保存中途计数，也没有改变存档版本。旧格式中途战斗档兼容恢复可接受显式 handInfuseCounts；缺字段按 0 开始。延迟目标是序列化数字，不保存对象引用；旧任务保留首个活敌回退。

engine 同时完成其他组请求的接线：getAllies 用于全体友方随机祝福；天国之门直接打出的回合任务保留祝福候选并持续；getFrozenTargetBonus 用于文本伤害的寒冰剑被动；飞身劈按真实 ID 识别且仅攻击伤害额外叠加流血，不写持久增伤。

## 集中回归清单

1. 射线：全局历史不追溯、两副本不同在手窗口、离手再入手、实际燃料事件与钩中抽牌先后、旧状态兼容、新战清零、快照隔离。
2. 火球：首次打出前跨回合增长，重复牌区 UID 只计算一次。
3. 正午决战：第二目标存活时四枪保留目标；目标死亡时回退；JSON 延迟任务恢复保留目标。
4. 四张到期卡：真实临时卡入口与 consumeTemps，各 UID/重复任务只触发一次，注能总数不增加。
5. 到期守卫：已取消动作不消耗；终局后不处理后续 UID；到期不误触发被注能效果。
6. 邻近契约：m2-contract、运行态字段守卫、战斗快照相关用例；父会话统一更新旧审查断言。

## 真实未验证项

上述回归均为已准备、未运行。尚无本批通过数量、游戏实页结论、类型检查或构建结论。游戏表现仅能由父会话通过当前平台内置浏览器、当前窗口集中验收；本代理没有启动或替换浏览器、端口服务。
