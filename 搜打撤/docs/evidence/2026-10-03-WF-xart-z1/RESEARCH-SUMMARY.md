# WF-xart-z1 三线研究汇总（A3 / A5 / A6）

- 日期：2026-10-03
- 来源：WF-xart-z1 三线研究数据；对应证据文件同目录 `a3-research.json` / `a5-research.json` / `a6-research.json`
- 口径注记：盘上三份 research.json 为研究首过版本（findings 全标 verified）；本汇总以含复核结论的下发研究数据为准——verified/unconfirmed 口径以本文 ②③ 为准，status 行数 / 发现数 / keeps / unverified 计数两者一致
- 性质：只读研究产出的书记汇总，只新增本文件、不改其他文件；三线全程禁浏览器，结论均为源码级（未验证范围见 ④ unverified）

## ① 三线总览

| 研究线 | 覆盖页签数（status 行） | 发现数 | verified | unconfirmed |
|---|---:|---:|---:|---:|
| A3 | 13 | 7 | 2 | 5 |
| A5 | 11 | 5 | 2 | 3 |
| A6 | 22 | 4 | 1 | 3 |
| 合计 | 46 | 16 | 5 | 11 |

计数口径：「覆盖页签数」按各线报告 status 数组行数计，合并页签组（A6 的 HUB-ACH/HUB-BACKS/HUB-ACHIEVEMENTS/HUB-COLLECTION、INBOX/SUGGESTION、CARDS-EXPORT/CARDS-IMPORT、NODE-NOTE 四件套、DEV 四页签；A3 的 SACRIFICE/ALTAR-REWARD/DOOR/ALTAR-FRAGMENT-FAIL、CHEST-PICK/ALL、RUN-SHOP/RUN-SELL、RUN-TRANSITION/NODE-SAFE/POCKET-RESTORE、BAG/BAG-PEARL/BAG-POUCH、MAP-LAYER1..4）均按 1 行计。A6 的 22 行中 1 行为「coverage 对应行新鲜度」核对行（非页签，页签行实为 21），该行同时给出 coverage.json 对应行新鲜度：17 新鲜 / 26 过期，报告结论已按当前源码重核、coverage 行 status 未回写。A5 的 11 行中 1 行为「战斗结算组其余 14 行」锚点批量核验、1 行为数据页/聚合消费核验；A3 keeps 另载 coverage 新鲜度结论「44 行 123 个 input：104 新鲜/19 STALE/0 缺失」（原文见 ④）。

## ② verified findings（5 条）

verified 项均附「逐处读码/实跑复核成立」级复核（review）记录，原文见各线证据 JSON；下表逐条照录研究数据字段。

