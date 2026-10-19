# FB037：自身有效规则状态公共投影

玩家反馈自身buff要显示。原自身名牌仅枚举Combat.BUFFS/CURSES，实际已生效但存于runtime或额外status键的规则没有常驻反馈。

## 已核边界与实现

新增 runtime/battle.player-effects.js 的纯函数 projectPlayerEffects：输入明确已生效数值，输出key/name/icon/duration/description，不读取卡描述、候选牌或修改状态。engine capture采集来源，snapshot冻结数组与元素并纳入既有全输入signature，layers复用自身bt-buff与图标/词条tooltip；同一来源组合只显示一个条目，失效时常驻层差分清除。

- 诅咒免疫：engine.addPlayerCurse消费playerCurseImmune或holyRune；首个delayed.curseImmuneOff的restore为假时，下回合开始结束（与执行器同样布尔转换，含旧任务缺字段）；restore为真代表本场来源。圣洁符文前3回合按当前turn显示剩余回合，合并来源保留最长已知有效范围。伤害免疫继续由既有BUFF_META单独显示。
- 法术/武术1费：card-cost实际分支，本场有效；两种同时存在显示招式1费；说明更高优先级单牌0费和无限符文仍适用。
- 下一张法术：exec-play读取nextSpellTwice>0额外施放1次并清零，不把内部数值误当重放次数。
- 全招式已注能：hasInfusionWaiver接受allSpellsInfused，仅武术/法术，本场有效，仍付正常费用。
- 发现候选+N：engine.queueDiscover读取status.discoverPlus，本场有效，不增加可选张数。
- 流血加成翻倍：engine.hitFoe读取status.bleedAmp，增加一份流血附加伤害，并非总伤害翻倍，本场有效。
- 致命伤害抵挡：engine两处实际致命判定扣deathSave，触发后获得本回合伤害免疫，剩余次数至本场结束。
- 额外回合：enemy-phase.resolveExtraTurn读取并清extraTurn，跳过敌方行动。

未将装备/符文所有内部flag一概展示；单牌zeroFeeUntil保留手牌实际费用，未扩大为自身全体buff。无核心规则/CSS/资源修改。

## 验证范围

首轮tests.txt：5文件117项；真实模块链验证快照缓存失效、只读副本、常驻chips激活/清空、来源合并、待选牌不产生状态、tooltip属性和延迟队列不修改。lifecycle-tests.txt补原免疫生命周期、架构/类型边界及旧restore兼容；最终统计见登记。

所有交互证据为真实模块/jsdom测试，不是实玩。内置浏览器仍阻塞，无headless/CDP/外部浏览器替代。未全量测试、build、开服务、提交或推送。

最终验证：首组5文件117项＋第二组5文件142项，hand-inspector97项重复，去重9文件162项通过；8套typecheck、定向ESLint、4份生产JS语法、diff检查通过。

资源差分已人工审阅：layers仅新增状态span固定5种icon键，无新增URL/assetUrl路径。shield/sparkles/question/blood/hourglass均在图标catalog、asset-manifest及实际PNG。layers SHA256：1f438814d23f7f60a555f6369bf013cb12366c5763b5636696c4c6f790491127；opaque指纹由父维护。沿既有flex-wrap，8项拥挤与遮挡须待实页验证。
