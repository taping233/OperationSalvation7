# review-U18-0530 —— 战斗死亡判定迁移（负血+即时死亡）第三方独立复审

- 时间：2026-09-30 早晨（复审者 R12，只读复审，唯一写入=本单）
- 复审对象：工作树 U18 面 = battle.engine.js / battle.enemy-phase.js / ui/hud.js / tests/u18-negative-hp-death.test.js；对照单 docs/evidence/2026-09-29-nightshift/fix-U18-0500.md
- 方法：全部结论亲核代码原文与亲跑命令，未采信修复单自述。

## 1. 伤害入口完备性（核心）——PASS

rg 独立盘点全库玩家受伤路径（非采信修复单表格）：
- `damagePlayer` 调用方全集 4 处：battle.resolution.js:1012（结构化 heal.selfDamage）、effect-steps.damage.js:290（dmg.selfReceived）、effect-steps.kills.js:94/103（dmg.loseLife/dmg.negHp）——全部收敛至 engine.js:135 单点，钳位已去（:143），尾部 `if (n>0 && G.hp<=0) finish(false)`（:147）覆盖全部 4 路径。
- `playerTakeHit` 调用方唯一：battle.enemy-phase.js:214。engine.js:1361 `G.hp = playerRef.hp - (r.overkill||0)` 还原真实负血，死亡判定交既有敌方回合检查收口。
- 毒/灼 tick：enemy-phase.js:110-133，overkill 累计还原（公式推演见第 5②条）。
- 全库 `G.hp =` 直接赋值仅 5 处：engine:143/1361（U18 改点）、enemy-phase:117/125/133（还原点）、battle.core.js:343（G.hp=maxHp 满血重置，无关）。无漏网写点。
- 反伤路径伤的是 foe（combat.js 内部钳，修复单声明 foe 侧零变化，核实成立）。

结论：入口无遗漏，无「该死不死」残留。

## 2. deathSave 语义——PASS

- 顺序：两处判定（engine.js:137 / :1353）均**先于扣血**（`G.hp - n <= 0` 预判、hp 完全不动、保险 -1、immune 1）——与新语义无耦合，手感与现状一致。
- 免死后 hp 为正：新语义下 hp<=0 即刻 finish(false)（:147），故能走到免死分支时 G.hp 恒 >=1（整数血量），「免死后仍 <=0 死循环」结构上不可能。测试②（hp=100 不动、deathSave 递减 0、战斗继续）亲跑锚定。

## 3. 死亡触发重入——PASS（附一条修复单表述修正）

- finish 本体（lifecycle.js:127-172）**无重入标志**：transitionTo 有 phase 守卫（:130/:132），但 `busEmit('battle:end')` / `G.onBattleEnd` / `recorder.noteBattle`（:155/:156/:163）**不在守卫内**。修复单「lifecycle 的 phase 守卫天然防重复收尾」一句**表述过强**——防的只是 phase 转移，不是完整收尾幂等。若同一次出牌中第二次 finish(false) 发生，死亡结算广播会跑两遍。
- 现实可达性核减：双重 finish 需「一次出牌内两段独立致死伤害」。rg 卡库实证：结构化 selfDamage 现役仅 cc-demon 一张（cards.sync.m2.js:76，单段 2 点）；文本自伤句现役同卡仅此一句（cards.data.js:295）。**无多段自伤卡面，单段只 finish 一次，现状不可达**；仅自建卡/未来卡可能暴露。
- 且 U16 短路条件 `foesAnnihilated()`（resolution.js diff）对「自伤致死」不成立（敌人还活着），不挡同卡余下 op——即 U16+U18 组合对「多段自伤」形态无双重保险，依赖 exec-play 层 throwIfActionCancelled（:65/73/107/143，resolution 循环体内不查 signal）。此为理论缺口，非现状 bug。
- half-dead 态：damagePlayer 尾行即 finish 调用（:147 为函数末行），finish 后无残留 hp/日志写点；敌方回合 7 处检查均 `return` 收口（:90/:135/:161/:258/:393/:405/:446 亲数一致，修复单所列行号为改前旧行号，偏移系 U18 自身加行）。

## 4. 展示钳点全集——PASS

