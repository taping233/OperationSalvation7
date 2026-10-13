# 已验证补丁接入

2026-10-13，Friday 子代理 integrate_verified_fixes。老板确认此前工作结束并允许本会话全部占用后，将四线试玩已完成的 G01–G12 修复接入共享 `搜打撤` 工作区；未提交。

## 接入核对

- 来源为 [四线修复说明](../2026-10-13-WF-four-player-fixes-1013/README.md)及其 `core-fixes.patch`、`ui-fixes.patch`、`patch-manifest.json`。
- 接入前 34 个路径全部匹配 manifest 的源 SHA256：27 个既有文件、7 个待新增文件。两份补丁自身 SHA256 也与 manifest 一致，相关未提交 diff 已核对，无需覆盖或重基。
- 在仓库根目录使用 `git apply --check --directory=搜打撤` 后应用两份补丁。接入后 34/34 个路径原始字节 SHA256 完全匹配候选。详见 [接入指纹](integration-sha.json)。
- 首次在 `搜打撤` 子目录直接执行 `git apply` 时 Git 静默忽略无该目录前缀的补丁；新增文件检查立即发现没有应用。已改为上述根目录加 directory 参数，按最终 SHA 核实实际接入，不将最初退出码作为接入证据。
- `git diff --check` 通过；34 路径中的 JavaScript 定向 ESLint 退出码 0，见 [ESLint 输出](integration-eslint.log)。

## 回归结果

[有效定向报告](integration-verified-tests.json)及[控制台原文](integration-verified-tests.log)：24 个文件，246 项通过，1 项既有失败。6 份新增 four-player 回归文件的 24 项全部通过。范围包含事件/复原动作与退出时序、地图视口复位、宝箱存档恢复、背包容量、格挡到期、附加效果原目标、首脑补给、规则描述、音频回退，以及邻近存储/战斗/动效与架构契约。

唯一失败为 `tests/sound-music.test.js:96` 的 `pauses immediately when muted/hidden and fades back in without a second decode`：断言静音后不调用 unload，当前实现实际卸载 1 次。它与来源任务 `final-target-tests.json` 及 `baseline-existing-failures.json` 中的既有失败一致，本轮未修改这项无关行为或断言，不算通过。

初次沙箱内运行因依赖 `node_modules/vitest/dist/spy.js` 的 realpath 报 EPERM，0 项测试实际执行；[该无效报告](integration-tests.json)虽然写出 `success:true`，仍按退出码 1 和空断言判为未验证。随后同一测试范围经自动审批在沙箱外执行，以上有效报告来自该次运行。

## 交接边界

补丁接入与指纹核对完成后已释放全部 34 个源码/测试/文档路径，主代理及其他子代理可继续本轮远征体验整改。后续改动以其新的证据为准；本报告中的完整候选 SHA 是释放时状态。

本子任务未改 REGISTRY/PENDING，未启动服务、浏览器或 build，未安装、删除、提交、推送或发布。实页、听感、完整通关及本轮整体文档守卫由主任务按其实际范围验收；此处不将来源任务的隔离实页证据冒充共享版本的新实页通过。
