# FB038 / FB041：本场消耗查看与真正发现

2026-10-18 UTC。基于44条原始反馈，第38条：“战斗界面要显示本局对战的消耗牌堆，同时统一墓地和消牌堆的文字描述”；第41条：“装备只能搭载两件：有些牌描述是是发现实际上是随机获取”。装备两件属此前修复，本批不更改容量规则。

## FB038：共同呈现，不合并结算区域

此前普通战徽标只读grave、不可点、全0时隐藏；实际普通战注能/效果消耗写consumed，故仅把span改button仍会漏牌。本批为snapshot透传只读consumed（输入缺省[]、冻结副本），签名已有全输入签名机制，自然包含consumed；显式测试确认追加consumed改变签名且不污染旧快照。

`consumedPileUids(snapshot)`统一呈现取值：普通战consumed，首脑grave。普通战始终保留可点“本场消耗”徽标，首脑仍有原循环牌库/弃牌显示；两者调用已有openGrave和同一牌堆查看器。标题、徽标、注能去向、首脑帮助统一“本场消耗牌堆”。没有把consumed写入grave，没有启用普通战墓地/牌库规则，也未更改战后消耗区。

真实模块链证明普通战0张可打开，注能后consumed有fuel且grave没有，徽标/查看器显示1张，返回不变更资源和记录。

## FB041：发现+免注能

当前卡文完整为“灵能召唤：发现一张注能卡，使其无需注能”。原结构化规则却是acquire n:1/pool注能/dest:hand/act:noInfuse；旧文本discover.infuseFree直接randomDiscoverCard。历史迁移曾记录随机直发，不将这条历史实现当作不准修复的设计规则。

- capability放行acquire.discover+noInfuse；resolution把act传入既有发现队列。
- DiscoverQueueJob/状态已完整保留act，无需第二套字段或状态机；连续发现仍传递同一act。
- pickDiscover只有选中后clone候选并加_noInfuse，再交原临时卡入口。未选候选、全局卡、目录模板不修改；不免费用或绕其他限制。
- 文本discover.infuseFree改排队真发现，与结构化路径对齐；候选生成和输入延迟/过期守卫复用原流程，不新增取消玩法。
- cards.sync.m3 marker由v4升v5，通过createRuleBackfiller将精确匹配旧hand规则+定版卡面的存档迁移；玩家改名/改字段/自有规则仍保留。未手改cards-sync.json。
- 现行MATRIX、规则契约和卡牌显示文档同步。
- 存档边界：现行保存战斗起点checkpoint，旧档恢复会清空discoverQueue/popups；本批未实现或验证恢复待选发现面板。独立只读审查未发现本批确定回归。

## 集中验证

整批代码后集中定向验证，未跑全量或build：
- discover-tests.txt：5文件158项，通过文本/结构化发现、候选不提前授予、选中实例免注能、连续独立实例、终局拒旧选择、原免注能结算、v5迁移和自改保留、capability/resolution。
- ui-tests.txt：11文件201项，通过真实消耗查看链、普通/首脑边界、快照、注能、架构/循环依赖守卫等。
- selection-regression.txt：5文件35项，通过发现旧回调/连续队列、必需注能、绽放及快照签名补断言；其中snapshot3项与上组重叠，不重复计数。合计去重20文件391项。
- 定向ESLint通过（发现一个已不再使用的grave解构后删除并复验）；8套typecheck通过，见types.txt；相关JS语法与git diff检查通过。
- 最初16文件调度发生ERR_IPC_CHANNEL_CLOSED（tests.txt），未获得结果，不算通过，也不是游戏崩溃证据。拆分同范围后通过。

以上均为真实模块/jsdom/静态检查，非实玩。内置浏览器仍阻塞；未使用外部浏览器/headless/CDP，不改CSS，不开服务，不提交/推送。待实页检查普通/首脑消耗徽标与查看返回、灵能召唤候选阅读→确认→免材料正常扣费使用。
