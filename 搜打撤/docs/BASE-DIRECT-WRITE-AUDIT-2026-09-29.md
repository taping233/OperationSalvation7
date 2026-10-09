# 基地存档直写路径盘点与收敛审计（2026-09-29 夜班 C 线）

文档身份：09-29 的路径审计与方案依据。当前写入、失败和恢复边界见[存档契约](save-format.md)与[架构](architecture.md)；下文的路径状态使用前核对源码。

- 基准 HEAD：`47001e3`（docs(vite): record gate, art, perf, and provenance evidence）
- 执行：存档收敛子代理（hub/base 存档域）；未提交，工作区另有并行会话改动（`game.bag.js`、`game.run.altar.js` 文案/接线，`docs/M-BATCH-MATRIX.md` 开工后出现）——均未触碰。
- 使命：把绕过事务命令、直接改 `Base.data` 后保存的业务残留路径收敛为命令，业务层「直接写存档」清零。

## 结论

1. **可收敛路径 7 条全部收敛**（5 处直写簇 + 2 处迁移/旗子），新命令按同范式落位：`base-pet-egg.commands.js` 扩 1 个、新建 `base-meta.commands.js`（3 个）、`base.js` 门面新增 3 个窄命令 + 1 个 Meta 进度端口。
2. **收敛后复核**：`game/src` 业务侧（白名单=base.js 门面内部、base-* 命令内部、tests/）「直写形态」rg 命中 **0**；剩余 `Base.data` 引用全部为只读或登记保留项（见下）。
3. **特殊兼容语义未误改**：pet-egg / elapsed 式「失败仅内存推进 + persisted:false」在新命令中原样保留（见语义表）。
4. 存档 schema、字段名、随机流、玩家可见行为均未变；定向测试全绿（详见测试证据），未跑全量（主会话统一跑）。

## 方法

- `rg "Base\.data"` 全 src + tests；补局部别名形态（`const B = SDT.Base` / `window.SDT.Base` / `B().data` / `base.data` / 嵌套引用改写如 `applyAbilityRename(cards)`、`s.nestBossKills.push`）。
- 白名单：`hub/base.js` 门面内部、`base-*.commands.js` / `*-*.commands.js` 命令内部（含 `_readForCommit/_writeCommitted` 窄接口）、`tests/`。
- run/cards/battle/core 只盘点不修改（并行会话地盘）。

## 一、收敛清单（本次完成）

| # | 原直写位置（HEAD 47001e3） | 原形态 | 收敛为 | 语义 |
|---|---|---|---|---|
| 1 | `hub/game.bag.settle.js:131-135` `teachAmmoOnce` | `B.data.ammoTaught = true; if (getActiveSlot()) B.save();` | `Base.markAmmoTaught()`（base.js 门面） | 保留旧语义：内存先行，保存失败不回滚（重试层依赖旗子只弹一次） |
| 2 | `hub/game.bag.settle.js:183-185` 无档位胜利战斗计数 | `SDT.Base.data.eggBattles = (…\|\|0)+1` | `Base.recordEggBattle()`（base-pet-egg.commands.js + `persistEggBattles` 端口） | 保留旧语义：内存推进+尝试落盘，失败仅内存、`persisted:false`；槽位对局计数仍走结算事务 afterBase（battle-settlement.commands.js:200），互不重复 |
| 3 | `hub/meta.js` 原 `track()`（297-334）：`s.kills++`、`s.bossKills.push`、`turnMovesMax/battleEquipsMax/reviveKills/actions/stashTotal` 直改 + `B().save()` | 统计事件直写 | `Base.recordMetaEvent(type, payload, xpMul)`（新 base-meta.commands.js；统计+经验单草稿一次落盘） | 保留旧语义（persistMetaProgress 端口）：草稿准备→保存成功才替换运行态；失败同一规则在运行态补应用（仅内存推进）。未知事件不改状态不落盘（与旧 default 分支一致） |
| 4 | `hub/meta.js` 原 `addXP()`（33-49）：`d.lv/d.xp` 直改 + 每 checkpoint `save()` | 熟练度直写 | `Base.addClassXp(cls, amount)`（base-meta.commands.js） | 同上端口；升级播报（sfx/log）仍由 Meta 按 checkpoints 编排；无效入参不落盘（与旧一致） |
| 5 | `hub/meta.js` 原 `onCollect:177-178` `d.collXp` 直改、原 `syncCollXp()`（191-201）回填直写 + `save()` | collXp 直写 | `Base.ensureCollXp()`（仅内存初始化，同 ensureStarterPet 惯例）+ `Base.markCollXpSettled(ids)`（草稿落库）；「哪些 id 是职业卡」判定留在 Meta | ensureCollXp 内存初始化不落盘（与原一致：原代码此处不 save）；回填失败仅内存推进 |
| 6 | `ui/game.menu.js:676-680` `launch`：`applyAbilityRename/applyDuplicateRenames` 经卡片引用直改 `Base.data.stash/pocket` 后 `save()` | 改名迁移直写 | `Base.applyStoredCardRenames()`（base.js 门面） | 保留旧语义：两个改名函数都执行（不短路）、内存先行、有改动才 save；迁移幂等，保存失败下次进档重跑 |
| 7 | `hub/meta.js` 原 `track→addXP` 组合的多次 save（每 checkpoint 一次 + 末尾 + track 末尾） | 多次落盘 | 合并为单事件单次落盘 | **已知微差（更优）**：终值不变，只减少中间写盘次数；升级播报次数不变 |

