# 战斗选择 UI 公共边界与整批接入

2026-10-18 UTC。本批将同类操作的提示与取消收拢到共享 UI 模块，覆盖点击选牌、卡牌待选目标、道具选靶、职业技能/双镖以及注能。保留核心规则、原提交回执、临时道具显示、键盘取消焦点恢复和触屏取消修复。

## 公共接口

`game/src/battle/view/battle.selection-ui.js` 不导入战斗引擎，也不写 snapshot 或消费资源：

- `selectionState(snapshot, { clickUid, findCard })`：统一选择态投影（infusion/card/item/slam/dart/click），包含当前提示、来源 UID 和多目标步骤。
- `selectionKey(snapshot, selection)`：场次 + 选择种类 + 来源 UID + 目标步骤，用于拒绝旧选择的迟到输入。
- `cancelSelection({ snapshot, commands, hasAim, clickUid, clearAim, clearClick, clearFeedback, restoreFocus })`：统一取消分派；适配器释放指针/点击 UI，核心 pending/infusion 仍调用原 commands。空闲返回 false，不提交、不扣费。
- `syncSelectionPrompt(stage, snapshot, { clickUid, findCard, getCurrent, onCancel })`：一个共享可见提示条，复用 `.bt-infuse.bt-pick`、`.bt-infuse-copy`、`.bt-infuse-actions`、`.mini-btn`。相同内容保持按钮节点/焦点；种类切换更新同一条；隐藏、inert、已脱离 DOM、忙碌、换场次/来源/步骤的旧按钮不响应。

## 多入口接入

- `battle.aim.js`：新增 `cancelBattleSelection`，封装核心命令与已有取消适配器。点击选牌更新共享条；显式右键/键盘取消复用同一入口。提交仍走 `submitCardWithFeedback`，绝不把提交当取消。普通重绘/失效清理保留底层 `cancelAim`、`cancelClickSelection`，不意外撤销核心状态。
- `battle.layers.js`：Esc 不再自行拼接四种清理，调用统一取消入口；IME/defaultPrevented/二级面板守卫保留。
- `battle.view.js`：删除独立 itemBar 模板和全局取消 action，渲染后同步共享条；移除 pendingTarget 同文气泡，具体选择说明只在共享条显示一次。顶栏仍显示简短阶段名。
- `battle.infusion-view.js`：专用材料工作区保留；按钮与捕获阶段 Esc 调用同一个 cancel，沿用已有页面/场次/来源牌守卫并复用公共分派，不让 Esc 穿透底层。

取消按钮自己的 listener 截止传播，不会再被通用 data-act 代理调用一次。旧按钮需自身仍连接且属于当前条，并匹配最新选择身份；不依赖全局 action 名来代表当前选择。

## 验证

整批完成后集中验证，没有每个点跑全套。

- 9 文件 235 项通过（`tests-final.txt`）：公共模块26项、真实战斗输入95项、注能布局30项、Esc/IME4项、拖牌21项、词条交互11项、箭头7项、contracts17项、architecture-boundaries24项。
- 新增跨入口真实模块断言：点击选牌与职业技能都只有一个取消条，取消清选中/高亮且不消费；旧卡取消按钮不能取消同场新卡；原双目标中途取消与正常完成、道具取消、键盘焦点、注能旧回调与Esc均回归通过。
- 初次并发运行部分文件通过后发生 `ERR_IPC_CHANNEL_CLOSED`（`tests.txt`），不可记通过；用单 worker 重跑同一范围后228项全绿，追加生命周期边界复核后最终235项全绿，没有扩大成全量。
- 定向 ESLint、5生产文件 node --check、git diff --check、8套 typecheck 通过；见 lint.txt/types.txt。

仍未核验实际视觉/触屏：内置浏览器环境阻塞。所有输入测试为 jsdom 合成交互，不称实玩。未运行外部浏览器/headless/CDP、build、服务、提交或推送。实页恢复后集中验点击选牌→取消、扰敌首选→取消/继续、道具/技能→取消、注能→返回/确认的完整链及共享条布局。

## 集中审查后的生命周期补充

当前舞台指针与舞台token也必须匹配，拒绝仍连接的旧舞台。键盘来源选牌后Tab转到取消控件，Esc/键盘激活仍恢复原可用卡；真实指针点击（click.detail > 0）明确不抢焦点。同UID取消后重选会移除旧条并创建新按钮，旧button即使closure还在也因自身断连拒绝，不另造与核心冲突的会话序号。对应7项追加边界已计入235项。首次IPC关闭属于测试工具进程异常，不是游戏崩溃证据。