| id | where | 问题 | 影响 | 建议动作 |
|---|---|---|---|---|
| A3-PREP-01 | game/src/hub/preparation.view.js:18 + game/src/hub/preparation.commands.js:82-85 | 预设摘要只显示『带入 N 张 · X 缺失 · Y 禁带』，而 canStart 还依赖 characterKnown/characterOwned/petKnown/petOwned 四项资格判定，UI 无任何表达 | 玩家选了未拥有人物/宠物后『应用到整备』永远禁用，界面显示『需要处理 · 0 缺失 · 0 禁带』，无原因可查 | fix：prep-summary 消费 preview.qualification 追加一行原因（如『人物未拥有』） |
| A3-PREP-02 | game/src/hub/game.hub.depart.js:219-231,368-372 + game/src/hub/preparation.commands.js:64-77 + game/src/hub/game.hub.preparation.js:108-116 + game/src/run/game.session.bag.js:26-27,47-51 + game/src/run/game.session.js:495-500 | 同名叠放两套口径并存：手动加牌封顶 stackCap(3/5) 并称『局内叠放上限』，局内实际是分段占格无硬上限（第 4 张起另占一格），预设应用路径完全不经过 stackCap 封顶也不按多占格计容量 | 仓库同名 ≥4 张时预设可带超量并通过预览，整备页按种类数显示格数而局内多占格（预览失真）；『局内叠放上限』描述了局内不存在的规则，帮助文案『格数=种类数+初始攻击』同样只在每名≤stackCap 时成立，玩家容量心智被误导 | fix（跨属地协调）：preset-apply 对超 stackCap 的 pick 截断并提示，或 previewDeployment 按分段计入 slotsUsed；文案改『每格叠放上限，超出另占一格』。game.hub.depart.js 属 exploration_layout 会话，需协调 |
| A5-DEATH-01 | game/src/run/game.session.death.js:152-168（回执字段在同文件 :40-44） | 死亡结算页不展示关键损失明细：buildDeathReceipt 已算出 losses.lostNotable（传说/史诗至多6条）并随 token.receipt 进入 finish 作用域，但 doom-panel 只显示资源损失价值与抢运卡面，具体丢了哪些关键卡只有 UI.log 一句「其余全部丢失」；对照撤离成功页有「散失：未入库 N 张（【卡名】×n）」逐名表达 | 死亡是不可逆损失场景，玩家在结算面板上看不到自己丢了哪些传说/史诗卡，与撤离页损失表达不一致；TASKS A5.1「损失分别表达」未在死亡页达成 | fix：doom-panel 增加 losses 行读 token.receipt.losses（复用 altar.js:996-998 lossRow 形态，含 lostCount 与 lostNotable 名单）；该文件为 PH1 完成未提交增量，实施前需与 SYS-11 会话协调 |
| A5-EXSTASH-01 | game/src/run/game.run.altar.js:862-870（renderExtractStash 卡片网格） | 整理入库页不区分「带入的卡」与「局内获得的卡」：带入卡出发时已从基地仓库移除（base-departure.commands.js:54-55 扣库存），未入库即永久损失（game.session.js:417 v0.21 规则），但整理页所有卡按同一「未入库将丢失」呈现，无来源标记 | 仓库容量不足时玩家无法一眼识别哪些卡是永久收藏（优先抢救）、哪些只是本局收获，可能把永久损失浪费在局内散卡上；TASKS A5.1「候选、实际入库、原库存和损失分别表达」中的原库存维度缺失 | fix：ext-card 加来源角标——o.brought 在 game.ownedCards 上仍可取（extractLeft 只有 card+count，需按卡名/uid 映射；刷新恢复 resumeExtraction 后 ownedCards 同样在位 game.session.js:314,364），注意同名多张部分带入的边界 |
| A6-ACH-01 | game/src/hub/game.hub.js:287-290 | 成就领取 claimAch 只处理成功分支：meta.js claim() 专门构造的仓库满缓发回执 {ok:false,why:'full',msg:'仓库容量不足——先卖出或扩建卡牌仓库再来领取'}（meta.js:239-241）与 grantReward 的存储写失败回执 {ok:false,why:'save',msg:'基地存档未保存…'}（base-economy.js:24）在此被整体丢弃，点击「领取」后无日志、无重绘、无任何反馈。收藏里程碑 claimColl（game.hub.js:305-309）处理了 why==='full' 但同样漏掉 save 失败分支。 | 带卡奖励的成就（achievements.json 实证 labScore2→tt3-thunderblast、labScore3→tt3-immortal-blade）在仓库满时点领取完全无反应，玩家会以为按钮坏了；所有成就/收藏领取在 localStorage 写满时同样静默失败。错误消息已构造好，只差消费端一行。 | fix：game.hub.js claimAch 补 else 分支 UI.log(r.msg \|\| '领取失败，请稍后重试','warn') 并在失败但原因明确时也 renderHub()；claimColl 补 r.why==='save' 时 UI.log(r.msg,'warn')。不改 claim/grantReward 语义。 |

## ③ unconfirmed findings（11 条）

口径说明：verified 项均附逐处读码/实跑的复核（review）记录；以下 unconfirmed 项在研究数据中均无 review 字段——即未留存同等独立复现的复核记录，故维持 unconfirmed。「复核未复现（未升级为 verified）」的原因凡数据中注明者逐条照录，未注明者如实标记「数据未注明」。

