# 战斗/卡牌测试质量复核

本次依据父代理追加授权，只读检查冻结 snapshot/tests，未重跑测试、未改产品或既有测试。原 coverage.json / findings.json / report.md 保持不变。

**主要结论：已有测试确实包含生产 BattleSession 行为测试，并非全是 mock；但“全卡实打通过”和“规则双门通过”目前不足以证明卡牌效果正确。上轮五项重点缺陷主要漏在跨阶段接线、奖励落账、UID归属，以及测试自己注入了生产端本应产生的状态。**

## 覆盖范围

[逐文件记录与 AST 索引](test-review.json)：70 个文件，共 64 个执行测试文件、2 个类型 fixture、2 个 JSON 基线、2 个 helper。递归筛选 basename 包含 battle/card/effect/m-batch，排除 workflow 开头。没有扩到不匹配命名的 m2-contract 等测试，因此下述“缺少覆盖”是本分配范围和已复现漏洞下的判断，不能解释为全 tests 目录绝无相似测试。

审阅深度：

| 深度 | 文件数 | 含义 |
|---|---:|---|
| deep | 19 | 完整阅读测试 setup、动作、替身与 oracle；本轮没有运行 |
| systematic | 8 | 重点入口、替身、关联片段与全文件 AST 索引 |
| static-only | 43 | AST/fixture 结构层核对，未人工逐 case 深读 |
| not-reviewed | 0 | 所有文件均有至少静态记录 |

Acorn 扫描识别 403 个字面量 it/test 调用声明。这个数字不是 Vitest 实际用例数：没有展开 it.each、循环生成、模板字符串 case，也没有完成导入别名或跨函数数据流分析。vi.fn/spyOn 命中数量同样不能直接解释为“mock 了关键业务”。

## 五项重点漏洞为什么漏测

| 产品问题 | 关联现有测试 | 漏测原因 | 最小改进 |
|---|---|---|---|
| BC-03 武装凭空生成装备 | card-audit.test.js:85；battle-all-cards.test.js:82 | 文本审计 deckDraw 只记录参数并返回 n；全卡 smoke 的支付/离手也会改变指纹，没有真实 BOSS 库存不足断言 | canonical 武装走真实 BOSS commands；0/1/2 张装备及满手，新增 UID 必须来自原库，granted 不增加 |
| BC-04 挖宝甲取旧抽牌 | battle-selection-flow-boundary.test.js:210-236 | 测试直接 set discovering.priceArmor=true 并 stub sellPrice=5，跳过 structured 挖宝 producer，当然查不到缺失的旗/错误时点 | 从 canonical playCard 起，旧 lastDrawn 与底牌不同价格；选牌前后查甲、来源和队列 |
| BC-06 正午决战到期失败 | battle-resolution.test.js:276-301；全卡审计 | 旧 schedule “未接线”守卫卡自身缺 battle.target，宽泛 toThrow(TypeError) 因其他字段非法照样通过；全卡审计没有推进到期回合 | 先确认卡 schema/capability 合法，再 play→endTurn；当回合0、下回合8伤、第三回合不重复、delayed清空且后续抽牌正常 |
| BC-09 通行证消耗无奖 | battle-all-cards.test.js:193-203 | 道具只在“未消耗且零变化”时报错；消耗母本本身足以通过。drain不证明 discoverQueue 已完成 | 真正 usePotion/useItem，A/B必须获得正确奖励；C必须出合法面板；同时检查母本一次消耗、队列收敛与无拒绝日志 |
| BC-10 饮血剑漏多杀/非卡杀 | m7-battle.test.js:64-74 | 装备后直接 applyKillRewards(nonNullProbe,1)，不实际杀敌，恰好绕过 kills>1 与 null source 分支 | 真 AOE 双杀+2，再真砸击第三殺累计+3；保留存活敌避免终局遮住观测，再单独测最终一杀 |

完整改进点、准确单行来源、优先级与相关复现依据在 test-review.json 的 important_gaps。这些是测试改进建议，没有实施。

## 可以保留的强证据

- battle-lifecycle.test.js：真实 canonical 费用规则、play/flee/start，查跨战能量/护甲/费用重置。
- card-effect-semantics.test.js：真实注能选择与指令链，对具体敌 HP、玩家 HP 断言；三张卡范围明确。
- battle-snapshot-integration.test.js：生产目标交互与 source nested rules 变异，先证合法，再查 immutable snapshot 与缓存失效。
- structured-onplay-battle.test.js 的 setup：合成卡先 validateCardRules，走生产 commands，而不是直接假装 resolver 已获得正确输入。
- battle-snapshot-types / battle-settlement-types / e6-card-rules-types：确实运行 TypeScript API 对生产进口及负例做诊断，不能一概归作“读源码字符串即通过”。但类型检查仍不能验证奖励和时序。

m-batch-production.test.js 的真实启动、272 张库结构检查和幂等检查也有价值，适合防数据迁移损坏；它覆盖的是规则存在与结构，并不跑每张卡的完整效果生命周期。

## 容易产生误解的证据

1. **全卡 smoke 的 oracle 太宽。** battle-all-cards 的 observe 把 energy、hand、ownedCards.length 纳入指纹，因此仅支付/离手就足以让“零效果检查”通过。道具甚至直接以“已消耗”豁免无效果。建议保留这层不崩/不挂烟测，但对明确资源/状态/伤害卡增加面向需求的落账断言。
2. **无 vi.mock 不代表没替换逻辑。** battle-resolution 的 makeResolver 和 card-audit 的 FakeCombat 都用普通函数替代 hitFoe、draw、deckDraw、queueDiscover、价格等实际端口。它们适合检查解析/分派，但不证明生产消费者与 producer 连线正确。
3. **注入一个正确状态，只验证 consumer。** priceArmor=true、合法面板 state、kill count=1 等人工输入在单位测试里合理；应另有至少一个实际生产入口闭环，验证 producer 真能生成这个输入。
4. **toThrow 应核对原因。** schedule/时点扩展已接线后，旧“pending”测试仍能因为缺目标字段等无关 schema 错误通过。需要把“形状非法”和“合法但unsupported”分开，先证前者合法，再断言具体 issue path/原因。
5. **选择面板只自动选 0 项不证明选择语义。** 候选数、获得次数、真实 UID 保持、是否需要点选、回合推进等都是独立需求。BC-05/07 展示了把次数和候选数混淆仍可烟测通过。
6. **精确预览应与真实结算对照。** battle-preview-amount 只查 null/NaN兼容，动态段数与多操作风险需要独立实打锚；可以优先加入连续射击先出0/1/2张牌三态。

## 限制与移交

本轮未重跑已有测试，不报告新的 PASS 数字。上轮 repro.log 的缺陷断言仅用于解释漏测，不能原样当“修复回归通过”使用；修复时必须转成预期行为断言。

43 个文件只有 AST/fixture 层记录；它们的 import 或 mock 信号只是线索，未被证明每个 case 的 stub/断言都正确。图形、浏览器实际输入、整局终局、其他命名测试与 CI 环境不在本次30分钟测试质量复核的已验范围。

未新增产品缺陷、未改原发现列表、未改共享台账。父代理可把本报告与其他测试分片合并，按 TQ-01～05 优先补能杀死已确认缺陷的生产入口测试。

