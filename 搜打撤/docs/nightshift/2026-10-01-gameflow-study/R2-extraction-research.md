# R2 · 外部调研①:撤离类玩法的损失呈现、风险预告与再出发激励

> 轮次:R2(2026-10-01 凌晨,夜班 WF-nightshift-gameflow-study)。方法:WebSearch 外部检索;搜索服务中途多次限流(429),Hunt/DnD/PYL 细节部分依赖检索工具的通识汇总,已在表中标注置信度。目的(对应流程第 2 节验收「能说明借鉴目的」):为搜打撤的**撤离风险预告、损失解释、再出发钩子**找有实证的参照。

## 一、四作品机制拆解

| 作品 | 撤离/收手决策怎么设计 | 损失如何呈现与缓冲 | 再出发的钩子 | 置信度 |
|---|---|---|---|---|
| **Escape from Tarkov** | 一局内随时可走,但收益随深入递增;死亡掉全部带入装备 | ①付费**保险**:死亡且装备未被拾走则延迟归还;②**安全箱**:贵重品放箱内死亡不掉;③scav 免费局兜底 | 「损失真实但可部分回收」: sting 驱动复仇局,安全网防绝望退坑;赛季删保险活动时玩家 gear fear 飙升,反证机制核心地位 | 高(官方 wiki+多方来源) |
| **Hunt: Showdown** | 拿到赏金后「立即撤」vs「再打一个 BOSS」;**携带赏金=全图可见**,banish 也广播位置 | 死亡失去猎人(含装备);不确定 | 风险预告即核心玩法:暴露状态本身就是「该不该再贪」的信息 | 中(限流,靠通识汇总) |
| **Dark and Darker** | 撤离门**随时间出现且互相竞争**,深层门更好但更少;晚走=门在收缩 | 不撤出局=全丢 | 门的出现节奏制造天然的「再搜一把还是走」压力 | 中(限流,靠通识汇总) |
| **Loop Hero** | **三档回收**:营地格撤=100%,中途撤=60%,死=30% | 死亡也不是全灭,30% 资源进永久进度 | Reddit 名场面:玩家问「我知道怎么按,但怎么才能让自己(中途撤)?」——60% 与 100% 的差值就是持续的 push-your-luck 张力;指南把「知道何时撤」定义为技能而非失败 | 高(多来源+原始讨论) |

**Push-your-luck 通识**(检索限流下的通识汇总,置信度中):成熟 PYL 设计的共件是**已知概率**(Incan Gold/Quacks 用可见的耗尽牌堆,玩家能算出确切爆率)、**递增的双边赌注**(每 press 同时抬奖励与爆率)、**部分回收**(banked 的点数永远安全,爆的只是本轮)。

## 二、与搜打撤现状的对位(读 rules.md/design.md/GDD 后)

搜打撤已经有惊人的同构骨架:
- 撤离点撤=100% 带回,紧急撤离点=献祭 3 卡换提前结束(rules.md §1)——**这就是 Loop Hero 的 100%/代价档**;
- 死亡/放弃时宠物安全格的卡可带回(rules.md §2)、珍珠盒内容「撤离失败时一并抢运回基地」——**这就是 Tarkov 安全箱**;
- 遭遇定版公开在 rules.md(每种敌人数量区间与概率)——**这就是 PYL 的已知概率**,只是只在文档里。

**结论:搜打撤不缺机制,缺的是把机制「翻译成玩家可感知的信息」。** GDD 待验证问题里「玩家是否看得懂当前带出价值与风险」正卡在这一步。

## 三、可借鉴点清单(每条注来源与适用性)

| # | 借鉴点 | 来源 | 对搜打撤的适用性与落点 | 服务 R1 缺口 |
|---|---|---|---|---|
| 1 | **常驻「带出价值+死亡损失预估」面板**(Hunt 的暴露信息思想:风险状态应该始终可见) | Hunt 通识汇总 | 地图 HUD 或背包页常驻:当前携带价值 / 若此刻死亡能带回多少(安全格+珍珠盒) / 距最近撤离点。纯 UI,不动数值 | 缺口②教学 |
| 2 | **回收比例显式化**(Loop Hero 三档比例玩家全部可知) | Loop Hero | 搜打撤的 100%/献祭/安全格保护比例散落在规则里;在撤离点与紧急撤离点交互时直接显示「撤=带 X 张,死=带 Y 张」 | 缺口②教学 |
| 3 | **失败结算页列「这次带回了什么」**(死亡保留 30% 的再出发心理学:失败也有进账) | Loop Hero | 搜打撤死亡结算已有安全格带回,若结算页逐卡列出带回物并标「本应全丢,安全格救回 N 张」,损失从「白跑」变「保住了一部分」 | 缺口②教学+第 18 节损失解释 |
| 4 | **已知概率入游戏内**(遭遇概率表从文档搬进游戏:情报站/图鉴页显示各遭遇权重) | PYL 通识(Incan Gold 可算概率) | rules.md 的遭遇定版是现成数据;放进游戏=玩家从「怕未知」变「算概率」,这是搜打撤与 Tarkov 类肉鸽最大的差异化机会(单机可公开全部概率) | 缺口②教学+缺口③数值透明 |
| 5 | **保险位**(花币投保「下一局随身牌组」,死亡未带回归还) | Tarkov 保险 | 搜打撤经济已有币与商店;「保险」给币一个防损用途,缓解后期币无处花的普遍问题。属新机制,**须老板拍板**,R5 提案展开 | 缺口③再出发激励 |
| 6 | **撤离窗口递紧**(DnD 门随时间收缩的单机化:紧急撤离代价随层数/进度递增而非固定 3 卡) | DnD 通识 | 现版紧急撤离=固定献祭 3 卡;变体「越深越贵或越深越远」让「何时收手」的决策更有梯度。属玩法改动,**须老板拍板+试玩验证** | 第 3 节核心循环 |

## 四、方法限制

- 搜索服务在会话中段持续 429 限流:Hunt/DnD/PYL 细节置信度标注为「中」,建议立项前用一次正常网络环境复核原始来源。
- 全部为桌面/线上提取类与肉鸽参照;回合制卡牌肉鸽(Slay the Spire 系)的对应做法在 R3 调研。
- 未做任何玩家实测;借鉴点落地前应转成 R4 假设,走 agent 批跑或实页观察验证。

## 来源

- [Tarkov Insurance 官方 wiki](https://escapefromtarkov.fandom.com/wiki/Insurance)
- [Psychology of Games: Loss Aversion(Podcast 63)](https://www.psychologyofgames.com/2020/09/podcast-63-loss-aversion-and-game-design/)
- [The Decision Lab: Loss Aversion](https://thedecisionlab.com/biases/loss-aversion)
- [Loop Hero 撤离回收比例(Gaming.StackExchange)](https://gaming.stackexchange.com/questions/383036/how-do-i-retreat-from-an-expedition-with-all-my-resources-in-loop-hero)
- [Loop Hero 评测含 60%/30% 口径(Overclockers Club)](https://www.overclockersclub.com/reviews/loop_hero_review/4.htm)、[Gaming Nexus](https://www.gamingnexus.com/Article/7280/Loop-Hero/)
- [「怎么才能让自己撤」(r/LoopHero)](https://www.reddit.com/r/LoopHero/comments/m5ywpy/how_do_i_retreat_with_10060_instead_of_30_of_my/)
- [Loop Hero 攻略(BlueStacks)](https://www.bluestacks.com/blog/game-guides/loop-hero/lh-tips-tricks-en.html)
