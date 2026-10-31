# 当前桌面偏好真实消费者

已接入当前正式 CSS 的三档标题装饰光效和大字阅读具体元素；生产已冻结，等待受理会话统一原生验证。本目录不含前台、浏览器、服务或 Unity 启动操作。

## 画质

来源 `game/src/core/performance-settings.js` 经 `ui/performance-settings.js` 与 `menu-settings.js` 进入正式入口。源比例 low/balanced/high 分别是背景 1/1.5/2、庭院 .75/1/1.25、预热保留 .25/.5/1（48/96/192 MiB）。正式 `performance-settings.css` 在 low 隐藏标题全部雪/雾/颗粒/火花/光束，在 balanced 隐藏近雪/雾/颗粒。新 Kit 入口读取现有 CurrentUiPreferences.Quality，HomeAmbient/Motion 在每帧读取，因此保存成功后即时更新。

当前 Unity 的 MapBackdrop 直接用 SpriteRenderer，KoiPondGraphic 直接用 UGUI 顶点；没有浏览器背景 canvas 的像素采样中间层。现有 Res._sprites 保留正在使用的 Sprite，也不是源仅持有额外预热 Image 引用的 warmPool。没有新造 RT、第二缓存或按档位强卸载正在显示的纹理，也不声称 native 图片驻留内存受上述数字封顶。三档通过现有标题真实命名装饰形成可观察差异。默认 balanced 现在保留远雪、火花、光束，隐藏近雪、雾和颗粒，符合源默认条件。

## 大字

`card-layout-selected.css` 精确覆盖 `#cardZoom .hsc-desc` 为 26px，原有行距保持。CardFace 仅在已经挂入 cardZoom/inventory-zoom/reward-cardZoom 容器时绑定；绑定器抵消现存放大卡牌 transform 后的字体放大，使 26 以 Canvas 的逻辑像素表达。原有可滚动说明继续滚动。普通手牌、普通 Xl 卡不增加绑定。

`review-ui.css` 将词条、日志和确认正文设为 26px、1.7 行距；已连现有 PhotoInlineLinks 词条标题/正文、BattleLogScreen、CurrentSettingsConfirmation 正文与错误状态、HomeInboxDeleteDialog 正文。词条测量高度按大字重算。独立行动记录 `#log` 尚无完全对应原生面板：RunLog 桥至 ToastRequested，BattleLog 收集战斗记录；未将普通临时 toast 扩大或冒称独立行动记录完整移植。

照片右纸说明是源 `.cz-photo-rules`，不是 `.hsc-desc`；背包右栏独立说明是 `.inventory-zoom-rules`，源规则也不命中。两者维持原字号。普通 `#tooltip`、按钮、名称和地图预览未在本轮扩大。

## 验证与接班

- `receipt.json`：只读源 SHA256 与实施前生产 SHA256。
- `source-vectors.json`：源比例、三档命名层开关与生产条件核对；这是静态接线证据。
- `production-freeze.json`：最终 10 个生产文件 SHA256；后续原生输入复核以此为准。
- `typecheck/latest.log`：现有 Unity 6000.6.7f1 引擎与当前 UI/Newtonsoft DLL 定向类型检查，退出 0，0 errors；10 项已有警告与本次新增文件无关。

原生待验：各档位实际雪层/雾/颗粒/光束开关；低档 ghost/accent/wallpaper 静止；默认 balanced 画面；设置保存、重开与切回标题；放大卡牌说明有效 26 逻辑像素和溢出滚动；词条与确认正文大字后的布局；设置关闭恢复基线。原生由受理会话统一执行，不能用上述静态检查替代。

`prepare.py`/`finish.py` 是本轮一次性私有候选准备和落地脚本，现生产已改变，不应重新执行。`verify.py` 可只读复核源和刷新本目录最终 SHA；`run_typecheck.py` 将类型检查输出限制在本目录。
