# review-U12-0315 —— 复审者 R7：U12 修复独立复审（只读）

- 时间：2026-09-29 03:15 前后（夜班三代理编制·第三方复审，时间盒 25 分钟）。
- 复审对象：工作树未提交改动，基线 HEAD `633a9d1`；对照单据 fix-U12-0300.md 与 find-F-0230.md。
- 方法：git diff 逐行读、rg 独立枚举消费面、亲跑 vitest（21 文件 151 用例），未采信修复单任何未验证断言。

---

## 1. diff 范围 —— 结论：合规，无夹带

U12 实际触碰 6 文件，与修复单「改动面」逐行数一致（`git diff --stat` 原文）：

```
game/src/battle/core/battle.enemy-intent.js |   5 +
game/src/battle/view/battle.layers.js       |   9 +-
game/src/run/map-generator.js               |  25 ++++-
tests/battle-pure-rules.test.js             |  10 ++
tests/layered-map-generator.test.js         |  20 ++++
tests/m2-contract.test.js                   |  24 +++++
```

工作树另有 css/package/docs 等 8 处改动，经 `docs/PARALLEL-REGISTRY.md` 原文核对均有归属、非本班夹带：winter.css+page-rewards-bag-help.css=CSS 精修班（registry 14 行「压树待落库」）、package.json+根 AGENTS.md+STATUS.md=验收分级班（29 行）、package-lock.json=无主在案（22 行「改动者不明，认领前不还原不提交」）、docs 三件=各会话台账。禁碰五项（winter.css/page-rewards-bag-help.css/package.json/package-lock.json/cards-sync.json）中前三者改动均早于本班存在，U12 diff 未含其一。

**更正一处任务书笔误**：任务书写「game/src/core/mapData.js：generateLayeredMap 兜底」，实际该函数定义于 `game/src/run/map-generator.js`；`game/src/core/mapData.js` 零改动，其头部注释原文「地图几何（每层结点、门与入口）由 map-generator.js 按种子生成」证实二文件分工。改动落点正确。

## 2. U12-a 位置与优先级 —— 结论：与行动侧判定链严格同序，语义自洽

分支插入点：`evenAttack` 分支（battle.enemy-intent.js:14-16）之后、bleed/atk 默认攻击之前（diff 原文第 17-21 行）。行动侧判定链（battle.enemy-phase.js 原文）：

```
160  if (foe.stunned) { …蓄力完毕，下回合行动… }
165  if (foe.evenAttack && turn % 2 === 1) { …蓄力（偶数回合才会攻击）… }
169  if (foe.noFirstAttack && turn === 1) { …第一回合蓄力，不会攻击… }
174  if (!Combat.canAct(foe)) { …被冰冻，无法行动！… }
```

意图侧 evenAttack `(round||1)%2===1` → noFirstAttack `(round||1)===1`，与行动侧 165→169 同序同条件；stunned/冰冻不属意图侧本单范围（见第 4 条与残留）。

双旗标组合（evenAttack+noFirstAttack 且 round=1）：rg 全 game/src，两旗标仅存在于 game.nest.js 三处定义——dragon:58 `noFirstAttack: true`、evilDragon:60 `evenAttack: true`、ancient-dragon:67 `noFirstAttack: true`，均单旗标，组合在当前数据下不可达；假想可达，两侧亦自洽：round=1 时行动侧先命中 165（蓄力不攻击）、意图侧先命中 14（「蓄力·下回合行动」），均归蓄力语义，无「显示攻击、实际蓄力」矛盾。

## 3. U12-b 消费面完备性 —— 结论：三点全部成立

**① 消费点枚举（rg 独立）**：`intentViewModel` UI 调用仅 battle.layers.js:694 一处（另一处 battle.intent.view.js:23 是 intentSummary 内部转发，而 intentSummary 全库仅 tests/battle-architecture.test.js:134 直测，无 UI 消费）——「玩家可见意图渲染路径唯一」成立。`calculateEnemyIntent` 消费点=battle.engine.js:127（intentFor 定义）+ 本次 battle.layers.js:694，无第三处。

**② 同帧性**：`ctx.turn = snapshot.turn || 1, playerStatus = snapshot.pstat?.status || null`（battle.layers.js:531-532 diff）与 `updateFoes` 的 foes 同出自**同一次** `getSnapshot()`：captureSnapshotInput（battle.engine.js:266-288）一次采集 `turn … pstat, foes …` 原文可见；签名 signatureValue（battle.runtime.snapshot.js:106-125）按值遍历整个 input，注释原文「Walk the values instead of relying on object identity: combat units and selection sets mutate in place between renders」——foe.atk 原地变异必改签名、必重建快照，**无 stale 缓存窗口，也未引入新窗口**。快照 foes 构造（battle.runtime.snapshot.js:146-151）`...foe` 全字段展开后冻结，现算所需 atk/behavior/affix/evenAttack/noFirstAttack/status 完备；与存量赋值点同构（lifecycle.js:234 原文 `f.intent = intentFor(f, 1)`——intent 第一参本就是 foe 对象，非静态 def）。

