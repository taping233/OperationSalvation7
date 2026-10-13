# 地图与普通战样板

2026-10-11，WF-selection-map-implementation-1011，代理 map_battle_art。状态：首个样板CSS已实施，当前窗口实页待根代理复核。

## 已实施

- `game/css/page-expedition-hud.css`：目标放到路线标题下独立阅读行；路线名称/已知结果分级；金币、攻击有可见名称。`data-direction="return|deeper"`、`data-cleared="1"`已准备好样式接口，接口接线仍待原属地协调。
- `game/css/expedition-battle.css`：普通战采用已有`winter-expedition/outskirts.webp`，与地图同一冬境素材家族。冷灰明暗承托地面，敌方大面积黄光改为接地阴影，双方图片同用克制的轮廓投影。首脑、动作播放器和原稿未改。
- 实际黑网格来源是后加载的`ak-skin.css:142`背景简写；普通战属性选择器提升特异性后恢复冬境环境，不改共享skin文件。

## 依据

已检查前轮`09-map-entry.jpg`、`12-battle-entry.jpg`；读取总体计划、参考对照板与资产获取清单，查看R08图B、R09战斗、R11地图。R08支持节点类型与状态分别表达；R11支持地图与场景联系；R09支持共享地面/光影与底部操作区分离。采用G10的关注度层级与L1的M1冬境氛围；外部图未接入。

## 验证与待核

- 两个自有CSS经PostCSS解析通过（113/110顶层规则，之后仅增加一个资源容器规则）。
- 样板尚未做当前窗口实页通过声明。根代理需从真实开局进入外圈首战，截图核对脚线、地面、目标高亮、敌意图和手牌；地图核对目标换行与路线按钮高度。
- F08已获主会话许可并修改`game/src/core/renderer.js`的`drawIcons`/`drawNodeLabels`：保留节点类型，已消耗外框改虚线、已走过用勾标，标签加状态字。
- F07日志默认展开仍由`game/src/ui/hud.js`第一条日志自动展开控制；未编辑共享HUD模块。当前任务样板不改变日志存储。
- 未build、提交、推送、发布；无新进程，无新素材。

## 第二切片

已增加`game/src/ui/expedition-feedback.js`，由选人代理在altar唯一安装，消费`sdt:expedition-feedback`临时事件。营火显示实际生命增量/复原数量，入城显示已经获得的职业卡，关闭只清理DOM；路线点击、地图点击与新的节点弹层打开均清理反馈，不抢普通节点输入。状态只在模块变量/DOM内，不写game或存档。

`tests/expedition-feedback.test.js`与contracts/architecture-boundaries共3文件39项通过，覆盖过期营火、零实际收益、自动消退、实际卡对象揭晓、关闭不结算、新节点打开清理；Acorn、PostCSS及自有diff检查通过。F07正式文件仍未修改，可审阅方案留在`F07-PROPOSED.patch`，待原属地交接许可。

## F07 授权接手

老板明确允许保留原改动接手后，按上述可审阅补丁对`expedition.view.js`实施精确增量：回程/深入/探索属性、已探索属性与对应箭头；差分键加入路线可见状态，避免相邻索引未变时选中/已探索不刷新。四层目标、祭坛奖励和首脑状态指引保持原内容。对应expedition-view加状态缓存回归，与contracts/architecture-boundaries共3文件50项通过；本轮不接旧四层全局实页验收。

## 当前窗口目标栏修复

根代理`current-window/06-map.jpg`发现目标栏上溢。1523×956当前窗口测得sidebar为两行（61.3473/91.6507 CSS px），routePanel只占第一行且flex居中，标题顶端766.70落在sidebar顶端797.36之外。`page-expedition-hud.css`内仅给routePanel当前宽档跨两行，将标题/路线/帮助改三行grid并增加内边距，目标允许正常换行。未改sidebar、其他HUD或全局缩放。CSS解析和diff检查通过，修复后实页位置待根复核。