新文件：`game/src/hub/base-meta.commands.js`（recordMetaEvent / addClassXp / markCollXpSettled）。
`base.js` 门面新增：`markAmmoTaught`、`ensureCollXp`、`applyStoredCardRenames`、`persistMetaProgress` 端口、`persistEggBattles` 端口。

## 二、保留/登记清单（不收敛的理由）

| 位置 | 形态 | 判定 |
|---|---|---|
| `run/game.nest.js:346-350`（nestBossRewards） | `s = SDT.Base.data.stats; s.nestBossKills.push(…); SDT.Base.save();` | **研究所冻结（铁律）→ 需主会话裁决**。建议后续收敛为 base 命令（同 recordMetaEvent 形态），本次不动 |
| `run/game.nest.js:577-585`（无档位研究所撤离） | `base.data.runes.push(…)`、`stats.labTotalScore/labBestScore/labRuns` 直写 + `base.save()` | **研究所冻结 + 注释明示「No selected slot has no durable run identity; preserve the legacy ephemeral-memory path」→ 保留旧兼容语义，需主会话裁决** |
| `run/game.session.js:314-321`（读档改名迁移） | `copies` 混入 `Base.data.stash/pocket` 卡引用，`applyAbilityRename/applyDuplicateRenames` 就地直改 + `saveBaseForLoad('card_rename')` | **run 域不碰 → 需主会话裁决**。与 #6 同一迁移语义；收敛方式同款（Base 门面命令或经 menu 同款 API），但改 run 文件超出本次地盘 |
| `run/game.session.js:92` `saveBaseForLoad` | `SDT.Base.save()` 纯保存检查点，无前置直写 | 保留（非直写路径，装载期持久化收集） |
| `hub/meta.js:12-19` `clsData` | `migrateCharacterProgress(B().data)` + `d[cls]` 懒建——**读路径惰性初始化**，无 save 调用 | 保留（内存惰性迁移/懒建，持久化随下一次命令保存；同 ensureStarterPet 惯例）。classLv/classXP/addXpToProgress 等读 API 依赖它 |
| `hub/game.hub.js:280` `restoreCard` 捕获 `stack` 引用 | 只读引用（算 pocketKeyCost 展示），restore 本体在门面内 mutate | 保留（非直写） |
| `hub/extraction.commands.js:88` `base.stats.extracts++` | `base = clone(baseSnapshot)` 命令内草稿 | 白名单（命令内部） |

其余 `Base.data` 引用（game.menu.js:677 已随 #6 消失；game.nest.js:247/370、game.session.js:317/330、game.hub.depart.js:32/55、game.hub.pages.js:487、game.hub.js:69、run/chests.js:159 等）均为只读。

## 三、兼容语义对照表

| 命令 | 保存成功 | 保存失败 | 无档位 |
|---|---|---|---|
| `recordEggBattle` / `persistEggPity`（既有） | 落盘 + 返回 persisted:true | 内存推进、不回滚、persisted:false | 仅内存、persisted:false |
| `recordMetaEvent` / `addClassXp` / `markCollXpSettled`（persistMetaProgress 端口） | 草稿提交落盘 | 同一规则在运行态补应用（内存推进）、persisted:false | 仅内存、persisted:false |
| `markAmmoTaught` | 内存+落盘，返回 true | 内存已置位（旗子只弹一次）、返回 false | 仅内存、返回 false |
| `applyStoredCardRenames` | 内存+落盘，返回 true | 内存已改名（迁移幂等，下次进档重跑）、返回 true | 内存改名、返回 false |
| economy（grantReward/purchase 等，既有严格事务） | 草稿提交 | 整单回滚 `{ok:false,why:'save'}` | mutate 返回 failure |

