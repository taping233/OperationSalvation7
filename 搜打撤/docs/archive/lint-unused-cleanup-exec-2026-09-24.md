# no-unused-vars 清理执行记录（2026-09-24）

- 依据清单：`docs/lint-unused-vars-cleanup-2026-09-24.md`（443 项，老板已批准）
- 执行环境：HEAD=b156a22，工作区另有并行会话在途改动（开工快照 51 个已修改文件，本任务未触碰其所有权文件中清单外的内容）
- 结果：**lint 错误 443 → 4**，剩余 4 项全部为豁免保留（见下）；全量 vitest 142 文件 / 798 用例全绿

## 总账

| 项目 | 数量 |
| --- | --- |
| 清单总项 | 443 |
| 实际删除（清单内） | 439 |
| 豁免保留 | 4（原批 2 项 + 执行中认定 2 项，逐项理由见下） |
| 跳过（找不到匹配） | 0 |
| 级联删除（清单外孤儿符号，删除清单项的必然残留） | 4 |

## 剩余 4 项与豁免理由

1. `game/src/hub/game.bag.js:326 showBagCardDetail`（未用函数）——原批豁免：被 selftest.js 源码正则锚定，不得删。
2. `game/src/run/game.run.scenes.js:115 openScene`（未用函数）——原批豁免：零调用但属 run-architecture 架构入口名单成员。
3. `tests/tt12-hitechrd-structured.test.js:111 rules`（仅赋值未读）——执行中认定：`const { rules, ...legacyCard } = card;` 是 rest 兄弟省略模式，`rules` 的"未读"承载测试语义（legacyCard 必须缺 `rules` 才能有效验证 `ensureTT12DiscoverRules` 迁移，后文断言 `migrated.rules` 重新补齐）。配置未开 `ignoreRestSiblings`，删绑定会破坏测试，改名/加 disable 注释均越权。按清单执行注意事项 3"保留并说明"。
4. `tests/r5b-route-overlay.test.js:16 swap`（仅赋值未读）——执行中认定，与上一条同模式：`want` 的 `swap` 靠解构省略从 `plan` 中排除（第 17 行单独断言 `routePlan.swaps[0].bNodeId`）。首轮执行时按"删绑定"机械处理导致全量测试 2 例红（`toMatchObject` 收到混入的 `swap`），已恢复原行并复测通过。**此 2 例红为本任务所引入，非并行会话在途。**

建议后续若要归零这两项：在 eslint 配置给 `no-unused-vars` 开 `ignoreRestSiblings: true`（一次配置消两类误报），而不是改测试代码。

## 现场口径（与清单建议的差异）

清单建议"未用参数改 `_` 前缀"，但 `eslint.config.js` 的 `no-unused-vars` 无任何选项（无 `argsIgnorePattern`/`caughtErrors` 豁免，清单中 sound.scape.js 的 `catch (_)` 本身被 flag 即为证）。故实际执行口径：

- catch 绑定：删绑定（`catch (e) {` → `catch {`），不改 `_`；
- 未用参数：仅当为**末位参数**时删参数名（调用方按位置传参不受影响，JS 忽略多余实参）；本次 13 个未用参数全部满足；
- 仅赋值未读且初始化器有副作用（`startSealBoss`/`vi.spyOn`/`drain` 调用）：保留调用语句、只去绑定；
- 巨型 multi-import 行（battle.core.js 167 项等）：脚本逐名删除、空 import 整行移除，保持剩余项语法正确；别名导入按本地名（`as` 后）匹配。

## 分文件明细

### game/src/audio（14/14）
- sound.js：11 处 catch `e` 删绑定
- sound.scape.js：3 处 catch `_` 删绑定

### game/src/battle（238/238 + 级联 1）
- battle.core.js：167 项 import 全删（battle.runtime 巨型行重建 + 8 条整行 import 移除，含别名 `emit as busEmit`）
- battle.aim.js：1 import（uiRect）+ 1 catch
- battle.anim.js：4 import + 2 catch
- battle.enemy-phase.js：8 import
- battle.engine.js：7 import + 1 catch + `freeCastTarget` 函数（全仓 rg 确认无调用/字符串引用，docs/R3-B-DELIVERY 亦确认死分支）+ `addPlayerCurse` 末位参数 `foe`
- battle.frames.js：7 catch
- battle.hand.js：UNIT/SPREAD/Y_BIAS/MAX_ROT/FAN10/rowScale 6 项；**级联删 CARD_W**（唯一引用者是 UNIT）
- battle.layers.js：2 import
- battle.overlays.js：解构成员 `opts`
- battle.pace.js：2 catch
- battle.preview.js：`cardRuleHint` 末位参数 `mode`（调用方 hover/layers/tests 均位置传参）
- battle.vfx.js：4 import + `listIdx` 参数
- battle.view.js：7 import + 9 条命令别名赋值 + 解构成员 `pdef`/`pendingHint`
- effect-steps.audit.js / effect-steps.curse.js / effect-steps.kills.js：各 1 处 `run: (ctx, m) =>` 末位参数 `m`

### game/src/cards（41/41）
- card-photo-notes.js：2 catch
- cards.data.js：4 import（整行）
- cards.js：10 import + 2 catch
- cards.rules.js：1 import（整行）
- cards.sync.js：2 import + 18 catch
- cards.view.js：2 catch