独立 rg 盘点并读原文：
- battle.layers.js:514（pct `Math.max(0, hp/maxHp*100)`）+ :515（txt `Math.max(0,hp)`）双钳，快照 player.hp 消费点 :546/:597/:714 全走 setUnitHP。
- ui/hud.js:44 dispHp 钳 0（文本 :56 用 dispHp）、:45 pct 钳、:55 low 态 `game.hp > 0` 负血不亮低血。:46 hpKey 缓存键保留真实值——修复单已声明（负血→结算回正触发一次重绘），核实无害。
- 战斗日志钳：engine.js:146/:1366、enemy-phase.js:120/:128 均 `Math.max(0, G.hp)`。
- 存档面验证：battle: 字段门 `game.battleActive`（game.session.js:175-176）——死亡当拍 finish 内 `G.battleActive=false`（lifecycle.js:148）先于任何后续 saveGame；saveGame:191 `terminalPending` 守卫在位。战斗检查点不可能捕获负血，成立。

## 5. 移交两条评估

**① finish(false)→terminalPending 窗口写负 hp——挂账成立（维持移交）**：
- 链路实证：lifecycle.js:155 busEmit → bag.settle.js:34 `onBattleEnd` 为 **async function**，busEmit 同步调用但其 await 链（口袋结算/掉宝箱续流）把 doDeath 推后——finish→terminalPending 之间存在**真实异步间隙**。
- 间隙内：battleActive 已 false（battle: 字段 null、action-runner 节流不写），但 game.state 不在 saveGame:194 挡列表（title/done/boot/moving），beforeunload 恰在该间隙触发则 payload 顶层 `hp: game.hp` 带负值；读档侧 numOr 不拦负。旧语义该窗口写 0，新语义写负值，危害升级（负血读档下场战斗进场即判死）。
- 现实可达性：需死亡结算动画间隙（数百 ms~秒级）恰好关窗，概率低、非每死必现。结论：**挂账**，交 hub 存档域会话处置（与修复单建议一致），非 U18 FAIL 项。

**② combat.js 钳位与消费侧 overkick 公式——PASS**：
- 记账侧：combat.js:161/:220/:237 三处 `if (target.hp < 0) { r.overkill = -target.hp; target.hp = 0; }`（超出量记账+钳 0），属地未动。
- 消费侧代数推演三情形全对：毒不致死+灼不致死 → `pref.hp - 0`；毒不致死+灼致死 → pref.hp 被灼钳 0，overkill=burn-P，还原 `P - burn`（P=毒后真实值）；毒致死 → pref.hp=0，overkill=poison-原hp，还原 `原hp - poison - burn`。累计公式（:133）在含时光符文双 pass 下亦闭合。
- 次要观察（不计缺陷）：:117/:125 的每 tick 即时还原在「毒+灼双致死」时瞬时值漏前序超杀（:125 只减 b1.overkill），但该值仅进日志且日志行有 max(0,·) 钳，:133 统一修正最终值——展示无负血外泄。

## 6. 亲跑验证——PASS

- `npx vitest run tests/u18-negative-hp-death.test.js` → **5 passed (5)**，无 Unhandled。
- `rg -l "engine|enemy-phase|playerTakeHit|deathSave" tests/` → 16 文件，全量亲跑 → **Test Files 16 passed / Tests 230 passed**，grep 抽查输出无 Unhandled/error/fail。

## 7. make-work 检查——PASS

- 测试为真实 BattleSession harness（非空转/非恒真），断言逐条绑定硬变化：0 血即死（①b）、负血数据层保留（①③④）、免死逐字（②）、敌方路径回归（③）、快照/展示分离（④）——锚定价值真实。
- 修复单与代码逐条对上（行号偏移已解释）；「顺带发现只报告不动手」纪律遵守；禁碰清单（resolution/exec-play/hub/css×2/package*/cards-sync.json）经 git status 复核零触碰成立（resolution.js 的 M 系 U16 属地改动，非 U18 越界）。

## 结论

verdict: PASS（附 3 条随单移交——①修复单「phase 守卫天然防重复收尾」表述过强，busEmit/onBattleEnd 不在守卫内，双重 finish 现状不可达但无卡面级保险；②terminalPending 窗口负 hp 挂账成立，交 hub 域；③若未来引入多段自伤卡面，需先补 resolution 循环内 abort 检查或 finish 重入标志）
