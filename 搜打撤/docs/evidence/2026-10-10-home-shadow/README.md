# 首页左侧按钮底部阴影

在 `game/css/home-polish.css` 中为左侧“进入城市”和“生存指南”添加两层向下投射、收窄边缘的柔和阴影。

- 实页：Codex 内置浏览器 `http://127.0.0.1:5200/`，当前窗口首页，HMR 后截图核对。[效果截图](home-shadow.png)。
- 计算样式：`mStart` 与 `mGuide` 均为 `rgba(3,8,14,.7) 0px 10px 12px -7px, rgba(3,8,14,.55) 0px 4px 5px -3px`。
- 已捕获浏览器 error 日志为空。目标 diff whitespace 检查通过。
- 本轮仅验默认状态外观，不涉及交互行为；未运行 Vitest、构建，未提交。
