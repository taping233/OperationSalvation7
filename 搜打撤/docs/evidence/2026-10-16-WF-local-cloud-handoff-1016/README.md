# 本地到云端交接检查：集成测试阻塞

2026-10-15 UTC。本轮只完成交接检查，未暂存、提交、推送、构建或打包工作区；没有修改游戏源码和测试预期。两个当前开发任务均已完成且空闲，当前集成基线仍有真实失败，不能记为可交接版本。

## 开发完成与稳定性

- 性能任务 `01a14050-f24a-78a3-a6f8-1987fe8a2adc`：116 项定向通过，源码和边界见 [性能报告](../2026-10-16-runtime-perf/README.md)。
- 战斗任务 `01a1404b-b9a5-7ab0-bca4-469824fac056`：170 项定向通过、当前窗口普通战胜利，见 [战斗交接](../2026-10-16-WF-battle-play-rewrite/HANDOFF.md)。
- 两任务的 25 条源码指纹匹配，见 [完成源码核对](completed-source-check.json)；其余源码/测试当前指纹见 [输入清单](stable-inputs.json)。不把任务空闲或工具的 ready 当作全库通过。

## 集成验证

`npm test -- --reporter=json --outputFile=...` 在当前工作树执行，不是冻结 index 的验收回执。

| 执行 | 通过 | 失败 | 跳过 | 结果 |
| --- | ---: | ---: | ---: | --- |
| 沙箱 | 3893 | 148 | 2 | 失败，包含临时 Git 写入/重命名和本地桩网络权限问题 |
| 正常受审查权限补验 | 3998 | 33 | 12 | 失败，退出码 1；17 个文件仍失败 |

精确失败名称与错误见 [正常权限摘要](full-test-unsandboxed-summary.json)。失败不全是文案或快照过期，不能批量改预期放行：

- `e4-async-entry.test.js` 11 项：职业选择渲染读取未定义的 `MAP.rules.playerMaxHp`；须核对入口契约与测试桩。
- `extraction-flow.test.js` 2 项：祭坛/撤离回调读取未定义的 `UI.el.ovBody`；须核对脱离页面后的回调契约。
- `boot.test.js` 5 项：地图几何和战斗选牌详情链与集成断言不符。
- `map-travel-path.test.js`、`node-retrigger.test.js`、`node-reward-state.test.js` 各 1 项：入城补给路径、节点状态和待领奖状态不符。
- `e8-card-inventory.test.js` 2 项、`m-batch-production.test.js` 1 项：`tt12-backupcell` 的描述变化超出原批准迁移清单。
- `bag-structured-use.test.js`、`base-hub-business-lifecycle-audit.test.js`、`departure-stack-lifecycle-review.test.js`、`nightshift-u10-teardown-guards.test.js` 各 1 项：消耗区/发卡说明和旧断言不一致。
- `runtime-asset-aliases.test.js`、`runtime-asset-redundancy.test.js` 各 1 项：新宝箱资产与原生产别名/冗余契约不符。
- `scripts-contract.test.js` 1 项：新增 `scripts/css-redundancy-audit.mjs` 未登记门禁测试映射。
- `ui-accessibility-regression.test.js` 1 项：战斗卡牌键盘/读屏契约的源码断言不符。
- `asset-audit.test.js` 1 项：当前工作树包含 91 张未登记图片，见下节。

定向任务通过不能代替本次集成失败的修复。旧任务不重新启动、不发消息；跨模块遗留修改需先核实设计依据和归属，不能为提交直接改游戏规则或弱化断言。没有执行提交钩子，也没有冻结 index 回执；build 与远端 CI 均未执行。

## 保留在本地的内容

- [素材审计](asset-audit.json)：91 个未登记候选，分别是 `game/assets/scenes/chests/{boss-rig-v1,class-rig-v1,large-rig-v1,medium-rig-v1,small-rig-v1}/` 的 86 帧，以及 `game/assets/ui/slot-weather/` 的 5 图。搜索正式 `game/src`、`game/css` 和 `game/index.html` 未发现目录引用；可在未来冻结提交中排除，原文件未删除、未移动，未擅自补入正式清单。
- NAI 登记仍为编辑中的 `tools/nai_gen.py`、`tools/nai_style.py`、`tools/nai_vibe.py`、相关测试/提示词/证据保留原状；本机 `.codex/config.toml`、4 份 `.bak-nai-*`、`nul` 均不纳入自动打包。NAI 未跟踪不等于可删除或已完成。
- 卡框候选、方舟技能实验、PV 和其他无法核实完成归属的来源/中间文件保留。自动 ship 仅是分类候选：它不完整解析段落式登记，返回 ready 不代表人工归属审查通过。
- 两份原始全量 JSON、日志留在本机并由本目录 .gitignore 排除，取得方式为本次 npm test 生成；[原始证据哈希](raw-evidence-manifest.json)供核验。

## 远端与传输

已通过现有登录只读确认仓库 `taping233/OperationSalvation7` 为私有，远端 master 为 `3d02437e4c3cf6fb4a55f8a05b409932ec35daae`，tree 为 `c7a724a6c51afc1ac16549967041f7a73c03220b`。本地 HEAD 为 `a330d25f476e7955e38ce352436af8d510071a37`，tree 为 `4d383aa1f66a275500ba865102eeaade2b3c2a1e`，领先 4 提交，暂存区为空。

已扫描待推送 4 提交的 373 个文本 blob，未命中所用密钥规则，见 [增量扫描](outgoing-secret-scan.json)；这是启发式范围检查，不覆盖旧远端完整历史或未来 index。

Library 只读访问成功；可用 create_library_file（绝对本地路径、每批最多 20 件）以及 prepare_uploads/finalize_uploads。工具说明未公布单文件字节上限，未据此假定可上传大包。由于本轮尚未安全提交推送，没有下载/上传源码归档、没有创建 bundle、没有搬运登录凭证或新建 token；也没有改变仓库可见性。

后续必须先修复或基于已确认行为同步上述契约，审查完成范围并正常执行冻结暂存门；推送后核实远端 commit/tree，再用现有本地授权从该不可变 SHA 下载归档，计算 SHA256 并按实际支持的大小上传。云端使用 Node 22 与锁定依赖，仅启动 `搜打撤` Vite，重新核对 hook 路径和运行素材。

后续33项修复、正常完整测试、预算基线与最终交接状态见[集成交接记录](../2026-10-16-WF-integration-ship-1016/README.md)；本页保留首次只读基线，不代替后续验收。