| id | where | 问题 | 影响 | 建议动作 | 复核未升级为 verified 的原因 |
|---|---|---|---|---|---|
| A3-PREP-03 | game/src/hub/game.hub.preparation.js:98-117 + game/src/hub/preparation.commands.js:126 + game/src/hub/preparation.view.js:15,19 | 预设人物/宠物字段只作 canStart 资格闸：应用时只传 picks，characterId/petId 丢弃，出发后仍重新选人；带 characterId 的 startDeployment 事务路径（M11）在 UI 无入口 | 预设里选已拥有人物并应用后对开局零效果，易误解为会自动选人；文案自洽（view:20、depart.js:51 均声明『出发后选择』），属功能空转非误导文案 | investigate：是否让预设选人预填出发选人页属玩法决策，列方案问老板，不建议静默改 | 数据未注明；建议动作自注为 investigate（玩法决策，列方案问老板） |
| A3-PREP-04 | game/src/hub/game.hub.preparation.js:29-40,74-125 + game/src/hub/preparation.view.js:64 | 整备预设页无 busy 态：makeModel 从不传 busy（aria-busy 恒 false），异步命令执行期间按钮不禁用 | 快速连点会并发多次 savePreset/setTrackedGoals，依赖 expectedRevision 兜底，冲突时报泛化『操作失败』；窗口小有反馈，轻微损伤 | fix：onIntent 入口置 busy 并 repaint 完成后复位，或按钮侧最简防抖 | 数据未注明 |
| A3-SRC-01 | game/src/hub/preparation.sources.js:4-6,11 | evidenceRef 四处漂移（isRandomObtainable 实在 cards.rules.js:234、base.js:shopCards 符号已不存在（实在 base.js:273-279 seedStarterStash）、chests.js:52→现 69、altar.js:39/473→现 105/520）；本地判定复制缺 card.type!=='能力卡' 排除 | evidenceRef 不向玩家展示（view:39 只用 conditions），仅损维护溯源；缺能力卡排除在当前数据下无实害（cards.data.js 全部 17 张能力卡均带 cls 走 abilityPool 分支），未来无 cls 能力卡会被误标『通用随机池』 | fix：一行补 type!=='能力卡'；evidenceRef 随下次触碰该文件顺带更新，不单独开工 | 数据未注明 |
| A3-ALTAR-01 | game/src/run/game.run.altar.js:505 + game/src/run/game.run.scenes.js:301-322 | 祭坛『献祭道具·复原卡牌』调用 openPocketRestore 不传 opts，复原页落默认身份『营火休整』；scenes.js:301-302 注释（09-19 留言 #21）明确不应再伪装营火；同批在途改动已给回赠路径传 opts（altar.js:570-572，git diff 可见在途新增），漏掉 505 | 玩家在污染祭坛献道具后跳出『营火休整』页（火堆图标/场景色/『继续旅程』按钮），节点身份语境断裂——FACTS A3 边界候选之一，源码级复现成立 | fix：一行补 { tone:'altar', icon:'[[icon:crystal]]', title:'祭坛复原' } 同款 opts；属地 game.run.altar.js 归他人（祭坛文案在途），转交协调勿双改 | 数据未注明；finding 自注属地 game.run.altar.js 归他人（祭坛文案在途），「转交协调勿双改」 |
| A3-SHOP-01 | game/src/run/game.run.shop.js:370,398,400 + game/src/run/game.session.js:65-70 | 商店买不下/补不了的拒绝文案断言『同名卡最多叠 3 张——初始攻击/火球 5 张』，而实际判定 canReceiveCard 是分段占格无硬上限（堆满一段后有空格即可继续收） | 拒绝行为保守正确，但文案教给玩家一条不存在的全局规则：与事件/火堆/宝箱可收第 4 张同名的实际行为冲突，与 A3-PREP-02 同族口径不一致 | fix：文案改真实拒绝原因（『同名已叠满一格且无空格』）；shop.js 属 PH1 在途避让，转主代理/属地 | 数据未注明；建议动作自注「shop.js 属 PH1 在途避让，转主代理/属地」 |
| A5-DEATH-02 | game/src/run/game.session.death.js:92,:96,:131（对照 :22-24 与 game/src/run/game.session.bag.js:39） | 死亡页「抢运回基地 N 张」与回执口径分歧：页面 savedN 用 cardStacks(true)（排除一切 o.stored，game.session.bag.js:39），而实际提交清单 token.cards 含珍珠盒安全时的 stored 资源卡（death.js:96），buildDeathReceipt.netTake.cardsStashed 按后者计数且 run.death 确实提交进仓库 | 珍珠盒升级且存有资源卡、盒又放入安全格的玩家，死亡面板张数/卡面列表少于实际入库与数据页 netTake 记录，对账困惑；低频边界 | fix：面板统计改读 token.receipt.netTake.cardsStashed，或列表/文案把「珍珠盒随盒抢运 M 张」单列 | 数据未注明 |
| A5-EXRETRY-01 | game/src/run/game.run.altar.js:834-838（对照 game/src/ui/terminal-settlement.js:33-38） | 撤离重试页没有 SYS-10 同款兜底说明：overlay 仅「撤离已成功，整理快照尚未确认写入。请重试保存后继续。」与重试钮，无关闭/替代出口；失败原因只进 UI.log（:802/:826），「退出重进安全」（doExtract 前已 saveGame 落盘撤前局面，:787）未告知玩家 | 存储持续失败（如配额满）时玩家困在无出口弹层里循环重试，不知道退出重进可回到撤前局面；死亡/放弃重试页已补齐同类说明，表现不一致 | fix：补一行人话说明（失败原因+进度在哪+退出重进兜底），复用 terminal-settlement.js:36-38 文案结构；属地 game.run.altar.js 撤离段（PH1 在途增量旁，注意避让） | 数据未注明；建议动作自注属地 game.run.altar.js 撤离段在 PH1 在途增量旁，注意避让 |
| A5-ABANDON-01 | game/src/ui/game.menu.js:870-873（对照 game/src/run/game.session.death.js:163-166） | 同为「宠物抢运清单」，放弃页用纯文本名字列表，死亡页用卡面网格（doom-cards + cardHTML），同一语义两种视觉表达 | 轻微：文本清单可读但与死亡页不一致，A2 定结算/领取样板时领取列表形态需统一口径 | investigate：不单独动，等 A2 规范定「领取/抢运列表」代表形态后随样板统一 | 数据未注明；建议动作自注「不单独动，等 A2 规范定代表形态后随样板统一」 |
| A6-STASH-01 | game/src/hub/game.hub.pages.js:92,117 | 消耗口袋「复原」按钮的可用判定用 B.keyCount()（真实钥匙储备+仓库钥匙材料卡折算，base.js:639-648），而点击后 restore() 执行判定只认真实储备 data.keys（base.js:483）。仓库有钥匙材料卡但真实储备不足时按钮亮起，点击必报「钥匙不足…可在仓库把钥匙材料卡『使用』折入储备」（game.hub.js:284）。 | 玩家多点一次无效按钮并需读一条解释才能继续；引导文案存在、流程可走通（先使用材料卡再复原），故仅为轻微摩擦而非不可用。 | fix：game.hub.pages.js 口袋行 afford 改用 B.data.keys\|\|0 与 restore 同口径（title 补「钥匙材料卡需先使用折入」），或保持现状并接受该提示引导——二选一，前者最便宜。 | 数据未注明 |
| A6-STASH-02 | game/src/hub/game.hub.pages.js:249-253,378-382 | 仓库弹层内材料「使用 1 张/全部使用」与「卖出 1 张/全部卖出」的命令失败分支静默：useStashMaterial/sellStashCards 的 {ok:false,why:'save',msg:'基地存档未保存，请重新载入后重试'}（base.js:592,611）在两处都只写 if (r.ok)，失败时同样执行 renderHub() 关闭弹层，无任何提示。 | 存储写满的边缘场景下，玩家确认操作后弹层关闭但物资/币未到账、卡未减少且无解释；操作本身未生效（幂等，无数据损失）。 | fix：两处补 else UI.log(r.msg \|\| '操作未生效，请重新载入档位后重试','warn')，失败时不调用 renderHub 以保留弹层现场（与备注保存失败的处理同款，core/notes.js:18-21 先例）。 | 数据未注明 |
| A6-MENU-01 | game/src/ui/game.menu.js:127 | 右键留言的页面识别器 describeCurrentPage 的基地页签中文名映射缺 shop：{deploy,stash,upgrade,classes,ach} 五键之外走 \|\| key 回退，基地「商店」页签内右键留言时 page.name 记为「基地 · shop」。 | 留言库中该条记录的位置名夹生英文，可辨认但不一致；其余五个基地页签均显示中文。 | fix：映射补 shop: '商店'（一行）。属地 game.menu.js 归 WF-experience-art-exec，本线只报告不动手。 | review 原文照录：「他人属地（game.menu.js 属 WF-experience-art-exec），按任务要求仅核冻结工具文案之外的问题并标注归属」 |

