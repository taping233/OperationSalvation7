# 当前 UI 独立代码审查

本次仅直接读取现行 Source 的活跃 JS、最终相关 CSS 和 Unity 调用链。未运行 Unity、构建、浏览器、测试或前台；未改生产。没有继承旧矩阵、旧 passed 或其他代理结论。

结论：发现 **1 项仍未对齐的活跃阅读器呈现差异**，不构成交易/换牌规则阻断；重编确认业务边界、整理器回焦和首脑编组的本次所查逻辑未发现新的确证 P1/P2。

## P2：重编结果详情仍进入旧默认阅读分支

真实入口为 `EventDialogScreen.Build:55` → `TryRenderRecodeResult` → `eventRecodeInspect-*`。`EventDialogRecode.cs:87` 调 `DepartureCardZoom.Open(new[]{card}, returnFocus:...)`，没有 options；`DepartureElements.cs:120–122` 因而进入默认分支：340px 卡宽、`#071922`/0.9 的全屏实色表面，且保留普通栈遮罩。

原版同一入口 `event-recode-result.js:27` 调的是通用 `UI.showCardZoom(card,{returnFocus})`，没有 photo/inventory/expedition 模式；`card-zoom-content.js` 产生 `.cz-reading-layout/.cz-card`，`winter.css:474/478` 生效为 18% 幕布、18px 背景模糊、34px 卡基础字级；`cards.css:3` 的 13.08em 意味着卡宽为 **444.72px**。普通重编页不命中 cardlib/photo/inventory 的特定覆盖。故读取原结果详情时，Unity 卡面只有源宽的约76.5%，背景也丢失源插画透出效果。

同一现存 `DepartureCardZoom` 的 options 非空分支已有 444.72px 独立阅读结构，编组已使用。建议由主线给该既有阅读器显式的源通用模式/参数，复用卡面和关闭回焦，并复用当前可用的模糊机制；不要新建一套详情框架。`CurrentRewardCardZoom` 含领取动作及自身实色背景，不宜直接拿来当只读结果详情。

应在集中原生复验中打开真实重编结果详情，检查卡宽/背景与关闭返回同一个结果按钮；本次没有把实机效果推定为通过。

## 已直接核对的业务与恢复边界

| 路径 | 核对结果 |
| --- | --- |
| Source `game.run.events.js:391–425` / `event-recode-result.js` → Native `EventDialogRecode` | 均显示原卡名称→冻结新卡面；新 UI 从现存 sources/drawn 读取，没有重新抽卡或发卡；确认按钮才经 `RunCurrent` → `__recode_confirm` → `ConfirmEventRecode` → `ReplaceEventCards`。 |
| 重编确认失败 | 运行时默认事务恢复原状态；`AcceptEventOutcome` 保存失败反馈，重建时 Build 从真实 progress 重读阶段和原结果，反馈与正常名称箭头 message 不同后显示源提示。签名相同保留卡面节点，未发现确认失败自动重复换卡。 |
| 重编背包/详情返回 | 结果节点按 sources/drawn 签名复用；`OnResume` 不抽取；背包返回恢复触发按钮；详情 `OnClose` 通过现有 returnFocus 恢复原按钮。实际 EventSystem 和滚动效果仍须原生验证。 |
| `CurrentIllustratedNode` footer | 默认高度仍 max(64,preferredHeight)，长失败提示使 footer 增高并压缩正文 scroll；当前窗口逻辑尺寸下可容纳源两张结果卡/两个动作。未运行字体布局，不能据此声称全部长文无裁切。 |
| Source `reward-capacity-organizer.js:82–112` → Native `CurrentRewardCapacityOrganizer` | discard→keep；keep→同 UID discard；safe/confirm→同 UID 动作，缺失/不可用则同 UID discard、邻行 discard，空列表返回；失败保留确认态并恢复决策；`Live`/busy 阻止旧覆盖页动作抢焦点。原命令不变，新增动作名/UID/旧索引与源一致。 |
| Source `battle.overlays.js:16–82` / `battle.snapshot-projection.domain.js:21` → Native `CurrentDeckFormation.Refresh` | need=min(可编数/装备容量后可选数,15)、Maximum、固定初始攻击、excess 和按钮可用条件一致；选择走正式 SelectDeckCard/ConfirmDeck，不在视图复制规则。 |
| 编组布局/规则/详情 | Source `battle-decision.css:11–12/93` 与 Native Layout 均为 min(1760,viewport−88) × min(980,viewport−88)、280px卡宽/28px格距；摘要、可折叠规则、开战装备提示与独立详情入口存在。 |
| 编组选择后的稳定性 | poolKey 只含 UID/Card，普通选择仅更新状态/边框/计数，不销毁网格；详情返回使用同一 inspect 按钮；规则开关和 scroll 挂在同一 retained 对象。未发现选择时强制滚到顶的调用。 |

## 边界与建议

- 没有把无玩家复现的 lastDeckSel 生命周期差异当成新缺陷，未扩审所有战斗规则。
- 没有验证持久化文件锁、字形实际采样、像素效果或系统硬件输入；这些由 Root 集中验证。
- 推荐定向原生覆盖：结果页和详情/返回、背包返回同 frozen drawn/RNG、保存失败提示 footer 与重试一次；整理器同 UID/邻行/失败/空列表回焦；编组选择滚动保持、详情/规则返回及容量门槛。
- `inputs.json` 记录本次读取的 Source/Native 指纹；Root 后续修复应按变动差异复核，不再把本报告旧指纹结论覆盖新实现。
