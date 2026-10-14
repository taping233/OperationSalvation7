# 云端修复的真实上游接入

固定补丁已在真实上游 `db831272780b8d0c792e93b9661404b5ee68e5ab` 的专属隔离分支通过 `git apply --check --index` 并应用。交接提交仅用于取出原始 blob，不合并交接分支或云端人工历史。补丁来源、601638字节与SHA256、93路径、原稿指纹及工具版本见 [来源核验](provenance.json)。原工作区四份未提交改动与1774个未跟踪文件保持原位，不进入本轮 index。

隔离依赖已按新锁从官方 npm 注册源安装；未运行 npm audit。Windows Node24.13.0、Vite6.4.4 的生产编译成功，postbuild 因原有四项预算超限退出1：[构建记录](build-summary.json)列实际数值，未提高阈值，重复资产预算通过。不将生产编译成功表述为完整构建门通过。

`art-manifest.js` 由这一完整已跟踪仓库的真实构建生成，未导入云端精简扫描文件；前后条目、文件可达及等字节别名覆盖见 [生成清单核验](art-manifest-comparison.json)。旧档原始字节与清单吻合，pre-commit在真实index中为100755。

本记录当前只确认接入、锁定依赖与编译/预算边界。真实暂存隔离门、正常提交推送、原master快进及实页采集结果按随后证据和最终交付补记；不复用云端通过报告作为本地收据，不把测试等同视觉验收。

首轮真实暂存隔离门的静态、数据、8组类型与lint通过；362文件中361通过，3125测试通过、2失败、16跳过。失败仅在端口预检：Windows允许通配监听与具体地址绑定共存；本机IPv6可绑定但在运行脚本前直接TCP、无代理HTTP都返回EACCES，不能将HTTP失败误记为监听器被杀。原失败收据保留为相邻 `2026-10-14T05-34-12.913Z-82bed44c-staged.json`，不作为通过证据。

接入补验增加IPv4数字loopback连接保护（CDP实际使用IPv4），连接成功即阻断；仅明确拒绝连接才继续，访问错误及超时失败关闭。绑定验证覆盖IPv4/IPv6的通配与loopback地址，不依赖平台命令，仍仅关闭本脚本创建的socket。Windows行为依据见 [Winsock说明](https://learn.microsoft.com/en-us/windows/win32/winsock/using-so-reuseaddr-and-so-exclusiveaddruse)，本机定向诊断见 [原始观测](port-native-diagnosis.json)。

存活夹具使用自有无代理HTTP agent，并在运行脚本前选定观测方式。HTTP原本可达时事后不可达必须失败；只有本机IPv6起初即EACCES时，独立核对操作系统TCP表中的准确地址、端口、Listen状态和自有PID。全部占用断言保留，新增关闭自有监听器后存活证据必须消失的反向断言。该路径证明监听器保留，不代表IPv6 HTTP已可达；没有跳过Windows用例、修改防火墙或全局代理配置。

端口与ship定向2文件23项通过、0跳过，目标lint通过；真实暂存完整门正在重新验证，尚未据此确认聚合通过或提交完成。
