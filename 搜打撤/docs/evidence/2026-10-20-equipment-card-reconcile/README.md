# 开战装备与13卡组合验收

在完整云工作独立副本合入 candidate-v2（SHA256 92b18537455916398526c0d15f43baac993ee8bcdca38be83470b4689762e715）和四文件本地规则。没有改源工作树、本地 index 或其它本地内容，没有提交、推送或全量 CI。

## 已确认行为

- 自动/手动装备共容量；开战装备全部先退出手牌、抽牌堆、弃牌堆并消耗，再依次执行效果。超过容量者不装配、不消耗。
- 星盘 firstTurn 与装备计数并存；满槽的新装备拒绝时不扣能量、不移牌、不初始化星盘。增加容量后星盘以真正穿戴回合为起点。
- 手选、自动补牌、旧编组与重开都按合法开战装备容量处理。自动补牌跳过超额开战装备，继续选后面的合法牌；重开沿用合法最低编组数。
- controlBoss 仅表示不能被精神控制，保留独立于 boss 胜利字段的语义；推断首敌死亡而其它敌人存活不会提前获胜。

## 原5失败的定性

初次4文件132项：127过、5失败，完整复现。

1. hand-inspector 的 passive 免槽断言过期：改为旧 passive 标记也占槽，并检查拒绝无支付/移牌，保留动态扩容测试。
2. talisman settlement 只消耗灵符的断言过期：同时检查混沌之眼消耗/移出/战后入消耗区一次，未选同类仍保留。
3. boss-equip 的混沌之眼不消费断言过期：检查两UID均移出可用区、入墓地及结算一次。
4. skull infusion 原测试把开战剑当唯一合法燃料；新规则已消费剑，选材入口正确拒绝。增加独立合法燃料继续验证不朽斩禁用、详情、取消无损，另有原有不足燃料拒绝测试。
5. skull 覆盖顺序原测试重打已消耗剑。明确验证旧UID被拒绝，再真实获得第二把剑占剩余槽，原覆盖顺序断言仍保留。

新增测试还发现两处真实遗漏并先复现失败：自动编组超容量停在编组页、合法不足额编组重开停在编组页。修复 lifecycle 对这两条入口的规则应用；没有通过减弱原行为断言放行。

## 验证范围

最终11文件234项通过：battle-hand-inspector、battle-talisman-settlement、boss-equip-select、skull-sword-effective-session、battle-restart、requested-card-batch、requested-card-integration、requested-equipment-effects、stellar-divination、contracts、architecture-boundaries。

8份配置 typecheck 通过；本次涉及的10个JS文件 eslint 通过；docs:check 608链接、0 findings。测试中的既有 jsdom canvas 未实现警告保留，不等于实页通过。没有重跑全量 CI/build，没有本轮内置浏览器实页验证；原卡牌候选的全量记录仍保留其原边界，不提升为本次全量通过。
