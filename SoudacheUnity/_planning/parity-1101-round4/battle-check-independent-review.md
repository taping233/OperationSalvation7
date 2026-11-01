# 敌方回合续接检查独审

状态：最终冻结检查源静态独审完成，未执行编译、领域检查、Unity 或原生检查。发现的一项确定夹具阻断已由 Battle 作者修正并只读复核闭合，当前无剩余确定检查错误。生产逻辑由 Hub 独审，本报告不代替生产审查。

最终冻结清单 `battle-turn-freeze.json` SHA256：`d87ba2af666bc4ef0662ff4169d8fe609ad94bd6dcb572e30de26cea5f146bd4`。

| 已审检查源 | 最终 SHA256 |
| --- | --- |
| `_planning/parity-1031/battle-check/Round4Checks.cs` | `99cb2543159a8f0da909c208ec9ad81de95eb08a081084229dd88276a88ebe1b` |
| `Assets/Editor/CurrentBattleRound4Checks.cs` | `03f2373bc3270dad3f02a246dac16f803ccfee85d8ba08c2e5f7daefea9a6ca5` |

## 确定问题

初审版本的 `Round4Checks.cs` 中 `Reactive(scales:2)` 先装备两件逆鳞，再装备深红丝袋；`CurrentBattleRound4Checks.Fixture` 同样装备这三件。`StructuredRules.cs:102` 的正式上限为 `2 + ownedEquipCapacity`，本组卡没有扩容，`:268` 会在第三件拒绝“装备栏已满”。因此两组检查会在目标交互出现前失败，不能通过修改生产上限解决。

已闭合：领域仅 scales==1 时装备丝袋；原生双逆鳞场景按确切名称取出两按钮，要求数量为2且全部禁用，再以 Fixture(1) 装备逆鳞和丝袋，单独检查主动技能锁。没有改装备容量或塞入其它职业扩容卡，原双副本、旧事件和敌方冻结续接断言均保留。

## 已核对的有效性

- 来源与方案为本目录 `battle-turn.md`。领域先用完整现行卡池确认神灯位于星辰随机法术池、血毒位于牧师明确的其它职业池，再裁剪测试卡库候选；保留内建卡定义，实际调用星辰、发现及生成两个带 castOnDraw 标记的实体 UID。没有以牧师直接永久拥有战士职业卡代替合法链。
- `ResponseSeed` 仅搜索原有 50% 抽牌成功的合法种子；不修改概率。测试预设抽牌顺序以覆盖已生成副本，不能据此声称自然完整卡池的概率、原始洗牌顺序或局内获得频率。
- 双逆鳞场景在第一次抉择时检查 Turn=1、敌人仅一次命中、队列还持有一个副本、两副本均不在材料手牌；处理第一次抉择后必须出现不同 RuleChoice 引用且不能推进敌人。完整 RNG 预期包含同次各装备 target/generation、狂乱 generation，以及后续两次命中，分别在等待点与回合结束比较 SaveState。
- 正常场景神灯处决非首脑受伤敌人，要求终局只产生一次结果、清理回合归属/队列/续接。首脑场景该选项按现行 execute 规则为无效果，便于验证有限链恢复；另选冻结检查下一 hit 与下一敌人重新判断可行动状态。
- 最终领域另覆盖首脑满手时副本仍可抽到自动施放、不会留在材料手牌；处决正在行动的已伤狂乱敌人后，余下 hit 跳过且另敌只攻击一次。牧师实卡花瓣法阵按其 onTurnStart 的 draw→heal 顺序，选择逆鳞原概率不抽的分支，验证 Turn2 抽到神灯时 HP 仍897、选择结束后只治疗一次到900；这些构造与正式规则匹配。
- 真实发现链继续到江湖救急、其它职业血毒及 rulePick，取消后要求返回同一有限结束回合链；旧目标回调必须拒绝。中毒触发逆鳞在敌人攻击前出现待选，随后逃跑与新会话重放旧 continuation，检查结果次数及新会话的回合、目标和 RNG 不变。
- 原生经正式 BattleRequested、BattleBridge、GameBattleHost、BattleScreen 构造当前战斗，Bridge 确实使用 GameRuntime.Rng 同一引用。只构造领域已证明合法的星辰双副本结果，不替换全局卡库；装备、结束回合与选择分别走正式命令和 ISubmitHandler。
- 原生检查等待两帧时要求相同 choice 和按钮实例；第二个同标签选择要求不同控制实例。旧 UnityEvent 在下一个 choice 和新战斗页面中重放，并同时检查 RuleChoice 身份、回合、HP、RNG。当前按钮正式消费者也确实绑定页面、battleToken 和 RuleChoice 引用。

## 覆盖边界

领域没有自然完整卡池抽取、所有自定义触发器组合或操作系统输入证据；原生明确是受控实卡结果、正式桥接与构造 Submit。原生只演示普通战斗的选择和冻结返回，首脑狂乱/多命中 RNG、二段目标取消及内部过期 continuation 由领域检查承担。当前终局组直接覆盖胜利及逃跑清理，不能单凭本片声称“持有交互时死亡”已被单独执行验证。
