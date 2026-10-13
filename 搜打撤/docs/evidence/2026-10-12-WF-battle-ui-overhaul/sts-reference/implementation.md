# 战斗一体场景重做：实施与验证

2026-10-12。实际阅读本目录 `reference-board.md`，并查看 `steam-00.jpg`、`steam-01.jpg`、`combat-multi.jpg` 原图。采用同一战场、角落悬浮资源与回合动作、下沿松弛手牌、每个敌人头顶紧凑意图及脚下生命组。沿用项目冬日科幻城市、人物和现行厚涂卡框；未恢复路线列表。

## 实施

- `battle.view.js`：舞台切换为 `battle-sts`；前景蒙版按实际能量、战术操作、技能、手牌卡与规则按钮开孔，避免零高 HUD 导致控件视觉被前景盖住。场景素材及其原有生命周期保持。
- `battle.layers.js`：手牌差分槽位内使用小角度、少量上下错落的视图扇面；完整意图在敌人附近按悬停、焦点或点击展开，点击意图不触发目标出牌。现有 UID、局部更新和序列帧挂载保留。
- `expedition-battle.css`：移除被否决的 v13 活样式，改为贯穿整屏的战场；能量与技能浮在左下、回合动作浮在右下，单位名称、生命与状态压缩贴近对应对象，意图改为图标/数字短标记。下沿只有局部渐暗，不再有整宽实心操作台。
- `battle-hand-overhaul.css`：默认卡牌完整入屏，费用与卡名可读；当前卡上提，受限原因只在阅读状态出现，规则按钮保持独立可触；规则侧板仍是只读路径。牌堆、背包等战斗决策阅读面保留原有功能。
- `combat-feedback.css`：伤害、治疗与格挡数字改用对象附近的文字描边承托，撤去常态黑色矩形底面；反馈队列与结算时序未改。

## 定向检查与实页

| 检查 | 结果 |
| --- | --- |
| `npx vitest run tests/battle-selection-flow-boundary.test.js tests/battle-esc-ime-guard.test.js tests/battle-preview-amount.test.js tests/battle-card-inspection.test.js tests/battle-modules.test.js --reporter=dot` | 5 文件、28 例通过 |
| `npx vitest run tests/battle-presentation.test.js tests/battle-selection-flow-boundary.test.js --reporter=dot` | 2 文件、16 例通过 |
| `node --check`、ESLint：`battle.view.js`、`battle.layers.js` 及相关 `aim.js`、`intent.view.js` | 通过 |
| PostCSS 解析 `expedition-battle.css`、`battle-hand-overhaul.css`；相关 `git diff --check` | 通过 |
| 主会话当前内置窗口，1606×956，实际双敌战斗 | 能量/结束回合真正可见；5 张默认手牌的费用和卡名完整入屏，未盖敌生命/意图；规则阅读打开“二刀流”显示“费用 1 能量”，未出牌 |

点击选目标、拖拽空处返回、结束回合及远征完整流程由主会话继续在当前内置窗口核验；本线未操作浏览器、未 build、未提交。
