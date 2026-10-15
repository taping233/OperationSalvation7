# 启动链与战斗可访问性集成收尾

2026-10-16。本子任务修复原 boot 5 项与 ui-accessibility 1 项失败；修改四个目标文件，未暂存、提交、创建服务或联系旧任务。主会话统一登记、完整门禁与实页复核。

## 判断与依据

- 地图两项为旧契约。`../2026-10-15-map-brush/README.md` 明确世界间距由 120 改成 180，并扩大节点占比、减少留白。当前 `game.session.map.js` 与 `camera-interaction.test.js` 一致采用 180。boot 改验合法相邻边长度；构图验证合法分支中心都可见、决策框跨度适配相机区域，并将隐藏远节点移到极远处验证取景完全不变，不再要求旧的固定 70px 边距。
- 战斗两项为旧输入链。已阅读 `../2026-10-16-WF-battle-play-rewrite/{README,HANDOFF}.md`，并核对当前 `battle.view.js` 的 btPlay 明确传 `autoSingleTarget:false`。普通数字键/点选/Enter/Space 选中，随后确认敌人；Shift+Enter 保留详情。测试改验当前真实 DOM 输入链，保留取消、组合态、资源未提前扣除、手牌保留及最终指定目标伤害/其他目标不变/消耗断言。
- 第五项卡牌大页 Escape 原失败是前序战斗失败未清理造成级联。两战斗用例改为 try/finally 保证释放战斗和动画替身；该卡牌大页用例保持原断言并通过。
- 可访问性按钮已从布局外壳移入 `.hs-card`：外壳 group/tabIndex=-1，内层 button/tabIndex=0。旧静态断言改为当前内层位置，并在 boot 实例中检验语义、可聚焦性、aria-pressed 和可用/不足能量 aria-disabled。

## 两个真实生产回归

1. `battle.layers.js` 内层 face 缺少 `aria-disabled`。补充由同一 `st.blockedReason` 派生的布尔语义，保留原业务输入保护。
2. 增补战斗真实链测试发现：组合态 Escape 被 battle.layers 忽略后，继续冒泡至 game.boot 的 moveCancel，调用关闭浮层并清空 `_acts`，使后续卡面点击失效。`game.boot.js` 只在 moveCancel 开头增加 isComposing/keyCode229 早返回。新增断言确认组合态不关层、不取消选中、不丢失 btPlay 动作；普通 Escape 仍取消。

上述生产文件均经主会话明确扩展属地授权。资源消费者审计若维护源码指纹，需统筹更新 `game/src/game.boot.js`、`game/src/battle/view/battle.layers.js`。

## 验证

- `npx vitest run tests/boot.test.js tests/ui-accessibility-regression.test.js --reporter=dot`：2 文件 22 项全部通过，13.74s，启动时间 00:48:22。
- `npx eslint tests/boot.test.js tests/ui-accessibility-regression.test.js game/src/battle/view/battle.layers.js game/src/game.boot.js`：退出 0。
- 以上四文件 `git diff --check`：退出 0，仅现行工作区 CRLF 正规化提示。
- Vitest 的音频 codec 与合成昂贵卡 fallback-art 警告属于 jsdom/测试夹具；无测试异常。没有运行本子任务范围外完整测试或构建。
- 未核：真实辅助技术读屏；当前窗口实页由主会话统一执行。本结果不宣称全库、所有角色或多尺寸通过。
