# 手牌与选择线实施证据

2026-10-12。范围：战斗手牌、目标预览、牌堆与背包阅读面。本轮未操作浏览器；实页验收由主会话在当前内置窗口统一执行。

追加范围：远征事件页。参考 `reference-board.md` 第 4 节与本地图版 plate-03/04；卡牌详情阅读采用 plate-11 的对象身份、规则正文与动作分层。

## 可见变化

- `battle-ui-v13` 下，手牌卡以 `data-hand-state` 区分可用、选中、受限和注能；受限原因在卡牌上可见，选中提示贴卡。按钮层级把结束回合保持为主动作，背包、撤离、设置降为次要动作。
- 手牌“规则”按钮打开只读侧板，保留原卡牌节点与当前选择。返回或 Esc 关闭；按钮不会传入 `playCard`，也不会触发拖拽。
- 牌库、消耗牌用卡牌列表加同层完整规则详情；点击列表只更换详情，返回战斗使用原命令。
- 战斗背包为“查看规则”提供独立按钮，使用道具与存入安全格仍由卡牌本身执行，避免把阅读误作操作。
- 事件保留一张场景图：左下安静故事面、右侧选项面、顶部实际生命/货币/容量。多选项点击只选中并显示原有已知后果，页脚确认才调用原 `data-act`；取消按钮或 Esc 清除选择。单选项沿原直接继续路径。
- 事件结算仍由原回调负责；新选择接线只把已选按钮的原点击转发一次，不改收益、节点消费或存档。打开背包后返回同一事件时，按本次节点键恢复选项。

## 定向检查

| 检查 | 结果 |
| --- | --- |
| `node --check`：`battle.aim.js`、`battle.overlays.js`、`battle.hover.js`、`battle.piles.view.js` | 通过 |
| `npx eslint`：以上 4 个视图片 | 通过 |
| `npx vitest run tests/battle-card-inspection.test.js tests/battle-selection-flow-boundary.test.js tests/battle-esc-ime-guard.test.js --reporter=dot` | 3 文件、20 例通过 |
| `git diff --check`：本线已跟踪源码 | 通过 |
| `node --check`、`npx eslint`：`node-scene-view.js`、`game.run.scenes.js` | 通过 |
| `npx vitest run tests/events-0919.test.js tests/battle-card-inspection.test.js --reporter=dot` | 2 文件、6 例通过 |
| `npx vitest run tests/event-scene-selection.test.js --reporter=dot` | 1 文件、2 例通过；覆盖多选项独立确认与单项直达 |

实页尚需核对：真实开局后的手牌状态、点击规则及返回、点选目标/拖拽/取消、牌堆与背包详情在当前窗口的排版和操作链。

事件实页尚需核对：多选项第一次点击只选中、确认仅执行一次、取消后可重选、单项直接继续、背包返回同一选项，以及叙事/选项/页脚在当前横屏窗口不遮挡。

## 主会话实页反馈修订

主会话已在真实双敌战斗中点开能量不足的龙焰射线规则：侧板正常，未出牌。侧板费用文案改为“费用 2 能量”等按实际费用生成的表述。受限卡的 `aria-disabled` 保留在出牌节点；A 线把规则按钮移为同一槽位的兄弟节点，使读规则按钮不再继承禁用语义，关闭侧板的焦点恢复同步调整。

本次受影响定向检查：`battle-selection-flow-boundary.test.js` 与 `battle-esc-ime-guard.test.js` 共 17 例通过；`battle.aim.js`、`battle.layers.js` 的语法和 ESLint 通过，diff check 通过。AX 树的最终效果仍需主会话在当前窗口复核。
