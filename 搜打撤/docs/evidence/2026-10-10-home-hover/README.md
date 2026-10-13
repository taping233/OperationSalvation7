# 主页悬停过渡柔化

老板确认反馈范围为鼠标悬停和移开主页选项。位移从 260ms 调整为 400ms，使用平缓曲线；渐变高亮改为独立装饰层，以 opacity 在 400ms 内淡入淡出，避免 background-image 突变。按钮命中区保持固定，键盘 focus-visible 共用高亮，减动效沿用现有关闭规则。

保留本文件既有左侧阴影和右侧深蓝底色改动。本轮仅改 game/css/home-polish.css 的悬停规则，以及 game/src/ui/home-fx.js 的装饰层挂载。

验证：ESLint 通过；home-menu-motion、home-async-lifecycle、contracts、architecture-boundaries 四份测试共 42/42 通过；目标 diff --check 通过。

2026-10-10 Codex 内置浏览器，http://127.0.0.1:5200/，当前窗口 1280×720，复用 ZCode PID21616 服务。使用浏览器输入接口移动鼠标，未构造 DOM 事件：设置按钮悬停后 opacity=0.999585、移开初期 opacity=0.991541（非直接归零），先前移开后的稳定状态 opacity=0、transform=none；主按钮进入初期 opacity=0.00842565，稳定右侧位移为 -6px。快速扫过右侧选项再移出后无残留 hover。截图 hover.png 显示设置按钮高亮、文字与底层顺序正确；浏览器 error 日志为空。

已完成未提交。未运行全量测试或构建；此次未测 FPS，不据此断言渲染性能改善。无自建服务。
