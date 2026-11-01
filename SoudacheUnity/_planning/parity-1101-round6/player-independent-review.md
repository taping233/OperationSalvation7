# Round6正常播放器新增流程独审

2026-11-01，仅静态读取 `NativeDisplayReview.Round6.cs`、主文件接线及其实际UI/领域消费者；没有修改Assets、编译、测试或启动Unity。生产/检查源继续冻结。本记录不代表实绘或真实点击已通过。

## 确证问题与修正边界

首次版本在 `settings-tab-2` 点击后直接Capture。`CurrentSettingsPage.SelectCategory/ChangeRegion`有0.12秒淡出、重建、0.16秒淡入；Capture仅等三帧及EndOfFrame，无法保证分类完成。已即时报告Root。Root随后改为独立点击并等待控件/祖先CanvasGroup就绪，三秒超时，方向正确。

复核该等待实现又发现它查找 `UnityEngine.UI.Slider`，但现役 `CurrentSettingsPage.Volume:275`挂载的是 `MenuDialogs.cs:43`的自定义 `VolSlider : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler`，并无Slider。此版本会固定超时，已报告Root。最终复核已改查实际active `setMusicVol` RectTransform再判断祖先CanvasGroup；上述两项静态闭合，未以固定帧数或放宽Raycast代替控件就绪。

## 其余静态调用闭合

- 主流程先挂正式Settings并截图，再ReviewRound6Audio；音频流程三个Capture均沿正常Capture/实际backbuffer，ClickNamed最终调用ClickButton的EventSystem.RaycastAll并核首个pointerClick接收者，无OS输入。请求失败/重试仅切状态与按钮显隐，不重建音频分类。必须先闭合上述分类入场等待。
- 音频临时修改仅运行时Music字典的board条目；try/finally覆盖所有yield break并还原条目、进入前scene、musicMuted和全局Muted。当前接线位于标题/图库后、NewPresentationFixture前，原scene为正式title，无同scene失败重试恢复歧义；音量和AudioListener资格未在此流程修改。失败场景不改变磁盘媒体；设置偏好仍落在本次隔离profile。
- 献祭先NewPresentationFixture，正式NewRun并领取入城补给，取消转场/清栈；随后按实际Map.Nodes的layer2 emergencyExit逻辑idx定位。六张普通同ID卡保留独立UID/variantKey及0/1/2费用，另外三张仅用safe/stored/pouchOf标记构造候选排除边界，不声称完整容器玩法。
- EmergencyModal的真实选择入口关闭自身再Open(true)；CardSacrificeScreen当前位置/owner一致性成立。首次入场经两帧及Capture后才点候选，取消后经过Capture再重新入场。Toggle只改选中标记/计数/确认可用状态，不重建候选或布局；同Guard连续选0/1/2和确认不依赖新页面布局。第三个UID位于第二排；实际是否被视口裁剪仍由运行时Raycast硬检查，静态审查不替代。
- 取消经正式Cancel返回EmergencyModal；确认经TryEmergencyExtract重查三UID、原子结算并由ExtractStashChanged正式挂ExtractStashScreen。QA断言三个精确UID消耗且目标页正确，未绕领域命令。该页随后Capture；成功路径最后NewPresentationFixture清掉结算并重开正常Run，主文件再构造门流程。Guard失败使整条隔离播放器退出，后续门流程不会继续消费半成状态。

最终审查原字节SHA256：`NativeDisplayReview.Round6.cs` 为 `07a7524459f84539dd33d817b184c0f6184f54f7e80ddf9b5fb48d333bd4efc5`，主文件 `NativeDisplayReview.cs` 为 `a56a8c2607094bb3e7a72f7ead73385b2a74b75eb01d889a12dd6286bddf85bb`。未发现此边界内其他确定API/接线阻断。真实页面到达、遮挡、四张献祭图及三张音频图仍待Root集中播放器验证。

## 追加：真实牌库底发现流程

2026-11-01，再只读核对新增 `Round6BottomFixture/ReviewRound6Discovery` 及主文件在ParityBattle之后、Formation之前的接线。未重复审音频/祭坛，未改Assets或执行。此追加读取时helper原字节SHA为 `e5cab809acafa1cb4350f345eb102f4038da18f5ee2f9371f027040e55af4086`，主文件为 `bc4e9fb16e6ece27315c67c30407d45d92a6c929b610d4c8c047d4015855f89f`；仅约束当时新增发现区间，后续Root修改应另记最终指纹。

静态未见确定阻断：

