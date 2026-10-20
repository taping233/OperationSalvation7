# 已有质量工具驱动的重复逻辑精简

jscpd 实测定位内部性能采样脚本中的两组重复实现，已将战斗测量前等待和基地重新出发分别收敛为同一闭包内的函数。`runDrive` 与 `driveBoss` 仍保留各自停止原因、编组选牌分支与结算调度；不改游戏运行代码和动态入口。

## 实际结果

- 基线：9b0fe799 完整快照；隔离目录 `work-quality-tools-9b0fe79`，未修改集成目录。
- 已有 jscpd 5.4.1，使用现有 `tests/tools/redundancy-report.json`、原阈值（70 tokens / 6 lines），对 scripts 的可识别 JavaScript 文件分析：52 个来源；重复组 2 → 1，重复行 27 → 13，重复 tokens 298 → 107。源码净减 5 行。
- 剩余组是两个推进循环的结算分支与下一步处理。保留其上下文控制流，不为归零指标继续扩大重构。
- 原配置含工具不识别的 `workers` 字段，jscpd 提示 warning，但输出完整 JSON 且退出 0；命令行显式指定单 worker。没有修改配置或提高阈值。
- 已实际跑 `npm run quality:unused`：Knip 报出 57 条 unresolved、6 条 Electron unlisted、2 条系统二进制引用；未报 unused exports/files。多数 unresolved 来自历史证据复制的测试相对路径。没有把报告当成删文件或删动态挂载入口的依据，未更改其忽略项。

完整定位和源文件指纹见 [clone-comparison.json](clone-comparison.json)。未新增依赖，未改 package/锁文件，未删除文件。

## 定向验证

- 新增 `tests/perf-ledger-drive.test.js`：8 项通过。用 Acorn 提取原脚本 `plInstall` 函数，在独立 Node VM 中执行；只模拟 Agent、快照和计时，不执行 CLI、不启动浏览器。
- 同时覆盖普通与首脑推进：busy 轮询后缓冲/turbo 关闭顺序、缺失快照时最多 40 次轮询、基地部署动作及 500/700/1500 ms 等待、结算先走 greedy 再部署。
- 新测试 + contracts + architecture-boundaries + scripts-contract：4 文件、103 项通过。
- 两个变更 JS 文件的 ESLint 通过；`node --check scripts/perf-ledger-capture.mjs` 通过。
- 额外运行 docs-consistency：3 项通过、2 项失败。失败仅为隔离副本父目录未带入 `AGENTS.md`、`NovelAI生图功能手册-AI接手版.md`，导致既有 docs/README 和 asset-audit-debt 的父目录链接不可达；没有改这些入口，未宣称文档全门通过。新增证据链接及 JSON 已人工核对。
- 这里保留原逻辑：40 次轮询未就绪仍继续返回，未把本次去重改成新的超时语义。

## 边界

本轮仅内部工具逻辑去重与定向契约测试，不运行全量测试、build 或外部浏览器/CDP。没有宣称真实游戏实页或实际采样性能通过。隔离快照无 Git 元数据，`npm run handoff` 因 git rev-parse 无仓库而阻塞；按派工约束不改共享 PARALLEL-REGISTRY，归属与交付在本证据记录。未提交或推送。

## 完整结构集中复核

本批 doctor 预检、性能脚本去重及卡牌容器尺寸更新在完整源码结构集中运行：13 文件 190 项全部通过，包括 workflow-doctor、workflow-cli-integration、workflow-tools、workflow-staged、workflow-dependencies、perf-ledger-drive、contracts、architecture-boundaries、scripts-contract、docs-consistency、card-browser-resize、card-browser、card-browser-state。独立副本中父目录或 Git 缺失导致的守卫失败在完整结构没有重现。本项是定向自动检查，不是全量 CI 或真实浏览器结果。

集成同时复核此前手势补丁的资产消费者边界：`battle.layers.js` 相对原基线仅把 `handHit?.sync(handBattleToken)` 改为传入 `getSnapshot()`，并加两行说明。将此精确片段还原后，其余字节与原基线完全一致，资产路径、选择器与动态构造均未变。因此仅更新 runtime-asset-redundancy-review 中该文件的 opaqueConsumer SHA256，从 `1f438814d23f7f60a555f6369bf013cb12366c5763b5636696c4c6f790491127` 为 `91c6774633ae0dcaca7ca162b1188ba64e281ee3e3e8f0c15064ff6f0c660d3c`；不改候选、阈值、manifest 或其他消费者。变更前检查明确警告未审查消费者并保留全部195项资源，不能直接忽略该阻塞。

依赖恢复并切换到独立可信安装后，本批与此前四组一起去重集中复核：35 文件 486 项通过、无跳过；20 个变更 JS 文件 ESLint 与语法检查、docs:check 通过。资源哨兵包含 runtime-asset-redundancy 和 retired-scenes-publication；当前排除集恢复为195，警告为空。原17文件 index tree `96b9df3c7abffc3453b9e5d45ef8b49cd83af4d0` 未改变，新增13文件保持未暂存，不把计划预检当作冻结验收通过。没有运行全量、构建、提交或发布；真实页面仍未验。
