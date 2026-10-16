# 云端交付内容预检（准备态）

本记录只准备候选清单，不代表完成归属、源码冻结、质量门或提交通过。BOSS、restore、notice、pearl 仍在进行；后续变化必须在实际打包时重新核对。本次未 stage、提交、推送、改配置、改源码、删除文件或联网。

## 快照与扫描

- 扫描时间：2026-10-15 23:34:50 UTC；基线与 HEAD 均为 `f0e84c5dc34afcbc1176b1519258d2c3010c62cb`，index 为空
- 当时有 393 件 tracked 差分、590 件非忽略未跟踪、222 件项目内忽略证据/候选，共扫描 1,205 件、59,239,313 bytes；活跃任务随后可继续新增
- 非忽略候选：运行代码 84、测试 93、工具/构建配置 5、现行文档/台账 4、运行资产 266（含清单）、证据文字/报告 345、复现/分析脚本 35、需归属审查的中间证据 68、截图 76、候选审阅页/元数据 7
- 常见密钥、token、私钥头、JWT、字面量 Bearer、带凭证 URL、secret 赋值/参数模式未检出匹配；没有打印任何疑似 secret 值。模式扫描不是无泄露保证
- 只读项目交付内容；未读家目录、环境凭证目录、sessions、Git 内部数据或 node_modules；未核验远端可见性与权限

详细统计见 [summary.json](summary.json)。此处计数描述扫描时点，不能代替最终冻结清单。

## 建议纳入（完成归属核实后）

1. 当前完成的游戏源码、CSS、HTML、selftest、专测与必要 fixtures，按子系统随相应现行文档一起归组。七件新增源码与一件新工具脚本必须逐项对上父任务/完成证据，不按“未跟踪即完成”处理
2. 263 件已跟踪 portrait 动画帧重编码、资产清单，以及已正式引用的新运行图。`portraits/personnel/wu-default-cutout-v1.webp` 为 1,011,996 bytes，低于 1 MiB；`home-prototype/room-direction-candidate.webp` 为 607,272 bytes，当前被 `home.visuals.js` 引用，须作为运行依赖核对，不因文件名含 candidate 误当可丢中间件
3. 正式 README/报告、结构化收据/验证摘要、SHA 清单与可复现脚本；保留足以解释结论和验证边界的证据。68 件中间证据不能整体当正式交付，也不能一概排除：部分补丁、before 指纹已被正式报告引用，需由父任务决定最小证据闭包
4. 76 张 PNG 截图合计 6,865,156 bytes，均不超过 1 MiB；它们是实页证据而非运行资产，可随对应验收报告纳入。测试通过或候选对照不能替代尚未完成的正式画面验收

## 建议排除（保留原位，不删除）

- 9 张 >1 MiB 候选 PNG 已有目录级 `.gitignore`：roster 四人各 v1/v2 与 Wu 原 PNG。逐件路径、bytes、SHA256、取回来源见 [binary-exclusions.json](binary-exclusions.json)，不要 force-add
- 本次项目候选中没有额外音视频、压缩包或字体；现有忽略日志 213 件保持忽略。仓库外黑像/星月无损候选 WebP 仍超过 1 MiB，既有转码报告已明确未正式接入；本次未重新读取或把它们算入仓库扫描
- 明确生成缓存：`docs/evidence/2026-10-16-shadowed-card-audit/.vite-cache/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json`
- before 源码副本、pending 测试候选和类似会话中间件默认不打包；26 件精确复核路径见 [intermediate-review.txt](intermediate-review.txt)。删除/移走并未获得本预检授权
- 候选审阅 HTML/README/manifest 可保留作溯源，但其大 PNG 只存在本地/原生成位置；同步 Git 后的新 clone 不会自动得到这些图，不能宣称审阅页在任意机器完整可用

## 父任务必须核对

- BOSS、restore、notice、pearl 源码闭环与最新测试/实页证据，活跃属地完成前不纳入冻结
- 七件新增源码：`agent/agent.battle-stats.js`、`cards/card-battle-start-explanation.js`、`core/art-preload-plan.js`、`core/card-capacity.js`、`hub/departure.selection-state.js`、`run/event-card-choice.js`、`ui/game.menu.pages.js`（均相对 `game/src/`）；另有 `scripts/visible-playback.mjs`
- 自有云端证据与运行资产需由父任务确认完成归属；handoff 的“无主 6”来自既有历史台账，不是本轮六个新增云端文件，不能机械当成交付遗漏
- `docs/PARALLEL-REGISTRY.md` 当前解析出的 7 个活跃行和 0 个完成未提交行不能证明云端改动已销账；本预检不修改共享台账或替他人宣告完成
- 最终在途 mtime、HEAD/index、完成归属和暂存门按 `WORKFLOW-TOOLS.md` 重核；本报告没有运行暂存门，也没有产生可复用 gate receipt
