# 牌库与消耗牌共用查看页可读性

本增量在 R7 完整验收之后实施，不能计入 R7 的全量覆盖。只修改 `game/css/battle-hand-overhaul.css` 的 `data-decision-kind="pile"` 限定规则，新增 `tests/battle-pile-readability.test.js`。既有牌库有效卡逻辑、复原及珍珠盒实现保持原状。

## 变更

- 专属壳宽 `min(1680px,94%)`、高 94%；中部承担滚动，页头及返回页脚保留在外
- 当前 1920×1080 逻辑画布可容三列 320px 卡格；原卡面和动作数量保留
- 规则 24px、页标题 34px、元信息 22px、返回按钮至少 64px 高 / 24px 字；在本轮 1188px 窗宽下，规则字约 14.85px、卡格约 198px、返回高约 39.6px
- 右侧规则保留 sticky；长文本在中部右栏有界滚动，正文换行不截断。卡片提供 scroll-margin、滚动区提供 scroll-padding
- ≤900px CSS 媒体条件下右栏转单列/静态/自然高度，卡格及按钮最大宽度受父容器限制；本轮没有另开浏览器尺寸

## 定向反馈

[测试日志](targeted-tests.log)：5 文件、48 项通过，包含新样式/模块契约、牌库详情、战斗工具往返生命周期、复原和珍珠盒回归。新增测试 ESLint 与自有 diff-check 均通过。完整命令、源码 SHA256 和覆盖边界见 [summary.json](summary.json)。

测试仅证明静态规则及模块结构/交互；jsdom 不证明像素布局或原生滚动/Tab。当前窗口内置浏览器验收由父会话执行，本任务没有打开浏览器、启停服务、操作真实存档、运行 build 或全量。

参考原实机：[牌库改前截图](../2026-10-16-WF-cloud-play-eight-hours/screenshots/81-boss-effective-deck-details.png)。