### game/src/core（26/26）
- art.js：BUILD_VERSION import + 8 catch + 1 catch `e`（清单中 362/368 两个"未用变量 `_`"在并行会话改动后已不存在，现场对应位置为 catch 参数，一并按 catch 处理）
- icons-bitmap.js：BUILD_VERSION + 1 catch
- input.js：3 catch + `prev` 赋值
- motion.js：4 catch
- notes.js：未用 `SDT` 垫片常量（连其 1 行专属注释）+ 1 catch
- renderer.icons.js：`drawIcon` 末位参数 `t`（导出函数，调用方位置传参不受影响）
- renderer.js：`walked`/`t` 赋值 + `drawAltarCircle` 函数（无调用无导出，rg 确认）

### game/src/game.boot.js（4/4）
- quitGame import + `atk` 解构成员 + 2 catch

### game/src/hub（66 删 / 67 项 + 级联 1）
- base.js：16 catch（含清单标注"未用变量"的 352 行，现场实为 hasSlot 行内 catch）
- game.bag.drag.js：4 import
- game.bag.js：3 import + `closeCardZoom` 赋值；**showBagCardDetail 豁免保留**
- game.bag.settle.js：4 import
- game.cardslib.js：TYPE_ICON 赋值 + 4 catch
- game.hub.depart.js：4 import + `B` 赋值
- game.hub.js：9 import
- game.hub.pages.js：13 import
- game.notes.js：1 catch
- meta.js：`mergeLegacyClasses` 函数（16-25 行）；**级联删 LEGACY_MERGE**（唯一引用者是该函数；其上方 2 行说明注释保留未动）

### game/src/run（12 删 / 13 项）
- game.nest.js：2 import + `nestBattleEnd` 末位参数 `consumed`
- game.run.altar.js：2 import + `openBossGate` 参数 `def`
- game.run.flow.js：1 import + 1 catch + `altarE` 赋值
- game.run.scenes.js：1 import；**openScene 豁免保留**（删 import 后现位 115 行）
- game.session.js：`hasSlot` 赋值
- lab.ending.js：1 catch

### game/src/ui（14/14）
- game.menu.js：deps 解构成员 syncPlayTime/clearSave/hasRun + 6 catch + `UI.act('wipeNotes', (d, btn)` 去参
- route-overlay.js：参数解构成员 `seed`（调用方多传属性无影响）
- ui.js：characterName import + 1 catch

### tests（24 删 / 26 项 + 级联 2）
- abyss-sovereign：`filler` 删行；`g` 保调用去绑定
- bag-structured-rule-migration：`save` 保 `vi.spyOn` 去绑定
- base-meta：`store` 删行
- battle-resolution：mock 末位参数 `count`
- boot：vitest import 去 `beforeAll`
- boss-equip-select：`max` 删行
- cursed-blade：`specOf` 删行
- direct-cast：1 catch
- dual-wield：`end` 保 `drain(500)` 调用去绑定
- ember-burst-rot-seed / nest-hearts / rapid-fire：动态 import 解构去 `viewApi`（保留模块加载副作用）
- extraction-session-resume：`copy` 删行
- hero-cards：`plainSpell`（2 行）删；`s` 保 `drain()` 调用去绑定
- lava-blast：`playByName` 函数（65-76 行，rg 确认零调用）
- mana-surge：`end` 保调用去绑定
- message-fixes：`uid`/`o` 同行删除（find 回调无副作用）
- nest-runemaster：import 去 `synergyOf`（其余命名保留，模块副作用不变）
- playthrough-bot：`battle` 函数（46-80 行含注释）；**级联删其专属 helper `cardName`/`expectFinite`**（唯一调用者在被删函数内，删除后由现场 ESLint 暴露）
- r5b-route-overlay：**swap 保留**（rest 省略模式，见豁免 4）
- structured-onplay-battle：Random import 整行删（random.js 经其他被测模块仍会加载）
- tt12-hitechrd-structured：**rules 保留**（rest 省略模式，见豁免 3）

## 验证记录

- 分域推进全程 `node node_modules/eslint/bin/eslint.js game/src tests` 计数单调下降：443 → 429（audio）→ 191（battle）→ 150（cards）→ 124（core）→ 120（boot）→ 56（hub imports+杂项中间态）→ 30 → 1（hub，剩豁免）→ 14（run+ui 中间态）→ 4（tests 后，3 豁免 + r5b 误删未恢复前为 3）→ **终态 4**
- 全量 vitest 第一轮：141 文件过 / 1 文件 2 例红（r5b-route-overlay，本任务引入，已修复并恢复原行）
- r5b 定向复测：3/3 绿
- 全量 vitest 第二轮：**142 文件 / 798 用例全绿**（约 262s）
- 所有改动文件保持 CRLF 行尾，无格式噪音；未触碰 CSS/资产/package.json/README/desktop-app/version.json/rules.md；未提交

## 未完成 / 遗留

- 剩余 4 项豁免如上；其中 tt12/r5b 两项的根治建议是配置层开 `ignoreRestSiblings`（需老板拍板，本任务未动配置）。
- art.js 清单中 362/368 两个"未用变量"在执行时已因并行会话改动形态变化（现场为 catch 参数），按现场处理，净效果与清单意图一致。
