# review-U16-0530 —— fix-U16-0500 独立复审（复审者 R10，2026-09-30）

对象：`game/src/battle/core/battle.resolution.js` 敌人全灭终局守卫（PENDING #14）。方法=只读复审：修复单对照代码逐条验证 + 独立 rg 盘点 + 亲跑测试。工作树含 U17/U18 邻居改动，已甄别与 U16 无交集。

## 1. op 通道覆盖完备性（核心）——独立盘点

rg 全量盘点 `resolveCardSteps`（:470-1185）全部执行通道，共 10 类：

| # | 通道 | 位置 | 守卫 | 结论 |
|---|---|---|---|---|
| 1 | 结构化伤害循环 | :585 | `break` :586 | ✅ |
| 2 | **遗留 dmg 字段伤害路径**（修复单未列） | :742-872 | 无显式守卫 | ✅ 语义自洽（见下） |
| 3 | 结构化资源循环（heal.selfDamage/coins/draw/curse/execute/summon/foeFight/acquire/energy/maxHp/deckCap 等 20+ op 全在内） | :879 | `break` :880 | ✅ |
| 4 | 法力奔涌 | :1127 | 引擎侧既有 `if (!targets.length) break` | ✅（HEAD 与工作树逐字一致，确系既有，非 U16 添） |
| 5 | 文本立即句循环 | :1140 | `break` :1141 | ✅ |
| 6 | heal/armor/draw 字段兜底 | :1152/:1159/:1167 | `&& !foesAnnihilated()` ×3 | ✅ |
| 7 | 回合开始/本局对战词条注册 | :1179/:1181 | 不拦 | ✅ 登记≠结算 op；全灭当卡打完即 `finish(true)`（exec-play:278），注册无可见副作用 |
| 8 | schedule bag op 回流 | resolution:597 / bag.js:132 → engine:430 消费 | 不需拦 | ✅ 延迟队列回合开始才消费，全灭后战斗即终局永不可达；且合成卡走 resolveCard 自带同款守卫（纵深） |
| 9 | 装备域 op（rules.equip） | :514-517 明示不回放 | 不适用 | ✅ 单路径在 equipment/registerEquip/runner，不在 resolution 属地 |
| 10 | exec-play 层 | :246 镖二段 `alive().length` 既有门 / :278 胜利判定 / :229 applyKillRewards | 未动 | ✅ :229 属击杀 rider（同 onKill 语义，原子保留） |

**通道 2 详证（修复单摸底表遗漏但语义已覆盖，非缺口）**：全文件 `hitFoe` 仅 4 处调用（:700/:828/:849/:867），后三处全在此路径。该路径是单卡 dmg 字段的单一 op 单元：多段循环遇无活目标自断（:803/:809）；「额外施放」`getAliveFoes()[0]` 空则 break（:844/:848）；「击杀连锁」recast 名单只含活敌，全灭则空转（:860-867）；循环后唯一结算=吸血 :835（同 op rider，原子）。全灭后无任何资源/额外 op 可执行——无「仍会执行」通道漏网。

**结论：无漏通道。** 拍板语义（op 级粒度，中途死→下一 op 起中止、当前 op 不回滚）下覆盖完备。

## 2. 谓词时机

敌人死亡只发生在 damage op 内：`hitFoe` 4 处全在两条伤害路径；execute op（可杀敌）在资源循环内、守卫每轮入口复查可即时命中；流血/中毒 tick 属回合管线不在卡结算内。粒度正确：守卫在每轮 op 入口，当前 op（含其 rider）完成后下一 op 才中止，不回滚——与拍板一致。口径与 exec-play 胜利判定同源（`getAliveFoes`=engine `alive` 注入）。

## 3. rider 原子性

onKill :734-736 / lifesteal :715 / recast.on kill :719-731 均在同一 operation 迭代内、命中循环之后、下一轮守卫之前结算——守卫不可拦截。遗留路径吸血 :835 同理。exec-play:229 applyKillRewards 为击杀对价，非「余下 op」。修复单「原子保留」声明与代码相符。

## 4. harness 改动

- `getAliveFoes: state.getAliveFoes || (() => state.foes || [state.target])`——回退分支与原实现逐字相同，既有用例默认路径不变 ✅；`splitClauses` 同构 ✅。
- 新用例真驱动新语义：①resource 循环 selfDamage 拦截 ②coins 拦截+state.coins ③未全灭回归锚（双敌倒其一，op 照常落账）④文本句循环拦截+heal 兜底拦截（onText 回调清场，恰好 1 条 text 事件）；实战用例 m1 走完整 exec-play+finish(true)，hp===100。断言仅增不改（diff 核实 0 条既有断言变更）。

## 5. 亲跑验证

`npx vitest run` 对 `rg -l "exec-play|resolution|effect-steps" tests/` 命中的 16 文件：**Test Files 16 passed (16)；Tests 219 passed (219)**，输出无 Unhandled（09:41:06）。注意：混树绿（U18 engine/enemy-phase/storage/hud 在途），与修复单声明一致；全量 vitest 留调度长收官，本复审不重复跑。

## 6. make-work 检查

源码 +14 行零删改、注释绑定拍板来源；测试纯增量；无顺手重构、无多余文件、红线（engine/cards-sync/css/package）零接触——裁量合理（engine.js:677 既有守卫复用而非重造）。无 make-work。

## 7. NOTES（不构成 FAIL）

1. **句内多动词不做句内中断**（如「造成X伤害，抽2张牌」为单 immediate 句，句内步级不查守卫）：修复单 §6 已如实披露并说明超出「op 循环每轮入口」授权；若日后要 STS2 完全对齐（per-Command→per-step），需另开单元改 effect-steps 管线。
2. 通道 2（遗留 dmg 字段路径）无显式守卫但语义自洽（见 §1 详证），建议后续维护者在改动该路径资源结算时同步评估是否补显式守卫。

---

**verdict：PASS WITH NOTES**
