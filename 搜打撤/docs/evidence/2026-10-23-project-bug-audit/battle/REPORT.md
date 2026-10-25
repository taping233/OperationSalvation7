# 战斗与卡牌规则 bug 审查

2026-10-23。只审查；仅新增本目录证据，没有修改源码、构建、提交或操作游戏存档。确认 **5 项新增 P2 缺陷**，并运行确认今日 backend-audit 的 **2 项既有缺陷仍在**。不能把 7 项都计入新增。

证据：[reproduce.mjs](reproduce.mjs)、[reproduction-results.json](reproduction-results.json)、[existing-tests.log](existing-tests.log)。最小复现用独立战斗实例或直接领域工厂，不接浏览器、玩家存档或共享默认战斗。测试属于数值/状态执行证据，不充当游戏实页或真实玩家输入证据。

## 新增确认

### B-NEW-04 · P2 · 复活继续归还上一形态被偷攻击，8 攻复活体变成 15 攻

- 位置：`game/src/battle/core/battle.foe-lifecycle.domain.js:74-83`，具体缺口在 `foe.atk = foe.revive.atk`、`foe.status = {}` 后仍保留 `_stealRestore` / `_stealRestoreTurn`。回合末 `game/src/battle/core/battle.enemy-phase.domain.js:404-408` 会继续向新形态加回旧形态扣掉的攻击。
- 原生入口：影噬规则在 `game/src/cards/cards.sync.m3.js:98`，完全形态·元素领主在 `game/src/run/game.nest.js:94` 明确复活为 8 攻 8 心。
- 最小复现：同回合先用影噬将 8 攻领主偷至 1 攻，再击倒第一形态触发复活，然后结束回合。当前引擎复活即时为 8 攻，进入回合 2 后变为 **15 攻**；期望新形态维持定义的 **8 攻**。
- 实测：真实独立引擎 `resolveCard` → `hitFoe` → `endTurn`，结果键 `B-NEW-04`，`turn:2, atk:15, revived:true`。复现保留了原生 `heartsMode`、`affix:'aegis'` 和 `boss:true`，不是只模拟最终加法。
- 修复方向：复活替换攻血及状态时，同时清除旧形态用于延后恢复数值的记录；并复核 `_atkDownAmount` / `_atkDownPending` 等同类记录。不要通过改复活基础攻击抵消旧记录。

### B-NEW-01 · P2 · 武装的定向抽牌绕过「抽到时」效果

- 位置：`game/src/battle/core/battle.draw.domain.js:168-189`，命中类型后第 182-186 行直接放进手牌，只处理 `_castOnDraw` 特例，没有普通 `drawCards` 第 95-120 行的结构化或文本 onDraw 分派。
- 原生入口：武装 `game/src/cards/cards.sync.m3.js:103` 走 `draw + filter.type:'装备'`；天启剑当前卡面 `game/src/cards/cards.data.js:534` 声明「抽到该牌时额外抽 1 张牌」。结算器 `game/src/battle/core/battle.resolution.domain.js:766-770` 把过滤抽牌送往 `deckDraw`。
- 最小复现：牌库从底到顶为普通牌、天启剑，先比较普通抽一张和武装同型的定向装备抽取。普通抽天启剑时额外抽出普通牌，剑进入弃牌堆；定向抽取时剑直接进手牌，普通牌还留在牌库，额外抽牌完全没触发。
- 实测：`B-NEW-01` 用同一结构化 onDraw 卡验证普通抽触发 1 次、定向抽 0 次；`B-NEW-01-NATIVE` 从当前 `cards.data.js` 原文取天启剑字面量，再通过真实独立引擎普通抽牌/结构化过滤抽牌对照，得到上述牌区差异。
- 影响：任意被过滤抽到的 onDraw 牌，包括天启剑的补抽和诛魔剑的抽到攻击；不仅是自定义卡。此前 backend-audit 仅把此路径列为待核，本轮有执行证据，计为新增确认。
- 修复方向：抽取来源筛选与「抽到后如何结算」复用同一分派；保留实体 UID、原库序、满手、自动施放失败和支付选择等现行边界。

### B-NEW-03 · P2 · 已消耗闪避的到期记录会扣掉后来获得的闪避

- 位置：`game/src/battle/core/combat.factory.js:83-88` 消耗闪避只扣 `status.dodge`；`263` 登记的 `__timedBuffs[].amount` 不变；第 `230-233` 行到期时又把原始 amount 从总层数扣一次。
- 最小复现：获得 1 层、持续 1 回合的闪避 → 被一次伤害消耗 → 获得 1 层、持续 2 回合的闪避 → 推进一次共享回合钟。
- 实际：闪避层数变 **0**，但剩余登记仍有 `{ key:'dodge', amount:1, turns:1 }`；期望后获得那层仍有 **1** 层、剩 **1** 回合。此时下一段伤害会错误命中。
- 实测：`B-NEW-03` 直接执行真实 `createCombatRuntime`。两种时长对应的结构化 blessing 卡都经过 `inspectCardRuleCapability` 确认为可执行。
- 适用边界：当前内建闪避缺省仅持续本回合；本例明确覆盖项目已支持的自定义/制作坊多时长祝福组合，不宣称普通单张内建闪避也必定触发。
- 修复方向：消耗闪避时同步消耗来源剩余量，再到期仅扣尚未消费的部分；需要确定多个时长的消费顺序，并用该顺序保持状态与记录一致。

### B-NEW-05 · P2 · 多次偷攻共享一个归还日期，不同持续时间互相覆盖

