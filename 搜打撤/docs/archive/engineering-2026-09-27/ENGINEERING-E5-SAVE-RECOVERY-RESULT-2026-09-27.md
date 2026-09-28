# E5 存档恢复契约与入口校验结果

E5 独立主指挥记录，2026-09-27 14:58（Asia/Shanghai）。协调 Friday：`01a0e192-baec-7192-ba9f-4e8d1cfe9923`。顶层范围与补充裁决见同日 E5 PLAN；本记录仅交接本团队实现、定向验证及独审，不代替 Friday 全量门禁或实页验收。

## 基线与归属

14:57 实时 HEAD 仍为 `3d06b1e5467823b6c9f9e45a4f8955b77c954805`。相对本地 `origin/master` ahead 11 / behind 0；未 fetch，未 push，不代表服务器实时状态。启动时 tracked/index 干净，当前改动均按本批单写分工完成；Friday 独占 PLAN/index/全量/本地提交。本团队未操作 index 或提交。

| 所有者 | 精确文件（均相对 `搜打撤/`） |
|---|---|
| 全新成员 A | `game/src/hub/game.storage.js` |
| A | `game/src/hub/run-save-validation.js`（新增） |
| A | `tests/e5-save-validation.test.js`（新增） |
| 全新成员 B | `game/src/run/game.session.js` |
| B | `tests/e5-session-recovery.test.js`（新增） |
| 主指挥 | `docs/save-format.md` |
| 主指挥 | `docs/ENGINEERING-E5-SAVE-RECOVERY-RESULT-2026-09-27.md`（本文件） |

`game.menu.js` 无需修改。Friday 自有 PLAN 不在上述七文件中。原有 `.codex/`、`.ui-art-loop-0925/`、`.ui-loop-0926/`、AGENTS 备份、根目录 package 两文件、E2 两张证据图、`game/shots/` 等排除未跟踪内容全部保留，不纳入本团队交付。

## 最终行为

- RunStorage 拒绝顶层数组/标量与非法显式版本，缺 version 仍走历史版本 0；未来整数版本与损坏分别报告。未发现数字字符串版本的真实历史证据，因此不作字符串兼容。
- 新纯校验模块按装载消费者检查集合、卡实例/card 记录、发现集合、普通及龙巢直接消费字段、商店条目，以及真实 `battle.run` 检查点。保留缺省/null 的既有默认、未知合法卡 ID、未知顶层扩展与标量默认；不静默过滤资产，不重做战斗 schema。完整字段矩阵见 save-format。
- 预检在 Random、地图安装、Base.use 和 game 赋值前拒绝坏结构，返回字段原因及 preserveRun；原 run/base/journal 串不被此次拒绝覆盖。备份失败只说明原档保留，不声称已经备份。
- readCache 返回深克隆，防止运行态修改卡实例/地图污染同一原串下次读取；成功读取和缺档清理陈旧 issue，列表读取不推进写入基线。
- `loadGame.persistence` 分别报告 `not_attempted`、`succeeded`、`failed` 与每次保存明细，涵盖普通 `enterLayer` 的原有间接保存及战斗恢复回写；任一失败不能被后来成功抹去。保留原保存次数、saveGame boolean 和 loadGame.ok 的装载成功语义；失败明确提示。同步收集上下文在正常返回、预检拒绝和抛错后释放。
- menu/Agent 的进入成功及 E4 的 Promise.isCurrent、battle-loader 身份、enterSlot 完成凭据语义保持。没有新增事务保证。

## 独审发现与最小补修

独立只读成员确认原 `readForLoad` 在后续纯预检拒绝前已推进写入基线：旧局继续保存会覆盖另一标签替换的坏档。内存探针得到 `preservedAtRejection=true`、`subsequentOldWrite=true`、`replacementPreserved=false`。这不是玩家事故报告。

Friday 裁决纳入本批，并要求成功菜单预检也不得授权旧局覆盖。最终新增 `readForPreflight` 与 `acceptLoad`：单次读取的返回对象以私有 WeakMap 绑定档位及精确原串；预检只读，实际装载全部纯检查通过后才采纳。采纳时原串已变返回 STALE_SLOT，读取异常返回 STORAGE_READ_FAILED，均保持旧基线且早于运行态副作用。既有 readForLoad 直接消费者保持兼容。

修改前红灯记录：A 14:55:41 的原串保护回归失败；B 14:55:20 合法预检后旧局错误可写，14:55:36 坏结构/坏地图/坏撤离记录三种拒绝后旧局都错误可写。修改后全部转绿，另外验证真实装载最新合法档后可保存、采纳前原串变化、预检/采纳读取失败、错档与复制候选拒绝。

## 定向验证证据

均使用现有依赖、测试内存 localStorage，不接触玩家档。Vitest 启动曾遇沙箱 spawn EPERM，获准子进程执行后通过；首轮两个 fixture 路径定位失败已修为项目既有 cwd resolve 写法，无遗留失败。

| 最终运行时间 | 命令/范围 | 结果 |
|---|---|---|
| 14:56:34 | `npx vitest run tests/e5-save-validation.test.js tests/save-compat.test.js --no-file-parallelism` | 2 文件 78 例通过（67 + 11） |
| 14:56:44 | `npx vitest run tests/e5-session-recovery.test.js tests/r5a-session-menu.test.js tests/extraction-session-resume.test.js tests/e4-async-entry.test.js --no-file-parallelism` | 4 文件 50 例通过（23 + 5 + 4 + 18） |
| 14:57:43 | `npx vitest run tests/terminal-recovery-matrix.test.js --no-file-parallelism -t '第三值'` | 1 例通过、同文件其余 2 例按筛选跳过 |
| 14:57 | 自有已跟踪实现与文档定向 `git diff --check`；成员各自检查 | 通过（仅 Git 行尾转换提示） |

最终覆盖 7 个测试文件中的 129 个用例；未把之前重跑次数叠加为新增覆盖。新增 E5 专属用例 90 个。固定历史字段迁移与真实可恢复旧 3/9 地图分别覆盖；真实 session/menu 运行，战斗 restore/render 在新增 session 用例中用替身，真实恢复消费者另以源码独审核对，不能宣称真实战斗实页验收。

## 验证边界与交接

独审成员只读检查最终 diff、两份专属测试、兼容矩阵、原串保留、副作用顺序、持久结果和 E4 守卫；不写文件、不重复已通过的测试。最终结论为阻塞项 0：战斗恢复分支绕过与预检提前采纳基线两项均已关闭，文档与最终实现一致。A、B、独审及主指挥在交接后停写，交 Friday 进入全量窗口。

全量门禁、本地提交由 Friday 接手；本团队未运行全量、build/install、清理/删除/回滚/amend/push，未手改 cards-sync.json。浏览器恢复提示实页未验；E2 真实 hover/旧档 04/05、E3 结算/旧档/长局、E4 异步实页仍按 PLAN 后置，本批未混入。代码、定向、全量、实页口径分别报告。
