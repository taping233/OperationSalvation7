# 战斗域实现类型检查

当前总览：I-04运行合同恢复已完成，本域14文件95项及补充合同3文件20项通过，lint退出0；最终联合11组类型检查已由hubrun退出0复核，537/537（strict49）。最终稳定全量再现hero药水测试随机漏判后，仅补固定候选与真实抽牌UID合同，hero全文件13项及定向lint退出0，生产源码保持冻结。原始首次验收记录保留在下方，不能替代I-04复验。未提交；保留上一轮框架拆分、快照及端口类型成果。

- 全域 `jsconfig.runtime.json` 实际启用 `allowJs/checkJs`，本域164个运行JS均直接入编译输入，含factory、resolution、规则执行器、runtime及view。沿用非strict渐进基线，原10组配置保留。联合报告535/535运行JS覆盖；严格配置独立执行，不宣称164个战斗实现均strict。
- 修复状态/回调/生成器/DOM节点的真实签名，补Draw、Selection、FoeLifecycle、Inspection具名端口；保留取消、支付、牌效与随机次序。
- 最终类型路径使用中央执行卡/操作泛型透传原输入，撤销首批新增的assertBattleExecutionCard运行校验，保留原有schema/capability入口及其有效卡不改写/非法规则/未知操作回归；没有增加发现候选限制。没有新增ts-nocheck、ts-ignore或整袋any。
- 生成的战斗HTML节点以本域BattleElement接口声明真实挂载字段；Canvas、按钮、输入、图片按实际元素类型声明，没有扩展全局Element。

## 首次阶段验证（I-04之前，保留原始结论）

| 命令/范围 | 退出码与结论 |
| --- | --- |
| `node scripts/check-types.mjs` | 0；原10组+runtime共11组通过，535/535，strict覆盖49/535 |
| `node node_modules/vitest/vitest.mjs run tests/framework-independent-battles.test.js tests/framework-runtime-instances.test.js tests/framework-battle-decomposition.test.js tests/battle-resolution.test.js tests/battle-execution-continuation.test.js tests/battle-structured-authority-unification.test.js tests/builtin-card-execution-battle.test.js tests/structured-onplay-battle.test.js tests/battle-hand-selection-rules.test.js tests/battle-discover-state.test.js tests/battle-discover-candidates.test.js tests/battle-all-cards.test.js tests/battle-rule-audit-1014.test.js tests/architecture-boundaries.test.js tests/contracts.test.js --reporter=dot` | 0；15文件229项通过。282张全卡真实实打，硬失败0；保留5条既有零效果警告 |
| `node node_modules/vitest/vitest.mjs run tests/battle-execution-card-guard.test.js tests/battle-all-cards.test.js tests/battle-discover-candidates.test.js tests/battle-resolution.test.js --reporter=dot` | 0；字段校验补全后的4文件65项通过，含282张全卡复验 |
| `node node_modules/eslint/bin/eslint.js game/src/battle game/src/ui game/src/experience tests/battle-execution-card-guard.test.js` | 0 |
| `git diff --check -- game/src/battle game/src/ui game/src/experience tests/battle-execution-card-guard.test.js` | 0 |

最终类型日志`.tmp/types-final5.txt`、实战`.tmp/battle-tests.txt`、边界补验`.tmp/guard-final2.txt`、lint`.tmp/lint-final5.txt`仅作本机中间证据，不入git。

没有运行build、安装、提交、推送或创建端口服务。本域未验浏览器实页；最终联合实页由集成会话补验，不能用上述jsdom/规则测试替代。

## I-04恢复与最终定向证据

类型来源：本会话`.tmp/I04-types-final.txt`保留修复前唯一hub/departure.view-updates.js诊断（退出1）；该跨域点由hubrun修复，父会话确认其最终11组类型检查退出0、537/537（strict49）。本会话没有把旧失败日志改记为通过；最终联合类型证据复用hubrun.md及`.tmp/hubrun-I03-all-types-final.txt`的同一冻结源码结果。

集成全量日志`.tmp/types-integration-accepted/test.log`暴露本轮省略消耗UID实参；该真实回归推翻首次“本域已完成”的运行等价判断，已修复：