## ④ 各线 keeps 与 unverified（原文收录）

### A3 线 keeps（7 条）

- **ROOT-01 预设应用链路修复在位**：applyPicks→setDeployPick 置 deployPickFresh，openDepartPrep 保留注入值（game.hub.depart.js:85,92-95；game.hub.js:55-56）——此前应用预设后只带初始攻击的缺陷已修
- **previewDeployment 与整备页容量口径（每名≤stackCap 时）**：两端都是『种类数+初始攻击』：preparation.commands.js:83-84 与 game.hub.depart.js:368-372 一致；职业卡禁带双端一致（commands.js:69-71 vs depart.js:109,212）
- **整备出发页反误导提示**：空背包出征有显式警示『空手出战会明显吃力』（game.hub.depart.js:197）同时保留可直接出发（:195）——不把『牌越多越稳』当强制规则，符合 TASKS A3.1
- **火堆 2026-10-02 自动复原两张形态**：池不足全复原、空池明示、满包专用播报、首次结算锁防重领（altar.js:49-83）；FACTS 记录的形态变更已稳定
- **chests/shop 满包反馈与资源去向一致性**：放不下张数逐张模拟、散落明示、只收币离开出口、强收时现场播报（chests.js:308-347；scenes.js:272-279 满包拒收即日志）
- **层间过渡与节点过场**：showRunTransition 代次守卫防旧过场盖新页、战斗 modal 态不降级、点击跳过（scenes.js:113-149）；enterNode 按节点身份差异化文案/背景（:151-161）
- **coverage 新鲜度结论**：44 行 123 个 input：104 新鲜/19 STALE/0 缺失；STALE 集中于 6 个并行属地文件（game.hub.depart.js、expedition-hub.css、game.run.altar.js、expedition-map.css、game.bag.js、expedition-inventory.css），与避让清单完全重合；我属地 preparation.* 三文件全部新鲜，coverage 结论可直接沿用

