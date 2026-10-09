# 只看壁纸隐藏右侧遮罩

2026-10-09，Friday / Codex。`game/css/title-p0.css` 增加壁纸模式下 `.home-slash` 的 `visibility: hidden`，隐藏斜切遮罩及描边；恢复界面时恢复原样，保留既有壁纸素材改动。

验证：`npx vitest run tests/title-wallpaper.test.js --reporter=dot` 5/5 通过；首次沙箱执行被依赖 realpath 的 EPERM 拦截，正常权限重跑通过。定向 diff 检查通过。

Codex 内置浏览器访问 `http://127.0.0.1:5200/`，当前窗口、群像壁纸。真实点击“只看壁纸”后遮罩计算样式为 hidden，截图确认右侧斜切层消失；真实点击“恢复界面”后为 visible，页面 error 日志0。未扩展其他页面或尺寸；未构建、未提交；复用已有服务。

截图：[wallpaper-only.png](wallpaper-only.png)，由本次内置浏览器当前窗口获取。
