# 世界流程 / UI / 基地 / 存档测试质量复核

本轮仅审查冻结 `snapshot/tests`，没有运行或修改测试，没有改变既有源码 coverage/findings。独占产物为本文件和 `test-review.json`。

## 范围与方法

- 索引中 255 个 `.test.js` 文件均有分类条目；其中 91 个属于本片测试范围，164 个标 not-reviewed 并说明排除原因。
- 91 个文件：22 deep、7 systematic、62 static-only。deep 为人工核测试用例、依赖边界、输入和断言；systematic 为大文件先索引、按本片相关片段审；static-only 为完整 AST 结构提取与入口/mock/源码断言候选分类，**不表示逐 case 深审**。
- 排除命名或实际语义为 battle/card/effect/m-batch/workflow/agent、contracts/acceptance/docs-consistency/architecture/types 等工程测试；混合文件只审地图/事件/UI/基地/存档/撤离相关部分。桌面 `suggestions-store` 按冻结范围排除。
- AST 统计包含 import/dynamic import、显式 vi.mock/spy/stub、可静态取得的用例标题、readFileSync 和源码字符串断言候选。不完整计入 `it.each`、模板标题、循环动态生成用例；没有把这一数量当测试覆盖率。
- 每文件 `reviewedRisks`、`limitations`、来源 hash 和 AST 入口见 JSON。显式 vi.mock 数量为 0 不等于真实集成，手工 SDT/UI/导航/储存端口同样可能是替身。

## 已确认缺陷为什么未被现有测试捕获

| 已确认问题 | 最接近的现有测试 | 缺失的关键组合 |
|---|---|---|
| WORLD-001：拾取返包后按钮失效 | `bag-return-hook.test.js`、`node-retrigger.test.js`、`chest-click-flow.test.js` | hook 测试只取/清/替换函数；节点测试一直完成领取；宝箱测试不是 pickup 页且 hideOverlay 不清动作。没有实际拾取页→B→真实closeBackpack→恢复领取按钮→click。 |
| WORLD-002：火堆返包重刷 | `node-retrigger.test.js` | 首用例 LOOT_TYPES=`chest/coin/wood/rations/key/resource`，不含 fire，目标优先该列表/商店。sweep 中虽有 fireDone，但只是自动结算邻格，不在已回血未完成的火堆中开关背包；没有检查中间收益与visited消费之间的窗口。 |
| WORLD-003：军需返包丢奖励 | `events-0919.test.js`、`narrative*.test.js`、`r6-story-flow.repro.test.js` | events-0919 的“结算端口已实装”只检查源文件含 ev19 id 和表达式；Ink测试只走剧情choice图；R6测试是LastLamp专门来源/身份。没有军需付款与消费节点后、二级选卡满包→B腾格→回候选→领奖。 |
| ROOT R-HUB-01：预设应用清选择 | `game-hub-preparation-feature.test.js`、`m06-preparation.test.js`、`m06-sources-view.test.js`、`hub-flow-regression.test.js` | feature有效预设仅断applyPicks与openDeparture spy，openDeparture未运行真正openDepartPrep；领域preview/命令正确、view发意图、源码接线存在，都不检查导航结束后实际deployPick。 |
| WORLD-004：设置留言来源误判 | `r7b-feedback.test.js:45-47` | 虽叫“标题→设置→留言库→设置→标题”，实际用 `acts.openInbox()`，缺生产委托的dataset参数。默认false使它走正确来源，从而绕过 `!!dataset` 恒真的真实缺陷。 |
| WORLD-005：启动失败提示不停表 | `boot.test.js:53-55` | boot 测试从HTML提取body后删除所有 `<script>`，再导入main；启动inline看护从未执行，故main启动通过不验证那段interval。 |

这些不是“mock一律不好”的结论。上述测试对其原本目标有价值：纯hook存取、节点完成后的锁、领域preview、故事事务和主模块启动等确实是独立契约。薄弱处是少量跨页面组合没有落在任何测试边界上，不能把各层单独通过相加成整条链通过。

## 当前有价值的验证与局限

- `overlay-dialog.test.js` 使用真实 UI.init 和实际事件 dispatch 验焦点、inert、Esc；值得复用这个委托通道承接领取/来源恢复组合，而非所有测试都换成完整main。
- `node-retrigger.test.js` 使用真实main、地图/节点和DOM click，能验完成领取后的visited；其动态选目标/自动sweep减少布局耦合，同时也把火堆未完成阶段绕过。可定向构造火堆节点和中断，不必扩大到长跑局。
- `extraction-recovery-ui.test.js` 将真实 Base/RunStorage/recovery 与受控 after-base 故障结合，能核中断重试/一次统计。它mock session/scenes/UI壳，合理边界是撤离事务，不应宣称所有节点/UI返包安全。
- `r6-story-flow.repro.test.js` 已包含旧实例、旧hook、Base成功run失败、await换局等有意义的失败路径；但mock整个scenes/altar且直接取hook，不能自动覆盖普通pickup或ev19子流程。
- `layered-map-generator.test.js` 除调用实现自身quality门，还单独核节点配额、门、终局和功能房性质；`r5b-route-overlay.test.js` 另核相邻战斗、类型数量与确定性回退。这些结构测试不能发现进入节点后的交互结算漏洞。
- `hub-flow-regression`、`premium-ui-pages`、`ui-accessibility-regression`、`exp003-extraction-pocket-copy` 主要是源码字符串/样式tripwire，适合锁名称、文案、标记与接线结构；无法证明分支可达、动作参数正确、最终状态或真实computedStyle。没有因为其使用字符串就判无效。
- Home/Pixi大文件分层审阅记录为 systematic；WebGL是替身，不能当真实视觉和命中验收。91 个测试中其余62个仅 AST 分类，已明确未逐case判断测试质量。

## 建议的最小补充验证（仅建议，未编写）

1. 用真实overlay动作委托、真实bag关闭和实际scenes，拾取页开关背包后click领取，断只领取一次并完成节点。
2. 指定合法未消费火堆，记录hp/卡数，第一次回血后B开关再重入，断不得再次回血/抽职业卡且复原页仍能完成。
3. 指定军需事件和合法满包，付款后通过背包腾格返回，再选择候选，断币只扣一次、卡到账、visited只结算一次。
4. `createHubPreparationFeature` 接真实 `setDeployPick`、`openDepartPrep`，有效预设应用导航后断最终deployPick和整备DOM，而非只断调用spy。
5. 设置留言入口用实际按钮 click 的 dataset 委托；inline启动看护独立用浏览器timer this语义和fake time验证成功停表/失败条可关闭。

无需把所有小测试改成端到端。针对当前确认问题补这些边界组合即可；全量测试绿色并未否定本次复现，也不能被解释为全仓审查已完成。

## 收官口径

只读复核完成；91文件有范围内分类，其中人工深审22/系统片段审7、静态AST62。未重跑套件、未新增产品问题、未写产品修复、未写共享台账、未改原审查coverage/findings；164排除项不伪装成已审。