### A3 线 unverified（6 条）

- 本任务禁浏览器：全部结论为源码级静态复核，未做实页复现；B04 修复效果、祭坛复原页身份的视觉观感需属地负责人在当前窗口实页验证
- 归 WF-experience-art-exec：game.run.altar.js（A3-ALTAR-01 与火堆文案，祭坛文案会话在途）、game.run.shop.js（A3-SHOP-01，PH1 在途）、expedition-map.css+game.hub.depart.js（B04 修复与 dep-foot，exploration_layout 属地）——四项均只记录未动源码
- 选人页/皮肤/待机表现（TASKS A3.2）未研究：cls2-idle 待机包在途，按任务书先避让接收其结果
- PH1 完成未提交增量（extraction.commands.js/game.session.death.js/chests/shop/flow）原样保留只读，撤离/死亡回执消费一致性归 A5 线
- agent.stats/agent.data byDriver 口径分叉归 A5（FACTS 已记录），本线未重复核
- coverage DOOR 行『当前页面是否应可留』属独立玩法决策（闸门不可停留现状维持，未提解冻）

### A5 线 keeps（9 条）

- **EXTRACT-DONE clear/extract 收束可区分性（标题+图标+副标题+日志四层分叉，不只换标题）**：altar.js:991/:1001-1005 按 r.outcome 分叉且数字一律读回执；两主体互斥另有 DOM 断言钉死（ph1-sys02 README:11）；实页观感留待验收
- **TERMINAL-RETRY 人话化失败页与防重复提交守卫**：terminal-settlement.js:33-38 固定补进度位置/重试安全/刷新兜底三件事；:39/:43 busy+current 双守卫；:55-64 attempt 保留+replay 直取收据；SYS-10 增量原样保留不重做
- **EXTRACT-STASH 容量语义与丢失预警**：容量 chip 满仓变色 :895、单卡容量不足徽标 :863-868、全部入库按余量禁用 :911、完成整理明示将丢失张数 :915、帮助页解释口袋 1/3 与初始牌 :879-886
- **EXIT-PAY 成本不足/取消/停用三态**：altar.js:699-707 停用态有解释、:715-717 卡不足禁用+文案、:721-725 运行时二次守卫、:692-694 币不带回提醒、:718/:732 继续深入出口
- **DEATH 页失败语义区分与 XP 行**：「你倒下了」vs「战斗中撤离」副标题（death.js:84,:155）、失败横幅（:14,:154）、熟练度行区分升级/未升级/测试投影三态（:137-147）；损失明细缺口单列 A5-DEATH-01 不否定整体收束
- **ABANDON-DONE 二步确认与损失表达**：menu.js:829-837 二步确认 2.6s 回弹、:875-876 损失统计行、:870-873 抢运清单、:883-884 回基地/回主菜单双出口分路；保存失败不显示已完成由 terminal-settlement 编排保证
- **BATTLE-REWARD 满包预检与三选一不吞卡**：chests.js:308-337 逐张模拟占格+最低价参照（:326-332）、:313-314/:374-381 三选一放不下留面板可腾格重选
- **刷新恢复链（源码级成立，实页待验）**：整理中刷新：pendingExtraction 持久化+preflight 校验（session.js:255-263）→resumeExtraction 回整理页（session.js:357-366→altar.js:769-779）；终局中刷新：terminalPending 不写档（session.js:192）回撤/死前自动存档；已提交事务 readSettlementReceipt 重放不重复（terminal.commands.js:81-83,:116-120；extraction.commands.js:186-191）
- **数据消费一致性（表现侧）**：结算页（altar.js:969-987）、跑局记录（recorder.js:200-253 回执赢+原回执留档）、CSV 同读一份回执；agent.stats.js:98 byDriver 已切 provenance——FACTS.md:32-34 的 driver 分叉结论在工作树已被并行会话修复（新鲜度更正，非本线动作）

