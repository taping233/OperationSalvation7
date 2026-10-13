# 完成成果安全打包（2026-10-13）

## 授权与边界

老板本聊天明确要求提交。按根 AGENTS.md 的打包默认，本会话审查并提交当时工作树全部**完成未提交**成果，分代码与文档/证据组；在途 PV、待决、无主和会话中间文件不得混入。提交不等于推送或发布。本任务只占用 Git index、候选预览与本目录，不改 PV 属地或启动服务；任务元数据见 [task.json](task.json)。

## 初始现场

HEAD `cdd5c1a836`；index 为空；`workflow ship --json` 初次预览为 `ready`、代码 2891 路径、文档/证据 2720 路径，另列 excluded 56 与 inProgress 249。预览返回 `nextAction=review-plan-and-confirm-commit-authorization`；本聊天指令已构成提交授权，但应用前仍须核对候选归属、mtime、index、质量门及冻结收据。活跃 PV v2/v3 是独立目录，保持排除。初始 planSha256 `9482c2182953f1125d377d5b9123e2ba12c8ad53e802d808df9001bfa3344c40` 会随登记/工作区变化失效，不用于执行。

当前混合工作树上，上一轮全量 Vitest 为 350 文件 349 过、1 败，失败是 273 项未登记素材的仓库级审计断言，另有 1 次 worker 更新超时。提交验证必须以精确暂存范围与质量门结果为准，不沿用混合工作树绿色结论。

## 候选审查中的发现

- 两笔计划约 2891 个代码路径和 2700 余个文档/证据路径，原 `workflow ship` 用单条 Git argv 传入约 20 万字符的路径，Windows 会超长。另立 [pathspec 修复任务](../2026-10-13-WF-ship-pathspec-1013/task.json)，用 NUL 分隔 stdin 保持 `git add`/`commit --only` 与钩子语义；修复测试通过后须重做预览和冻结门。
- 在途 PV v2/v3 的路径被排除；但被老板否决的 PV v1 证据 3 项、只建任务未改代码的审计续批记录、待审阅未接入的四角色皮肤证据 35 项仍入文档候选，须显式排除。`bash.exe.stackdump` 与旧 PV 源文件为 unknown，原计划未纳入。
- 部分 `game/art-source` 大图已有原任务“不进 Git”记录，须精确排除；超过 1 MB 的战斗 OGG 被当前音乐目录直接引用，不能按大小一刀切排除。旧 `doing/planned` 任务元数据又让 76 个 game/tests/scripts 路径保守进入 inProgress，需按归属逐项判断，不能据元数据或 registry 单边状态直接纳入。
- 当前 index 仍为空，未暂存、未提交、未推送。

## 首批已提交：工作流工具

按老板“分批传”的指示，先选 `workflow-ledger` 与 `workflow-ship` 两脚本、对应两测试，以及 pathspec 修复任务的 README/task.json。首次只暂存 ship 两件时，冻结快照中“表头前活跃登记”回归 1 项失败，证明缺少上一轮完成的 ledger 解析依赖；失败报告 `docs/evidence/2026-10-13-WF-ship-pathspec-1013/2026-10-13T12-23-54.978Z-2ef564e2-staged.json` 为 2,378,346 字节、SHA256 `907E1C77EC1C62463E5CFD2FC9B23E273A037CB1E75750D4AAA5FC55AC3E057C`，从本工作区该相对路径读取，留本地不入 Git。补齐四件后暂存门 quick 通过：隔离快照语法、数据、8 组类型契约、ESLint 和 3 个工具测试文件 41/41；可复用收据 `docs/evidence/2026-10-13-WF-completed-pack-1013-b2/2026-10-13T12-27-52.891Z-e636bc69-staged.json` 为 2,493,716 字节、SHA256 `005E2F0B22F0E08BB4C6DAACE9859664256258320B91B5290878132E3F4A7537`，从本工作区该相对路径读取，留本地不入 Git。

精确 ship 计划为代码 4 文件、文档 2 文件，foreignStaged/inProgress/blocked 均 0；按冻结 SHA 应用后两笔已落库：`b2dbe48d2131d2bf8bc2f2f8065b1ff56574d5bc`（代码）、`68981ba749de6cab50ab67e18b1665da384274f4`（文档）。主仓未推送。首批后的 index 与其余工作树须继续复核；该两笔不代表全场收官。

## 第二批已提交：Agent 批跑工具

只选 `game/tools/agent-batch.mjs` 一件，代码门判 full；本批的 `git add` 与首轮预览均无其他路径。默认并发连续两次冻结验收均为 298 文件/2540 用例通过，但 Vitest 各报 1 次 worker 更新超时，门禁判失败，未使用失败报告。确认 Vitest 本机支持 `VITEST_MAX_FORKS` 后，在**相同 index** 下以 `VITEST_MAX_FORKS=2`、`VITEST_MIN_FORKS=1` 重跑，298 文件/2540 用例通过、17 跳过、0 worker 错误；静态/类型/数据检查也通过，取得可复用 full 收据。精确 ship 预览仅代码 1 文件、blocked/foreignStaged/inProgress 均 0，应用后提交 `f615e735a8045e469f080db85f8928af10bee7e1`。index 复核为空；未推送。

