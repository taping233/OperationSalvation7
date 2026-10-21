# UI与体验域实现类型检查

当前总览：I-05已修复HTMLElement早退拒绝SVG图标的真实回归；HTML/SVG点击与hover专属测试、原注入动效参数合同均通过，本域runtime诊断0、lint0，原strict-ui保持。该跨域filters诊断已由hubrun修复并确认最终11组类型退出0、537/537（strict49），本域源码相同，复用其有效联合证据（`.tmp/hubrun-I03-all-types-final.txt`）。首次阶段结论与I-05修复分列，原始日志保留。87个UI运行JS及1个experience运行JS均纳入真实checkJs。

UI壳明确已安装HUD缓存与DOM元素，生命周期/视觉准备/卡片浏览器/奖励与结算视图补精确options及回调；表单事件按真实HTML类型收窄。自定义DOM属性只在专属UIElement/CardZoomElement声明，未扩展全局Element。I-05复核后恢复motion/mini原CSS字符串原样透传；本地安装包map-easing.mjs支持字符串键的既有回落，边界只补接受字符串的声明，没有转换曲线或改变注入runner参数。UI惰性字段改为纯声明的空对象展开，恢复原初始化键集合及el={}。

## 首次阶段验证（I-05之前，保留原始结果）

- `node scripts/check-types.mjs`退出0；原10组+runtime共11组通过，运行源码535/535覆盖。
- `node node_modules/vitest/vitest.mjs run tests/card-browser.test.js tests/card-browser-resize.test.js tests/card-browser-deferred-art.test.js tests/card-browser-state.test.js tests/event-dice.test.js tests/extraction-rewards-view.test.js tests/extraction-recovery-ui.test.js tests/home-menu-motion.test.js tests/global-ui-settings-notes.test.js tests/performance-settings.test.js tests/premium-ui-pages.test.js tests/page-surface-lifetime.test.js tests/reward-acquisition-motion.test.js tests/settings-audio.test.js tests/settings-page.test.js tests/target-motion.test.js tests/sts2-battle-settings-restart.test.js --reporter=dot`：初次退出1，16文件130项通过，唯一失败是premium-ui-pages对hub/game.hub.js源码片段的精确匹配，已交该源码属地hubrun修复与复验；未改该业务断言。
- `node node_modules/vitest/vitest.mjs run tests/battle-execution-card-guard.test.js tests/character-view-motion.test.js tests/target-motion.test.js tests/reward-acquisition-motion.test.js tests/page-surface-lifetime.test.js tests/home-menu-motion.test.js --reporter=dot`退出0；6文件40项通过。动效类型收窄兼容普通动画测试桩。
- 本域ESLint退出0、diff检查退出0，命令同battle.md。

日志`.tmp/ui-tests.txt`、`.tmp/guard-final.txt`、`.tmp/types-final5.txt`仅作本机中间证据。

未运行build/安装/提交/推送/服务，也未替代集成会话的当前窗口内置浏览器实页验收。

专属新合同：`game/src/ui/ui.dom.types.d.ts`。现行游戏、卡片及地图状态类型沿对应属地维护，没有新增宽泛门面shim遮蔽运行实现。

## I-05修复及最终验证

集成独立AST审查指出本轮在15处委托事件增加`target instanceof HTMLElement`早退会拒绝SVG/path点击。已改按实际`.closest()`能力接纳Element；需要HTML专有字段的地方在定位到的HTML控件处声明具体类型，没有扩展全局Element。

精确实现文件：`ui.js`、`game.menu.js`、`card-browser.js`、`home-fx.js`、`home-menu-motion.js`、`base-design-preview-v7.js`、`expedition-feedback.js`、`archive-motion.js`、`achievement-gallery.js`、`quick-nav.js`。恢复实参/动效合同涉及`interface-motion.js`、`archive-motion.js`、`target-motion.js`；DOM惰性合同在`ui.dom.types.d.ts`。其他CustomEvent收窄使用声明，保持原事件处理分支。

新增`tests/type-runtime-delegation.test.js`覆盖HTML文字及嵌套SVG path冒泡点击得到同一卡片/同一动作，SVG hover继续交给页面handler。`tests/target-motion.test.js`新增精确注入runner参数回归，ease:'linear'、duration:0.245、delay:0.012均原样保持。

最终14文件95项+补充3文件20项退出0，精确命令/日志见battle.md的I-04段；本域lint退出0。此前premium-ui-pages跨域源码片段问题由hubrun修复并在其12文件199项中复验通过，未删除业务断言（其证据hubrun.md）。没有执行本轮全量/服务/浏览器/build/提交。

