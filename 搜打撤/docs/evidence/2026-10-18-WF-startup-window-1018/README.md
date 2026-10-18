# 桌面启动死锁与加载窗口修复

2026-10-18，代码提交 f373954ad9bb983ac5c8d49836ca57100e28dc57。标题页已就绪却未发布 body 状态，使 Electron 一直等待 startup-ready；修复在初始化完成时立即发布状态，保留标题遮挡地图循环的省电逻辑。

加载窗改为同一显示器工作区居中的普通小窗，限制尺寸以适应较小工作区；增加原生拖动区域，重试与退出按钮保留点击。真实 DOM 就绪后保留双帧发送，缺帧时 250ms 兜底；15s 未初始化成功则显示失败重试。

验证：真实启动回归先失败、修改后通过；独立真实 main.js 探针确认原实现四次循环仍未发布状态，候选在首帧前发布 title。启动定向回归 4 文件 48 项通过，ESLint 与语法检查通过。完整冻结门结果：

- Test Files  614 passed (614)
- Tests  6020 passed | 16 skipped (6036)
- Duration  367.00s (transform 8.86s, setup 0ms, collect 121.69s, tests 547.98s, environment 561.60s, prepare 88.98s)

[独立前后观测与诊断](diagnosis.md)；[完整门摘要](integration/full-gate-summary.json)；[冻结输入](integration/build-inputs.json)；[EXE 校验](integration/exe-verification.json)。

交付 Windows x64 portable 单文件 EXE：.tmp/startup-fix-1018/delivery/搜打撤-代号7.exe，287812412 字节，SHA256 605f7ff6a99a3be2a2c1f2c000001e653d98b48b632f8bdc9393d5af5c3ac155。复用本机锁定的 Electron 44.1.0 和离线工具，无依赖安装、签名、推送或发布。包内原生启动文件、游戏文件、运行时及本地引用已校验；源码来自 a39866285f 不可变 Git 对象与八个自有改动，排除其他会话在途文件。二进制及超过 1MB 的原始门报告只保留本地，路径、SHA 与获取方法见 [本地产物](integration/local-artifacts.json)。

Vite 编译成功；标准 postbuild 仍因原有五项体积预算超标返回 1：构建 202.85MiB、重复资源 9.94MiB、入口 gzip 325.6KiB、首屏 JS gzip 371.1KiB、CSS gzip 214.0KiB。阈值未调整，本包为修复候选，未宣称体积门通过。

遵照老板停止实玩的要求，本轮未启动浏览器或游戏 EXE，也未验证原生桌面上的实际位置、拖动和冷启动时长；自动化覆盖模块初始化、IPC 生命周期、定位参数与拖动声明，不能据此给出真实加载秒数、FPS 或内存结论。
