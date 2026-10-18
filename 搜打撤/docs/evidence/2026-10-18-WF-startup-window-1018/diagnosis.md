# 启动窗口与就绪握手诊断

记录时间：2026-10-18。启动卡住的确定原因是标题页没有发布桌面 preload 所需的 DOM 状态；窗口不居中、不能拖动另有各自的配置原因。本报告记录源码审查与 Node/jsdom 证据。

过渡窗原设定同时包含 `width: 880`、`height: 540` 和 `fullscreen: true`，全屏配置使固定尺寸小窗与居中要求无法成立。候选改为普通小窗，按游戏窗口所在显示器的 `workArea` 计算位置，并在工作区较小时限制尺寸；负坐标、任务栏占位采用同一套工作区坐标。

过渡窗同时使用 `frame: false`，页面却没有原生拖动区域，因而缺少可拖动表面。候选将 `main` 设为 drag 区域，操作区和按钮设为 no-drag，以保留重试、退出的点击入口。游戏主窗口的全屏行为不在这两项修复范围内。

启动死锁发生在就绪握手之前：真实 `showTitle()` 已把游戏状态设为 `title`、显示标题并绑定按钮，但没有同步 `body.dataset.state`。`game.boot.js` 的循环在标题或退出屏可见时提前返回，写入 body 状态的代码位于返回之后。隔离 preload 要求 body 状态非空、非 `boot` 且标题按钮已绑定，故始终不发送 `startup-ready`。旧 4500ms 切幕兜底仅在收到 ready 后才开始，无法解除此等待。启动资源预取没有在这条标题就绪链上被 await；本次证据不支持把资源解码慢或隐藏窗口缺帧作为该死锁根因。

同一真实 `main.js` 启动夹具的前后观测如下；原版和候选均执行四次真实循环帧，每次等待 275ms 让既有空闲调度继续。

| 观测 | 原实现 | 候选 |
| --- | --- | --- |
| DOMContentLoaded 后游戏状态 | `title` | `title` |
| 标题可见、controlsBound、lobby | 均已成立 | 均已成立 |
| 首次循环前 body 状态，loopTicks=0 | 未定义 | `title` |
| 四次循环后 body 状态，loopTicks=4 | 仍未定义 | `title` |
| 独立探针结果 | 1/1，通过代表成功观察原缺陷 | 1/1，确认候选及时发布状态 |

候选在启动调用 `showTitle()` 完成后立即同步 body 状态，无需等待首帧，也保留标题遮挡时的省电返回。桌面 bridge 保留双帧发送路径，并增加真实 DOM 条件成立后的 250ms 兜底；主进程增加未收到 boot 就绪信号时的 15s 失败重试入口。交叉审查覆盖了成功、失败、重试、关闭、旧 loadURL 拒绝及 preload 取消后的晚回调，未发现阻塞本次冻结的问题。

原字节、探针、配置、前后观测及命令结果见 [baseline/README.md](baseline/README.md)、[原观察](baseline/observations.json)和[候选观察](baseline/candidate-observations.json)。原命令摘要从已捕获工具输出转存，候选保留完整 stdout/stderr；源码 SHA 分别记录在原观察和 [candidate-source.json](baseline/candidate-source.json)。

本片未修改共享生产或测试，未实玩、未启动浏览器或 EXE，也未验证原生窗口的实际居中、拖动或点击。jsdom 使用 canvas/audio/fetch 环境桩，不覆盖 Electron 原生 GUI、GPU、字体呈现或真实冷启动耗时，不能据此给出加载速度数值。构建、完整冻结门与最终包结论由主代理另行补证。
