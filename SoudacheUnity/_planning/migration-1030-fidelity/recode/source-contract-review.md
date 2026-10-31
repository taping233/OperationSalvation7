# 重编结果确认：按当前活跃实现补齐

已补齐 `recodeTwo → recodeConfirm` 的实际结果确认页面。读取既有来源快照与冻结的抽卡记录；更换仍只经原有 `__recode_confirm` 命令完成。原生效果尚待主线集中检查，本记录不作为已完成画面验收。

## 代码结论与变更

| 当前源实现 | Unity 原差异 | 本次接入 |
| --- | --- | --- |
| `game/src/run/game.run.events.js` 的 `openEventRecode/convert` 抽完结果后进入 `showEventRecodeResult`，确认前不更换原卡 | 运行时已持有 `sources/drawn` 并进入 `recodeConfirm`，UI 却将结果退化成名字箭头文本与通用选项 | `EventDialogScreen.Build` 在通用分支前调 `TryRenderRecodeResult`；无运行时/RNG/事务改动 |
| `game/src/ui/event-recode-result.js`：标题“重编结果”，说明“新卡已确定，确认后替换原卡。” | 沿用事件开场标题与叙述 | 沿现有 `CurrentIllustratedNode` 显示结果标题和说明，保留现行 `scene-event-recode` 资源消费者 |
| 每项是原卡**名称**与箭头，上方文字之后显示新卡面；没有两张卡面并排 | 没有结果卡面 | 消费来源快照名称与 `drawn` 对应定义，不从现有物品反推/重抽 |
| `event-recode-result.css`：横向可换行、列间距40/行间距24、内距24/12/36；原名20px、箭头30px；无局部卡面宽度覆盖 | 通用16px文字 | 复用 `CurrentRewardFlow` 和正式 `DepartureElements.Card`；沿 `cards.css` 默认 `13.08em × 14px = 183.12px` 卡面宽度 |
| `eventRecodeInspect` 只读，独立详情退出后焦点回原按钮 | 没有结果详情动作 | 复用正式 `DepartureCardZoom`，单卡阅读，回到同一结果按钮 |
| 可整理背包，返回保留页面阅读位置；确认失败原卡与结果保留，可重试 | 只有确认与“放弃并离开”通用选项 | 提供源“整理背包”及“确认更换，继续探索”；保留同一结果节点/滚动，背包返回恢复焦点；失败提示沿源文案 |
| 结果页只有上述两个底部动作；顶部事件退出另有共同入口 | 通用分支插入“放弃并离开” | 特定结果页不渲染通用选项；Escape 继续走现存 `LeaveCurrentEvent`，不将冻结结果作废 |

共享脚手架仅将 `CurrentIllustratedNode.Layout` 的默认64px底栏扩展为 `max(64, preferredHeight)`。默认64/76值不变；失败提示需要额外高度时压缩正文滚动区域，底栏不越过决策区底边。

## 变更范围与复用

- `Assets/Scripts/Sdt.UI/Screens/Run/EventDialogRecode.cs`（新增）和 `.meta`：结果视图及特定入口。
- `Assets/Scripts/Sdt.UI/Screens/Run/EventDialogScreen.cs`：`Build` 增加一行特定入口。
- `Assets/Scripts/Sdt.UI/Screens/Run/CurrentIllustratedNode.cs`：底栏首选高度与滚动限高最小补丁。
- 复用 `CurrentIllustratedNode`、`CurrentRewardFlow`、`DepartureElements.Card`、`DepartureCardZoom`、`CurrentNodeElements.Button`、`BagOpened`、正式确认命令；未新增抽卡/授予/保存框架。
- `GameRuntime.Events.cs`、`GameRuntime.EventRoutes.cs` 和 Vite 源码本次未修改。

## 验证与证据边界

- 私有生产快照 `Sdt.UI` 类型检查通过：0错误，10项既有警告；结果在 `typecheck/latest.log` 与 `typecheck-inputs.json`。
- 对当前 Vite 源码运行已有两组定向测试，共28项：26通过、2失败。`event-settlement-unification.test.js` 全26项通过，覆盖重编原卡变安全/储存/身份后拒绝确认、冻结骰记录保留。
- 失败的两项来自 `event-recode-selection-continuity.test.js`，其 `.event-choice-hand` / `.picked` 查询与当前 `openEventRecode` 的奖励页结构不匹配：当前根为 `reward-v14 event-recode-scene`。未改只读源代码或其测试，也没有将此结果计为全通过。
- 未启动 Unity、未打包、未操控前台；原生卡面排版、实际焦点和保存锁失败/重试流程待主线集中检查。

## 主线原生检查入口

从新局和实际 event 节点进入，确保至少一张非安全/储存/容器内的武术/法术/装备且存在同类型同稀有度替换候选，使用正式命令：

```csharp
g.CurrentNodeReceipt.eventCardId = "ev19-recode";
g.GetEventChoices("ev19-recode");
g.ApplyCurrentEventChoice("ev19-recode:0");
var selection = g.GetCurrentEventOutcome();
g.SubmitEventSelection(selection.CardKeys.Take(selection.Need).ToList());
while (g.GetCurrentEventOutcome().Stage == "dice") {
    g.RollCurrentEventDice();
    g.ApplyCurrentEventChoice("__dice_continue");
}
EventDialogScreen.Open(CardLibrary.FindById("ev19-recode"), null);
```

新视图稳定动作名：`eventRecodeInspect-0/1`、`eventRecodeResultBag`、`eventRecodeAccept`；只读详情复用 `zoom-close`。

应检查：打开页时原卡未变；详情返回同按钮；背包返回同 `drawn`/RNG/滚动；锁定保存后确认原卡与 `drawn`/骰记录保留且提示显示；解锁重试仅更换一次；旧结果按钮在其他面板或离开节点后不产生操作。文件指纹随 `receipt.json` 给出。
