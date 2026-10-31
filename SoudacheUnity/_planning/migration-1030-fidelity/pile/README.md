# 现行战斗牌堆迁移修正

当前生产修改已冻结，原生画面与点击验收仍由主会话执行；本代理没有启动 Unity、操作前台或写用户存档。

来源：`game/src/battle/view/battle.pile-view.js`、`battle.decision-shell.js`、`battle.decision-content.js`、`battle.overlays.js`、`game/css/battle-pile-view.css`。旧页按 UID 原顺序展示 320×480 卡片，没有聚合、检视或列表浏览。

- 牌库显示列表复制后按中文名称、类型、费用、ID 与稳定键排序，实例保持独立；真实 DrawPile 和卡数据不排序、不写回。
- 消耗牌按全部有效 CardDef、费用与 UID 无关的实时呈现数据聚合，保留规则、费用、强化、变体、星盘相位差异；显示 ×N。
- 采用源 1700×900 面板、280×420 卡、40/36 间距、源标题与总张数、右下返回。复用 `DepartureElements.Card` 按 paper 宽缩放，避免旧 Xl slot 280×392 把 paper 收为 261.33×392。
- 点击卡片复用已有 `DepartureCardZoom`，以可选呈现参数传入实际费用与 UID 规则上下文；默认 Departure 调用保持原 340 宽和循环浏览。战斗牌堆以源 13.08em×34px=444.72 宽显示，透明保留底层牌堆，底部有界 ‹ index/total › 与方向键浏览、点卡面/外部关闭；关闭后返回当前检视卡的原按钮焦点，父页不重建、滚动位置保留。
- 复用 `CurrentHomeMaterials.Composite` / 已有 GrabPass shader，以源 7px blur 和 .72 stage opacity 合成，再叠 #050d1766；没有新建捕捉系统或相机。牌堆暂隐已有 BattleUnitFrames 的 Figure 与 foreground，关闭、销毁和 Build 异常恢复原 alpha。UiStack 只新增按 owner 设置自有 mask 颜色的方法，牌堆与透明 reader 的默认黑幕设透明，避免双重压暗。
- 原生按钮：`btDecisionInspect-0..N`、`btDeckBack`/`btGraveBack`、reader 的 `zoom-close`/`zoom-prev`/`zoom-next`。`BattlePileScreen.Kind/Stacks/Scroll` 暴露只读诊断状态。

验证：`python _planning/migration-1030-fidelity/pile/check.py` 最终私有全部生产程序集编译 0 错、10 项已有警告；`check_editor.py` 新原生入口与 OffscreenCapture 编译 0 错、4 项既有警告；`check_data.py` 运行实际 helper 源码，10 项数据断言通过，包括隐藏顺序不变和有效变体分离。

原生入口：`Sdt.Editor.CurrentBattlePileValidation.Run`（内部150秒；建议runner≥240秒）。它用隔离档、受控持牌和真实卡牌命令形成24张消耗牌，真实HUD打开deck/grave，检查21组与4张同体聚合、真实DrawPile不变、原生wheel到底、检视/浏览/点外部关闭、父页scroll/focus保留、blur参数及隐藏/恢复原alpha（.73/.61受控fixture）。原生参考截图不能代替独立播放器清晰度，本代理没有运行此入口。

边界：现 CardFace 没有 animated state-aura 元素，因此本片未生成光环。编译与纯数据断言不能代替实际布局、材质效果、滚动输入与返回焦点验收；上述原生流程仍待主会话执行。

附带只读技能复核：`battle.bag.domain.js:420-438,515-590` 与 native `StructuredRules.cs:1007-1044` 的 2 fixed、0 attack、4 spell、heal3/惩戒3 spell 和 normal/boss 搜刮目的地一致。3/4 是基础法伤，实际结算继续吃法伤加成，禁疗仍翻面。未发现应改规则的差异；完整 hint 的实际成本已经读取 live snapshot。未修改技能 helper 或 Core。

## player-7 实际画面复核与桥接修复

实际2560×1440的 `player-battle-pile.png` / `player-battle-pile-reader.png` 暴露普通战开场日志的全局黑条遮住标题。metadata确认标题内容存在，bounds x813–1747/y1233–1296；OperationNotice覆盖x865–1695/y1224–1285，处于Stack后的前层。原因是 `BattleBridge.Log → RunLog.Log` 把sys日志无差别变成ToastRequested，丢失kind；源 `ui/hud.js:132-149` 只写保留日志，当前日志DOM入口移除时直接return。

经Root明确扩展属地，只改RunUi的Log桥接为 `LogRequested{Text,Tone}`，BattlePresentation监听LogRequested保留战斗日志；明确Toast仍走独立提示消费者。未在Pile隐藏Notice、未挪标题。既有DesktopRunHud仅把LogRequested的warn显示为警告，保持保存失败等反馈。新增title/total稳定节点名；原生probe增加实际标题可绘制字形与无sys全局notice遮挡断言。修后生产编译0错/10已有警告，Editor probe编译0错/4已有警告；新播放器画面和原生断言仍待Root运行。

层级核实：`run-top-bar.css:3`共享header z210高于二级层z200，因此Pile的共享HUD保持清晰在前符合源；同文件:99在cardZoom出现时隐藏header，所以reader里隐藏HUD也符合源。这两处不改。此前只看battle-secondary局部CSS推测reader HUD应该保留的候选已被最终cascade否定。
