# 发现保留树独立只读审查

状态：只读当前 Root 源与现行 Vite，未编译、未测试、未启动 Unity/Player；不是画面通过结论。审查对象为 `BattleSubpages.cs`、`CurrentDiscoveryRetainedRound7Checks.cs`、`NativeDisplayReview.Round7Discovery.cs` 与扩展 `NativeDisplayReview.Round6.cs`，以及实际 Core 快照/发现写入链。

保留树与六候选滚动主链未见新增确定阻断；另确证底牌候选缺真实 UID 呈现映射。Root 已分配 Core 侧映射与本片检查，UI/Root 检查/播放器探针接线由 Root 持有；下文保留发现过程及准确边界，不能把尚未执行的闭包写成通过。

## 引用与生命周期

- `BattleSession.GetSnapshot` 对 discovering.options 只复制 List，保留每个 CardDef 引用。普通生成由池选出的定义、底牌由 FindCard 返回的实际当前卡面、锦囊由真实来源选出的卡面，均在 BeginDiscovery 建当前轮的列表。
- 当前正式写点没有在等待期间原地改当前 option：zeroCost/noInfuse/decay/互换均在确认后克隆或建立新的 override，下一次发现重新 BeginDiscovery 并递增 selectionId。计数 n 的递减也新建当前轮。未把所有 CardDef 类型宣称成不可变，只核此正式等待链。
- Root SameView 比较 token、selectionId、kind、sourceCommit、命令门面身份、候选数量及逐项引用，符合上述当前契约；列表副本不会触发无效重建。新轮即使候选完全相同仍因 selectionId 变化而清草稿/重建；新 session 因 token 变化失效。
- 选择只改变前后两条 Outline.enabled 与确认可用状态。稳定 SetSnapshot 不改 revision、不重置 readyAt，不会把350ms重新计时；候选身份改变才递增 revision、清选中并沿 UIKit.ClearChildren 立即撤下旧按钮。
- Current 守卫检查 Unity 对象存活、关闭/活跃、Top、revision、未终局、token 与 selectionId。OnClose 同帧设置 closed/递增 revision，旧监听不能选择、确认或取消新内容。Core/Boot 的 token/id/current Session 复核保持。

## 检查源边界

`CurrentDiscoveryRetainedRound7Checks` 沿真实 BattleRequested/Bridge/会话进入挖掘宝藏，验证稳定实际 Snapshot 下树/按钮/revision/期限、选择/切换后的焦点与状态；显式替换 options[0] 克隆是当前轮候选失效夹具，记录为受控构造，没有冒充一张正式卡牌效果会这样修改候选。旧按钮事件在该失效后与下一场实际会话都被重放并核拒绝。取消仍核原牌库底UID顺序。

六候选由三张真实暗黑形态加神秘召唤构造，先核预支付能量97及候选6，再将实际Scroll滚至末端，验证首射线 receiver 为第六张按钮并触发真实 pointerClick。其后仍核未支付来源/能量保留。该行为来自当前窗口受控前置，不代表 OS 滚轮/物理鼠标或多尺寸覆盖。

`Round7Discovery` 正常播放器探针复用严格 ClickButton；`Round6WaitForButton` 先等真实 Canvas 周期，再在3秒期限内检查当前 Top 活跃、可交互按钮与首射线事件接收者。没有替代点击、忽略 receiver、修改焦点/布局使其命中或无限轮询；找到后仍由 ClickNamed/ClickButton 再次做真实射线严格检查。布局主张仍要等待正常播放器实际PNG复核。

## 确证：底牌候选需真实 UID 呈现状态

Source `battle.acquire-operation.domain.js:64–66` 最初只是从保留 UID 取得 raw card；最终消费者才是关键：`battle.view.js:39` 将 findEffectiveCard 导入为 findCard，`:362–371` 对 deckBottomUids[i] 再读真实来源，替换当前有效卡面并附随身/临时来源说明。因此不能依据最初的 raw options 断言无需来源状态。

合法可达前置是本场产生/零费入库，或实际牌库变形后再由挖掘宝藏翻底。Source 最终卡面保留 Temporary/Transforming/Transformed/OriginName/BaseCost 以及 UID 对应的 live cost。Native `DeckBottomDiscovery` 当前 private uids 与 selectedIndex 完整保原实体，但 Snapshot 仅给 CardDefs；DiscoverPanel 的通用 CardFaceOptions 未传 UID 投影，无法恢复该身份与动态费事实。

Core 已按明确授权实现：仅 deckBottom 在 state/snapshot 暴露显示候选对应的 candidateUids（最多3）；Snapshot 复制 UID 字符串列表，保留 CardDef 引用契约；取消归还所用的全量 reserved UID 闭包和选/付费逻辑不变。已补正式变形/生成状态、受控牌堆位置下的真实挖掘宝藏映射/原 UID 确认/费用与完整随机流断言，以及本片 Native 实际候选标签/绿色0/Submit 的待验源。Root UI 按同索引 UID 读取正式 CardPresentation 并传现有 CardFaceOptions；SameView 核 UID 字符串内容，稳定快照不重开期限。本报告对保留树的独审截至该 UID 接线前版本；Root 最终接线由另一独审和集中检查闭合，本片没有编辑 Root 文件。

Source 呼吸光晕按 Root 已确认边界由静态状态标签替代，用于减少装饰更新；本片没有将未运行的动效写成复刻通过。

