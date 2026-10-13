# 前端、持久化与工具代码审计（2026-10-13）

## 范围与基线

老板要求审计代码、删除已证实冗余、检查 Bug 并提高效率。项目当前只有 Vite 单机游戏，没有独立后端服务；本次“后端”按对局持久化、结算事务、Node 工具和工程脚本核对。任务元数据见 [task.json](task.json)，编辑占用见 [REGISTRY](../../PARALLEL-REGISTRY.md)。

接手 HEAD `cdd5c1a836`，工作树已有大量完成未提交成果；此前[非实页第二批](../2026-10-13-WF-nonbrowser-failures-b2-1013/README.md)的混合工作树全量 Vitest 为 350 文件 348 过、2 败；余项为 273 项未登记素材触发的资产断言，以及 agent-batch 启动后静默退出。该证据只作输入，不替代本轮定向实验。

本轮先分域只读审计，复用既有归属和差异证据；选出可以确定的缺陷与重复代码后实施最小修复。删除文件或目录须另列精确路径按项目规则获批；普通代码修订与冗余语句清理按本轮授权执行。性能改动先取得同条件前后证据。按老板此前指示，暂不做游戏实页验收。

## 已确认并修复

- **撤离事务**：`game/src/run/game.run.altar.js` 首次撤离曾忽略有档位的 `saveGame()===false`，`extraction.commands.js` 随后可能用最新内存收益与旧磁盘对局拼成一个提交。独立注入实验曾得到“基地木材 2 / 待领奖新卡”与“对局卡 0 / 旧位置”混合快照。现要求首次预存成功才启动结算；失败显示未保存重试页，已有事务令牌的重试沿原快照继续，无槽位临时局保留原流程。`tests/extraction-recovery-ui.test.js` 补首次失败与重试；相邻撤离/结算 6 文件 37/37 通过。
- **Agent 批跑**：`game/tools/agent-batch.mjs` 的 jsdom `document` 与 Node `AbortSignal` 跨 realm 导致音频监听抛错，未处理拒绝仅进内存桶又让进程 0 退出；未知 `--policy` 还会静默回落 greedy。现挂载同 realm 的 DOM AbortController/Signal，Node fetch 桥转换 signal 并转发取消；未处理错误输出且最终非零，未知策略启动拒绝。LLM 两局超时桩回归 1/1 通过，greedy 单局产生 `runs.jsonl`，未知策略退出 2；ESLint、语法、差异检查通过。默认沙箱的 Vite `realpathSync.native` EPERM 属执行环境限制，放行运行已验证实际路径。
- **卡牌浏览效率**：`game/src/ui/card-browser.js` 把每次分页刷新中对每项 `visible.indexOf` 的反复扫描换成一次可见索引，并把连续图片 load 事件合并到一帧；过滤、分页及换页后断开容器的回调语义由 `tests/card-browser.test.js` 覆盖。200 卡、100 次合成 load 的同条件 jsdom 基线约 202.14ms / 20,900 次 `indexOf` 调用；修改后约 3.23ms 事件处理 + 5.65ms 单次刷新 / 800 次（主要为 jsdom 内部）。这是代码开销对照，不代表真实浏览器帧率。定向 2 文件 13/13 通过。
- **冗余代码**：`game/src/audio/sound.music.player.js` 的 `fadeOut(entry, immediate)` 从现行调用链只收到 `false`；即时静音已走 `release()`。本轮删去不可达的立即分支及多余参数，保留淡出和即时卸载两条实际路径，待音频定向复核。

## 未改动的发现与边界

- 战斗场景遮罩在指针移动期间会读取布局并重新编码 SVG，未有实页同条件性能数据，本轮不改。
- 未跟踪的 `game/src/ui/base-design-preview-v6.js` 当前未见现行入口，预览页引用 v7；它属于旧会话未提交成果。若要删除该文件，须按项目规则列精确路径另获批准。
- 素材审计仍有 273 项未登记资源；来源/归属不足时不把在途文件批量转正。本轮未删文件或目录，未改 `cards-sync.json`。

## 验证与收官边界

- [组合定向日志](targeted-tests.log)：撤离、批跑、卡牌浏览、音频及邻近基地测试，6 文件 33/33 通过、退出 0。
- `npm run lint`、`npm run check:syntax`（386 文件）、`npm run --silent docs:check -- --json`（598 相对链接、0 findings）、`node game/selftest.js`、本轮已跟踪文件 `git diff --check` 均退出 0；未跟踪的卡牌浏览源码/测试由 ESLint、语法和逐行空白检查覆盖。
- [全量 Vitest 日志](full-vitest.log) 86,578 字节，SHA256 `DAB7552B42982B028E004F31E988868F4BC22A19DA63300D0CB43E3BB97BDE6B`：350 文件 349 过、1 败；2944 用例 2931 过、1 败、12 跳过，另有 1 次 worker 更新超时。唯一失败仍为仓库级资产审计断言（273 未登记资源），不把 worker 超时记作产品用例失败；该全量运行不能称绿色。
- 本轮未做游戏实页、build、远端 CI、提交、推送或发布。照相馆等前批可见变化及本轮卡牌浏览的真实帧率未复核。
