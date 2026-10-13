# 奖励整体重做

状态：首版结构/光色与实际稀有度层级已实施，透明宝箱新图等待接入；老板最终统一审阅，未声称美术通过。

## 来源与对照

- [STS2多人实现者开发记录](https://straypixels.net/sts2-multiplayer-timeline/)，2026-04-19，作者自述2024-05起与Mega Crit合作；其中真实奖励截图2026-04-05/v0.99.1（图内字）。已直接view_image查看：一件Blood Vial奖励居中、解释贴对象、Skip独立右侧；没有顶部场景横图。只借对象焦点和独立退出，不搬多人、遗物或奖励规则。
- 原图：[开发者图](https://straypixels.net/assets/sts2-multiplayer-timeline/sts2-mp-reward.png)，references/sts2-developer-reward.png，508777bytes，SHA256 E81F005B87E3FC0B91D43ED829E74162615F77AE3075445AA1EDFCB554794938，Invoke-WebRequest原字节；未接入游戏。
- 方舟原R08结果归纳与商店S01/S02稳定资源/对象身份作为辅助；未实际看抽取动态，不编造官方时长/高稀有度演出。
- 项目问题由老板明确指出：顶部莫名横图、无用装饰/文字、大量结果重复、高稀有度缺少满足感；E1-A01/A14/A16与旧奖励截图为旧版对照。

## 第一版：卡牌与实际收益成为焦点

删除奖励markup中的车队横图及对应只读URL常量，素材文件保留；揭晓后不再重复已开宝箱图。FIELD SUPPLY编号、口号、重复职业箱解释和长常驻消耗教学移出主层。核心风险保留在收取前的容量/散落提示；完整开局损耗教学已前移整备。实际击败/生命摘要与真实损耗折叠清单保持。

头部显示胜利/宝箱来源、真实最高稀有度标题、实际金币与容量；中央卡牌按原顺序/原cardHTML呈现，原估值仍明确；底部操作固定。普通/稀有/史诗/传说/棱彩用真实Cards.rarityOf分层，继承/hero按现行共同规则取有效稀有度，不按箱档位伪造。没有提前在搜索阶段泄露高稀有度。

第一轮假设：删横图与重复箱图后，卡牌视觉身份与真正金币能承担收获主焦点；高稀有度只在对象周围使用不同低对比承托、稀有度色短线及短揭晓节奏，不堆持续粒子/整层大闪。实验普通220ms、史诗360ms、传说480ms、棱彩560ms，是本项目试验值，非二游实测。延迟音效仍有代次/对象/已收防串检查，棱彩沿已有legend音色，减少动态跳过新增CSS入场，逐张收取不重播。

最低必要检查：chests.js ESLint、CSS解析通过；收取/容量/三选一事务两文件12项通过。没有全链自动验收、没有build或提交。

## 宝箱接口与后续循环

现五URL在chests.js CHEST_ART与chestArtOf：scene-chest-{small,medium,large,boss,class}-anime-v1.webp。新透明小中大箱由root协调：主体约280×210设计px，四周透明至少12%，完整盖/锁，不含字/框/价格/背景，不提前透露真实随机结果；搜索可点击立即揭晓，实际随机/领取/容量/稀有度概率不改。

下一轮按新透明箱实际输出与本版结构再看对照：重点检查卡面/估值/已收标记、主按钮、金币与容量，判断高稀有度是否适度突出；明确缺陷再改。老板接管最终统一审阅，当前为待老板审阅，不能把静态/事务检查写成画面通过。
## 多帧接口与唯一揭晓（继续实施中）

老板新增所有最终箱必须多帧，旧红木、青黑及雪箱不采用。实际新帧包尚待map交付，现没有接任何被否定图。

`SDT.Chests.configureFrameArt({small,medium,large,class,boss})`只接受显示用frames字符串数组与fps（独立每kind），class覆盖普通kind。五组目前为空；收到最终原路径后将按实际图填配置，不能把空接口记为五箱美术完成。

搜索780ms时点与原rollContents时点保持。自动搜索后按同一画布逐帧（closed→unlock→小角→中途→full-open），最终帧结束后才显示真实牌；点击立即跳过、减少动态与turbo直接静态终态。frameArt预热用现Art.warm且不保留额外warm池。新帧存在时禁用旧箱轻摇，避免两套运动破坏铰链/基线。

同箱openingPresentation/revealed和可取消search/opening timer双守卫，next/suspend/非chest overlay/HMR取消；原手动点击后780ms再次render/排音效的缺口已获root明确授权修复。领取handler另绑定renderedBox与可见reward-head，旧箱迟到的take不能领取下一箱搜索中的内容。原grant/coins/容量/抽取/概率操作保持；suspend后resume仍恢复原已滚出的结果，不重抽。

新增七个有意义时钟回归覆盖：点击唯一揭晓与音效、最终帧前不显示牌、领奖一次、中途skip与下一箱隔离（含旧take迟到调用）、挂起不抢背包、减少动态、外部节点切换、turbo。测试用closed/unlock等虚拟URI，只验证播放器/事务链，不是新素材实际验收。三文件24项通过（sys03-loot-shop-txn、chest-click-flow、nightshift-u10-teardown-guards）；追加旧take隔离补丁后两收取文件19项通过。

首次动画测试的四失败源于fixture每次只返回同名A导致去重后1牌，却断言2牌；测试池改为明确A/B交替后通过，未改游戏权重/发放实现逃避失败。未来科幻城市题材沿root最新，商店批准图冻结；奖励箱仍以实际卡面画法、现代盒结构重新制作中。