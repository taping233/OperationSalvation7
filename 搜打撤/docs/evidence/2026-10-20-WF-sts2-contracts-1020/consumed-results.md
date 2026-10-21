# 统一消耗牌堆规则与挖宝专项验收

2026-10-20，子代理 sts2_settlement。未构建、未启服、未提交；共享台账由主会话维护。

## 本代理改动

- `game/src/battle/core/battle.resolution.js:336`：仅 `tt3-dig-treasure` 的实际底部候选数固定为 3，兼容保存了 acquire `n:1` 的旧实例；队列仍只排一次选择。库中不足三张按实际数，空库保持空，不改其他牌的 n。
- `game/src/battle/core/battle.resolution.js:656`：结构化 graveyard 增伤取消 Boss 门控，读取注入的统一消耗牌堆。`:806` 的旧卡文兼容墓地、弃牌堆、消耗牌堆三词，日志均使用消耗牌堆。
- `game/src/battle/effects/effect-verbs.js:106`：graveScale 同步识别三词。
- `game/src/battle/effects/battle.card-inspection.domain.js:103`：只有费用优先级实际执行 consumedSpellDiscount 的回调时，才读取 `state.getConsumedPile?.() || state.consumed`；按 UID 去重，并保留旧调用者和稀疏数组行为。费用优先级无修改。
- `tests/battle-card-inspection.test.js`：旧重复 UID 断言由重复计数改为每个实体一次；其余查找优先级和缺失 UID 测试保留。
- `tests/effect-verbs.test.js`：保留原始冻结快照，仅显式放行本轮 graveScale 三词兼容，其他条目仍按原冻结值验收。
- 新增 `tests/sts2-consumed-rules.test.js`，24 项。

初始源码与变更的旧测试均先保存原字节到 `consumed-baseline/`；初始三份源码 SHA256 在 `consumed-baseline.json`。inspection 由并行框架线转为 domain 薄壳后，按主会话释放的精确范围补回计数段，先额外保存了 `consumed-baseline/battle.card-inspection.domain.js.txt`。其余 domain 同步由框架线负责。

## 验证

23:25:31 执行：

```text
node node_modules/vitest/vitest.mjs run tests/sts2-consumed-rules.test.js tests/effect-verbs.test.js --reporter=dot
Test Files 2 passed (2)
Tests 32 passed (32)
```

本代理改动的 resolution、inspection.domain、effect-verbs 与三个测试文件 ESLint 退出 0；resolution、inspection.domain 与新测试语法检查退出 0。

专项使用真实 BattleSession 开战与提交出牌，普通战和 Boss 战均验证：

- 真实运行态四个旧源 played/consumed/discard/grave 的混合与历史重影 UID，只按一个实体计数；手牌、牌库、非匹配类型、当前结算源牌均排除。
- 结构化增伤和三种旧卡文均造成精确的 7+4 固定伤害；结算完成后源牌才可计入。
- 真实复原将原 UID 回到手牌并清旧重影，折费从 8-4 变为 8-3；空消耗堆不会复原正在结算的自身。
- 能量不足拒绝不修改六个牌区、能量、实例牌或 RNG。
- 查询 spy 验证普通费用及符文、临时费用、宇宙形态、武术/法术固定费用、上一类型免费、招式次数折费、零护甲免费等较高费用槽都不读取统一消耗堆；折费槽实际生效时仅查询一次。
- 挖宝从库底最多三张异价原牌中只选择一次，护甲按所选卡价格结算；未选牌保留原 UID 和原序，选中原 UID 入手且保留实例 override，granted 不增加；新定义和旧 n:1 实例一致。不足三张和空库均不随机补。
- 普通 99 库的 normal-sha 原 UID 经挖宝入手再打出，战后仍被 spentCards 过滤，不转成可进入战后消耗区的 bts 副本。

集成测试只为组合旧源状态而直接布置 live runtime 的六个牌区；实际费用计算、增伤、复原、出牌拒绝、发现选择与战后结束均走真实模块。测试不宣称涵盖全部历史入堆生产者或全部存档迁移。

## 协作边界与待补验证

统一投影/取回纯域由 local_compare 实现；factory 的懒查询、结算源 UID 排除，以及挖宝原 UID 移动端口由主会话实现。新定义 cards.sync/data 由框架线维护，本代理未编辑。

23:24:48 的旧 `battle-card-inspection.test.js` 在既定 node 环境收集失败：迁移后的 inspection/infusion 兼容壳导入 default context，再导入 battle.frames/ui-scale，后者顶层访问 window。已交给主会话与框架线修复纯模块边界；未把测试换成 jsdom，也未在旧测试伪造 window。此项应在其修复后补跑。