foundation独立确认并在冻结后签名：frames.js/layers.js/vfx.js/ui.js的动态资源构造表达式与HEAD逐项一致（4/1/2/1处）。四文件已通知冻结，不再编辑；相关资源审查索引由foundation统一写。

## 实现检查精确文件清单

- `game/src/experience/pocket-strip.js`
- `game/src/ui/achievement-gallery.js`
- `game/src/ui/achievement-medals.js`
- `game/src/ui/achievement-motion.js`
- `game/src/ui/archive-motion.js`
- `game/src/ui/base-design-preview-v7.js`
- `game/src/ui/base-preview-rooms-v7.js`
- `game/src/ui/battle-hud-info.js`
- `game/src/ui/beginner-guide-diagrams.js`
- `game/src/ui/beginner-guide.js`
- `game/src/ui/camp-entry.js`
- `game/src/ui/card-browser-state.js`
- `game/src/ui/card-browser.js`
- `game/src/ui/card-result-feedback.js`
- `game/src/ui/card-state-motion.js`
- `game/src/ui/character-idle.js`
- `game/src/ui/character-view-motion.js`
- `game/src/ui/chest-reward-overview.js`
- `game/src/ui/cinematics.js`
- `game/src/ui/comm-feed.js`
- `game/src/ui/cover-context.js`
- `game/src/ui/departure-transition.js`
- `game/src/ui/equipment-info.js`
- `game/src/ui/event-dice.js`
- `game/src/ui/event-option-state.js`
- `game/src/ui/event-recode-result.js`
- `game/src/ui/event-signal-puzzle.js`
- `game/src/ui/expedition-feedback.js`
- `game/src/ui/extraction-rewards-view.js`
- `game/src/ui/feedback-theme.js`
- `game/src/ui/feedback.local.js`
- `game/src/ui/fire-rest-view.js`
- `game/src/ui/game.menu.js`
- `game/src/ui/game.menu.pages.js`
- `game/src/ui/general-transition.js`
- `game/src/ui/home-fx.js`
- `game/src/ui/home-layers.js`
- `game/src/ui/home-linked-interactions.js`
- `game/src/ui/home-menu-motion.js`
- `game/src/ui/hud.js`
- `game/src/ui/interface-motion.js`
- `game/src/ui/inventory-zoom.js`
- `game/src/ui/lucide-acquisition-icon.js`
- `game/src/ui/map-health-hud.js`
- `game/src/ui/map-passage.js`
- `game/src/ui/motion-presets.js`
- `game/src/ui/motion-transitions.js`
- `game/src/ui/navigation-motion.js`
- `game/src/ui/node-decision-view.js`
- `game/src/ui/node-scene-view.js`
- `game/src/ui/overlay-return-state.js`
- `game/src/ui/overlay.js`
- `game/src/ui/page-entry-cancellation.js`
- `game/src/ui/page-loading.js`
- `game/src/ui/page-motion-profiles.js`
- `game/src/ui/page-surface-lifetime.js`
- `game/src/ui/page-visual-ready.js`
- `game/src/ui/partner-interaction.js`
- `game/src/ui/performance-settings.js`
- `game/src/ui/quick-nav.js`
- `game/src/ui/rarity-reveal.js`
- `game/src/ui/reward-acquisition-motion.js`
- `game/src/ui/reward-capacity-organizer.js`
- `game/src/ui/reward-card-feedback.js`
- `game/src/ui/reward-picker-heading.js`
- `game/src/ui/reward-scene-view.js`
- `game/src/ui/reward-state.js`
- `game/src/ui/route-overlay.js`
- `game/src/ui/selection-state-motion.js`
- `game/src/ui/settings-audio.js`
- `game/src/ui/settings-battle-restart.js`
- `game/src/ui/settings-navigation.js`
- `game/src/ui/settings-transition.js`
- `game/src/ui/slot-emblems.js`
- `game/src/ui/startup-transition.js`
- `game/src/ui/surface-motion.js`
- `game/src/ui/target-motion.js`
- `game/src/ui/term-tips.js`
- `game/src/ui/terminal-settlement.js`
- `game/src/ui/title-credits.js`
- `game/src/ui/title-wallpaper.js`
- `game/src/ui/transition-diagnostic-policy.js`
- `game/src/ui/transition-preparation.js`
- `game/src/ui/transitions-director.js`
- `game/src/ui/ui-decision.js`
- `game/src/ui/ui-disclosure.js`
- `game/src/ui/ui-scale.js`
- `game/src/ui/ui.js`
