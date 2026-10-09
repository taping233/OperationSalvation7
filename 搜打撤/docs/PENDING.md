# 待拍板台账（PENDING）

> **规则（09-29 起）**：
> 1. 任何会话产生「等老板拍板/处置」的事项，**即时**登记一行（一事一行，注明来源与需要的决定）；拍板后回写来源，将记录移至「已决记录」，不混入活账、不抹除决策依据。
> 2. 台账只收**等决策/等处置**的活账；未排期 backlog、需求想法不入（各归 roadmap / 战役文件）。
> 3. 删除先列具体路径清单获批；台账仅批准方向而未给清单时补清单，清单已获批且范围未变沿用授权，不重复确认。提交/回滚/发布等授权仍独立。
> 4. 记忆只放指针。事项识别来源/对象/需要的决定以避免重复登记；普通修复 backlog 移路线图并留回链，已授权实施归任务记录，不重新挂成等待批准。
> 5. 日落（10-02）：活账挂超 7 天未决——普通工程/处置类在下一落库批次自动降级 [roadmap](roadmap.md) 并留回链；玩法语义与删除报批类不自动降级，仅由 handoff ⏰ 持续催办至拍板。

## 活账

| # | 事项 | 提出 | 来源 | 备注 |
|---|---|---|---|---|
| 38 | 方舟衍生残留资产处置拍板：主链路音效已于 10-04 全量换开源（battle 核心 27 件重做，见来源证据），但休眠方舟素材仍在库（不接入任何运行链路）：①game/assets/sfx/alternatives/arknights{,-adjusted,-expansion,-runtime}/ 共 188 ogg（sound.bank.js 试听页仍指向 runtime 库，主链路不加载）；②docs/evidence/2026-09-30-sfx-alternatives/A-arknights/originals/ 方舟原音频 wav 与 A/A2 processed-wav。删（git rm，历史重写另牵动 #32 同批）或留（仅存档不发布）请拍板 | 10-04 | docs/evidence/2026-10-04-sfx-opensource/README.md 待拍板节 | 删除需按规另列清单审批；发布/商用前必须清 |
| 2 | 战斗右键弹反馈浮层做否（历史挂账功能） | 09-25 | 记忆 soudache-continuous-refactor-2026-09-25 | |
| 9 | 照相馆 `?libPerfDiag` DEV 诊断钩子（game.cardslib.page.js）去留：保留=可随时复跑滚动归因五连测，删=一句话即清 | 09-29 | docs/PHOTOLIB-PERF-TASK-2026-09-29.md 遗留3 | 生产构建零开销 |
| 10 | `game/src/e2.snapshot.qa.js` 删留单议（E2 验收宿主遗产，E 批已归档；knip A 类批其余项已执行销账：renderer.icons 位图管线 289→57 行、getHomeForSlot、openAltarRitual re-export、三个无人 default+matchBlank 死导出词、run-architecture 断言清单腐坏项同步修正；dev-shims 改判误报=dev.html importmap 依赖） | 09-29 深夜 | knip 首跑甄别（09-29 深夜会话） | 其余已执行，本条仅剩 e2.snapshot |
| 13 | 照相馆照片在 Vite 主线 dev 服全黑：页面相对路径 `assets/thumbs/*.webp` 解析到 `/game/assets/*` 被 SPA fallback 回 text/html（16/16 naturalWidth=0），绝对路径 `/assets/*` 有映射正常；8137 类静态服（game/ 即根）不受影响。修不修（改绝对路径/加 Vite 映射）等拍板 | 09-29 深夜 | CSS 精修班顺带发现（docs/evidence/css-dedupe-2026-09-29/README.md 顺带发现①；HEAD 版 A/B 同现=既有问题） | 影响：以后在 Vite 主线服做照相馆实页验收会被照片黑块干扰 |
| 16 | 自施 debuff 首 tick 语义仍待定：当前挂上后同回合末递减，STS2 跳过首 tick（find-D-0100 R-4） | 09-30 夜班 | 夜班 STS2 对照第二批 + journal 延伸 | 已解释，老板指示「后面做」；不重复催问，实施前确认语义 |
| 19 | 终局短路深化：文本路径句内多动词不做句内中断（单 immediate 句内步级不查全灭守卫），修复单已披露（fix-U16-0500）——要完全对齐 STS2 需句级守卫另开单元；遗留 dmg 字段路径（resolution:742-872）维护者后续改动时需复评（R10 NOTE） | 09-30 | 夜班 U16 复审 R10 | |
| 20 | finish(false)→terminalPending 异步窗口内 beforeunload 可把 run 级负 hp 写入存档（旧语义写 0 同类窗口，危害 0→负升级，概率低；bag.settle.js:34 onBattleEnd async 间隙，hub 域处置）——R12 移交①挂账成立 | 09-30 | 夜班 U18 复审 R12 | |
| 26 | 疑似游戏 bug：宝箱搜刮页多箱队列中 `chestSkip`/`chestTake` 点击 handler 返回 ok 但队列不推进（实机实测连点 40 次全空转，spin 熔断；单箱场景 chest 正常）——玩家手动点「只收金币并离开」预计同样卡。影响 extract/fullrun 剧本完整收口。需定性 chests.js 的 next()/queue 状态机 | 10-01 | docs/evidence/2026-10-01-acceptance-scenes/README.md 坑 8（trace 证据在案） | 定性修复后 extract/fullrun 重跑销账 |
| 23 | 性能优化遗留两项是否排期：F11 启动链动态 import 拆包（47k 行 ESM 解析几十 ms；牵动 boot-order 契约与初始化时序）、F1 全量版快照签名代际缓存（战斗状态写入通道无统一信号——set$ 赋值与数组原位变异并存，代际会漏事件产出陈旧快照；已用 getBattleLiveness 轻查询覆盖其热路径） | 10-01 | docs/evidence/2026-10-01-full-audit-fix-perf/README.md 第二轮 | 评估后暂不实施（回归风险>收益）；其余 F1 局部/F3/F4/F5②/F9/F12/F8 补充均已实施，F5③ 已有封顶 |
| 24 | `game/tools/agent-batch.mjs` fetch 桥 2 行追认：审计班子代理修 INFRA-04/05 时使能（jsdom 无 window.fetch，旧回落恒拒绝 → llm 批跑静默退化贪心），按原注释意图回落 Node 原生 fetch | 10-01 | docs/evidence/2026-10-01-full-audit-fix-perf/README.md 待拍板节 | 不追认可 2 行回退，但 INFRA-04/05 桩验收随之失效 |
| 27 | ~~提交机制重设计 6 提案拍板~~【部分销账 10-01 深夜】：老板令「应用新的方案」——**R1 提交边界守卫已实施**（staged 命中 REGISTRY 无主物品阻断，GATE_MANIFEST_OK=1 逃生口；26a5254 形态演练拦截实证）；**R2 已实施**（未映射脚本回退 scripts-contract 契约+引用搜索+哨兵，同改动集 48s 全量→8s quick；映射守卫倒逼新脚本登记）；**R4 已实施**（task/ledger `--expect auto` 一步化，锁内复核+apply 重 plan 双防线，并发演练通过）；**R6 已实施**（gate --paths 逗号空格均收）；**R3 已数据化不改规则**（runtime 13 文件 7 个本就 quick，仅 battle.runtime.* 核心 6 文件全量且影响面 12-54 判得合理——首轮「runtime 整体全量」判断过粗已修正；core/ 30 文件全量是审慎设计，收窄另立专项）；FIX1-5 与 R1/R2/R4/R6 已落库 73a8f12+docs 次笔 | 10-01 | docs/evidence/2026-10-01-commit-gate-audit/ | 剩 R5 见 #28；提交授权待老板指令 |
| 28 | worktree 清理报批（R5 清单）：主仓库外 13 个附属 worktree 共 3.0GB（C:/Users/太平/.codex/worktrees）。分类——①Temp prunable 2 个（soudache-release/settlement-20260923，`git worktree prune` 即清）；②codex 分支挂靠 6 个（836c/full-flow-validation、agent-llm/20260928、architecture-luna/vite-architecture-closeout、b518/vite-rapid-iteration-20260914、luna-navigation-bag、photo-select-20260928——分支历史仍在，删 worktree 目录不丢提交）；③detached 无分支 5 个（art-iteration、battle-state-effect-families、ea55、luna-hub-economy、luna-ui-implementation——快照在对象库，删除前建议逐个核对无未提交内容）。**全部只报批未动** | 10-01 | 本表 #27/R5；`git worktree list --porcelain` 实测 | 老板勾选可删清单后执行；hooksPath 共享不受影响（附属树本就禁改钩子） |
| 30 | DEBT-1 状态写入通道方案 B（全 setter 化 25 豁免字段）做否：定性结论=现状「受控双轨」（65 setter 在用+25 归因豁免+守卫锁死名单漂移即红），方案 A 维持现状已采纳（零代码改动）；方案 B 需改 25 字段全部写入点（含存档回填/深变异路径），换来已被独立否决的 F1 全量代际缓存的理论可行性——Friday 评估负收益不推荐。老板可否决 A 改做 B | 10-02 | docs/evidence/2026-10-02-DEBT-1/characterization.md | 默认按 A 执行不阻塞 DEBT-2/3 |
| 31 | 全量代码审计 112 条待拍板（flash 十域只读审计+机器 grep 复核+人工抽检 3/3 坐实）：**A 档 74 条**（死导出~50/死 CSS 类 149 个约 254 行+死动画/重复块/hosted 注册表 61 条四处手写/motion hit() 死链等，预计可删约 400 行，机器验证+抽检过）；**B 档 36 条**（存档管线热路径 readIdentity×13 parse/每步走格双序列化、_m01.requests 无界增长、CLASS_STORY 双源、enemy-phase 双轨归还等，需测量或语义复核）；C 档 2 条保留。删除实施=逐条 A 档三证据+定向验证；性能项先测量后动。老板批 A 档即执行（建议 A 全批+B 挑存档管线三项先做） | 10-02 | docs/evidence/2026-10-02-code-audit/REPORT.md（69KB 全清单+证据行） | 【10-02 执行完毕】A 档 72 条已删（15 条复验跳过——其中 4 条 flash 复验推翻审计证据：matchHandSelectKey/parsePoolNoun/render 有测试实消费、expedition-shop:114 是活规则；B/C 档按铁律未动），全量 268 文件 2199 过 exit 0 亲手复核；B-1 readIdentity memo 已做（66 存档链测试绿）；**B-2 走格落盘合帧挂档待专项**（playSeconds 口径=结算边界合并已查明，改动牵动 meta 消费链与成就触发，宜独立批次细做）；B-3 收据表修剪需定版重放契约策略待老板口径 |
| 32 | evidence 二进制历史瘦身：.git 实测 2.2GB（pack 954MB），大头=docs/evidence/2026-09-30-sfx-full-v5 master zip 41MB、2026-09-30-sfx-alternatives CC0 素材 65MB、2026-09-30-vertical-slice-review runtime-copy 整份游戏副本 108MB（均 tracked 在库）。git filter-repo 重写历史+强推 taping233/OperationSalvation7 可瘦身（提交哈希全变、协作端需重新 clone、执行前备份 bundle）；保守替代=仅执行未来红线（.gitignore+AGENTS 红线已于 10-02 落）不动历史 | 10-02 | docs/evidence/2026-10-02-flow-efficiency/README.md（10-02 流程审查报告 P1 实测数据） | 选时机拍板 |
| 33 | 删除审批打包（原 #1/#3 剩余项合并，一次拍板不再逐条确认）：①`docs/evidence/perf-probe-photo/`、`docs/evidence/perf-probe-run/` 两目录（tracked，约 53K）；②`game/assets/cards/martial-melee.webp`、`game/assets/cards/martial-ranged.webp` 及 `game/assets/thumbs/cards/` 同名 2 张（card-art-coverage KNOWN_ORPHANS 白名单剩余全部；原 #3 七张中其余已随 f8c3561 批删）。老板勾选①②任意子集即执行 | 10-02 | 本表 #1/#3；10-02 流程审查现场核实（KNOWN_ORPHANS=melee/ranged 两条） | 范围不变沿用授权 |
| 37 | 美术 UI 升级计划拍板（米娜可 PV 基准 BV1PL3c6gEKF，v3）：①P0-A 转场四件套（斜纹闸门/失焦退场/界面即过场/**全界面开合成对动画**——老板令「点开任何界面和退出都要有过渡」，附录 B 五档）+无线电通讯演出是否启动；②**首页排版重做方案 A/B/C**（老板令「图不换、排版换」：A=左轴纵列【建议，壁纸压暗渐变天然吻合】/B=底缘汇流 dock/C=左轴+右下锚点），前置=WF-ach-gallery 属地协调；③贴纸标签用色（建议双色：金=获得类、青=状态类）；④通讯演出文案来源（建议复用 flow 现有文案）；⑤立绘 idle 微摆做否（P2）；⑥闸门用色（建议暖金×深青）；⑦战斗域开合走 .18s fast 轻量版确认。逐页落点见附录 A（32 界面全映射）；P1 另有前置=WF-photolib-perf 归因协调 | 10-04（v3 同日修订） | docs/evidence/2026-10-04-minako-ui-benchmark/美术UI升级计划.md §2A/D9-T4/D13/§5/附录A/B（拆解帧证据同目录 frames/） | 【10-04 执行进展】①已拍板执行：P0-A+P0-B 随 WF-motion-ui-p0 落地并实页验收通过；⑥闸门已按暖金×深青实现；⑦战斗域 .18s fast 已实现；②首页排版重做：先经实页验收后老板令「改回原样」完整撤回，同日老板再令「模仿米娜可主菜单排版修首页」＝D13 方向拍板，WF-home-minako-layout r1→r3 三轮落地（左轴 01/02 编号大键+右列平行四边形+星芒/墨描边/斜切条/贴纸，老板 r2/r3 追加令全落），待老板实机验收；⑤未做；③按复用 flow 风格文案实现 demo。剩余待拍板：标准弹层开参数是否全量收编新模块（已知偏差节）、P1/P2 排期、闸门全链路扩展与否 |

## 已决记录（不计入活账）

这里保留编号与原登记状态；决定、实施详情和原来源见[整理前快照](archive/WF-ledger-context-1009/originals/docs/PENDING.md)。原备注仍为“待专项”等状态的记录，按其来源核对后续任务。

| # | 历史事项 | 提出 / 记录 | 来源 | 原备注 |
|---|---|---|---|---|
| ~~1~~ | docs/evidence/ 内 perf-probe-photo、perf-probe-run 两目录（53K）已入库仍 tracked， | 09-29 夜班 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 【10-02】并入 #33 打包拍板 |
| ~~3~~ | 死图 7 张待批删（卡面重出审计豁免之外） | 09-23 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 【10-02 核实】原七张其余已随 f8c3561「删除已批孤儿资产 108 文件」批删；剩 martial-melee/ranged 两张并入 #33 |
| ~~4~~ | 三份 PARALLEL 盘点文档未跟踪，处置方式 | 09-27 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 【10-05 收尾销账】对象已不存在（docs/ 与工作树实核无盘点文档），疑点解除 |
| ~~5~~ | photo-nail 待处置 | 09-19 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 【10-05 收尾销账】全库实核无 photo-nail 对象（find 零命中），疑点解除 |
| ~~6~~ | martial-builtin-sha 死图待批删 | 09-19 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 【10-02 核实销账】图片已不存在（随 f8c3561 孤儿批删落库）；card-art-coverage 现行白名单仅剩 melee/ranged 两张，入 #33 |
| ~~7~~ | 僵尸 Vite：.exp-observe/ 5199 端口（PID 21256，09-25 起）杀否 | 09-28 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 【10-05 收尾销账】5199 已无监听（netstat 实核），僵尸进程已自然消失，无需处置 |
| ~~21~~ | 已实施：scripts/iab-drive.mjs 由 WF-acceptance-scenes 收编纳管（owner 补齐+runScen | 09-30 挂账；10-01 老板拍板收编 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 完结 |
| ~~25~~ | 部分完成：event 实机过（664ms）、extract 机制全链路验证（跳层/BFS/战斗/死亡收束全通），fullrun 同链路依赖； | 10-01 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 剩余收口归 #26 |
| ~~29~~ | ~~低效/重叠工具清理报批~~【10-02 老板令「弄完」全部了结】：①page-snapshot.mjs 已合并清理（27 行壳删除，功能 | 10-01 挂账；10-02 销账 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 完结 |
| ~~37~~ | 老板选择：候选图暂留，先完成界面与性能；不进行去背景衍生/扩批/运行替换 | 10-03 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | v1/v2原稿保留 game/assets/portraits/battle-v2/wu-melee-sample-v1.png、wu-melee-sample-v2.png，均>1MB排除Git；本轮转向UI与性能，候选透明/安全距仍未通过，不算运行美术交付 |
| ~~35~~ | 已实施（老板拍板方案 1 行尾归一化，10-03）：asset-audit-lib 对 svg/json 按 LF 归一后计 bytes/s | 10-03 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 完结 |
| 36 | boot.test.js IME Esc 用例全量负载连红：tests/boot.test.js:529（组合态不误触→非组合态 Esc 关 | 10-03 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 待专项 |
| 34 | production-research 返工额度 | 10-02 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 老板明确批准“允许至55%，完成关键证据”；从已用49%继续，目标辅助四层/首脑/终局撤离/基地实收和报告整合，不新增游戏修改或提交授权 |
| ~~8~~ | 已处置（老板拍板「其他的全部落库」+三项明细确认）：.codex/config.toml 与 项目近况-2026-09-29/ 入库、.ui | 10-01 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 完结 |
| ~~22~~ | 已实施：老板授权修复全量 3 红灯——hub-flow-regression 源码形状守卫放宽为有界顺序断言（合法音效插入不再误红，CRLF | 10-01 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 完结；变异演练另发现 pets 数值覆盖空洞（全链路无人测），归 backlog 另议 |
| ~~14~~ | 已实施：老板拍板 STS2 式全灭短路，foesAnnihilated 循环守卫及字段兜底，onKill/吸血 rider 原子保留；历史  | 09-30 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 完结；句内深化 #19 仍待决 |
| ~~15~~ | 已实施：老板拍板负血 + 即时死亡；免死钩照旧、展示钳 0、快照真实值；4f0fae5，R12 PASS | 09-30 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 完结；保存窗口 #20 仍待决 |
| ~~17~~ | 已实施：老板拍板主档 corrupt 时回退同链 prev 并逐字节自愈，tooNew 不回退；历史 8 例，8f6756c，R11 有保留 | 09-30 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 完结 |
| 18 | 无 IME 守卫的极窄 moveCancel 入口，属于未排期 P3 修复，09-30 按本台账职责转 roadmap | 09-30 分类核对（非玩法拍板） | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 未实施，保留原问题与风险说明在路线图 |
| ~~11~~ | 已执行销账（09-29 深夜，老板批「删除c类」）：set$×25 定义行全删（effects 13/piles 4/presentatio | 09-29 深夜 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 完结 |
| ~~12~~ | 已执行销账（09-29 深夜，老板批「按步骤做」，档一）：新建 ui/terminal-settlement.js 消 death⇄menu | 09-29 深夜 | [完整决定与来源](archive/WF-ledger-context-1009/originals/docs/PENDING.md) | 完结（CSS 档另议） |
