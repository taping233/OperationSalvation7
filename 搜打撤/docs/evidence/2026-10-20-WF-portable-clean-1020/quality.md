# 便携空存档包质量门

当前源码的语法、数据、类型、lint 和零依赖自测均通过。首轮全量有 11 项历史卡库期望失败；已按授权补齐穷鬼套餐的精确夹具并定向闭环。未重跑修复后的全量，不声明最终全量全绿，skipped 不计通过。

| 检查 | 实际范围 | 结果 |
| --- | --- | --- |
| `npm run check:syntax` | 525 个项目文件 | 退出码 0 |
| `npm run validate:data` | pets 6 / 成就 26 / 怪物 15 / 场景 12 / 同步卡 57 | 退出码 0 |
| `npm run typecheck` | 10 个配置，包含 framework-boundaries/framework-ports | 退出码 0 |
| `npm run lint` | game/src、game/tools、tests、scripts、根配置 | 退出码 0 |
| `node game/selftest.js` | 现行源码契约、接线与兼容检查 | 退出码 0 |
| 首轮 `npm test` | 原 pretest、全量集合、maxWorkers=2；713 文件 / 7356 项 | 退出码 1；709 文件通过 / 3 失败 / 1 skipped；7307 项通过 / 11 失败 / 38 skipped |
| 历史卡库守卫定向复验 | e6-card-rules-capability、e8-card-inventory、m-batch-production；3 文件 / 25 项 | 退出码 0；24 通过 / 1 既有 skipped / 0 失败 |
| teardown 定向复现 | reward-save-interruptions、event-choice-acquired-gift-cloud；2 文件 / 20 项 | 两次均退出码 0；20 通过 / 0 skipped；第二次启用 dot+json 保留控制台观察 |
| 修改后的测试 lint / diff | 3 个测试的定向 lint，4 文件 diff 核对 | 退出码 0；无运行时源码修改 |

原始日志在项目根外 `../.tmp/portable-clean-1020/checks/`；日志 SHA256、退出码、全量的 11 项失败与 38 项 skipped 名单、后续定向结果和改动 SHA256 保存在该目录 `checks.json`。该目录原始 JSON/日志本地保留，不进 git。本项未构建、提交或操作浏览器；EXE 构建、资源/脚本预算与当前内置窗口验收由主代理执行。

## 全量范围与失败定性

素材审查代理明确冻结后，于 21:21:04 启动 `npm test -- --maxWorkers=2 --reporter=json --outputFile=../.tmp/portable-clean-1020/checks/full-vitest.json`；保留 npm pretest 的剧情编译和数据检查，两者通过。Vitest 用时 672.48 秒；测试集合、超时与原断言未绕过。原始证据为 `full-vitest.json`、`full-vitest.log`。

11 项失败集中于 e6 1 项、e8 8 项、m-batch 2 项，共因是现行生产卡库已加入 `tt13-poor-meal`，历史夹具及总数仍期望 281 张。全量 ID 差异唯一新增本卡，实际总数 282、结构化 231、legacy 51；已逐字段核对 `cards.data.js` 与既有 `docs/evidence/2026-10-20-poor-meal/README.md` 的已授权实现。修复只增加完整精确卡定义、显式 14 个 ID 守卫和 282/231 计数，未知 ID、任意字段漂移、漏卡、规则扩展拒绝断言保留。复验原始证据为 `catalog-recheck.json`、`catalog-recheck.log`、`catalog-lint.log`。

全量中的 desktop-startup 20 项、desktop-runtime-guard 7 项、desktop-file-protocol 11 项全部通过，共 38 项，未 skipped。这些检查验证桌面适配逻辑，不代替原生 EXE 实际运行验收。

## rAF 清理日志边界

首轮全量日志在上述两组奖励测试后，由 jsdom MutationObserver 经 `selection-state-motion.js:20` 打印 `requestAnimationFrame is not defined`。最终 Vitest JSON 未提供运行时错误计数字段，因此不伪记为 0；控制台最终摘要没有 `Unhandled Errors` 节，最终失败均为上文 11 个卡库断言，两组奖励测试本身通过。

随后两组测试独立运行 20 项全部通过；为观察控制台再用 dot+json 运行同一 20 项，全部通过且 `teardown-observation.log` 中 rAF 和 Unhandled 日志均为 0 次。第二轮不是新增覆盖，不能累计成 40 个独立测试。代码读取证据显示 body observer 生命周期与测试环境全局清理可能交错；当前仅支持“全量 jsdom teardown 时序日志”的推断，未复现生产页面故障。不增加运行时 guard，不改封装源码。证据为 `teardown-recheck.*` 与 `teardown-observation.*`。

## 本轮源文件修改及 SHA256

| 文件 | SHA256 |
| --- | --- |
| `tests/fixtures/approved-card-batch-20261020.json` | `925bebfac7b181f884cc7fc898dc0a4adb828b881dc6cf26b1a91bc1e8a6d5fd` |
| `tests/e6-card-rules-capability.test.js` | `044ebf5d2ccb24b41f773fb7d90a91f48ca98a8bf1e951482796e5db5866efa4` |
| `tests/e8-card-inventory.test.js` | `614c19872690b67c222b4c0fb7bad7f86d36c5c9baa787574157c17bd3d255e5` |
| `tests/m-batch-production.test.js` | `9e379d4285e80e9863c7294da698adf14c7c2f67cc28ced4dca848bddc0d6c0e` |

另新增本报告。剧情 pretest 使用现有确定性生成命令，未手改生成源码。本轮未改变游戏运行时、桌面适配或资产，按主代理指示复用已通过的类型及未受影响全量结果，仅记录首轮全量与定向修复闭环。