- 夹具NewPresentationFixture后正式挂普通战斗，等待BattleScreen和转场结束；五张原卡均来自现行CardLibrary并有独立UID。反射只控制本次私有session的hand/drawPile/energy，两个Round6BattleField重载分别明确读/写，未碰共享资源或保存实现。真实挖宝定义为1费、self目标、牌库底三张acquire加所选价格护甲，因此PlayCard(source,-1,false)是合法正式入口，必须Ok且最终Snapshot.kind=deckBottom。
- 正式StartDeckBottomDiscovery从drawPile先取1/2/3原UID并暂移，余下4；选0后hand加入原UID1，2/3原顺序放回4之前。QA检查完整deck为2/3/4，未用名字/临时复制代替原牌身份。
- 首页Capture后再等0.4秒，覆盖DiscoverPanel的0.35秒选牌门；pick只修改本页选中态并重建本页，随后Capture经过三帧及EndOfFrame，再Raycast确认。两个点击均经既有ClickNamed/ClickButton首接收者检查，不绕过射线。
- 第二次重建独立正式战斗后直接点取消。取消本身不受0.35秒的pick/confirm门，页面无独立入场CanvasGroup动画；ClickButton强制Canvas布局后仍做实际Raycast核验。取消走带token/selectionID的正式命令，原1/2/3插回4之前，QA核完整顺序和取消前后能量相等。
- 主体新增四个Capture名称唯一。发现流程结束后下一Formation的第一步仍NewPresentationFixture，会重置slot/run并由RunLoaded/RunEnded桥清掉旧BattleView/会话/页面，不让上场选择影响编组。失败时Guard终止整个隔离Player，后续Formation不继续。

已报Root一项证据强化：取消能量基准在PlayCard后采样，因此原断言严格证明“取消未再改能量”，尚未单独证明100已扣到99；可在正式PlayCard后增加实际Energy==99，再保留现有取消不变断言。当前生产ExecPlay确实扣费，没有据此提出生产修复。

边界：挖宝出牌是受控Session.PlayCard前置，不声称该次从真实手牌拖拽入场；发现卡面选择/确认/取消才是本流程真实Raycast。四张新增图及与原66+3音频+4献祭合计77的目标数量，均需Root集中Player实际结果确认。首轮纯发现preview不在本次四图覆盖内。

## 追加：纯发现首轮预览三图

只读复核最新共用 `Round6DiscoverFixture(bool preview)` 与 `ReviewRound6DiscoveryPreview`。读取时helper原字节SHA为 `c2db4be338761d52b3d59866c7a28e5f06fd6e9432728f478c7534a862737539`；主接线仍 `bc4e9fb16e6ece27315c67c30407d45d92a6c929b610d4c8c047d4015855f89f`。未测试或修改Assets。

- 真神秘召唤 `cmtn125e1nk0` 是self目标、2费、纯acquire/discover，合法沿同一PlayCard(-1,false)前置；SourceCommit/sourceUid声明和Rng.SaveState返回string均存在。共用fixture现在明确核preview初始Energy=100、底牌分支已支付Energy=99，上条底牌已付证据建议已补齐。
- 首图前明确源UID仍在hand且未付能量；正式取消后核BattleScreen、无费用/来源消耗且RNG不增。保持同session重新Play，核sourceCommit=preview、options的ID/费用/variant顺序与RNG状态原样复用，未另起随机夹具掩盖缓存。
- 已提示Root选框点击会SetSnapshot重建Confirm。最新helper把pick/confirm拆成两Guard，中间WaitForEndOfFrame再yield null，确认前走新控件的实际Canvas周期与同一Raycast接收者检查；保留0.4秒首轮选择等待。静态时序缺口闭合。
- 最终确认严格核Energy=98、源UID移出hand、hand.Count=1，未把取消写成退款；图后下一Formation继续原NewPresentationFixture。没有改共享资源或临时媒体，全部状态归当前隔离session。

未见此新增三图范围的确定API/时序阻断。该片仍是正式Session命令前置及真实UI后续操作，实际画面/点击待Root统一Player。目标数量随本次追加为66原图+3音频+4献祭+4底牌+3预览=80，最终以运行结果为准。

## 当前修订复核：按真实射线等待再点击

2026-11-01，Battle代理只读复核当前驱动及业务闭包；没有修改Assets、执行测试、启动/操作播放器或读取本轮PNG。本节约束最新源码，前文旧helper指纹/固定帧等待说明属于历史，不代表当前Player运行结果。

本次读取指纹：

| 文件 | SHA256 |
| --- | --- |
| `NativeDisplayReview.Round6.cs` | `5bd1f459155ffffb1a74b4174630add2ab00e4e85c0cc0a350e8fe72da8808c6` |
| `NativeDisplayReview.cs` | `bc4e9fb16e6ece27315c67c30407d45d92a6c929b610d4c8c047d4015855f89f` |
| `CardSacrificeScreen.cs` | `0dc04aea2dcdcca1a9b27290d067d81495a5e1b059fe169aa79a2deca5f2de4f` |
| `BattleSubpages.cs` | `661e9f547fd29ac2a39928d847f7afc3e3fc3ce17c62333c28fac323ad38b830` |

静态结论：新waiting没有跳过真实命中或使用无界重试，未见所审范围的确定阻断。