### A5 线 unverified（6 条）

- 完整结果链实页未验（本任务禁浏览器）：clear/extract/death/abandon 结算页真实观感、CSV 导出对照、死亡/放弃/失败重试链、刷新恢复——FACTS.md:14-15/:28 与 SYS-02 README:19-21 均列实页缺口，归负责人实机验收；本报告全部结论为源码级
- 「回基地」「再出发」均回 deploy 的用户期望：源码证实三处同路（altar.js:1015-1016、death.js:169-170、menu.js:883-884），TASKS A5:87 要求实页核是否误导后改命名/衔接——期望判断须实页，未做
- 归 WF-experience-art-exec 属地（按 ask 跳过，仅作新鲜度更正）：agent.stats.js byDriver 已修复（FACTS 过时）；agent.data.js:91 口径注释与现行 recordRun 传参不符（clear 行现传 carriedCards）归其复核；game.menu.js 冻结工具文案、game.bag.js 锦囊、game.run.altar.js 祭坛/火堆文案段、expedition-inventory/map.css、game.hub.depart.js、core/art.js、battle/view/battle.frames.js、page-battle-ui.css 未研究
- EXTRACT-RETRY/TERMINAL-RETRY 的真实存储故障注入实验未做（coverage 两行 nextAction 要求，只读研究不执行注入）
- 死亡链回执与嵌套（nest）clear 口径：SYS-02 scope 决策维持既有口径（ph1-sys02 README:10），本线未对 nest 收束页另做核验
- 未运行任何测试/构建：PH1 增量（terminal-settlement.js 约19行、extraction.commands.js、game.session.death.js 等）按 ask 原样只读看待，其测试绿灯属原交付报告，非本轮独立验收

