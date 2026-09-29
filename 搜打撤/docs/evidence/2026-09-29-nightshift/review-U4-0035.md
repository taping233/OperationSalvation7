# review-U4-0035 —— R3 独立复审 fix-U4-0105（U4 两条 P3 健壮性守卫）

- 复审者：R3（夜班三代理编制第三方复审，只读，唯一写入本单）｜2026-09-29 00:06｜HEAD 5384bfd（工作树未提交态复审）
- 复审对象：`game/src/battle/effects/effect-steps.m2.js`、`game/src/hub/versioned-slot-reader.js` 两处生产 diff + 新增 `tests/u4-nightshift-guards.test.js`；对照实施单 fix-U4-0105.md 逐条核实。
- 方法：rg 独立全量排查调用链（不采信实施单表格）、读装配点与迁移表原文、亲跑定向测试。

## 清单 1：U4-a 调用链复核 —— 属实，无漏注入路径

rg 独立全量 `resolveCopyRandom|copyRandom`（game/src/）：**唯一执行调用点** `game/src/battle/core/battle.resolution.js:908`（原文 `did = resolveCopyRandom(card, m2Deps) || did;`，`operation.op === 'copyRandom'` 分支内）。其余命中均非调用点：`card-rules.capability.js:26`（键位白名单）、`card-rules.schema.js:145/679/723`（schema 校验）、`cards.sync.m5.js:46`/`cards.sync.m8.js:37`（卡牌数据与注释）、`effect-steps.kills.js:199`（审计登记 `id: 'hand.copyRandom'`）。

注入链三段全部亲验：`battle.resolution.js:43` ports 解构含 `randomBattle` → `:85` `m2Deps` 字面量 `random: randomBattle`（**无条件字段**，不在任何分支内）→ `battle.engine.js:513` `randomBattle: () => Random.random('battle')`（'battle' 种子流）。与实施单自报完全一致；不存在任何可绕过 m2Deps 的生产调用路径，throw 化不会把「静默随机」变「运行时炸」。

附带排查：rg `Math.random`（game/src/）确认生产代码已无任何裸调用残留（仅 sound.scape.js:19 / battle.vfx.js:212 注释声明走种子流，及本次新增注释与 throw 措辞）——退化口是唯一一处且已收口，无同类遗漏。

## 清单 2：throw 措辞与位置 —— 合理，一处措辞备注

- 位置正确：位于手牌空 early-return（:305-307）之后、随机选取之前——空手牌本就不涉及随机，不误炸。
- 措辞可定位：`'resolveCopyRandom: deps.random 未注入——战斗随机必须走 battle 种子流，禁止裸 Math.random 退化'`，函数名前缀 + 中文说明，与项目报错风格（如 reader 侧 `` `${logTag} 迁移表断链：…` ``）一致。
- **备注 N1**：diff 新增注释「装配期就应炸出」与实际不符——resolveCopyRandom 无装配钩子，throw 实际发生在**效果结算期**（该卡 op 触发时），非启动/装配期。属措辞夸大，非行为缺陷（由函数签名决定只能在调用点炸）；不改判，留档即可。

## 清单 3：U4-b 0 号键豁免与装配时机 —— 合理，不误伤

- **0 号键豁免依据（两侧原文亲验）**：`base.js:23-24`「// 0→1：首个显式版本，字段缺省由 mergeDef/adopt 兜底，盖章即可」；`game.storage.js:26`「// 0→1：首个显式版本。无 version 的旧档字段形状已由 migrateRunCharacter 兜底，盖章即可。」两侧 MIGRATIONS/BASE_MIGRATIONS 均只设键 1、无 0 号键——若校验含 0 号键，现网两侧表会立即装配炸。豁免正是按两侧既有约定执行，合理。
- **现值逐档核对**：`SAVE_VERSION = 2`（game.storage.js:13）、`BASE_VERSION = 2`（base.js:21），两表键 {1} 齐全 → 装配校验范围 1..1 自然通过，现网零行为变化。真实存量档 v0（无 version）/v1/v2 三条读取路径均不受影响。
- **时机**：校验在 `createVersionedSlotReader` 构造期（versioned-slot-reader.js:35-39），先于任何 parse，不存在「读档中途炸」。parse 内 while 迁移循环（:74-82）**逐字未动**（diff 仅增两行注释），负 v（base 宽松 `+d.version||0`）逐步盖章行为与改前一致。
- **误伤排查**：reader 全部装配点 = `base.js:77`、`game.storage.js:48`、`tests/hub-versioned-slot-reader.test.js:15`（maxVersion:2 + MIGRATIONS{1} 齐全）、新 u4 测试自身——无一被误炸（清单 5 亲跑证实）。

## 清单 4：测试质量 —— 5 例均真触发目标分支，回归断言存在且有效

- 例 1（缺 random throw）：先 `set$hand(['u4a-uid-1'])` 保证手牌非空、绕过 early-return 直达随机选取口——姿势正确（空手牌测不出守卫）；正则 `/deps\.random 未注入/` 精确命中新增 throw。
- 例 2（注入后复制成功回归）：`random: () => 0` 恒选第一张，断言 `addTempCard` 收到被复制 card 本体——「守卫不拦正常装配」回归有效。
- 例 3/4（断链）：末级缺口 `maxVersion:3, migrations:{1}` 断言 `/迁移表断链.*2→3/`；中间缺口 `migrations:{2}` 断言 `/迁移表断链.*1→2/`——校验循环两端各有钉死。
- 例 5（正常链路回归）：v0 老档盖章迁移（`{hp:10}` → `{hp:10, migrated:true, version:2}`）、v1 档迁移、v2 直读三断言 + `issue(1)` 为 null——「正常链路不受影响」的回归断言存在且覆盖三条存量路径。

## 清单 5：亲跑复验 —— 全绿，无 Unhandled

- `npx vitest run tests/u4-nightshift-guards.test.js`：`Test Files 1 passed (1) / Tests 5 passed (5)`。
- `rg -l "effect-steps|versioned-slot|slot-reader" tests/` 命中 12 文件全量跑：`Test Files 12 passed (12) / Tests 174 passed (174)`——与 fix-U4-0105.md §3 自报数字完全一致。
- 核心三文件输出 grep `unhandled|failed|error`：无命中。

## 清单 6：make-work 检查 —— 否

改动量生产 +7/+13 行、测试 75 行，各有真实防御对象：U4-a 堵「未来新装配点漏注 random」静默破坏种子复现性（fix 单 §遗留已写明移交约束）；U4-b 堵「未来 maxVersion+1 忘补迁移函数」旧档静默跳级盖章损档。红线遵守：diff 仅上述三文件，未触碰 winter.css / page-rewards-bag-help.css / cards-sync.json / package-lock.json（工作树中这些是其他会话的未提交改动），无 git 写操作、无 install、无删除。

## 结论

**PASS WITH NOTES**——两处收口行为正确、调用链与豁免依据属实、测试有效、亲跑全绿。备注 N1：effect-steps.m2.js 新增注释「装配期就应炸出」措辞与实际「效果结算期 throw」不符（该函数无装配钩子，只能在调用点炸），属措辞瑕疵非行为缺陷，不改判、不动手，留待后续顺手修正。
