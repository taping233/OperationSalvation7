# 照相馆进入准备优化

2026-10-24，Friday。老板反馈每次进入稍卡，偶发丢失过场；本轮只调整入馆准备和照片墙挂载调度，完成未提交。

- `game/src/ui/page-loading.js` 支持目标页准备回调，与场景图、页面背景和字体并行等待，仍等全部完成或既有超时后揭幕。
- `game/src/hub/game.cardslib.js` 把照片准备交给上述并行等待，过场完成后释放本次页面的延后工作；关闭或换页后旧回调不能释放新页面。
- `game/src/hub/game.cardslib.page.js` 主动挂载并赋首屏照片图源，绕开等待观察器首拍；扩大窗口挂载与远处空壳追加延到过场结束，避免与动画争用帧。既有2200ms照片等待和980ms演出时长不变。

验证：

- `npx vitest run tests/page-loading.test.js tests/photo-page-lifecycle-audit.test.js tests/card-library-lazy-boundary.test.js tests/photo-art-warm-audit.test.js`：4文件35项通过；新增覆盖并行等待、过场期间暂停远处挂载、旧页面回调及主动首屏加载。
- 对上述三个源码及两个修改测试的定向ESLint通过。
- 当前Codex内置浏览器、当前窗口、复用127.0.0.1:5200：首次进入及两次关闭重进，确认创建独立过场；揭幕时存在`transition-handoff-rich leaving`、插画无fallback、首窗79格；结束后遮幕释放、照片墙282格、16张已赋图源。未作多尺寸、慢网络或耗时对照，不据此承诺偶发现象完全消失或具体提速比例。
- 实页截图为`gallery.png`。工具返回的揭幕截图显示相机插画与照相馆标题；结束截图保存本目录。
- 控制台仅见既有howler音频池warning，本轮未处理音频。

无新服务、无build、未提交或推送；原5200服务保留。
