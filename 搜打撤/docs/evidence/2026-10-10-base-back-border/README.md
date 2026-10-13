# 基地返回按钮同选档样式

老板要求基地返回按钮和选档返回相同。`game/src/hub/game.hub.js` 仅将返回按钮文字箭头换成选档相同的24×24 SVG；`game/css/base-camp.css` 仅取消返回按钮边框、裁切及hover底色和阴影，保持图标居中。

2026-10-10，Codex内置浏览器 http://127.0.0.1:5200/ 当前窗口，真实输入进入城市→档位01→基地→返回选档。计算样式border 0px、shadow none、透明背景，SVG包含同款两条path。返回选档成功，error零条，截图after.png。

`npm run test:target -- tests/hub-flow-regression.test.js` 7项通过；自有diff检查通过。无新服务、未build、未提交。该源码和基地样式已有其他完成改动，本次仅增补返回按钮。
