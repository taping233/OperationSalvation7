# 共用献祭选择框与撤离账目排版

已完成未提交。献祭选择器采用统一五列卡牌、可读提示和始终可见的操作条；撤离自动入库账目改为标签与说明两列，避免“消耗区”拆字。实际浏览器验收由父任务在第三局祭坛继续完成，本记录不宣称视觉或真实滚动输入已通过。

## 修改边界

- 生产文件仅 `game/css/expedition-rewards.css`，两个作用域：`.card.discover:has(.sac-hand)` 与 `#exMain.result-pg .pk-row:not(.dep-row)`
- 献祭框逻辑尺寸1480px宽、94%高；候选五列240px、间隔28px，卡面和原选择按钮同宽；标题32px、提示与操作22px、按钮至少64px高；只让候选网格滚动
- 费用角标、已选轮廓、键盘焦点保留；仍由原 `sacPick` 按钮处理选择，没有添加放大或更改点击逻辑
- 撤离账目标签保持单行，说明列允许缩窄换行；排除左侧 `.dep-row`，保留初始攻击的长说明布局
- 新增 `tests/sacrifice-layout-readability.test.js` 六项静态合同；未修改 JavaScript、玩法、费用、保护区筛选、研究所、全局按钮、通用发现弹层或全局缩放
- [精确补丁](layout-only.patch) 以本次修改前工作树为基线，不包含此前R3及其他会话增量；[字节校验回执](receipt.json) 确认去掉本轮新增CSS后与前快照完全相同，`game.run.altar.js` 指纹未变

## 已验证

- 四文件定向25项全部通过：[测试输出](tests.log)。包含新CSS合同、既有终局结算阅读、安全格献祭和撤离流程回归
- 全项目Acorn语法扫描425文件通过：[输出](syntax.log)
- 新增测试文件ESLint通过：[输出](lint.log)，空输出且退出码0
- 文档守卫461相对链接通过、无发现：[输出](docs-check.json)。该守卫按既有边界不扫描evidence目录
- PostCSS由新合同测试解析实际样式文件；CSS布局合同不能代替浏览器排版结果

## 待父任务实页核验

在当前内置浏览器窗口检查祭坛与紧急撤离选择器的五列布局、卡面与命中区域、已选状态、候选滚动、取消回流及操作条；检查撤离右侧四类账目标签与长说明。现有JavaScript每次选择都会重绘候选区，第二屏点击后的滚动保留需实测，本次CSS授权未更改该行为。

未运行浏览器、build、全量测试、提交或推送。原始截图参考父任务证据 `2026-10-16-WF-cloud-play-eight-hours/screenshots/50-emergency-sacrifice-candidates.png` 和 `51-success-settlement-after.png`。
