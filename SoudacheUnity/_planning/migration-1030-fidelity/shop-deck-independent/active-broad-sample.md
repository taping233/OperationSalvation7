# 现行迁移代码：约10分钟高信号独审

2026-10-30。version-matrix.json仅用作24类文件定位，不复用其中旧结论。只读代码；未运行Unity、构建、浏览器或看图；未改生产/共享记录。Shop凭据、RNG、保存和lastDeckSel实施已由Root另行接手，本次不重复派工。

## 可落实差异

| 现行Source函数/文件 | Native实际调用 | 具体条件与结果差异 | 建议复用入口 |
|---|---|---|---|
| game.run.events.js:407 → showEventRecodeResult；event-recode-result.js:8–36显式导入event-recode-result.css | GameRuntime.EventRoutes.cs:89置recodeConfirm → Events.cs:59–63清CardIds/CardKeys，仅Message名称箭头 → EventDialogScreen.Build回base.Build → EventDialogChoices.cs:39/后续choices | 异常改装台两张原卡完成骰子抽取后，源逐张显示原卡名→结果卡面，可检视完整规则并回焦、整理背包后返回同一冻结结果，点击确认才更换。Native只剩16号文本的原名→新名及确认重编，没有结果卡面/检视，无法在确认前阅读抽到的新牌规则。业务确认阶段本身仍保留，不误称提前成交。 | 为recodeConfirm增加专门呈现；复用CurrentIllustratedNode、CardFace/DepartureCardZoom和既有原结果p.drawn及ConfirmEventRecode，沿用骰子/提交逻辑。 |
| game.bag.js:24,81 → game.reward-organizer.js → reward-capacity-organizer.js:82–112 | CurrentRewardScene.cs:103/140 → CurrentRewardCapacityOrganizer.Open → Build:28–55 | 满包奖励的腾位整理器：源丢弃第一步后聚焦“保留”，完成安全格移动/丢弃后回同UID动作或相邻行；Native每次Clear(_list)并销毁/重建行与页脚，全文没有EventSystem/SetSelected恢复，原键盘焦点随对象消失。滚动位置已有保留，勿误报为滚动丢失。 | 复用已采用的action名+UID、相邻行回焦办法；只补当前整理器，不重建奖励系统。 |

## 活跃与死代码区分

- `EventDialogChoices.cs:78–94` 仍留CardIds/CardKeys纵排Md卡+按钮代码，但 `EventDialogScreen.Build:55–60` 对同一条件提前转CurrentRewardScene并return。因此当前无普通生产路径到此旧分支；不能据此把事件选卡整体判旧版。
- `CharacterAppearanceScreen`、`StoryArchiveScreen`、`CardBackPickerScreen` 的全Assets/Scripts引用仅自身定义/自调用；真实HubScreen.Build:87–91走HubCurrentRooms、HubCurrentArchiveViews等partials。因此这些旧类不构成活跃旧骨架证据。
- `PreparationScreen.Open` 则确实由HubScreen:147“携带预设”调用；当前实现已接独立Preparation页面/追踪目标/双预设区，未把旧类名当作旧版结论。

## 抽查范围与证据缺口

| 域 | 本次实际抽查 | 结论边界 |
|---|---|---|
| Menu | MenuDialogs当前Build转Guide/Settings/Achievement组件；TitleScreen→CreditsScreen；CurrentSettings输入/重开按钮与App按键分发 | 确认当前调用已转专用组件，未完成全部按钮保存/恢复守卫和最终CSS逐项比较；不能宣布Menu完整同态。 |
| Hub | HubScreen实际switch、携带预设入口、人物/收藏旧类全局引用 | 已区分活跃Currentpartials和无调用旧类；仓库/伙伴/建设每项效果与事务未逐项核完。 |
| Bag/容器 | BagScreen入口battleActive守卫、ContainerScreen当前两列卡格/整叠转移/独立检视、CardContainerCommands过滤 | 未发现仅凭抽查即可成立的新P2；全背包拖放、排序、键盘和详情返程仍有证据缺口。 |
| 事件 | 实际Build拦截CardKeys条件、RenderCurrentEvent、recodeConfirm数据出口及源结果阅读器 | 上表结果阅读缺口已证实；未对全事件数据分支宣称通过。 |
| 奖励 | CurrentRewardScene领取/整理器入口、整理器具体动作、源对应决策回焦 | 回焦差距已证实；领取背包往返、长描述和随机队列不扩审。 |
| 结算 | ExtractScreens:31/38实际Build转CurrentSettlementReport；Growth/Memento/保存卡片区域 | 当前活跃专用报告存在，旧矩阵不能沿用；所有损失/带回/成长数据口径未逐项核完。 |
| 退出恢复 | CurrentLeavePage继续/保存/放弃调用；menu-leave.js原owner/继续/保存错误分支 | Native保留底层Panel，继续直接Close而非重建源DOM具有架构原因，未凭此误报“漏恢复”。系统菜单跨奖励/战斗/Settings嵌套及失败状态需定向守卫审查，暂无本次可证新P2。 |

## 修正旧复现

“Boss开战后未出牌撤退再进”不是生产复现：btFlee明确拒Boss；flee道具也被Boss规则拒绝。先前结论已在两份自有记录更正，lastDeckSel仅保留静态实例生命周期差异，暂不列玩家P2。

本轮停止扩扫，交Root集中修复上述两项并安排后续必要的定向检查。
