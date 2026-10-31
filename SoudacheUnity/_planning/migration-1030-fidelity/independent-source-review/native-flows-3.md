# Film / Pile / Frames / Journey 独立图像续查

只读检查范围：film-flow-3的16帧、pile-2的5帧、frames-2的32帧、journey-3现有26帧；先用带文件名的总览检查全部，再对Passage、事件、Pile reader、Chest、DeckSelection、Shop、Extraction放大查看原图。总览仅为审图辅助文件，不代替原证据。未运行Unity/CUA或写生产。

## 证据边界

这些Editor流程PNG使用 `OffscreenCapture`：1920×1080，关闭CanvasScaler，将Canvas改成ScreenSpaceCamera并设RenderTexture。它们能揭示构造布局问题，但不等同于player-9/10正常ScreenSpaceOverlay的物理桌面backbuffer。此前“原生”措辞不能省略该区别。

## 当前待闭环

### P2：商店仍有明确源结构差距，作者处理中

`journey-page-ShopScreen-1.png` 上约75%被商队背景占据，商品只露出卡顶；底部可见地图文字。`ShopScreen.cs:Build`把背景Image作为VerticalLayoutGroup普通子项，未设ignoreLayout，背景进入纵向流。源 `expedition-shop.css:4-14` 将批准插图设置为CSS background，并由shop-market布局承载商品/详情/交易，目标该结构与源不等价。不能把此图当商店画面通过。主会话已派作者沿源完整整改，待正常播放器新图。

### P2：首脑编组卡标题越界，作者处理中

`journey-page-DeckSelectionPanel-3.png` 顶部“BOSS战·编组牌库”被画布顶边裁去一半，说明左侧也被截，HUD压住其标题区域。`BattleSubpages.cs:Build`新建card的RectTransform设near-stretch anchors后未清默认offset/sizeDelta，保留100×100默认尺寸，足以解释越界。仍需按源deck页面/共享header确定完整顶部布局，不将单次离屏截图推断成正常播放器所有入口必现。主会话已派作者整改。

### 待正常播放器确认：整理战利品标题与HUD重叠

`journey-extraction.png` 上方“整理战利品”大标题与返回、静音、头像、HP整排重叠；源run-top-bar.js在检测到#exMain时把共享header停入parking，源行为明确不叠加该header。

**现码CurrentRunTopBar.Covered已包含ExtractStashScreen**，不是漏写名单；此前即时消息曾误读，已向root更正。所以此处需要核当前Standalone稳定图/实际Visible与CanvasGroup，不应盲目追加重复条件。主会话正在补正常播放器证据。该问题不能因journey流程passed而销账，也不能无视离屏证据边界直接宣称生产必现。

## 已关闭或非生产缺陷

- **Passage字幕：正常Overlay已确认可见。** film-flow-3的passage-middle-caption在progress .60449时无字幕，虽然trace存在“继续深入/第2层/区域”对象；它证明Editor离屏路径没有覆盖该字幕。随后独立查看player-10/player-passage.png（原生产材质）与player-passage-ui-queue.png（QA临时材质队列），两图字幕均完整，故撤销“生产字幕缺失”判断，不改生产shader。
- 源map-passage.js:54-56的region直接使用game.layerData[to].name，没有剥离“第n层”前缀；当前小字显示“第2层·风雪哨线”本身不能判文案错误。
- journey稳定ChestOpen四图的奖励标题位于中间，chapter已隐藏，没有旧的chapter/奖励标题叠字；EntrySupply选择页也未见同类重叠。
- pile-2展示了消耗牌堆顶部/底部、相同卡×4分组、末条reader 21/21与独立UI警告。当前图片没有之前遇敌日志提示覆盖pile标题。它不能仅凭静帧证明所有回焦/alpha恢复时序；这些属于其原生操作断言范围。
- frames-2五角色各状态总览可见不同的攻击/受击/倒地中段与最终倒地造型，脚底基线未发现明显跳动；无与黑象/星月/无/白塔/长物语身份混淆。真实出牌攻击与EndTurn受击图片也有相应姿态。未逐素材重算264张或仅凭静帧批准30/60fps、暂停、末帧停留时长，仍由对应原生断言/时间记录支撑。
- film的保存失败横幅为故意文件锁用例反馈，不将它残留在同批其他截图上升级为正常路径的新设计问题。
- journey-returned-base.png是全黑，不能作为基地正常可见的画面证据；需等camp curtain结束再补稳定图。它本身不证明生产回基地黑屏。

本轮尚未宣布完整玩家画面收官；Shop、Deck、Extract实际稳定图是本报告留下的收尾点。
