# Windows 便携测试版

本地交付文件：`搜打撤/.tmp/deep-perf-1018/delivery/搜打撤-代号7.exe`，287,818,619字节（约274.49MiB），SHA256 `560493f3442f46cdcd6bcea0f26cf074f025b125c63861dd1c2c512729151ed8`。复制这一个文件即可取得内置运行时的便携包，构建目录不需要一同交付。文件保留本地，不进入Git。

主会话使用现有权限执行 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .tmp/deep-perf-1018/run-exe-builder.ps1`，会话18867退出0，再运行 `node .tmp/deep-perf-1018/verify-exe.cjs` 退出0。全部复用本机 Electron 44.1.0、electron-builder 26.15.3、NSIS/7zip缓存；没有安装、下载、签名或发布。先前子代理受限版本检测未进入builder，错误提权等待已结束，没有重复封装进程。

封装核验：外层NSIS为PE x86、内层Electron为PE x64；7份ASAR启动文件与快照相同，13份运行时资源、55份locale及1526份游戏文件共212,699,644字节逐文件一致；HTML/CSS/JS本地引用分别13/170/69，无外部生产依赖。详见 [exe-verification.json](exe-verification.json) 与 [builder-result.json](builder-result.json)。

源来自不可变父提交加十二个自有补丁，生产文本与最终提交相等；测试限定名的后补差异不进入游戏包，证明在 [release-commit-equivalence.json](../integration/release-commit-equivalence.json)。原有五项包体预算仍失败，阈值未改；标准构建日志见 [build-game.log.txt](build-game.log.txt)。

按本轮要求未打开EXE实玩，也未测原生存档、音频/GPU或设备帧率。以上是封装和静态完整性核验。
