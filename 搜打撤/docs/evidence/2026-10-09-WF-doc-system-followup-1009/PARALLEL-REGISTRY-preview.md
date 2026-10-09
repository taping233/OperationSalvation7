# 并行会话热点登记（PARALLEL-REGISTRY）

> **规则（09-29 起；10-01 精简：动作先行）**：
> 1. 会话改**共享文件**（AGENTS.md / docs 公共文档 / MEMORY.md / 其他会话热点）或开**长任务**（工作树 / 端口服务 / 后台进程）：动作先行，登记行同轮紧随补齐——不缺席、不阻塞启动（10-01 老板拍板）；登记表或 `npm run handoff` 显示他人活跃占用同一属地时，先协调再动手。收官/释放后把行移入「近期已释放」。单会话活跃（`npm run handoff` 占用仅本会话）时小额共享台账修改可直接编辑+收官核对，免登记免两段式。
> 2. 发现**无主改动/文件**（归属不明的 M 文件、陌生未跟踪产物）登记到「无主物品」，**只记录勿动**，等认领或老板处置；认领者把行移入活跃登记。
> 3. 本文件是占用登记的唯一真源；记忆只放指针。状态用「编辑中 / 待验收 / 完成未提交 / 已交付」；完成未提交必须列路径、归属和证据，编辑结束不等于提交获批，其他会话不能覆盖未提交内容。
> 4. 服务登记工作目录/端口/PID/创建会话；收官只停本会话创建且身份确认的服务。完成事项移至已释放，工作树等仍需处置的资源保留登记。日期/PID 是记录时点，使用前核实身份。

## 活跃登记



