# 选档返回按钮取消框形和阴影

老板要求取消选档页返回按钮框形和阴影。当前启用样式为 `game/css/page-slot-select.css`，仅覆盖 `.slot-page .ak-back-tl` 的正常与hover背景、边框、阴影、裁切，并隐藏内框伪元素。

2026-10-10，Codex内置浏览器 http://127.0.0.1:5200/ 当前窗口，真实输入进入城市→选档→返回主菜单。样式实核：border 0px、background透明、boxShadow none、::after content none；返回主菜单通过、error零条。截图 after.png。自有diff检查通过，纯样式未跑Vitest、未build、未提交。