超过 1 MB 的冻结 JSON 只留本地、从本工作区所列相对路径读取，不入 Git：

| 记录（均位于 `docs/evidence/2026-10-13-WF-completed-pack-1013-b2/`） | 字节 | SHA256 |
| --- | ---: | --- |
| `2026-10-13T12-33-38.079Z-f2a8cb09-staged.json` | 2,378,650 | `FD20C09CEF90B1B1F872D27E478DDB974F980061B6422FAC0BE3E9A0F147FF32` |
| `2026-10-13T12-38-26.643Z-4d250ec6-staged.json` | 2,378,650 | `0B7B148E00304BF635A44438D8D0873B2182550F1E8AF43C5BA30B30A21F4104` |
| `2026-10-13T12-42-16.244Z-c0730111-staged.json` | 2,493,351 | `7087E0E2EF9F8131D0E2025ABBDC9EAB05CFE71763A2B37F6A5A804F7E8B6344` |

## 第三批已提交：卡牌浏览组件

先只暂存 `game/src/ui/card-browser.js` 与 `tests/card-browser.test.js`；隔离门发现模块导入的未跟踪 `game/css/card-browser.css` 缺失，失败报告保留在本地。核对 CSS 为同一组件的直接依赖后补入本批，重新冻结 quick：语法、数据、8 组类型契约、ESLint、3 个测试文件 39/39 通过。精确 ship 计划只含这 3 件，应用后代码提交 `646be25beab45583b8109f7fed5d7512ea00f894`；index 复核为空，未推送。该组件后续运行入口与基地模块仍按各自未提交归属处理，本笔不宣称整个基地 UI 已交付。

本批超过 1 MB 的冻结 JSON 只留本地、从本工作区 `docs/evidence/2026-10-13-WF-completed-pack-1013-b2/` 下列相对文件名读取，不入 Git：

| 记录 | 字节 | SHA256 |
| --- | ---: | --- |
| `2026-10-13T12-54-14.797Z-8ec76a47-staged.json` | 2,379,217 | `9162DD084D219428B1BC15F15496BA6B926702690D1B70FD804AD7FA2ADC737E` |
| `2026-10-13T12-56-35.602Z-46aff0bc-staged.json` | 2,464,764 | `30F2495746AAA4E40B58EDAA557AECACB5F15E0B10710F6700908213275C7361` |

## 第四批已提交：独立设计审计证据

只选 `docs/evidence/2026-10-10-WF-base-design-audit-1010/`，task/registry 均记为只读审计完成；候选 76 件，最大文件 124,798 字节、无禁入音视频/压缩/字体或 >1 MB 证据，不依赖本轮未提交源码。ship 预览仅 docs 76 件、gate=skip、blocked/inProgress/unknown 均 0；应用时文档守卫 598 相对链接、0 findings，通过后文档提交 `c1a8c712d4b85c4e648584db17bbe990b2bb050f`。index 复核为空；未推送。

## 后续独立小包

- 城廓转场来源记录：`game/art-source/ui/camp-transition-20261010/` 5 个小型文本/JSON路径，不含本地排除的 PNG 原图，ship gate=skip、无在途阻断；提交 `6d8ea5a01d494d10727fb400ea79e15b177ccfd9`。运行转场图仍随游戏素材包另审。
- 台账历史归档：`docs/archive/WF-ledger-completed-1010/` 与对应 `docs/evidence/2026-10-10-WF-ledger-completed-1010/` 共 5 路径，原任务完成、无源码依赖；文档守卫通过后提交 `cff7e58a574f68bea95f7a0ccbe4590b0d09f7b8`。
- 卡牌文案组件：`game/src/cards/{card-description-text,card-description-links,cards.view}.js`、`game/css/card-description-links.css`、`tests/card-description-text.test.js` 共 5 路径，归属已完成卡牌文案及词条小修；隔离 quick 门静态/类型/数据通过，3 测试文件 45/45，通过冻结收据提交 `2da08e0b536659f7aa4a0ef032ac0928f9c8ac61`。其他照相馆/词条共享文件仍按各自完成归属另批审。

卡牌文案冻结 JSON `docs/evidence/2026-10-13-WF-completed-pack-1013-b2/2026-10-13T13-07-05.583Z-34869b8e-staged.json` 为 2,515,560 字节、SHA256 `752BBF475DA6BAC047D461A7A375FFF8C079400123D2E5A0258721DC8FC86D85`，从本工作区该相对路径读取，留本地不入 Git。上述每笔后 index 均复核为空，均未推送。