### A6 线 keeps（10 条）

- **卡牌制作/导入冻结拒绝行为（CARD-DESIGNER/CARDS-IMPORT）**：冻结期入口本身不渲染：game.cardslib.page.js:489「＋制作新卡」「导入」只在 CARD_DESIGNER_WRITES_ENABLED 时出现，:137 编辑/删除操作同条件；运行时另有 designer.js:36/331 静默redirect、:264/341 与 page.js:537/563/608/624 直 return 的多重守卫。玩家日常路径见不到入口即无误导；设置页开发者勾选文案已改「开发者模式（测试工具）」（game.menu.js:983，他人已实施）。导出为只读行为保留开放符合设计。维持冻结，不开启写入口。
- **存档恢复链（SLOT-RECOVERY）**：recovery.commands.js 日志四快照版本门+收据身份链校验（:27-54）、Web Locks 独占锁（:62-66）、recoverable-pair.js 三相日志+第三值检测（:77-88）+失败保留现场（:138-142）、versioned-slot-reader.js 迁移断链装载期炸出（:35-39）+tooNew拒读+坏档备份、game.storage.js U17 prev 自愈不假称已回退（:96-99）；UI 侧选档页恢复失败走页内 #slotRestoreError role=alert+日志+保留原档（game.menu.js:714-727）。语义严谨无需改动。
- **基地各页签空/满/锁定/危险状态**：仓库空态引导（game.hub.pages.js:108-112）、口袋空说明（:124）、宠物未孵化摘要行（:163-181）、货架空态封条兜底（:66-69）、成就 0 解锁剪影含 title 名与条件（:630-633）、卡背锁定显示来源（:606-614）、材料 0 时 zero 态（:142-149）、卖出价≥5或末张/收藏消耗/材料末张与全部使用均有两步确认且 initialFocus 落保留（:256-286,350-398）。覆盖完整。
- **基地帮助文案与规则数据一致性（HUB-HELP 六页签）**：registerHubHelp（game.hub.js:323-363）逐条对照源数据核实：宠物蛋 0.7%起+3%/场+0.2%=rule-config.js:12-14；孵化 50 币=pets.json hatchCost；升级 2-3-4-5 上限 Lv.5=pets.json upCosts/levelMax；职业卡+10/能力卡+50=meta.js:30；钥匙门槛 10=base.js:629；复原价古朴1/稀有2/史诗3/传说4=base.js:466；扩建木材2/+3张/上限100/符文门槛50×2=rule-config.js:7。帮助弹层机制（overlay.js showHelp + hideOverlay 清 _acts :188）无泄漏、Esc 可关。
- **照相馆已验收结构（STUDIO/CARD-ZOOM）**：窗口化瓦片（page.js:116-121 壳常驻+IO 双向挂卸）、筛选缓存（:90-111 含内容失效修正）、art 预热、悬停 90ms 去抖、搜索 120ms debounce、TDZ 事故修复注记（:533-535）均在位；closeLibPage 完整清理（:700-722）；showCardZoom inert+焦点管理。未发现新回归，不重开改造。
- **节点笔记四件套（NODE-NOTE/NOTES-EXPORT/NOTES-IMPORT/NOTES-CLEAR）**：写失败返回 false 并保留弹层与输入（game.notes.js:73-84 + core/notes.js:13-23）、导入 v2/v3 兼容+failed 计数如实上报（:150-179）、清空红系危险钮+默认焦点落取消（:184-201，10-02 定版已实施）、旧键迁移幂等（:7-31）。
- **开发台四页签（DEV-DEBUG/DEV-AGENT/DEV-DATA/DEV-KEYS）无新回归**：git diff 核实在途改动仅 SYS-11：game.run.dev.js 为调试动作追加 noteIntervention 记录，agent.data.js 为明细驱动列改 provenance 三态标签，均不触碰 batch1 验收的页面结构；agent.console.js 与 quick-nav.js 无工作树改动。winter.css .devc-row 死样式残留为 batch1 复核已知项，不重复报。
- **升级页短缺原因展示（HUB-UPGRADE）**：他人已实施 slice 在位且正确：game.hub.pages.js:426-432 符文门槛成本/差额与 base.js:378-381 canUpgradeStash 同口径，:465/471-473 渲染齐全，不重复报。
- **整备预设面板（PREP-GOALS）**：game.hub.preparation.js:84-121 命令失败 repaint(result.message||'操作失败')、preset-apply 资格失效提示、generation token 防 dispose 后回调；深入体验归 A3 整备线，本线未见缺陷。
- **UI.act 注册与基地重绘机制**：UI.act 为覆盖式赋值（ui.js:101）且 hideOverlay 清空 _acts/_inputHandler/_hoverHandler（overlay.js:188-190），renderHub 全量重注册无泄漏累积；closeBase 返回链正确（game.hub.js:367-373）。