**已知微差（登记）**：
1. addXP/track 的落盘次数从多次（每 checkpoint + 末尾）合并为单次；状态终值、播报次数不变。
2. `recordEggBattle`/`markAmmoTaught` 的落盘门槛从「运行档位存在」改为「Base.slot 存在」。真实流程里 run 槽位与 Base.slot 同进同出（menu launch 同时设置）；仅当人为构造「Base.slot 有值但对局无槽位」时，新代码会多一次基地落盘（旧代码只内存）。测试桩里的该组合已按新契约更新。
3. recordMetaEvent 单草稿内完成统计+经验：极端时序下不再出现「统计已落盘、经验仅内存」的中间态（更一致）。

## 四、测试证据（定向，未跑全量）

新增 `tests/base-direct-write-convergence.test.js`（18 例，全绿）：每条收敛命令覆盖「成功提交 / 保存失败仅内存推进 / 未变分支或无效入参不落盘」三态，另含 Meta.track/addXP 集成、syncCollXp 职业卡过滤、改名迁移幂等。

受影响的既有测试更新（Base 桩补新命令，断言契约未改）：
- `tests/battle-settlement-retry.test.js`：Base mock 补 `markAmmoTaught`/`recordEggBattle`（镜像真实门面旧语义）
- `tests/agent-command-results.test.js`、`tests/e4-async-entry.test.js`、`tests/menu-recovery-entry.test.js`：Base 桩补 `applyStoredCardRenames: () => false`

定向批次结果（`npx vitest run … --no-file-parallelism`）：
- base 家族 16 文件：146 passed（含 base-mutation / base-pet-egg / base-meta / base-elapsed / base-departure / base-progression-commands / base-sticky-issue-fix / m01-base-commit 等）
- 结算+收藏+入口 10 文件（battle-settlement-retry/recovery/types、battle-victory-progress、collection-room、class-consolidation、contracts、e4、e5、e8）：全绿
- 撤离/终端/巢/菜单/存档兼容 20 文件（extraction-*、terminal-*、nest-*、menu-recovery-entry、r5a/r6/r7b、save-compat、facade-snapshot-drift、tt1/tt3、item15-18、game-session-elapsed、bag-*、chest-click-flow、pet-egg-chest）：89 passed / 0 failed
- agent-command-results：29 passed

## 五、收敛后 rg 复核证据（2026-09-29，工作区实测）

业务侧「直写形态」（赋值/自增/Object.assign/别名写）在 `game/src`（白名单外）命中 **0**：

```
===B. src 中直写形态（赋值/自增/Object.assign/别名data写）===
（无输出）

===C. alias 先行推进（B.data.* = 型）===
（无输出）

===D. 局部别名 base/B() 的 .data 写形态===
game/src\run\game.nest.js:577:      pending.runes.forEach(rune => base.data.runes.push(rune));   ← 保留项（nest 冻结）
```

`Base.data` 全量引用剩余 15 处，逐条归属：只读 10 处（game.nest.js:247/370、game.session.js:317/330、game.hub.depart.js:32/55、game.hub.pages.js:487、game.hub.js:69、game.bag.settle.js:183/203/303 存在性守卫）、base.js 白名单注释 1 处、base-pet-egg.commands.js 注释 1 处、game.menu.js:677 收敛注释 1 处；登记保留 3 簇见第二节（nest.js:347 统计别名、session.js:317 改名别名、nest.js:577）。

## 六、给主会话的裁决项

1. `run/game.nest.js` 两簇直写（346-350、577-585）：nest 冻结，是否在解冻后按 base-meta 命令形态收敛。
2. `run/game.session.js:314-321` 读档改名迁移：run 域，与本次 `applyStoredCardRenames` 同语义；建议主会话/A 线把该块改为调同一 Base 命令（或抽到读档命令层）。
3. `meta.js clsData` 读路径惰性迁移：如需彻底消除读路径写内存，需要把 classLv/classXP 全部改为显式命令化（影响面大、无存档风险，建议另开任务）。
