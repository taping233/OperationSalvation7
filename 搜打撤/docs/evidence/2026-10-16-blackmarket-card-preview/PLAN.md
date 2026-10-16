# 黑市投入前卡牌详情方案

状态：父会话已批准并完成单函数最小实现；7文件116项定向与静态检查通过，实页待下一自然黑市补验。

## 判断

`game/src/run/game.run.flow.js` 的 `openEventGamble()` 使用三张 `div.bt-card` 包住 `cardHTML(card, 'sm')`，没有可聚焦操作或详情动作。可最小复用 `UI.showCardZoom()`，不需要新弹层或 CSS 放大。

## 拟改动

- 仅将黑市三张预览包装换成原生 `button.bt-card.event-choice-card`，添加 `type="button"`、逐张 `data-i`、专用 `eventGambleRead` 动作与「放大查看卡名」无障碍名称
- 显示简短的点击卡牌查看提示
- 新详情动作使用现有 `settled` / `active()` 防失效保护，找到来源按钮后调用 `UI.showCardZoom(card, { hideNote:true, presentation:'expedition', from:source, returnFocus:source })`
- 大图不挂交易按钮，关闭沿用共用关闭按钮、Esc、背景点击与焦点返回；黑市原 DOM 与闭包继续存在
- 不改抽卡、3 币收费、50%、第五次保底与成功待领持久化

## 最小验证

新独立 jsdom 测试覆盖三张原生按钮、每张详情对应原奖品、反复开关保持 DOM / 金币 / 尝试数 / 随机调用次数、失败后的保底、离开/更换节点后的失效详情回调。共用大图的真实键盘与视觉由父会话在当前内置浏览器自然黑市场景复验。子任务不启动浏览器、服务或 build。

## 定位与现有边界

- `game/src/run/game.run.flow.js`：`openEventGamble()`、`eventPageBinding()`
- `game/src/ui/ui.js`：`showCardZoom()` 已提供原生关闭按钮、dialog 语义、inert、键盘关闭、焦点返回
- `game/css/scenes.css`：现有 `.event-choice-card` 按钮外观/hover/focus-visible 可直接复用
- 已读根 `AGENTS.md`、`docs/QUICKSTART.md`、`docs/WORKFLOW-TOOLS.md`、`docs/quality-gates.md`
- 定向 handoff：HEAD `f0e84c5dc3`；目标 flow.js 与 ui.js 有已有改动，保留不覆盖；本轮仅待授权的黑市局部增量
