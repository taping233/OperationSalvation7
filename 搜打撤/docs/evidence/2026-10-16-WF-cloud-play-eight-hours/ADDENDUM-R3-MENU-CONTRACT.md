# R3 独立验收补记：菜单测试契约已修复，构建预算仍失败

**结论：补修后的普通全量测试为 463 文件通过、4318 用例通过、2 用例跳过、0 失败。原 R3 的 4 个失败用例已消除；生产输入与原 R3 冻结版保持相同。构建复用原 R3 的真实产物和日志，正常 build 仍因 4 项原预算超限而失败，完整质量门尚未全绿。**

本补记于 2026-10-15 21:18 UTC 独立核对已有证据，只新增文档、证据副本与 SHA256 复核记录。没有重跑全量测试或 build，没有改生产源码、门禁、预算或原验收记录，也没有操作浏览器、本地电脑、暂存或提交。

## 原始结果与补验结果

| 项目 | 原 R3 | 三文件补修后 |
| --- | --- | --- |
| 普通 `npm test` 退出码 | 1 | 0 |
| 测试文件 | 461 通过、2 失败，共 463 | 463 通过，共 463 |
| 用例 | 4313 通过、4 失败、2 跳过，共 4319 | 4318 通过、0 失败、2 跳过，共 4320 |
| 正常 `npm run build` | Vite 编译成功，postbuild 预算失败，退出码 1 | 未重跑；复用同一生产输入对应的原 R3 产物，预算失败保留 |

补验命令与 UTC 时间来自 [supplement-checks.json](r3-menu-contract-supplement/supplement-checks.json)：定向 lint、自测语法、实际 Node 自测和普通 `npm test` 四项均退出 0。全量执行于 2026-10-15 21:04:47–21:07:15 UTC，命令总耗时 148.318 秒；Vitest 报告自身耗时 146.77 秒。日志中的本地钟面不用于替代这些 UTC 时间。

- [补验全量原始日志](r3-menu-contract-supplement/supplement-full-test.log)
- [实际 Node 自测日志](r3-menu-contract-supplement/supplement-selftest.log)
- [定向 lint](r3-menu-contract-supplement/supplement-target-lint.log)与[自测语法日志](r3-menu-contract-supplement/supplement-selftest-syntax.log)

两次均有 2 个 skip；skip 不计为通过。用例总数增加 1，是新增了真实冷设置载入期间按 Escape 取消的回归覆盖；通过数增加 5，对应原 4 个失败消除及新增 1 个通过用例。

## 仅三文件的修复范围

[批准的三文件 diff](r3-menu-contract-supplement/approved-three-file.diff)只包含以下测试与独立自测入口变更：

1. `tests/agent-console-jump.test.js`：等待真实异步 `devcGoto → jump` 返回与呈现完成，增加冷模块载入中 Escape 取消用例，并在用例间清理迟到任务。原目标页动作表、overlay、控制台替换和无效入口断言保留；仍使用真实页面工厂与真实 DOM 点击
2. `tests/selftest-paths.test.js`：保留实际执行 `node game/selftest.js` 及退出码断言，并新增要求输出“档位概览仅展示游玩时间与已解锁成就”的断言
3. `game/selftest.js`：在独立 CLI 自测的源码扫描清单中加入已拆出的 `ui/game.menu.pages.js`，保留原概览断言

没有新增 skip、删除原断言或修改生产菜单/控制台实现。原 R3 的三个控制台失败与一个自测入口失败，在上述补修后的普通全量中均未再失败。补验复制了这三文件及 8 个配套证据文件；[复制清单](r3-menu-contract-supplement/approved-copied-inputs.json)记录各自字节与 SHA256。

## 生产输入与构建复用的独立复核

[来源比较](r3-menu-contract-supplement/source-production-comparison.json)与[补验元数据](r3-menu-contract-supplement/supplement-metadata.json)记录没有其他生产输入变化。工作记录和截图的后续变化属于非生产记录，没有被当作生产修复。

本次额外只读复核结果见 [independent-verification.json](r3-menu-contract-supplement/independent-verification.json)：

- 补验前后生产状态清单逐字相同，共 2916 个输入；当前验收副本逐文件 SHA256 仍全部匹配
- 当前来源的 2916 个原冻结生产输入逐文件匹配，新增生产输入为 0；三文件及 8 个配套证据在来源与验收副本均匹配批准清单
- 原 R3 产物和保留副本各有 1322 文件、126673218 字节，均逐文件匹配原始产物清单，无缺失、改写或额外文件
- 原 R3 日志仍匹配原日志清单；本目录下的复制件与来源 SHA256 相同
- 补验 checks 引用的来源清单 SHA256 与元数据、实际清单完全匹配

因此复用的是**已构建且字节未变的原 R3 产物结果**，本补记不声称再次执行或通过 build。

| 构建指标 | 原 R3 实测 | 原预算 | 状态 |
| --- | ---: | ---: | --- |
| 总包 | 120.80 MiB | 112.00 MiB | 失败 |
| entry JS gzip | 288.1 KiB | 270.0 KiB | 失败 |
| initial JS gzip | 333.5 KiB | 310.0 KiB | 失败 |
| 全部 CSS gzip | 195.6 KiB | 136.0 KiB | 失败 |

四条超限原文保留在[原 R3 build 日志](r3-menu-contract-supplement/original-r3-build.log)。菜单拆块 CSS 仍计入全部 CSS；预算没有降低。

## 保留原红灯与覆盖边界

[原 R3 报告](r3-menu-contract-supplement/original-r3-report.md)、[原 checks](r3-menu-contract-supplement/original-r3-checks.json)、[原失败测试日志](r3-menu-contract-supplement/original-r3-test.log)和[原失败 build 日志](r3-menu-contract-supplement/original-r3-build.log)均完整保留为历史证据。本补记增加后续结论，不改写原红灯。

本结论覆盖原 R3 冻结生产输入及明确批准的三文件补修。它不代表实页、真实玩家输入、持续游玩、未来新增改动、未来提交或远端 CI 已验收；这些需各自的对应证据。

关键清单 SHA256：

- 原 R3 来源：`bf2e4dffb52d302525344f38dc61c1b325e35923e0ec8234c499411b0a8e96d5`
- 补验来源：`2e58810b934d08f450a9328eaf5e8e7941b961b5f0e996bc8654ccc0e5fcf950`
- 生产状态：`8a3431844719b172008352015b10c66d58c25d26290fe328b9ae59b3fca939c4`
- 原 R3 产物：`0754a018fa4724fe193cbc03dfd43dedefc850d4f1b3fe3e354c34b28c045526`

复制件的字节、来源与 SHA256 见 [evidence-manifest.json](r3-menu-contract-supplement/evidence-manifest.json)。大清单与真实产物保持在云端已有验收目录：`/workspace/shared/cloud-iteration-verification-r3-20261016/`；其中 `menu-contract-supplement/source-input-manifest.json` 超过 1 MiB，不复制入仓库，按上述补验来源 SHA256 获取并校验。补验全量日志的原始位置是该目录下 `menu-contract-supplement/logs/full-test.log`。

文档反馈：本轮 `docs:check -- --json` 通过，461 个现行相对链接、0 发现；该守卫明确跳过 evidence，本补记的相对链接另行逐项核对可达，结果见 [addendum-file-check.json](r3-menu-contract-supplement/addendum-file-check.json)。