**③ 存量契约零破坏**：`foe.intent` 赋值点 rg 全库恰 4 处（lifecycle.js:234、enemy-phase.js:69、enemy-phase.js:326、battle.runtime.session.js:82），本次全部未动；快照冻结 `intent: freezeObject(foe.intent)`（snapshot.js:151）不变；读档回填 session.js:82 不变；AI 侧 agent.state.js:84 `intent: f.intent || null` 与 agent.policy.js:96 读快照 damage，均继续读存量快照值（行为不变；其与显示口径的差=修复单残留 3，如实登记）。

## 4. U12-c 驳回核实 —— 结论：驳回成立，独立核实

battle.layers.js:685-690 现读（HEAD 已有，本次 diff 未触碰该三元）：`const frozen = !f.dead && f.status && (f.status.freeze || 0) > 0;`，冰冻分支原文：

```
const intents = frozen
  ? [{ icon: '[[icon:crystal]]', label: '冰冻·无法行动', damage: null, kind: 'frozen' }]
  : intentViewModel(calculateEnemyIntent(f, ctx.turn || 1, ctx.playerStatus));
```

frozen 实时读快照 `f.status.freeze`，玩家回合挂冰冻→status 变异→签名失效→快照重建→渲染即显示「冰冻·无法行动」，攻击预告被覆盖。发现单 F3「角标仍是攻击」与现状不符，驳回正确；现算只接管非冰冻路径，与冰冻分支互补不重叠。

## 5. U12-d 分布不变性 —— 结论：成功路径 RNG 序列零变化

对照改动前后 makeLayer 调用序：旧实现 `build(\`${seed}:attempt:${attempt}\`)` attempt 0..7 先命中先返回；新实现 round=0 时 `const base = round === 0 ? seed : \`${seed}:retry:${round}\``（diff 原文），第 0 轮子流名 `${seed}:attempt:${attempt}` 逐字同旧，质量门先过先 return——常态成功种子序列逐位不变（tests/map-rng-bit-equivalence 黄金值用例亲跑绿佐证）。仅两类原本必失败场景落入 retry：quality 8 连败（旧=throw）、buildImpl throw/makeLayer 扩展失败（旧=直接上抛，layeredMap.js:10 调用点无 catch 已核）。上限与信息：`FALLBACK_ROUNDS = 24` × `MAX_ATTEMPTS = 8`，最终 `throw new Error(\`地图生成失败：外层兜底 24 轮 × 8 次候选仍未通过质量校验（最后一轮：${lastNote || lastIssues.join('；')}）\`)`，与用例 `/外层兜底 24 轮 × 8 次.*候选网格无法扩展到目标节点数/` 及 `expect(calls).toBe(24 * 8)` 对应。`buildImpl = build` 可选参默认契约不变，单参调用方 layeredMap.js:10 不受影响。

## 6. 亲跑复验 —— 结论：全绿无 Unhandled

- `npx vitest run tests/battle-pure-rules.test.js tests/m2-contract.test.js tests/layered-map-generator.test.js` → **3 files / 45 tests passed**（03:08:37 实跑）。
- `rg -l "intent|mapData|enemy-phase" tests/` 命中 14 js + 2 fixture；连同修复单验证集补跑其余命中与 map 消费方（battle-architecture/engine-facade/preview-amount/snapshot-types/snapshot/compendium/contracts/encounter-count/facade-snapshot-drift/intent-legend-isolation/m05/m06/map-connectivity/map-rng-bit-equivalence/r5a-map-snapshot/item15-18-fixes/node-retrigger/r5b-route-overlay）→ **18 files / 106 tests passed**（03:09:46 实跑）。
- 合计 21 文件 151 用例全绿，输出无 Unhandled；contracts「ESM 依赖方向：src 模块不存在循环依赖」在含新 import 的树上通过。

## 7. make-work 检查 —— 结论：无凑数

四个子项各对应 find-F-0230 的 F1-F4：F1 是真实缺口（enemy-phase.js:169 行动侧有 noFirstAttack 判定而意图模型无，巢穴龙首回合显示攻击预告实际蓄力）；F2 用例断言修复前后差异（注释原文「修复前此处仍显示 5（stale）」）且实伤断言走引擎 `playerTakeHit` 独立出口交叉锚定；F4 用例以调用计数（192 次）与第 11 次成功验证兜底行为而非空转；F3 零改动并驳回发现单——恰是反 make-work 的证据。

---

## 备注（不构成缺陷）

1. 任务书路径笔误：`game/src/core/mapData.js` 应为 `game/src/run/map-generator.js`（前者零改动），建议调度长留档知悉，避免后续按错误路径追责。
2. tests/m2-contract.test.js 的 display 表达式「照抄」渲染层实现（同源公式两处书写），显示值断言单独看是同义反复；但 `foes[0].atk === 3` 中间断言 + `playerTakeHit` 实伤 `dealt === shown` 独立出口交叉锚定，验收有效性不受损。
3. 修复单残留 1-3（敌方 atkUp 口径差、stunned 期间意图仍显示攻击、AI 顾问读快照 damage）经独立读码确认属实且如实登记，维持「只报告不动手」边界正确。

## verdict

PASS WITH NOTES