| 会话/来源 | 属地（文件/端口/工作树） | 事项 | 登记时间 | 状态 |
|---|---|---|---|---|
| Friday（Codex WF-cross-category-art-v2） | docs/evidence/2026-10-09-cross-category-art-v2/；本表本行 | 修正清爽程度、固定无长剑与膝上前后等长短裙；安全／探索两样板重绘，不接入游戏 | 10-09 | 编辑中 |
| Friday（Codex 文档系统后续 WF-doc-system-followup-1009） | scripts/workflow-task.mjs、tests/workflow-task.test.js；docs/{STATUS,README,rules,save-format,WORKFLOW-TOOLS,roadmap}.md；docs/evidence/2026-10-09-WF-doc-system-followup-1009/；本表自有行 | 老板令继续：恢复任务登记、核对未占用功能说明、整理台账阅读入口；旧证据原文保留，卡牌和仓库在途正文只读 | 10-09 | 编辑中；无服务，不提交 |
| Friday（Codex WF-art-reference-board 预览） | 5318/PID24680，工作目录搜打撤，exec会话59250；本表本行 | 参考板编辑已释放，六图实页加载已核对；Python静态服务保留供老板查看与选图 | 10-08 | 预览服务保留，待老板选图 |
| Friday（ZCode 本会话，招式词条与卡牌数值改版） | game/src/cards/{cards.sync.m9.js,card-rules.schema.js,cards.data.js,cards.sync.face-refresh.js,cards.view.js}、game/src/battle/core/{battle.engine.js,battle.core.js}、game/src/battle/effects/effect-steps.m2.js、game/src/ui/term-tips.js、game/data/cards-sync.json（sync 脚本通道）、tests/{m9-data,battle-lifecycle,hand-cost-patterns,m8-data}.test.js、docs/{terminology.md,M-BATCH-MATRIX.md,game-compendium.md}、docs/evidence/2026-10-06-WF-move-term-cost/；本表本行 | 老板令：银河之旅改「所有招式（=武术+法术）1 费」并把招式立为词条；恶魔之力改 7 点法伤；定向测试 + 53xx 隔离副本实页验收 | 10-06 | 编辑中；不提交 |
| Friday（ZCode 本会话，仓库特写操作台改版+5200 服务修复） | game/src/hub/game.hub.pages.js、game/src/hub/game.hub.js、tests/home-async-lifecycle.test.js、tests/hub-flow-regression.test.js；docs/evidence/2026-10-06-WF-stash-card-view/；本表本行；Vite 127.0.0.1:5200 / PID15512 / npm run web / 本会话创建。修复记档：10-06 应老板令停掉 5200 双实例（22196=无登记他会话 strictPort 残留、24792=本会话 web-up），现仅单实例 | 老板二次反馈后废除旧 stash 弹窗：点卡=大卡特写操作台（卖出/收藏/使用/孵化全在页脚、armOrRun 就地二次确认、动作后页脚就地刷新、按卡名重读堆防串位）；44 项定向测试绿；实页全链路已验：看卡/收藏保护与解禁/就地确认卖出落账/全部卖出 ×n/堆空自动收特写（截图 r4/r5）。引导失败根因=删除函数后导出列表残留 openStashItem（模块求值即炸、页面静默全死），移除后恢复；「IAB 模块通道卡死」系测试路径用错（/game/src/* 应回退）造成的误判，内置浏览器无恙 | 10-06 | 待老板验收；不提交 |
| Friday（Codex 场景BGM补全 WF-music-missing-bgm） | docs/evidence/2026-10-05-WF-music-missing-bgm/；.tmp/music-workstation/missing-bgm/；本表自有行 | 老板令按已确认双手/连贯标准生成全部缺失场景BGM，自由配器独立旋律；核定11首：基地/商店/营火/事件/祭坛/撤离/3首脑/成功/失败 | 10-05 | 创作中；只生成候选和覆盖清单，旧曲及游戏只读，无服务，不提交 |
| Friday（Codex 壁纸预览服务 WF-wallpaper-view） | 127.0.0.1:5200/PID26752；cwd搜打撤；创建聊天01a10bd8-f1cd-7b13-b6fa-fd8cbef66018 | 壁纸代码编辑已完成释放；本轮实核5200仍由该PID监听，非打包会话创建，保留服务 | 10-05 | 服务运行中；代码完成项已移已释放，未停止他会话服务 |
| Friday（Codex 无部件长期任务 WF-wu-parts-full） | game/art-source/characters/wu-parts-v1/；docs/evidence/2026-10-05-WF-wu-parts-full/；本表自有行；独立Vite 127.0.0.1:5348，PID见证据preview.pid，本聊天创建（旧10028退出后已恢复） | 老板明确授权长期自主生成22件、拼装检验并按缺陷重画；持续Goal＋每小时本聊天续做；22件已齐，右小腿v2与关节遮挡修正已实检 | 10-05 | 编辑中；三种动作完整过程复核中，未接入游戏主流程 |
| Friday（ZCode 本会话，主线5200拉起+全场收尾 WF-web-5200-1005） | cwd 搜打撤；127.0.0.1:5200 / PID3744 / npm run web / web-up detached / 本会话创建；日志 node_modules/.cache/web-up-5200.log；本表本行 | 老板令「拉起一个主线，顺便把其他任务都收尾结束」+拍板（打包提交落库/五在途接手收尾/已验两件不用测试）：5200 实核无监听后重建（node.exe PID3744 LISTENING+入口 HTTP200）；全场 33 行定终态移已释放；manifest 转正 259 条+6 svg 归一（0 errors）；打包门修正三件（RNG visual 流/closeLibPage 经 common 派发器中止 entry/六套断言对齐终态）；码笔 39d5251（622 文件 +16463/−2276）+文档笔 71f9663（1050 文件，>1MB 十四件退回留本地）落库；排除件=三活会话在途属地（request-batching：根AGENTS/WORKFLOW-TOOLS/AGENT-TOOLBOX/QUICKSTART/workflow-memory.mjs；wu-parts-full+ui-art-live 起后新增 drift：workflow.mjs/sound.js/selftest.js/manifest+26 行）+嵌套搜打撤/（无主待批）+nul；SKIP_FULL_TESTS 显式放行有记档（门内 0 测试失败，同机并发负载环境级 error×3，独立全量两轮 295 文件 2517 过 0 失败+syntax 315+ESLint 净为证） | 10-05 | 服务运行中（留老板用）；全场收尾收官，行保留至服务停用 |

## 无主物品（只记录勿动，等认领/处置）

| 物品 | 现象 | 发现时间 | 备注 |
|---|---|---|---|
| ~~`搜打撤/game/src/audio/sound.js`（已暂存 404 行改动）~~ | ~~暂存区实质改动（367+/37−，264→594 行）：音效系统重构（合成音软限幅/点击音压缩链/解码队列并发限 2+asset-url/random 导入）；mtime 20:42:45，改动会话不明~~ | 10-01 21:0x 发现 | 【10-02 核实销账】已随 8be424a 落库（老板拍板打包，音效域单独成笔），工作树复核干净 |
| ~~`搜打撤/__try_feedback.local.json`、`__try_hud.json`、`__try_route-overlay.json`（根目录 3 个未跟踪）~~ | ~~jsconfig 形态 tsc 实验配置（target/module/files），文件名对应 hud/route-overlay~~ | 10-02 00:5x 发现（WF-process-refine 复查） | 【10-05 收尾销账】三个文件已不存在（10-05 实核），DEBT 会话已自清理，疑点解除 |
| ~~`搜打撤/code-map/`~~ | ~~generate.mjs+data.js+index.html，生成会话不明~~【10-01 认领】即活跃登记 WF-code-map 行（ZCode 会话产出，老板令做的代码结构可视化地图）；仍在迭代与实机验证中 | 10-01 21:0x 发现 | 已认领，移活跃登记 |
| ~~`搜打撤/package-lock.json`~~ | ~~已修改未提交（M），改动者不明~~【10-01 核实销账】内容 diff 恒为零（行尾假差：npm install 重写为 LF，git 归一后零变化，add 后工作树干净）；当日接力会话 npm install 修复 @cacheable/memory 时触碰，依赖树零变化 | 09-29 深夜登记；10-01 核实 | 无主疑点解除，无实质改动 |
| ~~scripts/{workflow-staged,impact-query,workflow-gate-receipt}.mjs + tests/{workflow-staged,impact-query,boot}.test.js（6 文件 M，提交 2336355 之后新出现）~~ | ~~workflow-staged.test.js:256 quotepath 断言失败单跑稳定红=半成品实证~~ | 10-03 09:5x | 【10-05 收尾收编销账】半成品已被后续会话做完：workflow-staged+impact-query 契约测试 10-05 实跑 32/32 绿；六文件随 10-05 打包落库，归属随包注记 |
| ~~node.exe ×2（PID 21272/22356）~~ | ~~监听 5200（主线 Vite 端口）/5321，REGISTRY 无登记~~ | 09-29 深夜 | 【10-05 收尾销账】两进程已不存在（5321 无监听实核；5200 由 WF-web-5200-1005 重建为本会话登记服务），疑点解除 |
| `搜打撤/搜打撤/` 嵌套目录（内含 production-research/diagnosis/engineering/measure.mjs，4KB） | production-research 会话脚本相对路径多拼一层项目名致产物落错位置（10-02 18:23 生成）；10-05 比对：与正位 measure.mjs **不同体**——系 git 直调迭代版（正位为 env 注入+hashManifest 定稿版） | 10-03 00:1x 包装会话发现 | 【10-05 收尾注记】变体内容已保全至正位证据目录 measure-git-variant.mjs（纯新增）；嵌套壳目录原样留现场，删除须老板批；本轮打包显式排除该路径 |
| `搜打撤/docs/evidence/2026-10-02-staged-check/` 两个 >1.5MB staged 报告 JSON | 9d4b5ef 会话隔离门证据，超 1MB 红线留本地未入库 | 10-03 包装会话发现 | 只记录；随该会话属地处置 |

## 近期已释放

此段索引已释放记录；完整路径、归属、结果与授权原文保存在[10-09 整理前快照](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放)。当前编辑与服务占用仍由上方活跃登记维护。

| 会话 / 任务 | 查阅线索 | 来源 | 状态说明 |
|---|---|---|---|
| Friday（历史记录 WF-cross-category-art） | Friday（Codex WF-cross-category-art），10-09：完成未提交、编辑占用释放。自有 docs/evidenc | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-doc-system-1009） | Friday（Codex 文档系统整理 WF-doc-system-1009），10-09：本轮完成未提交，编辑占用释放。根规则/工作区与项 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-agents-doc-writing） | Friday（Codex 文档规则修订 WF-agents-doc-writing），10-09：完成未提交，编辑占用释放。仅根 AGENT | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xhs-full-post-draft） | Friday（Codex WF-xhs-full-post-draft），10-09：完成未提交、编辑占用释放。自有 docs/eviden | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xhs-triptych-art） | Friday（Codex WF-xhs-triptych-art），10-09：完成未提交、编辑占用释放。自有 docs/evidence/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-m1-face-r4） | Friday（Codex WF-m1-face-r4），10-09：v3附件五官修正及v4头脸透视修正候选完成未提交、编辑释放。自有 doc | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xhs-reference-comparison） | Friday（Codex WF-xhs-reference-comparison），10-09：完成未提交、编辑占用释放。自有 docs/e | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-m1-style-refinement-r2） | Friday（Codex WF-m1-style-refinement-r2），10-09：v2原图微调候选完成未提交、编辑释放。自有 do | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xhs-post-concept） | Friday（Codex WF-xhs-post-concept），10-09：完成未提交、编辑占用释放。自有 docs/evidence/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-m1-style-refinement） | Friday（Codex WF-m1-style-refinement），10-09：一张M1风格收敛候选完成未提交、编辑释放。自有 doc | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-art-mood-m1） | Friday（Codex WF-art-mood-m1），10-09：老板选择M1情绪基准，已回写自有 docs/production/ar | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-art-mood-board） | Friday（Codex WF-art-mood-board），10-09：情绪板v0.1完成未提交，编辑占用释放。自有 docs/evid | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-art-reference-board） | Friday（Codex WF-art-mood-board），10-09：情绪板v0.1完成未提交，编辑占用释放。自有 docs/evid | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-art-direction-brief） | Friday（Codex WF-art-direction-brief），10-09：美术方向简报v0.1完成未提交，编辑占用释放。自有 d | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-art-style-samples） | Friday（Codex WF-art-style-samples），10-09：两张首页玫瑰坐姿对照小样完成未提交，编辑释放。自有 doc | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xhs-poster-ps） | Friday（Codex WF-xhs-poster-ps），10-09：完成未提交，编辑占用释放。自有 docs/evidence/202 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xhs-project-intro） | Friday（Codex WF-xhs-project-intro），10-08：完成未提交，编辑占用释放。自有 docs/evidence | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-inbox-export-all） | Friday（Codex 留言箱全部导出 WF-inbox-export-all），10-05：完成未提交、编辑/服务占用释放。自有 gam | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-exe-1005） | Friday（Codex EXE打包 WF-exe-1005），10-05：已交付EXE，编辑/构建占用释放。接手中断音乐任务，14首指纹复 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-integration） | Friday（Codex 音乐接入提交 WF-music-integration），10-05：原会话中断后由WF-exe-1005沿老板明 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-piano-two-hands） | Friday（Codex 双手钢琴 WF-music-piano-two-hands），10-05：完成未提交，编辑占用释放。自有 docs | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-continuity-review） | Friday（Codex 连贯性复核与重写 WF-music-continuity-review），10-05：完成未提交，编辑占用释放。老 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-package-cleanup-1005） | Friday（Codex 冗余清理与提交推送 WF-package-cleanup-1005），10-05：编辑占用释放，码笔da6b8ff | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-explore-battle-v4） | Friday（Codex 探索战斗V4 WF-music-explore-battle-v4），10-05：完成未提交，编辑占用释放。自有  | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-card-ally-redesign） | Friday（Codex 卡牌/友军返修 WF-card-ally-redesign），10-05：老板在提交会话明确确认已完成并令代销账、 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wallpaper-view） | Friday（Codex 壁纸全幅与纯展示 WF-wallpaper-view），10-05：已随da6b8ff入库、编辑占用释放，由WF- | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ensemble-wallpaper-final） | Friday（Codex 壁纸全幅与纯展示 WF-wallpaper-view），10-05：已随da6b8ff入库、编辑占用释放，由WF- | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-title-v8） | Friday（Codex 标题曲V8 WF-music-title-v8），10-05：完成未提交，编辑占用释放。仅 docs/eviden | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-independent-review） | Friday（Codex 独立音乐复核 WF-music-independent-review），10-05：完成未提交，编辑占用释放。仅  | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-title-v7） | Friday（Codex 第一首开场垫音v7 WF-music-title-v7），10-05：完成未提交，编辑占用释放。仅 docs/ev | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-title-v6） | Friday（Codex 第一首钢琴最后尝试v6 WF-music-title-v6），10-05：完成未提交，编辑占用释放。仅 docs/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ui-art-implement） | Friday（Codex 美术实施 WF-ui-art-implement），10-05：完成未提交，编辑占用释放。仅game/css/or | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ui-art-step1） | Friday（Codex 美术实施 WF-ui-art-implement），10-05：完成未提交，编辑占用释放。仅game/css/or | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-title-v5） | Friday（Codex 第一首旋律整理v5 WF-music-title-v5），10-05：完成未提交，编辑占用释放。仅 docs/ev | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-title-v4） | Friday（Codex 第一首音乐v4 WF-music-title-v4），10-05：完成未提交，编辑占用释放。仅 docs/evid | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ui-art-live-more） | Friday（Codex 遗漏美术补检 WF-ui-art-live-more），10-05：完成未提交，编辑占用释放。仅docs/evid | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-gap） | Friday（Codex 音乐量化差距 WF-music-gap），10-05：完成未提交，编辑占用释放。仅 docs/evidence/2 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-identity） | Friday（Codex 音乐共同元素与古典配器 WF-music-identity），10-05：完成未提交，编辑占用释放。属地 docs | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ui-art-live） | Friday（Codex 美术实机检查 WF-ui-art-live）｜属地：docs/evidence/2026-10-05-WF-ui- | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-demos） | Friday（Codex 循环音乐 WF-music-demos / WF-music-daw），10-05：完成未提交，编辑占用释放。首轮 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-music-daw） | Friday（Codex 循环音乐 WF-music-demos / WF-music-daw），10-05：完成未提交，编辑占用释放。首轮 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-flow-practice） | Friday（Codex 实际任务流程迭代 WF-flow-practice）｜属地：根AGENTS.md仅流程入口；README.md、d | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-dual-memory-efficiency） | Friday（Codex 双端效率对齐 WF-dual-memory-efficiency）｜属地：Codex/ZCode全局AGENTS、 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-parts-01） | Friday（Codex 无简化动画部件 WF-wu-parts-01）｜属地：game/art-source/characters/wu- | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-memory-efficiency） | Friday（Codex 流程与记忆检索迭代 WF-memory-efficiency）｜属地：scripts/workflow-memor | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-request-batching） | Friday（Codex 请求合并实测 WF-request-batching）｜属地：全局 AGENTS.md、Codex memory_ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-flyslash-no-character） | Friday（Codex 飞身劈无人版 WF-flyslash-no-character）｜属地：cards/martial-tt3-fly | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ach-blank-dismiss） | Friday（Codex 成就详情空白关闭 WF-ach-blank-dismiss）｜属地：game/src/ui/achievement | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-web-restore-2255） | Friday（Codex 5200掉线恢复 WF-web-restore-2255）｜属地：cwd D:\素材\代号柒\搜打撤；127.0. | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-web-5200-1005） | Friday（Codex 5200掉线恢复 WF-web-restore-2255）｜属地：cwd D:\素材\代号柒\搜打撤；127.0. | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-return-settle） | Friday（Codex 主界面返回闪刷修复 WF-home-return-settle）｜属地：game/src/ui/home-menu | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-hub-cover） | Friday（Codex 远征基地同款美术 WF-hub-cover）｜属地：新增game/css/hub-cover*.css、hub-a | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-hub-personnel） | Friday（Codex 远征基地同款美术 WF-hub-cover）｜属地：新增game/css/hub-cover*.css、hub-a | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-hub-warehouse） | Friday（Codex 远征基地同款美术 WF-hub-cover）｜属地：新增game/css/hub-cover*.css、hub-a | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-departure-cover） | Friday（Codex 远征基地同款美术 WF-hub-cover）｜属地：新增game/css/hub-cover*.css、hub-a | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-changwuyu-volcano） | Friday（Codex 充能火山重绘 WF-changwuyu-volcano）｜属地：cards/hero-volcano.webp + | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-volcano-abstract-block） | Friday（Codex 充能火山重绘 WF-changwuyu-volcano）｜属地：cards/hero-volcano.webp + | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wind-song-block-brush） | Friday（Codex 充能火山重绘 WF-changwuyu-volcano）｜属地：cards/hero-volcano.webp + | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-process-trim-1004） | Friday（ZCode 本会话，流程瘦身 WF-process-trim-1004）｜属地：根 AGENTS.md；docs/{READM | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-process-trim） | Friday（ZCode 本会话，流程瘦身 WF-process-trim-1004）｜属地：根 AGENTS.md；docs/{READM | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xingyue-wind-song） | Friday（Codex 正常星月浪掷风吟 WF-xingyue-wind-song）｜属地：cards/hero-sacredrain.w | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-web-codex-1004） | Friday（Codex 本会话，拉起网页版 WF-web-codex-1004）｜属地：cwd 搜打撤；127.0.0.1:5200 /  | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-web-5200-1004） | Friday（ZCode 本会话，拉起网页版 5200 重启 WF-web-5200-1004）｜属地：cwd 搜打撤；127.0.0.1: | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-sfx-opensource-1004） | Friday（ZCode 本会话，音效全量换开源 WF-sfx-opensource-1004）｜属地：game/assets/sfx/ba | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-minako-ui-benchmark） | Friday（ZCode 本会话，米娜可 PV 基准拆解+美术UI升级计划 WF-minako-ui-benchmark）｜属地：docs/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ach-gallery） | Friday（ZCode 本会话，米娜可 PV 基准拆解+美术UI升级计划 WF-minako-ui-benchmark）｜属地：docs/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-photolib-perf） | Friday（ZCode 本会话，米娜可 PV 基准拆解+美术UI升级计划 WF-minako-ui-benchmark）｜属地：docs/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-motion-ui-p0） | Friday（ZCode 本会话，美术UI P0 实施·工作流 dwfrun-0e76e773，WF-motion-ui-p0）｜属地：ga | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-web-5200-1003） | Friday（ZCode 本会话，照相馆打不开排查+Codex 现场盘点）｜属地：cwd 搜打撤；127.0.0.1:5200 / PID2 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-battle-imagegen-v2-1004） | Friday（Codex 无动画立绘返修 WF-wu-battle-imagegen-v2-1004）｜属地：docs/evidence/2 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-battle-imagegen） | Friday（Codex 无动画立绘返修 WF-wu-battle-imagegen-v2-1004）｜属地：docs/evidence/2 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-nai-v3） | Friday（Codex 无战斗立绘 NovelAI WF-wu-nai-v3）【已停止，10-03 老板令弃用，ZCode 会话收尾盘点】 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-nai-prompt-clean） | Friday（Codex 无战斗立绘 NovelAI WF-wu-nai-v3）【已停止，10-03 老板令弃用，ZCode 会话收尾盘点】 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-nai-v13-restore） | Friday（ZCode 本会话，nai_style v1.3 恢复与无正面立绘 WF-nai-v13-restore）｜属地：tools/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-xart-z1） | Friday（ZCode 本会话，nai_style v1.3 恢复与无正面立绘 WF-nai-v13-restore）｜属地：tools/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-style-recipe-v5） | Friday（ZCode 本会话，画风基准重定 WF-style-recipe-v5）｜属地：docs/evidence/2026-10-0 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-experience-art-exec） | Friday（ZCode 本会话，体验美术执行 ZCode 侧 WF-xart-z1）｜属地：**10-03 老板令：Codex 执行会话已 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-experience-art-plan） | Friday（Codex 体验美术总纲 WF-experience-art-plan）｜属地：负责人独占 game/css/{battle, | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-cls2-idle） | Friday（ZCode 本会话，选人页待机演出 WF-cls2-idle）｜属地：game/src/ui/character-idle.j | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ph1-sys03） | Friday（ZCode 本会话，选人页待机演出 WF-cls2-idle）｜属地：game/src/ui/character-idle.j | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-pending35-normalize） | Friday（ZCode 本会话，#35 归一化实施 WF-pending35-normalize）｜属地：scripts/asset-au | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ph1-sys08） | Friday（ZCode 本会话，PH1 第五批 WF-ph1-sys08）｜属地：battle/view 预览构造、battle.core | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ph1-sys11） | Friday（ZCode 本会话，PH1 第三批 WF-ph1-sys11）｜属地：game/src/agent/{recorder,pro | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ph1-sys02） | Friday（ZCode 本会话，PH1 第二批 WF-ph1-sys02）｜属地：game/src/hub/extraction.comm | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ph1-sys01-10） | Friday（ZCode 本会话，PH1 第一批 WF-ph1-sys01-10）｜属地：game/src/run/（经验结算落点：game | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ui-cover-all） | Friday（Codex 全游戏分层界面重塑 WF-ui-cover-all），10-05：授权范围源码美术实现完成未提交，编辑占用释放、待 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-character-pool-cover） | Friday（Codex 角色卡池同款与动效 WF-character-pool-cover），10-05：完成未提交、编辑占用释放。属地  | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-cards-22-fast） | Friday（Codex 二十二卡快速重绘 WF-cards-22-fast），10-05：完成未提交、占用释放。前8黑像卡按原构图：不变应 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-eight-items-rough-1005） | Friday（Codex 八装备粗笔重绘 WF-eight-items-rough-1005），10-05：完成未提交、编辑占用释放。car | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-eight-items-rough） | Friday（Codex 八装备粗笔重绘 WF-eight-items-rough-1005），10-05：完成未提交、编辑占用释放。car | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-holy-shield-fast） | Friday（Codex 圣盾快速粗笔重绘 WF-holy-shield-fast），10-05：完成未提交、占用释放。仅cards/spe | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wallpaper-glass-1005） | Friday（Codex 第二壁纸玻璃与城市背景 WF-wallpaper-glass-1005），10-05：完成未提交、编辑占用释放。属 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wallpaper-redraw） | Friday（Codex 第二壁纸玻璃与城市背景 WF-wallpaper-glass-1005），10-05：完成未提交、编辑占用释放。属 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wallpaper-block-1005） | Friday（Codex 第二壁纸宽笔块面续修 WF-wallpaper-block-1005），10-05：完成未提交、编辑占用释放。属地 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-big-chest-search-1005） | Friday（Codex 搜索大宝箱自由粗笔重绘 WF-big-chest-search-1005），10-05：完成未提交、编辑占用释放。 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-big-chest-search） | Friday（Codex 搜索大宝箱自由粗笔重绘 WF-big-chest-search-1005），10-05：完成未提交、编辑占用释放。 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-map-cover） | Friday（Codex 地图同款美术 WF-map-cover），10-05：完成未提交、编辑占用释放。属地 game/src/core/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wallpaper-redraw-1005） | Friday（Codex 第二壁纸清晰重绘 WF-wallpaper-redraw-1005），10-05：完成未提交、编辑占用释放。属地g | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-fullstrike-identity-rough） | Friday（Codex 全力一击原构图人设修正 WF-fullstrike-identity-rough），10-05：完成未提交、编辑占 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-wallpaper-1005） | Friday（Codex 第二壁纸切换 WF-home-wallpaper-1005），10-05：完成未提交、编辑占用释放。属地game/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-wallpaper） | Friday（Codex 第二壁纸切换 WF-home-wallpaper-1005），10-05：完成未提交、编辑占用释放。属地game/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-fullmoon-creative-1005） | Friday（Codex 满月形态创意粗笔重绘 WF-fullmoon-creative-1005），10-05：完成未提交、编辑占用释放。 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-fullmoon-creative） | Friday（Codex 满月形态创意粗笔重绘 WF-fullmoon-creative-1005），10-05：完成未提交、编辑占用释放。 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-smite-original-rough） | Friday（Codex 惩击原构图粗笔重绘 WF-smite-original-rough），10-05：完成未提交、编辑占用释放。仅ca | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-cardlib-term-colors） | Friday（Codex 卡牌库词条数字分色 WF-cardlib-term-colors），10-05：完成未提交、编辑占用释放。仅gam | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-sealed-limbs-transparent） | Friday（Codex 四封印肢体透明重绘 WF-sealed-limbs-transparent），任务开始10-04：完成未提交、编辑 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-dragonblade-original-rough） | Friday（Codex 青龙偃月斩原构图重绘 WF-dragonblade-original-rough），10-05：完成未提交、编辑占 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-character-cover） | Friday（Codex 全屏选人同款美术 WF-character-cover），10-04：完成未提交、编辑占用释放。属地 game/c | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-heixiang-two-forms-rough） | Friday（Codex 圣剑/青龙原构图粗笔重绘 WF-heixiang-two-forms-rough），10-04：完成未提交、编辑占 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-departure-card-size） | Friday（Codex 整备卡牌放大/底部数量与选项栏 WF-departure-card-size），10-04：实现完成待实页查看、编 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-bound-shadow-rough） | Friday（Codex 受缚之残影粗笔重绘 WF-bound-shadow-rough），10-04：完成未提交、编辑占用释放。cards | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-jianghu-rough-reset） | Friday（Codex 江湖救急改粗笔重置 WF-jianghu-rough-reset），10-04：完成未提交、编辑占用释放。card | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-group-identity-1004） | Friday（Codex 群像人设返修 WF-group-identity-1004），10-04：两遍内置生图候选已展示、完成未提交、编辑 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-group-identity） | Friday（Codex 群像人设返修 WF-group-identity-1004），10-04：两遍内置生图候选已展示、完成未提交、编辑 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-departure-cover-search） | Friday（Codex 整备仓库五列与检索 WF-departure-cover-search），10-04：实现完成待实页查看、编辑占用 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-heaven-face-exact） | Friday（Codex 天剑诛魔脸部严格参考返修 WF-heaven-face-exact），10-04：完成未提交、编辑占用释放。仅ca | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-two-swords-rough） | Friday（Codex 天剑诛魔脸部严格参考返修 WF-heaven-face-exact），10-04：完成未提交、编辑占用释放。仅ca | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-menu-motion） | Friday（Codex 全界面统一动效 WF-home-menu-motion），10-04：完成未提交、编辑占用释放、待老板验收。新增g | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-studio-cover） | Friday（Codex 照相馆同款美术及性能 WF-studio-cover），10-04：实现完成未提交、编辑占用释放，最新照片大小恢复 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-slot-emblems） | Friday（Codex 选档说明移除与徽记重绘 WF-slot-emblems），10-04：完成未提交、编辑占用释放。属地 game/s | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-slots-cover） | Friday（Codex 选档说明移除与徽记重绘 WF-slot-emblems），10-04：完成未提交、编辑占用释放。属地 game/s | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wind-song-abstract） | Friday（Codex 浪掷风吟抽象背景返修 WF-wind-song-abstract），10-04：完成未提交、编辑占用释放。同名替换 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-survival-guide-cover） | Friday（Codex 生存指南同款改造 WF-survival-guide-cover），10-04：完成未提交、编辑占用释放。属地 g | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-rundata-cover） | Friday（Codex 跑局数据同款美术 WF-rundata-cover），10-04：完成未提交、编辑占用释放。属地 game/css | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-inbox-cover） | Friday（Codex 留言界面同款美术 WF-inbox-cover），10-04：完成未提交、编辑占用释放。属地 game/css/p | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-cards-integrate-1004） | Friday（Codex 接入无今日职业卡 WF-wu-cards-integrate-1004），10-04：完成未提交，编辑占用释放。来 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-wu-cards-integrate） | Friday（Codex 接入无今日职业卡 WF-wu-cards-integrate-1004），10-04：完成未提交，编辑占用释放。来 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-settings-cover） | Friday（Codex 设置页同款美术 WF-settings-cover），10-04：完成未提交、编辑占用释放，老板反馈“非常好”。属 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-ach-proportion） | Friday（Codex 成就比例修正 WF-ach-proportion），10-04 21:04：完成未提交，编辑锁释放。仅 game/ | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-composition） | Friday（Codex 主页构图重构及续修 WF-home-composition），10-04：完成未提交、编辑占用释放。属地 game | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-snow-wallpaper） | Friday（Codex 主页构图重构及续修 WF-home-composition），10-04：完成未提交、编辑占用释放。属地 game | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-volcano-v4-reference） | Friday（Codex 通用画风提取与充能火山独立候选 WF-volcano-v4-reference），10-04：完成未提交、编辑锁释 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-home-minako-layout） | Friday（ZCode 本会话，首页米娜可式排版重做 WF-home-minako-layout），10-04：完成未提交、编辑锁释放，待 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-baita-lore-raving） | Friday（Codex 博览者狂语重绘 WF-baita-lore-raving），10-04：v6完成未提交、编辑锁释放。仅 cards | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-photo-studio-unified） | Friday（Codex 照相馆统一UI WF-photo-studio-unified），10-04：完成未提交、编辑锁释放，待老板验收。 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-stop-servers） | Friday（Codex 关闭多余服务器 WF-stop-servers），10-04 20:52：老板明确授权“停掉现在所有服务器，只留5 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-feedback-title-batch-1005） | Friday（ZCode 本会话·留言批处理 WF-feedback-title-batch-1005，三子代理分批），10-05 完成未提 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-feedback-inbox-polish） | Friday（ZCode 本会话·留言批处理 WF-feedback-title-batch-1005，三子代理分批），10-05 完成未提 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
| Friday（历史记录 WF-title-visuals） | Friday（ZCode 本会话·留言批处理 WF-feedback-title-batch-1005，三子代理分批），10-05 完成未提 | [原文](archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md#近期已释放) | 历史状态与归属见原文 |
