# Round7 发现页独审（Hub 代理）

本报告独立保留 Hub 代理已经查证的两项结论。共享 `discovery-independent-review.md` 由 Root 汇总，本代理不再修改。审查时两项都已报 Root；Battle 接底牌候选 UID 投影，Root 接 UI 映射和描边。下述均为修正前静态证据，后续修正与验证由各作者集中收口。没有改生产或检查源，没有编译、测试或启动 Unity / Player；此前 Hub 源继续冻结。

## 选择描边被透明根 Graphic 的 alpha 抹掉

`BattleSubpages.cs:214–218` 将选择 `Outline` 挂在 `CardFace.Create` 返回的根上；`CardFace.cs:43–44` 此根 `Image.color=Color.clear`。本机当前正式 ugui 源码为 `Library/PackageCache/com.unity.ugui@eb824e41fbc7/Runtime/UGUI/UI/Core/VertexModifiers/Shadow.cs`：`:21` 默认 `m_UseGraphicAlpha=true`，`:110–111` 将 effect alpha 乘原顶点 alpha；同目录 `Outline.cs:29–41` 正式复用该处理。根顶点 alpha=0，因此只切换 `Outline.enabled` 不会得到可见选择框。

当前 `CurrentDiscoveryRetainedRound7Checks` 检查 enabled 与仅一个框激活，不能证明像素上可见。最小方向是该专用选择边框不继承透明命中面的 alpha，或利用现有不透明卡框 Graphic；继续保留局部切换与稳定卡面，不必重新建树。必要验证应直接检查正式 mesh 的有色可见顶点，最终 Player 实看选中图，不能只增加另一个 enabled 断言。

这是正式当前 UGUI 实现下的确定问题，不是对图像的推断。修正前代码也使用同一透明根，故不将其误称为本轮新增逻辑回归；本轮“选择仅描边”需要一并闭合。

## 底牌候选缺少正式 UID 呈现状态

Source `game/src/battle/view/battle.view.js:38` 将 `findCard` 明确绑定为 `findEffectiveCard`。最终发现消费者 `:362–370` 对底牌按 `deckBottomUids[i]` 再查询真实卡，而非只用最初 Acquire 捕获的 raw option。`game/src/battle/effects/battle.card-inspection.domain.js:53–97` 的 `withPresentation` 附加 temporary / transforming / transformed / originName / baseCost，`game/src/cards/cards.view.js:167–173` 实际绘制“临时 / 随动变形 / 已变形”状态。

Unity `DeckBottomDiscovery.cs` 私有 uids 和 `state.selectedIndex` 已保证获得原实体及取消时全量原序归还；但 `DiscoveringSnapshot` 只有 `CardDef` 候选，没有逐候选 UID，`DiscoverPanel` 创建卡面也只设置 `HideCost=false`，未传 `CardFaceOptions.Presentation`。原 UID 领取正确并不等于呈现完整。

真实可达例包括牌库底的 `tt7-imitate`、寻宝图将搜索军用保险柜洗入牌库、铁甲阵将随机降费临时牌洗入牌库后，再使用挖宝。Source 最终呈现带本场临时 / 随动 / 已变形状态，当前 Unity 发现卡面缺这些状态标。Source 的 sourceNote / equipmentNote 当前主要进入 aria，不把它们冒称为可见文字缺失；也不把 Source 卡面未覆盖的动态费用强行列为差异。

最小闭包是仅 deckBottom 增加只读 `candidateUids` 映射，数量对应最多前三个可见 options；保留全部 reserved UID 的领取和取消闭包。UI 复用正式 `BattleView.Api.CardPresentation(uid)` 和 `CardFaceOptions.Presentation`，不另写临时 / 变形 / 原费用规则。SameView 比较映射字符串内容，并保持无关快照原 deadline 和控件；新增查询每次分配新 DTO 不能成为每帧“新候选”的判据。Battle 已独立确证并接 Core，Root 持 UI，不由本代理并写。

## 其余已审范围与边界

本次也读取了稳定快照、旧事件 / 350ms / 新候选代次 / 关闭、六候选滚动及原生与 Player 探针，没有查到确定的新逻辑阻断：

- `BattleSession.cs:1334–1337` 复制候选 List、保留 CardDef 引用。SameView 的 token / selectionId / kind / sourceCommit / commands / 逐引用检查符合现有每轮候选契约；新发现轮由 BeginDiscovery 分配新 selectionId。
- 新按钮捕获 token + selectionId + revision，要求当前启用页、栈顶、非终局；关闭递增代次，旧节点立即撤离。正式 Core Pick / Cancel 再核 token / ID。选中只改旧 / 新框和确认按钮，不再采样或支付。
- 连续三张黑暗形态令 Source optionsPlus=3，随机发现 cap=3+N；神秘召唤真实可产生六候选。Source 最终 CSS 用不换行横向 overflow:auto，Unity 超五张固定三列竖滚为等价可达方案，仍需实际尺寸 / 射线验证。
- 新检查使用真实 BattleRequested / PlayCard / Button submit / ScrollRect / RaycastAll；Player 拆开布局后的真实点击，原 R6 夹具 expanded 默认 false，后续战斗入口自身重新构造 fixture。预览不引入退款，原 R6 候选 / RNG 复用与仅支付一次的断言仍存在。

这些是静态审查，尚未运行本轮检查、截图或性能测量；不以旧 Passed 替代本轮执行。

## 修正前输入指纹

| 文件 | 原字节 SHA256 |
| --- | --- |
| BattleSubpages.cs | `95cc049f5147d7cc9656fda8c3a7f8b768d273e3a7afd02da6a391e9356a8f8d` |
| CurrentDiscoveryRetainedRound7Checks.cs | `4ffeb70553e3b0ddad13ff4cdbca34f315df1a9af79a554d048832204b9e135a` |
| NativeDisplayReview.Round7Discovery.cs | `e7d602716ddc661e265cf1c93bbd5d72fc09361b75c3b04a18f1da0c7d0569c5` |
| NativeDisplayReview.Round6.cs | `2e60ed74eadf748d680c73ae0bc6d507a7c805595add974e0ecd92728d1b8f84` |
| BattleSession.cs | `c8baeb6cd5f983324a2b47ea6550a710acd7107e6d4721eaee3547cff5521a78` |
| DeckBottomDiscovery.cs | `7b50052a50c5c0d544472e1c394fbb01ba4a33e5162fa12f820d8d490f5bb5ef` |

上述相关 Source 文件读取时无未提交变更。本文只对应这些已审输入，不冒称后续修正版本已复核。
