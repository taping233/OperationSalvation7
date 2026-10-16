# 失败与撤离整理结算阅读层 R3

2026-10-15 UTC。源码与14文件94项定向验证完成，真实按钮包含块、滚动裁切与输入仍等主协调既有5300页面验收。本轮实际看过[第一次首领失败36](../2026-10-16-WF-cloud-play-eight-hours/screenshots/36-failure-result-before.png)，没有操作浏览器、服务或build。

## 根因与实施边界

截图里的失败内容约445显示像素宽，对应 `.doom-panel { width:min(720px,94%) }` 在1188/1920统一缩放后的尺寸。11.5–14逻辑像素说明只剩约7.12–8.66显示像素。它原来整块限高滚动，回基地/再出发仍在同一内容末尾，因此截图里底部按钮被裁到视口外。这不是本轮查见的重复zoom问题；没有调整全局缩放。

失败、成功整理、成功结尾不是同一个DOM：失败是doom-panel；成功整理是exMain.result-pg；成功结尾是R2已经调整的sc-exit事件壳。因此只用同一阅读尺度和操作边界协调它们，不强行替换成一个业务页面。

授权后只修改 `game/css/expedition-rewards.css` 的doom结算及exMain.result-pg作用域，新增 `tests/terminal-result-readability.test.js`。现有入城补给专属、清退增量和其他奖励样式保留；不改battle.css/stage或战斗R4属地，不改玩法、发奖、存储和复盘JS。

## 修正

- 失败卡壳宽1240逻辑像素，左右各36内边距，主体约1168；1188当前窗口名义主体约722.7显示像素。卡壳限定94%游戏高度，标题独立，正文有确定高度的独立滚动区
- 正文、损失/资源卡规则、XP详情、复盘正文/覆盖范围22；小节标题24；统计标签20、数值32；卡壳标题34。22正文名义显示约13.61像素
- 车队图/结束原因、损失统计、资源规则/经验、复盘/抢运卡牌按两栏阅读；所有原有内容保留，没有以隐藏规则腾空间，也没有新增折叠或JS步骤
- 回基地/再出发改为相对卡壳定位的独立操作槽，位于正文滚动区之外；卡壳底部预留116，按钮至少64高，关闭其延时入场，主次保持明暗区分
- 成功整理页头/摘要保留，卡牌与自动入库两栏各自滚动；右栏宽520，并为完成整理/智能整理预留独立操作槽，按钮至少64高；相关规则提示22
- 新布局只命中特定结算DOM，不命中普通奖励、入城补给条列、战斗舞台或基地页面

独立操作槽利用CSS定位包含块：失败卡壳relative，ovBody与doom-panel static；成功result-columns relative，含dep-foot的hub-card static。正文滚动容器在动作槽与其定位包含块之间，主操作不随正文滚走。实际浏览器裁切仍须确认；静态测试不能代替此项。

## 验证

完整输出：[r3-targeted-tests.log](r3-targeted-tests.log)。本轮命令：

`npx vitest run tests/terminal-result-readability.test.js tests/terminal-death.test.js tests/terminal-settlement.test.js tests/fresh-run-settlement.test.js tests/fresh-run-settlement-battle-summary.test.js tests/extraction-flow.test.js tests/extraction-recovery-ui.test.js tests/extraction-settlement.test.js tests/extraction-preview.test.js tests/exp003-extraction-pocket-copy.test.js tests/entry-supply-presentation.test.js tests/event-scene-readability.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot`

- 14文件94项通过；包含新结算CSS/DOM契约6项，R1/R2阅读层、入城隔离、真实失败资源/抢运/XP/复盘、终局幂等/重试、紧急撤离与成功入库/恢复
- `npx eslint tests/terminal-result-readability.test.js` 通过；PostCSS实际解析通过；`git diff --check` 通过
- 没有全库测试、build、浏览器/服务操作、暂存/提交/推送；不是冻结index回执
- 图片和输入指纹：[r3-verification-summary.json](r3-verification-summary.json)。该CSS包含其他已完成属地，SHA256表示本轮验证时的整文件输入，不能据此认领其全部改动

## 当前窗口待核

1. 下轮真实失败：标题、完整损失/安全格/资源卡规则、复盘和抢运卡都可读；正文从顶部滚到底，回基地/再出发在两端和中途均稳定可见、不被正文遮住
2. 无安全卡与多卡抢运两态核查，长卡名/伤害来源不横向溢出；不以卡面小字代替全部正文规则
3. 回基地/再出发仍进入原流程，不重发奖励；新页离开后不残留动作槽
4. 成功撤离整理：多卡/满仓/剩余0卡时，左侧卡牌和右侧规则独立滚动；完成/智能整理稳定可见，未入库将丢失提示和确认仍准确
5. R2成功结尾两行动仍可达；普通入城补给和战斗舞台未受新选择器影响
