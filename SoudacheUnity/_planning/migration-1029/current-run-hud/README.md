# 当前运行 HUD 与输入迁移（冻结，待原生窗口复验）

本片按现行 `搜打撤/game` 的 `run-top-bar.js/css`、`expedition.view.js`、`map-floating-tools.css` → `run-experience.css` 最终覆盖及 `game-boot-input.js` 接入 Unity。原画资源只解码，不重新生成。代码保留为完成未提交，未启动 Unity、未操作前台、未使用共享编译输出。

## 已接入

- 同一物理 `runTopBar` 常驻，104 高透明顶栏，64×58 透明返回/音量/战斗设置，地图与战斗/房间共用。战斗不会因 `UiStack.Blocked` 隐藏；Bag、Settings、Shop、ExtractStash、卡牌特写/确认等专注页面按来源条件隐藏。插画房间添加来源中的暗色渐隐承托。
- 头像、164 宽生命值与4高血条、中央区域名/层数、原绘制金币96与攻击64图标、31号数字、失败存档重试、金币/攻击只读说明。来源7张 WebP 解码为原尺寸无损 PNG，RGBA 字节逐像素一致，见 `assets.json`。
- 底部工具左右32、底18、高88，最终工具图54/文案17/数字21、最小宽132；背包/安全格/消耗区直接接当前 `BagScreen.Open/SelectZone`。工具与预览均稳定保留，不按帧销毁重建。460宽右上地点预览呈现当前位置、可达、未完成、待领奖、营业中、已离店、已完成与关闭收据；规则复检仍由 GameRuntime 执行。
- 点节点只预览，再点或确认键前往；Space/Enter循环下一路线、Z上一条、X确认、Esc清选择；全部实际读取 `CurrentInputBindings.ActionFor`，支持重绑。Q/E分别连续旋转±0.2弧度，F按当前地点与同层直连路线框景，G按整层框景，均不改变探索状态。预览预留镜头边距时不改变正在显示的平移/缩放。
- 输入捕获早于Esc/注册表/游戏动作；字母开关、Ctrl/Alt/Meta、InputField/IME保护接实际分发。Bag旧B注册无法绕过重绑。原生Button保持Space/Enter提交；捕获期间临时暂停EventSystem导航，防止被捕获的键同时再次激活键位按钮。
- 启动应用实际帧率上限；View通过注入委托消费减动画/减震，保持Core/Res依赖边界；生命条过渡、地图呼吸/旋转、世界飘字位移/脉冲/相机震屏有实际消费者。阅读大字号接预览正文。
- `CurrentEndTurnHold.Install(Button, Action)` 复用同一Button，替代其onClick监听，不重复结束回合；设置开启时鼠标/Space/Enter按住650ms，显示进度条，松开、移出、失焦、失去选择、不可交互、UI归属变化、捕获输入和暂停取消。动画片已在BattlePresentation接入。

## 严格保留的来源边界

最终 `expedition-map.css:83` 将 `#layerBanner` 隐藏；`sdt-hintbar` 在现行源码只有偏好/class写入，没有可见提示条消费者。本片保留偏好与层更新事件，二者不新增可见界面。此项经Root明确拍板。

画质来源控制背板/庭院画布采样、保留图片缩放和48/96/192MiB缓存；Unity尚无这一整组等价消费者。`CurrentSettingsPage.QualityProjectionAvailable` 保持false。若后续实施，需要 `MapBackdrop`/各插画/头像渲染目标的采样上限接口、庭院采样接口，以及 `Res`/retained-frame共享缓存的预算与回收接口；仅改Unity通用Quality档位不能证明等价。

BattleSettings偏好归Root接线。跑局数据页保持 `CurrentSettingsActions.OpenRunData` 委托交Root。本片不更改BattlePresentation/Screen、地图生成、移动/结算规则。

## 验证与复用

- `python _planning/migration-1029/current-run-hud/verify_private.py`：冻结副本上的全源码私有编译，0错误、8条既有警告；日志 `private-check/latest.log`。不写Library或共享编译目录。
- `python _planning/migration-1029/current-run-hud/verify_behavior.py`：直接抽取正式状态投影与框景方法，在固定收据/地图数据上执行21条断言；包括待领奖/零索引已领取、火堆剩余操作、商店关闭、闸门通行、空祭坛收据、当前居中、HUD预留、整层与预览不移动镜头。日志 `behavior-check/latest.log`。
- `source-sha256.json`：现行Vite源码逐文件SHA256；`assets.json`：来源/导入/像素SHA256及逐像素比对；`receipt.json`：本片运行文件冻结SHA256。

以上为编译、数据投影与资源验证。尚未执行原生窗口布局、遮盖层、真实键位捕获/原生Button提交、650ms按住/提前取消、失败存档重试的实际点击验收；交Root统一原生窗口复核。

## 稳定控件名

`runTopBar`、`btnHome`、`btnMute`、`btnBattleOptions`、`heroAva`、`hpHud`、`hpText`、`hpBar`、`expeditionChapter`、`goldText`、`charAtk`、`save-status`、`save-retry`、`run-top-detail`、`expedition-map-tools`、`map-tool-{bag,safe,pocket,focus,overview}`、`expedition-map-preview`、`expedition-preview-enter`、`end-turn-hold-progress`。

属地：Kit `DesktopRunHud.cs/App.cs/CurrentRunTopBar.cs/CurrentMapTools.cs/CurrentRunHudView.cs/CurrentEndTurnHold.cs`；View `BoardView.cs`仅框景与减动画消费者、`BoardCamera.cs`仅detailInset、`Fx.cs`仅减动画/减震消费者；Res `Res.CurrentRunHudAssets.cs`、专有 `Resources/Art/Current/RunHud/`。View原已有地图改动不归本片新增。
