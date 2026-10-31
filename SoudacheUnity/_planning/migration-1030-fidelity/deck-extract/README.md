# 首脑编组与撤离页：源码转译复核

当前生产变更仅覆盖 `BattleSubpages.cs` 的 `DeckSelectionPanel` 与新组件 `CurrentDeckFormation.cs`。首脑编组改为现行源码的独立居中工作区，复用正式卡面、卡牌详情、快照与指令。未改 Core、牌池、支付或玩法状态。

具体来源：

- `../搜打撤/game/src/battle/view/battle.overlays.js`：编组渲染、选择与确认条件、自动装备提示、独立详情、同牌池增量更新。
- `../搜打撤/game/src/battle/view/battle.decision-shell.js`：formation 为非 floating 的独立决策页，阶段文案与退出行为。
- `../搜打撤/game/css/battle-decision.css`：1760×980 上限、四周 88 留量、标题/摘要/内容/固定页脚、240–280 列与 28 间距。
- `../搜打撤/game/css/battle-hand-overhaul.css`：对手摘要、编组进度、自动装备说明与默认折叠规则。

实际 Core 排除生物，规则文本据具体实现补充“生物”，其余按现行模板转译。Source prose 本身不是覆盖 Core 的理由。

现有 `ExtractStashScreen` 运行时类型已在 `CurrentRunTopBar.Covered` 中。`ScreenMount.Show` 的对象名 `ExtractStash` 不改变组件类型。本轮未为旧截图新增覆盖条件，需 Root 等待至少两帧后用独立播放器复核。

## 验证与边界

私有 `private_compile.py` 编译正式程序集，结果见 `compile/latest.log`：0 错误、10 条既有警告。未运行 Unity、未构建播放器、未前台操作。此结果只证明生产代码可编译；原生效果与真实输入由 Root 统一验收。

首脑编组运行时按钮名：`bossSel-<UID>`、`bossGo`、`bossCancel`、`bossFormationRules`、`btDecisionInspect-<index>`。观察入口为 `CurrentDeckFormation.Workspace`、`ContentScroll`、`RulesExpanded`。

Root 原生复核应覆盖：标题和 HUD 无裁切、长说明自动换行、选中后滚动与焦点保留、查看详情不改变选择、自动装备提示、折叠细则、确认条件与固定页脚。撤离需通过正常最终撤离事务进入并等待稳定帧。

生产 .cs 是权威文件；早期 `CurrentDeckFormation.cs.pending` 仅为实施前草稿，不能覆写生产。