- `effects/effect-steps.m1.domain.js`恢复`onHandConsumed(card, uid)`；`core/battle.effect-assembly.domain.js`恢复两参透传，`battle.core-ports.types.d.ts`声明UID可选；引擎接收端保持兼容签名。
- `core/battle.engine.factory.domain.js`恢复`addPlayerCurse(key, 1, foe)`第3实参，端口增加可选source；`ui/interface-motion.js`恢复`enterArchive`第3实参。
- `core/battle.engine.instance.js`恢复默认`options={}`及原context无额外占位字段；`core/battle.engine.js`恢复原context对象直接传递，避免复制与getter求值差异。
- 撤销新增候选/合成卡运行校验，通过真实中央泛型与精确字段声明检查实现；恢复发现说明isBoss字段、原始费用/状态表达式、步骤执行属性读取及overlay-close原回调。
- 本轮对164+87+1文件执行忽略注释/位置的Acorn AST差异清单，初始审查在`.tmp/I04-ast-audit.json`。与已获验收的前轮职责拆分区分；本轮少参、默认/初值、强制转换、额外限制均按上述原合同恢复。资源4消费者动态构造另由foundation独立核对。

最终定向命令：`node node_modules/vitest/vitest.mjs run tests/m-execute-consume.test.js tests/type-runtime-delegation.test.js tests/hero-cards.test.js tests/nightshift-u10-settle-transition.test.js tests/framework-independent-battles.test.js tests/framework-runtime-instances.test.js tests/battle-execution-continuation.test.js tests/battle-execution-card-guard.test.js tests/card-browser.test.js tests/target-motion.test.js tests/global-ui-settings-notes.test.js tests/character-view-motion.test.js tests/battle-trigger-lifecycle-unification.test.js tests/battle-victory-presentation.test.js --reporter=dot`，退出0，14文件95项通过（`.tmp/I04-final-target.txt`）。

补充合同：`node node_modules/vitest/vitest.mjs run tests/target-motion.test.js tests/m-execute-consume.test.js tests/type-runtime-delegation.test.js --reporter=dot`，退出0，3文件20项通过；精确验证消耗UID、HTML/SVG点击/hover、注入动效runner原ease字符串及delay/duration（`.tmp/I04-final-contracts.txt`）。scoped ESLint退出0（`.tmp/I04-lint-final.txt`）。

药水失败首次定性：精神药水既有draw:2；HEAD与现态`battle.draw.domain.js`抽牌实现、bag.domain.js结构化draw分支运行AST一致。旧hero-cards断言仍按“普通战获得初始攻击”的历史信号判断，随机命中精神药水时可漏判已抽2张真实牌库。当时保持原牌效、随机和原断言；独立失败组及95项通过，未声称随机隐患消失。后续精确合同修复见下节。

nightshift过场另一会话现行素材改动由hubrun处理，本会话未写hub/game.bag.settle.js；现态回归在上述95项中通过。

## 最终全量后的药水精确合同修复

父会话最终全量`.tmp/types-integration-final2/test.log`第1995行起再次命中精神药水：真实日志为“抽了2张牌”，旧历史日志判断返回false。原失败日志保留。

仅修改`tests/hero-cards.test.js`：发现构建期间以临时spy限定卡库中的药水候选，随后恢复完整卡库；实际发现、临时牌生成、直接施放、抽牌及消耗仍由生产管线执行。一般药水用例固定为火焰药水，保留原有全部效果断言并增加敌方精确失去2生命；新增精神药水固定候选用例，核对牌库末两张原有UID的pop顺序、牌库移除和手牌精确追加、生成药水进入消耗区且未留在手牌。没有新增日志白名单，没有修改生产牌效或随机算法。

- `npx vitest run tests/hero-cards.test.js --reporter=dot`：退出0，1文件13项全过（`.tmp/I04-hero-fixed.txt`）。
- `npx eslint tests/hero-cards.test.js`：退出0（`.tmp/I04-hero-fixed-lint.txt`）。
- `git diff --check -- tests/hero-cards.test.js`：退出0；仅既有CRLF规范化提示。
- 生产源码未变，沿用上述联合11配置类型证据；未跑全量、build、服务或浏览器。测试与本证据现已冻结，最终联合回归交integration。

## 类型边界文件

- `game/src/battle/core/battle.core-ports.types.d.ts`
- `game/src/battle/view/battle.dom.types.d.ts`
- `game/src/battle/effects/battle.rule-guard.js`
- `tests/battle-execution-card-guard.test.js`

## 实现检查精确文件清单