### A6 线 unverified（6 条）

- 全程禁止浏览器：所有结论均为源码级复核（verified 指逻辑链经本会话独立读码成立），当前窗口实页视觉、点击与性能未做任何验证
- 他人已登记未实施的两个 option 待实页定夺，归 WF-experience-art-exec：A6-COLLECTION-FIRST-OBJECT（收藏室首屏解释段+里程碑先于卡组）与 A6-ACHIEVEMENT-ACTION-WIDTH（ach-ops nowrap+flex-shrink:0 长奖励行挤压，hub.css:131-134 + page-rewards-bag-help.css:665-666 源码风险已在，视觉缺陷未证）
- 属地归他人未深研（按任务清单跳过并在此注明归 WF-experience-art-exec）：expedition-hub.css class-dossier*、game.bag.js 锦囊、game.run.altar.js 祭坛文案、expedition-inventory/map.css+game.hub.depart.js、game.menu.js 冻结工具文案、VISUAL-BIBLE/nai_style.py、battle/page-battle-ui CSS、battle.frames.js、agent.stats.js/agent.data.js 消费口径、perf-probe.local.js；PH1 完成未提交增量（extraction.commands.js/game.session.death.js/chests/shop/flow）原样保留未核
- SFX-AUDITION：sfx-audition.html 存在已核实，但页面本体与声音试听按老板令免验，未核
- hubStashHTML 每次页签渲染全量拼装至多 100 张（stashMax）sm 卡面 HTML 无窗口化——量级有限且为整页重绘惯例，未报问题；A7 性能线若实测仓库页卡顿可回看 game.hub.pages.js:96-107
- LEAVE/EXIT-SCREEN/TERM-TIP/GUIDE/HUB-DEPLOY/PREP/CLASS-CHOICE/SLOTS/TITLE 等相邻行分别归 A3/A5/入口基地线，本线未重核（LEAVE/EXIT-SCREEN 仅在 game.menu.js 通读中顺带确认无异常）

## ⑤ 归属声明

**本汇总为 ZCode 侧 WF-xart-z1 研究产出，coverage.json 仍归 WF-experience-art-exec，实施由负责人按此定清单。**
