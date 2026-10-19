# 非实页问题分批修复（2026-10-13）

<!-- cleanup-status-20261019 -->
> 2026-10-19清理后提示：本报告及本目录附件记录当时状态，其中提及的旧资源、旧音频实现或旧交付路径可能已按批准清单删除。“保留原文件/保留旧包”不代表今天仍可访问。当前保留包、替代入口与执行回执见[清理后状态](../../CLEANUP-STATUS.md)；下文历史验收结论与原始内容保持。


## 范围与接管

老板要求子代理逐项修复当前非实页问题，实页验收暂缓。老板确认上一「完整版收拢」聊天结束，由本聊天接管游戏源码与测试属地；原有未提交成果保留。本轮未启动游戏服务、build、提交、推送或发布。任务范围与完成标准见 [task.json](task.json)，当前占用见 [REGISTRY](../../PARALLEL-REGISTRY.md)。

## 已完成的定向修复

- 代码门禁：`game/src/core/renderer.js`、`game/src/hub/hub.archive-v3.js` 清除 4 个未使用符号；Home 场景控制抽至 `game/src/hub/game.hub.home-scene.js`，`game.hub.js` 按架构测试算法为 429 行，保留五件套导出与异步失效控制；`tests/sound-music.test.js` 按 [音频现行规则](../../audio-system.md) 改为验证静音立即卸载、恢复新轨加载和旧回调隔离。`hub-architecture`、`home-async-lifecycle`、`sound-music` 定向测试合计 22/22 通过。
- 战败存档：`game/src/run/game.session.js` 在对局仍活动、战斗已结束且生命值不大于 0 时拒绝普通存档。`tests/e5-session-recovery.test.js` 用真实本地存储验证 0、-4 血不覆盖旧档，恢复正生命值后可保存。含此项的 4 文件 39/39 定向测试通过；PENDING #20 已移已决记录。
- 多宝箱：新增 `tests/chest-multi-queue-regression.test.js`，以 DOM 点击验证跳过第一箱、领取第二箱、队列推进及结束回调一次，当前控制器级未复现 PENDING #26 的旧实页卡住情景；没有修改 `chests.js`，旧条目继续保留。
- 旧测试修正：`tests/battle-three-role-sprites.test.js` 的资产读取改用仓库根路径，避免 Vitest 转换 `new URL(..., import.meta.url)` 得到 `tests/undefined`；`tests/ui-accessibility-regression.test.js` 删除对宝箱 HTML 源码字面形状的旧断言，并在多宝箱 DOM 测试中验证预览与领取均为原生按钮且有可访问名称。`tests/agent-scenes.test.js` 的商店剧本本轮已通过，未改。贴图与无障碍定向测试 10/10，通过 DOM 复核 3/3。
- 全量失败分簇：`tests/e4-async-entry.test.js` 的 5 项旧入口补给预期改为验证现行“过场前持久化、入口格领取”，E4 19/19、连同邻近测试 44/44 通过；`tests/full-review-regressions-world.test.js` 的 4 项火堆旧预期改为“先确认休整、再结算并在结果页显示回执”，本文件 8/8、邻近 SYS03 16/16 通过。两簇仅改测试，未更改玩法实现。
- 工程自测：按当前曲目表更新 `game/selftest.js` 的旧音频文件名，保留 Howler 循环与播放器断言；`tests/acceptance-gate.test.js` 在隔离夹具中验证文档路径运行时先审计素材、再运行文档守卫，不更改生产门。零依赖自测退出 0，两文件定向 43/43 通过，细节见 [验证记录](asset-engineering-tests.md)。
- 随机数：锦鲤初始化使用独立 `visual` 随机流，雨声采样使用 `audio` 流；`tests/random.test.js` 只排除来源说明确认未导入的两份历史雨模拟源码。锦鲤 700 帧边界测试保留逐点检查、减少重复 matcher 开销。随机数、锦鲤及邻近庭院 4 文件 30/30 通过；全量负载下的超时尚未复测。
- 事件退出：`tests/four-player-event-regressions.test.js` 的两项旧 200ms 预期改为当前远征页 220ms 退出动画后的检查，并验证动画期间旧按钮动作已同步失效；没有修改事件实现。目标与邻近火堆测试 14/14 通过。
- 素材清单：按 [第一批](asset-first-batch.md)、[第二批](asset-second-batch.md)、[第三批](asset-third-batch.md)、[剩余指纹批](asset-remaining-batch.md) 的来源、前后指纹和当前文件字节逐条校正 62 个已有清单路径，未改素材文件。再修复审计器把 `.gitignore` 算作素材的 [3 项误报](asset-gitignore-fix.md)。全树审计阻断项从 400 降至 273，bytes/SHA 不符均为 0；余项均为未登记素材，审计仍退出 1。未登记项按 [跟踪状态与来源](asset-unlisted-triage.md) 分组，暂不批量转正。

## 本轮检查与剩余边界

`npm run lint` 退出 0；`npm run check:syntax` 退出 0（386 个项目文件）；`npm run --silent docs:check -- --json` 退出 0（598 个相对链接、0 findings）。上述定向 Vitest 在获准的执行环境中通过；默认沙箱读取 Vitest 的 `spy.js` 时曾报 EPERM、0 项执行，该次不计通过。

随后对当时的混合工作树直接运行只读全量 `npx vitest run --reporter=dot`，退出 1：350 文件中 324 过、26 败；2941 用例中 2880 过、49 败、12 跳过，另有 1 个 worker 更新超时。原始输出留本地 `.tmp/WF-nonbrowser-repairs-1013/full-vitest.log`（4,034,471 字节；SHA256 `593ADCAE960C58E9EDE8E0B80C4A4C2A86FE6F926C007D9C52052BFE29C372D4`；在本工作区按相对路径读取，不入 Git）。该全量运行早于上述入口、火堆、自测、随机数和事件修订，仅用于分簇定位，不能当成修订后的全量结果或稳定交付基线；未运行构建、实页或远端 CI。

本轮最终把相关修改合在一次定向 Vitest 运行，[原始输出](targeted-final.log)为 15 文件 160/160 通过、退出 0。该命令不包含已知受 273 项未登记素材阻断的仓库级资产审计断言；新增 `.gitignore` 扫描用例单跑通过，完整 `asset-audit.test.js` 为 15 过、1 项仓库级断言失败。未据定向结果宣称全量绿色。

未登记素材包含在途版本，须按来源、使用和许可证分组核对后再入清单。双剑合成语义与休眠方舟音频处置仍属老板待决策事项，本轮未改。
