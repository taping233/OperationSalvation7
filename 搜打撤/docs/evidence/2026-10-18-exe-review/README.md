# 转发后资源失败与崩溃：EXE审查

2026-10-18，Friday / 01a14f4c。老板要求重新审查代码和已交付EXE；补充故障发生在进入游戏后，对方Windows版本未知。本轮只读审查生产源码，未修代码、重打包或覆盖EXE。

审查对象：`.tmp/exe-refresh-1018/delivery/搜打撤-代号7-20261018-换肤修复.exe`，326032977字节，SHA256 `c8cd0c4f83750f4e6a77bc8ba9b46dd68f0cd579a3b9c7a64bd27c16a2746c4e`。实际载荷提取到`.tmp/exe-review-1018/extracted/`，而非继续用原解包目录代替EXE核查。主进程、启动窗口、预加载、资源协议四文件与当前源码字节一致。

## P1：重复启动同一便携EXE会破坏正在使用的资源目录

打包配置`desktop-app/package.json:49`没有指定`portable.unpackDirName`。本机锁定的electron-builder实现`desktop-app/node_modules/app-builder-lib/out/targets/nsis/NsisTarget.js:243`在构建时生成固定KSUID作为`UNPACK_DIR_NAME`；模板`templates/nsis/portable.nsi:33`使用`$TEMP/<该名称>`，启动前及子进程退出后均递归清理该目录。名称为每个包生成，非每次启动生成。

直接读取已交付EXE的NSIS头部并解压后，确认其字符串表含固定目录名`3Ks4uz7SIbkMFwZ4XJSGFwA0lwG`，与实际启动路径一致。`desktop-app/main.js:93`的Electron单实例锁发生在启动器解压之后；第二实例退出还会触发第二启动器的收尾清理，因此单实例锁不能保护第一个实例的资源。

实际EXE实验：仅在自建`.tmp/exe-review-1018/portable-temp/`内，将TEMP/TMP指向该位置，使用`ELECTRON_RUN_AS_NODE=1`运行自有`hold.cjs`，不打开或控制游戏界面。第一个子进程保持运行并监测自己的`resources/game/assets/portraits/full/wu.webp`；第二次启动使用同一个EXE并让其子进程立即退出，模拟第二实例退出这一启动器生命周期。结果见[portable-race.json](portable-race.json)：

- 两个子进程的实际EXE路径相同，均使用上述固定临时目录。
- 第一个子进程最初可见立绘；第二次解压开始后立绘消失33033ms，重新解压后出现。
- 第二子进程退出时立绘再次消失；此时第一个子进程仍存活，`existsBeforeStop:false`。
- 随后通过自有停止标记结束第一子进程；两个启动器均退出0。PID23436/30744/32256/23816最终均不存在，无实验遗留进程。

这已确认重复启动会造成运行中资源丢失，足以导致随后加载图片或动态模块失败。没有运行真实游戏渲染器，因此没有把该实验写成“已复现对方全部崩溃”。若对方仅启动一次且没有临时目录清理，仍需另外定位。

修复建议（未实施）：将便携解压改为每次启动独立目录。当前锁定构建器的`portable.unpackDirName:true`会跳过固定目录定义，沿用NSIS每实例插件目录；修复后必须重复上述实际EXE重叠启动实验，并补真实游戏内图片和动态页面验收。

## P2：进入游戏后渲染器崩溃失去桌面监测

`desktop-app/startup-window.cjs:54`显示游戏窗口后调用`cleanup()`，其第84行移除了唯一的`render-process-gone`监听；`main.js`没有另装全生命周期监听、持久崩溃原因记录或恢复入口。资源协议错误也仅走`console.error`。因此游戏启动后发生崩溃不会经过启动失败处理，也缺少能随包回传的原因。这是故障处置/定位缺陷，不能据此认定它主动导致了崩溃。

修复建议（未实施）：将启动窗清理与游戏全生命周期故障看护分开，记录具体失败URL、渲染器退出reason/exitCode、GPU子进程退出与主进程异常，提供明确的重试或退出反馈。

## 已排查的范围

- 实际EXE成功提取，1912文件/646797265字节与原解包目录逐文件相同，差异0，见[payload.json](payload.json)。7z提示尾部附加数据来自该自解压文件布局，不作为损坏证据。
- 已提取资源的1475张位图逐张真实解码，失败0，见[images.json](images.json)；409处静态资源引用、19项别名，缺失0，见[asset-references.json](asset-references.json)。动态运行时路径未被该静态检查完全覆盖。
- 使用实际包内协议实现做600次请求、32路并发，其中200次主动取消，全部HTTP200、未取消响应字节一致，未捕获异常0。200条流中止日志均对应主动取消，未记作崩溃，见[protocol-stress.json](protocol-stress.json)。
- 未取得对方机器的实际失败URL、渲染器退出原因或崩溃转储；不把GPU、系统版本、内存或全部故障同源写成已证实结论。没有使用外部浏览器、CDP或headless游戏验收。

上次交付验证仅覆盖同目录产物、资源处理器和局部浏览器换肤，遗漏了实际便携启动器重叠运行；本轮补上了该证据。旧EXE保留，自有编辑/实验占用释放，未提交推送。
