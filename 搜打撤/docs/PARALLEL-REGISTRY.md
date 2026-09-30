# 并行会话热点登记（PARALLEL-REGISTRY）

> **规则（09-29 起）**：
> 1. 会话要改**共享文件**（AGENTS.md / docs 公共文档 / MEMORY.md / 其他会话热点）或开**长任务**（工作树 / 端口服务 / 后台进程）前，先在「活跃登记」加一行；收官/释放后把行移入「近期已释放」。
> 2. 发现**无主改动/文件**（归属不明的 M 文件、陌生未跟踪产物）登记到「无主物品」，**只记录勿动**，等认领或老板处置；认领者把行移入活跃登记。
> 3. 本文件是占用登记的唯一真源；MEMORY 速览表只放指针不复制内容。

## 活跃登记


| 会话/来源 | 属地（文件/端口/工作树） | 事项 | 登记时间 | 状态 |
|---|---|---|---|---|
| Friday（工匠 U16） | game/src/battle/core/battle.resolution.js（终局守卫，engine.js 零改动）+ tests/battle-resolution.test.js、tests/m1-contract.test.js（新用例）、docs/evidence/2026-09-29-nightshift/fix-U16-0500.md | PENDING #14 老板拍板：STS2 式敌人全灭即中止该卡余下 op（单一谓词 foesAnnihilated+四处入口守卫）；断言变更 0、新增 5 用例；定向 16 文件 219 用例绿+战斗集成 4 文件 20 用例绿（混树含 U18 在途改动，见修复单）；全量留给调度长（与 U18 同批） | 09-30 | 完成，待调度长全量收官+落库 |
| Friday（工匠 U18） | game/src/battle/core/battle.engine.js、battle.enemy-phase.js、game/src/ui/hud.js + tests/u18-negative-hp-death.test.js（新增）、docs/evidence/2026-09-29-nightshift/fix-U18-0500.md | PENDING #15 老板拍板：对齐 STS2 负血+即时死亡判定（去钳位、hp<=0 即 finish(false)、免死钩照旧、显示层钳 0）；定向 48 文件 409 用例绿，断言变更 0；禁碰 resolution/exec-play/hub 已守；全量留给调度长 | 09-30 | 完成，待调度长全量收官+落库 |
| Friday（验收分级班·追加） | scripts/iab-drive.mjs（新建，已随本轮压树） | 老板 09-30 追问后追加：IAB 起手式固化（openGame/waitBoot/dev 面板跳转/Alt+数字/合成点击/快照，node_repl import 复用）。导入与环境检查过；浏览器桥今晨不可用，端到端复验待桥恢复首跑。 | 09-30 上午 | 完成，压树待落库（复验遗留） |
| Friday（照相馆性能专项会话） | ~~game/css/expedition-library.css、game/css/winter.css、game/src/hub/game.cardslib.page.js~~（已随 d2c0d0a 落库）、worktree .photolib-acc（待处置）、~~端口 8137/8138/5333~~（已杀净） | 照相馆性能专项三期：实机验收通过并已落库（d2c0d0a）；仅余隔离工作树处置待拍板 | 09-29 深夜 | 已落库，余 worktree 待拍板 |
| Friday（CSS 精修班会话） | ~~game/css/winter.css、game/css/page-rewards-bag-help.css、端口 5322~~（已杀净） | CSS 骨架重复收敛：winter 删陈旧副本 107 行（122px 原位保留）+ --rbh 合并；jscpd 109 行克隆→0，四页计算样式 A/B+全量 vitest 1889 绿；压树待落库。证据=docs/evidence/css-dedupe-2026-09-29/ | 09-29 深夜 | 完成，压树待落库 |


## 无主物品（只记录勿动，等认领/处置）

| 物品 | 现象 | 发现时间 | 备注 |
|---|---|---|---|
| `搜打撤/package-lock.json` | 已修改未提交（M），改动者不明 | 09-29 深夜 | 疑似某会话依赖变更在途；认领前不还原不提交 |
| node.exe ×2（PID 21272/22356） | 监听 5200（主线 Vite 端口）/5321，REGISTRY 无登记 | 09-29 深夜 | CSS 精修班会话发现；身份未验，未动；认领前勿杀 |

## 近期已释放（保留最近 10 条，更早删除）

| 会话/来源 | 属地 | 事项 | 时段 |
|---|---|---|---|
| Friday（夜班三代理优化班·主代理） | game/src 9 文件（boot/loader/意图/地图/道具/商店/发现流/选卡流/抽壳）+tests 新增 6 文件+改 4 文件+docs/evidence/2026-09-29-nightshift/（31 单据）；~~端口 54xx~~（预留未占用即释放） | 夜班任务书 v2 收官：**15 单元全部落库（9d7b871..a4efe1a），全量 1978 绿 EXIT=0 零 Unhandled**；挂账 PENDING #14-18；交接报告=docs/evidence/2026-09-29-nightshift/journal.md 收官节 | 09-29 23:27 - 09-30 04:45，已完成 |
| Friday（验收分级班会话） | 根 AGENTS.md（验收分级+顺带发现条款）、scripts/page-snapshot.mjs（新建）、package.json（page-snapshot/jscpd:baseline script）、记忆目录（quirks+stale-bundle 合并为 iab-verify-quirks、新增 acceptance-tiering、MEMORY.md 索引）、docs/STATUS.md、本文件；~~端口 5334/5335~~（已杀净） | 老板拍板三项全交付：验收分级制/实页快照脚本（自测失败 0/info 11/退出码 0）/记忆合并整理；压树待落库。证据=docs/evidence/acceptance-tiering-0929/ | 09-29 深夜，已完成 |
| Friday（架构检查+体系降本会话） | game/src/README.md、docs/architecture.md、tests/docs-consistency.test.js、scripts/handoff-brief.mjs、scripts/doc-retirement-candidates.mjs、package.json、根 AGENTS.md、记忆 MEMORY.md | 架构对齐（experience/ 域补记）+体系降本五项（文档守卫/接手简报/TTL 清单/速览瘦身/小额免登），代码批 d2c0d0a+docs 批本提交 | 09-29 深夜，已完成 |
| Friday（记忆v2会话） | 根 AGENTS.md、docs/README.md、本文件、docs/PENDING.md、docs/PARALLEL-DISPATCH-PLAYBOOK.md、docs/STATUS.md、记忆 MEMORY/ARCHIVE | 工作流标准化七项+落库双提交（0bac1f3+643434f） | 09-29 深夜，已完成 |
| Friday（同上） | game/src 6 文件+tests/run-architecture+knip.json、docs/STATUS+PENDING | knip A 类死代码清理双提交（20c4e25+041fd65） | 09-29 深夜，已完成 |
| Friday（同上） | ui/terminal-settlement.js 新建、death/menu/battle.resolution、evidence/jscpd-2026-09-29/、STATUS+PENDING #12 | jscpd 档一收敛双提交（506ccea+落档） | 09-29 深夜，已完成 |
| Friday（同上） | SPEC-PROCESS/UI-TOKEN-SYSTEM-PROPOSAL 新建、README 路由、派工手册 repomix 节 | GitHub 调研三项落地（5b3aef7） | 09-29 深夜，已完成 |
