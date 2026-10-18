# 收官记录

本轮五处运行时优化已实施、复核并提交，代码提交为 `828563a306126e2ac69ef0304d630abaf86f8f3a`，父提交为 `a3df7fabb1b6075d5197eae30be3f17c01031ecb`。提交范围是六个生产文件、五个新回归和一份资产消费者指纹；未提交或构建其他会话的事件、卡牌与美术改动。证据提交单独收官，未推送。

冻结 index SHA256 为 `e502f82bd481594c597de70c1a0cc0404f5d6df691820fbd04fd30b8491ac4e2`。全量门覆盖 614 个测试文件，6011 项通过、16 项跳过；语法、数据、类型与 lint 通过。原 Git 钩子核对并复用了该精确 receipt，没有绕过。命令结果、输入摘要及完整报告路径/SHA 在 [code-commit.json](integration/code-commit.json) 和 [full-gate-summary.json](integration/full-gate-summary.json)；大于1MB的原报告保留本地，不进Git。

首次冻结门因新增整备测试的三处 `HTMLTemplateElement` 未限定全局而拒绝，未执行后续全量测试。主会话改成 `window.HTMLTemplateElement`，该文件15项回归和 ESLint 通过后重新冻结并完成全量。旧失败报告仍本地保留并登记在 [local-artifacts.json](integration/local-artifacts.json)。

EXE 构建快照保持原字节，后补的测试限定名不进入游戏包。六个生产文件和审查文件与提交在 Git LF 规范化后逐文件相等，见 [release-commit-equivalence.json](integration/release-commit-equivalence.json)；[build-inputs.json](integration/build-inputs.json) 与 [code-inputs.json](integration/code-inputs.json) 分别锁定封装与最终提交输入。

标准隔离 `npm run build` 的 Vite 编译、资源复制和发布完成；postbuild 因原有五项预算失败而退出1，阈值未改变：包体202.85MiB/112MiB，重复资源9.94MiB/0.88MiB，入口gzip325.6KiB/270KiB，首屏JS371.1KiB/310KiB，CSS214KiB/136KiB。启动资源6/40通过。这些结果与便携 builder、包内完整性核验分开记录，交付为测试版。

本轮便携 EXE 为 `搜打撤/.tmp/deep-perf-1018/delivery/搜打撤-代号7.exe`，287,818,619字节，SHA256 `560493f3442f46cdcd6bcea0f26cf074f025b125c63861dd1c2c512729151ed8`。内置 Windows x64 Electron 44.1.0；封装、PE/ASAR、1526个游戏文件字节及本地依赖核验均通过，见 [EXE 说明](desktop-exe/README.md)。二进制不进Git。

测量与未覆盖边界：遵照老板指示，本轮未继续浏览器实玩或原生 EXE GUI；不声称真实FPS、GPU、显存或RSS收益。整备首开与战斗25卡的部分CPU/尾部指标未改善，完整样本保留。远端CI未推送核验。未新增浏览器、端口或后台服务；封装会话18867已退出0。既有5319预览沿其原登记保留。