- `game/src/battle/bag/battle.bag.domain.js`
- `game/src/battle/bag/battle.bag.js`
- `game/src/battle/bag/battle.consumed-pile.js`
- `game/src/battle/bag/battle.deck.factory.js`
- `game/src/battle/bag/battle.deck.js`
- `game/src/battle/bag/battle.equipment.domain.js`
- `game/src/battle/bag/battle.equipment.js`
- `game/src/battle/bag/battle.piles.js`
- `game/src/battle/bag/battle.slam-skill.js`
- `game/src/battle/battle-loader.js`
- `game/src/battle/core/battle.actions.js`
- `game/src/battle/core/battle.card-play.domain.js`
- `game/src/battle/core/battle.card-play.js`
- `game/src/battle/core/battle.card-presentation.js`
- `game/src/battle/core/battle.core.js`
- `game/src/battle/core/battle.damage.domain.js`
- `game/src/battle/core/battle.damage.js`
- `game/src/battle/core/battle.default-context.js`
- `game/src/battle/core/battle.draw.domain.js`
- `game/src/battle/core/battle.draw.js`
- `game/src/battle/core/battle.effect-assembly.domain.js`
- `game/src/battle/core/battle.enemy-intent.js`
- `game/src/battle/core/battle.enemy-phase.domain.js`
- `game/src/battle/core/battle.enemy-phase.js`
- `game/src/battle/core/battle.enemy-plan.js`
- `game/src/battle/core/battle.engine.factory.domain.js`
- `game/src/battle/core/battle.engine.factory.js`
- `game/src/battle/core/battle.engine.instance.js`
- `game/src/battle/core/battle.engine.js`
- `game/src/battle/core/battle.exec-play.domain.js`
- `game/src/battle/core/battle.exec-play.js`
- `game/src/battle/core/battle.facts.js`
- `game/src/battle/core/battle.foe-lifecycle.domain.js`
- `game/src/battle/core/battle.foe-lifecycle.js`
- `game/src/battle/core/battle.hand-selection.js`
- `game/src/battle/core/battle.hand.js`
- `game/src/battle/core/battle.lifecycle.domain.js`
- `game/src/battle/core/battle.lifecycle.js`
- `game/src/battle/core/battle.presentation-events.js`
- `game/src/battle/core/battle.presentation.js`
- `game/src/battle/core/battle.resolution.domain.js`
- `game/src/battle/core/battle.resolution.js`
- `game/src/battle/core/battle.selection-flow.domain.js`
- `game/src/battle/core/battle.selection-flow.js`
- `game/src/battle/core/battle.setup-mechanics.domain.js`
- `game/src/battle/core/battle.snapshot-projection.domain.js`
- `game/src/battle/core/battle.summary.factory.js`
- `game/src/battle/core/battle.summary.js`
- `game/src/battle/core/battle.target-session.js`
- `game/src/battle/core/battle.turn-continuation.js`
- `game/src/battle/core/battle.turn-start.js`
- `game/src/battle/core/combat.factory.js`
- `game/src/battle/core/combat.js`
- `game/src/battle/effects/battle.acquire-operation.domain.js`
- `game/src/battle/effects/battle.card-cost.js`
- `game/src/battle/effects/battle.card-inspection.domain.js`
- `game/src/battle/effects/battle.card-inspection.js`
- `game/src/battle/effects/battle.cost-modifiers.js`
- `game/src/battle/effects/battle.discover-candidates.js`
- `game/src/battle/effects/battle.discover-flow.js`
- `game/src/battle/effects/battle.discover-state.js`
- `game/src/battle/effects/battle.effect-clauses.js`
- `game/src/battle/effects/battle.effects.js`
- `game/src/battle/effects/battle.foe-fight.js`
- `game/src/battle/effects/battle.hosted.js`
- `game/src/battle/effects/battle.infusion.domain.js`
- `game/src/battle/effects/battle.infusion.js`
- `game/src/battle/effects/battle.rule-guard.js`
- `game/src/battle/effects/battle.status-operations.domain.js`
- `game/src/battle/effects/battle.target-rules.js`
- `game/src/battle/effects/battle.trigger-source.js`
- `game/src/battle/effects/battle.triggers.m2.domain.js`
- `game/src/battle/effects/battle.triggers.m2.js`
- `game/src/battle/effects/card-semantic-operations.js`
- `game/src/battle/effects/choice-semantic-operations.js`
- `game/src/battle/effects/effect-steps.audit.js`
- `game/src/battle/effects/effect-steps.ctx.js`
- `game/src/battle/effects/effect-steps.curse.js`
- `game/src/battle/effects/effect-steps.damage.js`
- `game/src/battle/effects/effect-steps.deck.js`
- `game/src/battle/effects/effect-steps.gates.js`
- `game/src/battle/effects/effect-steps.js`
- `game/src/battle/effects/effect-steps.kills.js`
- `game/src/battle/effects/effect-steps.m1.domain.js`
- `game/src/battle/effects/effect-steps.m1.js`
- `game/src/battle/effects/effect-steps.m2.domain.js`
- `game/src/battle/effects/effect-steps.m2.js`
- `game/src/battle/effects/effect-steps.recovery.js`
- `game/src/battle/effects/effect-steps.rules.js`
- `game/src/battle/effects/effect-steps.tail.js`
- `game/src/battle/effects/effect-verbs.js`
- `game/src/battle/effects/equipment-semantic-operations.js`
- `game/src/battle/effects/hand-cost-patterns.js`
- `game/src/battle/effects/hosted-catalog-index.js`
- `game/src/battle/effects/random-blessings.js`
- `game/src/battle/effects/requested-card-batch.js`
- `game/src/battle/effects/requested-card-runtime.domain.js`
- `game/src/battle/effects/requested-card-runtime.js`
- `game/src/battle/runes.js`
- `game/src/battle/runtime/battle.action-runner.js`
- `game/src/battle/runtime/battle.browser-presentation.js`
- `game/src/battle/runtime/battle.clock.js`
- `game/src/battle/runtime/battle.execution-session.js`
- `game/src/battle/runtime/battle.host-scheduling.js`
- `game/src/battle/runtime/battle.pace.js`
- `game/src/battle/runtime/battle.playback.js`
- `game/src/battle/runtime/battle.player-effects.js`
- `game/src/battle/runtime/battle.presentation-ports.js`
- `game/src/battle/runtime/battle.runtime.default.js`
- `game/src/battle/runtime/battle.runtime.effects.js`
- `game/src/battle/runtime/battle.runtime.factory.js`
- `game/src/battle/runtime/battle.runtime.interaction.js`
- `game/src/battle/runtime/battle.runtime.js`
- `game/src/battle/runtime/battle.runtime.piles.js`
- `game/src/battle/runtime/battle.runtime.presentation.js`
- `game/src/battle/runtime/battle.runtime.session.js`
- `game/src/battle/runtime/battle.snapshot.js`
- `game/src/battle/runtime/battle.staged-playback.js`
- `game/src/battle/runtime/battle.state.js`
- `game/src/battle/view/battle.action-timing.js`
- `game/src/battle/view/battle.aim.js`
- `game/src/battle/view/battle.anim.view.js`
- `game/src/battle/view/battle.attack-cues.js`
- `game/src/battle/view/battle.attack-profiles.js`
- `game/src/battle/view/battle.card-feedback.js`
- `game/src/battle/view/battle.card-results.js`
- `game/src/battle/view/battle.decision-content.js`
- `game/src/battle/view/battle.decision-shell.js`
- `game/src/battle/view/battle.discover-infusion.js`
- `game/src/battle/view/battle.discover-input.js`
- `game/src/battle/view/battle.discover-view.js`
- `game/src/battle/view/battle.effect-feedback.js`
- `game/src/battle/view/battle.enemy-motion.js`
- `game/src/battle/view/battle.feedback.js`
- `game/src/battle/view/battle.frame-assets.js`
- `game/src/battle/view/battle.frame-catalog-changwuyu.js`
- `game/src/battle/view/battle.frame-catalog-three-role.js`
- `game/src/battle/view/battle.frame-catalog.js`
- `game/src/battle/view/battle.frame-renderer.js`
- `game/src/battle/view/battle.frame-resolution.js`
- `game/src/battle/view/battle.frames-diagnostic-policy.js`
- `game/src/battle/view/battle.frames.js`
- `game/src/battle/view/battle.hand-hit.js`
- `game/src/battle/view/battle.hand-inspector.js`
- `game/src/battle/view/battle.hand-layout.js`
- `game/src/battle/view/battle.hover.js`
- `game/src/battle/view/battle.infusion-material-state.js`
- `game/src/battle/view/battle.infusion-view.js`
- `game/src/battle/view/battle.intent.view.js`
- `game/src/battle/view/battle.layers.js`
- `game/src/battle/view/battle.overlays.js`
- `game/src/battle/view/battle.page-activity.js`
- `game/src/battle/view/battle.piles.view.js`
- `game/src/battle/view/battle.presentation-ready.js`
- `game/src/battle/view/battle.preview.js`
- `game/src/battle/view/battle.scenery.js`
- `game/src/battle/view/battle.secondary-overlay.js`
- `game/src/battle/view/battle.selection-ui.js`
- `game/src/battle/view/battle.skill-view.js`
- `game/src/battle/view/battle.turn-feedback.js`
- `game/src/battle/view/battle.turn-forecast.js`
- `game/src/battle/view/battle.vfx.js`
- `game/src/battle/view/battle.victory.js`
- `game/src/battle/view/battle.view.js`