- `Round6WaitForButton:71–90` 先跨一个EndOfFrame和一帧，再用 `Time.realtimeSinceStartup + 3` 设置截止。每次只读取Top页面中名称匹配、active/enabled且interactable的按钮，强制布局后在其实际中心发 `EventSystem.RaycastAll`。仅当首射线命中的 `IPointerClickHandler` 就是目标按钮才返回；没有修改遮罩、CanvasGroup、焦点、按钮事件、业务状态或RNG，也没有偷偷调用点击。
- 到期抛 `TimeoutException` 经既有Guard/Fail结束。四个调用点（重开献祭、底牌取消、重开预览pick、重建后的confirm）均紧接 `_failed` 检查；主Run在子流程后同样检查。循环每次yield一帧，无屏蔽异常的继续分支。此上限依赖正常播放器继续产出帧，不构成应用挂起时的独立进程看门狗。
- 返回后仍调用 `ClickNamed → ClickButton:403–416`：重新定位按钮、重新布局/取中心、重新Raycast并记录首命中/接收者，接收者不等于目标立即失败，然后才派发 `pointerClickHandler`。等待与点击是两次独立读，因此期间若再被遮挡，点击仍会失败；没有直接Button.onClick/Submit作为备用路径。
- 献祭重开等待的按钮UID与下一次正式ClickNamed一致。业务 `CardSacrificeScreen.Toggle` 保留对象且只更新选中态/计数，前三次点击不会重建同名候选；最终确认调用真实 `TryEmergencyExtract`，驱动要求精确0/1/2 UID消失并进入ExtractStashScreen。夹具六张普通、三张安全/存储/容器排除项及正式Save/ReadSlot声明仍保留。Cancel沿真实EmergencyModal入口重开，无伪返回页。
- 发现pick会 `SetSnapshot` 重建当前页控件；预览confirm前新增的等待因此读取新控件，而不是旧Button或旧UnityEvent。350ms业务门仍由原0.4秒等待覆盖，waiting没有绕过该门。当前页面token/selectionId/revision、Bridge当前Session引用和Core owner检查均保持冻结的正式实现。
- 底牌夹具是实际挖宝与原UID队列，严格核100→99、确认选中原UID1/其余2/3原序归回、取消1/2/3全原序归回且不退款。预览夹具是实际神秘召唤，核100未支付、取消源UID/能量不变、同session重开候选ID/费用/variant及RNG相同、最终98和一张入手。Bridge正式context使用 `rng = g.Rng`，驱动读取同一随机实例；这些都是当前代码中存在的断言，尚不能替代当前Player receipt。

证据边界：战斗进入与手牌/底牌/能量为显式控制前置，出牌由正式Session命令构造；后续选卡/确认/取消才经真实当前Canvas射线派发。无OS硬件输入证明，不穷举所有献祭失败、发现n轮、存档切换或锦囊；这些范围由对应领域/Editor检查及Root实际结果分别承担。当前helper中献祭配置5个Capture、底牌4个、纯预览3个；不沿用前文历史合计作为本次全图完成证明，最终数量、画面、GUID和进程退出均以Root当前Player证据为准。

## 实绘发现的布局缺口及待补验

Root后续Player-3虽退出0/81图，实际发现页顶部标题/左侧说明裁切，视觉验收不通过。本代理已view_image读取该包 `player-discover-bottom.png`；此前只读驱动的“未见阻断”限定在输入/业务断言，不能外推画面合格。

当前修复位于BattleSubpages.cs：共同Base.Build清card stretch anchors遗留默认sizeDelta带来的越屏增量；Discover.Build一次性设置内容安全内边距。该版本指纹以更新后的battle-freeze.json为准，替代上表仅该业务文件旧SHA。共同影响仅Discover/Grave，编组页独立Build。

CurrentDiscoverRound6Checks新增实际Canvas表面/标题/说明/候选/footer几何检查，及正式Boss前置后的真实GravePanel/返回几何；墓地UID位置为明确控制事实，不替代完整入墓玩法证明。预期该检查58→154，当前尚未运行；Root将重跑新原生并重建实际Player。这里未声称修复后画面已经通过，白色受控敌人块不列为生产资源缺陷。

## 墓地共享HUD覆盖补验

Player-5虽已退出0/83图，本代理实际读取其 `player-grave.png`，确认生命值/头像/资源顶栏与墓地标题位于同区叠压。此前容器内矩形合格不代表共享HUD覆盖合格，该包仍未完成视觉验收。

Root持有的CurrentRunTopBar已按实际DiscoverPanel/GravePanel类型覆盖。当前CurrentDiscoverRound6Checks仅新增打开墓地后一帧的 `!CurrentRunTopBar.Visible && CanvasGroup.alpha==0`、真实返回后一帧的 `Visible && alpha==1` 两个Check；不直接手动调用Update或改group透明度，读真实组件结果。预期当前检查156、Root新369/合计1312，尚待统一native-round6-5/build/player-6执行和实绘复核，当前未宣称此修已通过。