- 位置：`game/src/battle/effects/effect-steps.m2.domain.js:128-132` 把所有 stolen 合并到 `_stealRestore`，但每次覆盖单个 `_stealRestoreTurn`；玩家的 atkUp 则由 `addBlessing` 按来源分别登记，双方到期不再对应。
- 最小复现：10 攻敌人先被偷 2 攻、持续 1 回合，再被偷 2 攻、持续 3 回合，结束当前回合。
- 实际：回合 2 敌人仍 **6 攻**，玩家加攻已从 4 正确降至 **2**；期望短期偷攻到期，敌人恢复到 **8 攻**、玩家加攻仍为 **2**。倒置施放顺序又会把长期偷攻提前全部归还。
- 实测：`B-NEW-05` 两张卡均通过 capability，走真实独立引擎出效果和敌方回合，不手工模拟到期结果。
- 适用边界：现行影噬、禁咒 I 都缺省 1 回合；本缺陷覆盖已支持的自定义 `stealAtk.duration` 组合，不宣称两张同为 1 回合的原生牌也会出现不同时长错误。
- 修复方向：敌人端按 `{ amount, expiresAt }` 分项登记，与玩家独立计时对齐；原记录若用于恢复检查点，需兼容已有快照。

### B-NEW-02 · P2 · 随机伤害同一段两次选靶，蓄势甲却命中乙

- 位置：`game/src/battle/core/battle.resolution.domain.js:281-285` 在 windup 前、windup 后分别调用 `pickTargets()`；当 `operation.target === 'randomEnemy'` 时每次都会在第 274 行推进目标随机流。
- 最小复现：两名存活敌人甲、乙；1 段 4 点随机敌人固定伤害；给目标流依次返回 0 和 0.99；不在 yield 期间改变任何战斗状态。
- 实际：windup 返回目标 **甲**，真正扣血的是 **乙**，该段用了 **2 次**目标随机数；期望同一段保留已选的存活目标，甲仍存活时命中甲。仅当既选目标在等待期间死亡等失效时才按规则重选。
- 实测：`B-NEW-02` 真实引擎 `resolveCard.steps`，卡通过 capability；结果 `windup:['a'], damaged:['b'], rolls:2`。此项不是声称相同种子会产生不确定结果，而是演出目标与实际提交不一致、并重复消费目标随机数。
- 同类静态路径：`game/src/battle/effects/battle.status-operations.domain.js:77-83` 的随机诅咒同样在 windup 前后重选。本轮只对伤害分支做运行复现；诅咒分支不另计一个 bug。

## 既有问题：去重且确认仍存在

以下两项已在 `docs/evidence/2026-10-23-backend-audit/battle.md` 报告，本轮只补执行证据，不计新增：

| 既有编号 | 当前结果 | 最小证据 |
| --- | --- | --- |
| backend B1 铸甲消耗漏事件 | 仍存在 | `B-KNOWN-01`：被消耗装备的 onConsume 应 +2 能量，消耗和 +10 甲完成，能量仍 8 而非 10。位置 `effect-steps.m2.domain.js:419-434`。 |
| backend B2 execute 尝试计击杀 | 仍存在 | `B-KNOWN-02`：第一目标免疫、第二目标可消灭、count=1；两人均存活却打印已消灭1个。位置 `effect-steps.m2.domain.js:325-338`。 |

## 验证、反证与覆盖

- `node docs/evidence/2026-10-23-project-bug-audit/battle/reproduce.mjs`：最终执行退出码 **0**。脚本使用断言锁定已观察的错误状态与对照状态；退出 0 表示复现成功，不表示缺陷已修复。执行前后比对 6 个相关源码文件 SHA256，确保复现期间源码没有变动；当前 hash 附在结果 JSON 的 `sources`。
- 现有定向回归：`node node_modules/vitest/vitest.mjs run tests/m2-contract.test.js tests/battle-trigger-lifecycle-unification.test.js tests/battle-review-remediation-1023.test.js tests/battle-qi-wave-defense.test.js tests/nest-hearts.test.js tests/sts2-enemy-plan.test.js tests/sts2-consumed-rules.test.js tests/normal-effects-deck-regression.test.js --maxWorkers=1 --minWorkers=1 --reporter=dot`：**8 文件、116 测试通过，退出 0，43.96 秒**。没有跑全量测试、构建或安装依赖。
- 已排除：自定义 damage 未写 battle.target 造成自动打首敌——schema 已拒，不报 bug；self atkDown 无效果——capability 已明确拒，不报 bug；同步首脑击杀漏伤害段币奖励——对照 `B-CONTROL-06` 实际获得 2 币，不报 bug。
- 初次原生卡补强尝试直接在 Node 导入 cards.data.js，被其 Vite JSON 导入路径拒绝（退出 1）。最终复现改为只读提取当前天启剑单行字面量，后续最终执行退出 0；没有改运行时或安装 loader。
- 主会话已确认的类型检查错误由其汇总；本报告不把类型错误重复当作运行 bug，也不改活跃发现/UI 属地。
- 本轮覆盖：battle/core 的伤害、抽牌、目标、结算、敌方回合、死亡/复活；effects 的结构化状态、M1/M2、获取、触发器、支付门；cards 的执行计划、schema/capability、原生规则入口与兼容。回放/随机只检查这些路径的随机消费和已存在定向用例，没有完整重放所有游戏局；未逐卡穷举全部卡牌组合，也未验证游戏实页。
