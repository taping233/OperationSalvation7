# 本地交互诊断接入验证

新增默认关闭的生产可选诊断入口与已有离线录屏工具对时支持。它提供取证路径，不是性能提升结论。

## 范围与基线

- 独立小副本修改：game.boot.js 开关、新 runtime-trace.local.js、video-review.mjs 可选参数、新 runtime-trace-alignment.mjs、对应测试与说明文档。
- 来源是当前工作树字节；本地Git HEAD 2749272仅是同步基线，不能作为最新发布版本声明。
- 修改前 game.boot.js SHA256：407b4e68839a764bc784acc10082e9ff9b05564f4337e1999d21c0a599b91ac9。
- 修改前 video-review.mjs SHA256：9f3b8f2ce02ca1306e82f79a906d7f3ca9ff340e0dbafc90b5108ec1ed99bde9。

## 已执行

- 三个测试文件19项通过：runtime-trace.local、runtime-trace-alignment、原有video-review。
- ESLint：新增采集器、对时模块、修改的离线工具、两份新测试通过。
- 新采集器独立 esbuild ESM minify 通过，约5.5KiB；不是完整游戏生产构建证明。
- 用2秒纯黑合成webm、显式sync标记、长任务合成数据执行CLI端到端：产出HTML/JSON，4个采样、覆盖0–2秒；单调时轴1000ms标记人工指定0.5秒后，1300ms事件对应0.8秒。合成输入不是真实用户录像，不是游戏FPS证据。
- 普通开关关闭无监听/rAF、白名单过滤与400条上限、拖牌起止、页面隐藏取消rAF、pagehide停止、显式下载/清空、长任务API降级、对时标记缺失/重复/超限均有定向测试。

## 待验收

未发布，未操作浏览器，未对真实游戏作体验/性能结论。集成后由负责人用当前私有Site正常打开 `?runtimeTrace=1`，执行切页/合法出牌、停止并下载，核验部署版本、实际UI事件与完整录屏。完整游戏构建/质量门由集成批次执行。新的诊断文档见 `../../runtime-trace.md`。
