# 28单元实施覆盖对照

这份对照记录源码处理结果，不替代主代理的最终实页验收。原方案的28单元包含整改、实施约束与条件优化，不能等同于28项新增功能。当前归类为：已实施15项、沿用现有3项、条件未触发8项、延后2项；“已实施”仅表示已写入相应消费者，具体覆盖边界和待验项见每行。

依据：[原设计清单](../2026-10-23-WF-p3-ui-adaptation-audit-1023/IMPLEMENTATION.md)、[P3代码摘录](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md)、[原项目代码摘录](../2026-10-23-WF-p3-ui-adaptation-audit-1023/project-code.md)。P/R摘录保留采样时的原文件行号；当前项目位置以下表的文件和符号为准，不能将历史行号当作现行定位。

实施证据：[设置](settings.md)、[卡片](cards.md)、[密集状态](status-layout.md)、[图形库](icons.md)、[图标消费者](icons-consumers.md)。本对照不新增浏览器操作或测试结果。

## 设置与分类

| 单元 | 状态 | 当前文件、关键入口与处理 | 覆盖边界／待验 | P3代码参考 |
| --- | --- | --- | --- | --- |
| A01 设置行阅读反馈 | 已实施 | `game/css/settings-navigation.css`：`.settings-group .chk`、`.chk:is(:hover,:focus-within)`、`.chk:has(input:focus-visible)`。去开启行额外着色，阅读高亮与 switch 开启分开；清除旧整行按压位移。 | `settings.md`；Tab、拖动音量、鼠标移出开启行的最终实页结论由主代理补充。 | [R08](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r08) |
| A02 单块分类底板 | 已实施 | `game/src/ui/selection-state-motion.js`：`installSelectionStateMotion/update/release`；`game/css/selection-state-motion.css`：`[data-selection-motion-ready]`。测量完成才接管填充；零尺寸、未挂载、销毁及 reduced-motion 保留业务状态的静态选择。 | 已有快速切换、单底板、焦点、背包局部更新测试；实页需核对设置和背包两类消费者，不仅看一张设置截图。 | [R10](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r10) |
| A03 小图标内部轻缩放 | 条件未触发 | `game/src/ui/run-top-bar.js`：`configureRunTopBar/installRunTopBar`；`game/src/ui/target-motion.js`：`retargetVisual`。图标语义与原宿主点击盒沿I01处理；未另加1.04缩放或环转动画。 | 未获得按钮边缘反复进出或反馈不足的同输入样本；不能宣称新增轻缩放。 | [R09](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r09) |
| A04 按下／禁用／忙碌 | 已实施 | `game/css/settings-navigation.css`：`.pg.settings-tabbed :is(.mini-btn,.ov-btn)`各状态、`#setMusicRetry/#setSfxRetry`、`.vol b`。以背景／内阴影替代位移缩放，保留禁用文字，重试按钮预留宽度，移除重复百分号。音频状态仍来自 `game/src/ui/settings-audio.js:bindSettingsAudio`。 | 仅设置消费者整改，未把所有全局按钮重做。不可播放／重试／忙碌和0→100音量实页仍须逐场景确认；未执行清空数据验收危险按钮。 | [R08](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r08)、[R10](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r10) |

## 卡片选择、阅读与领取

| 单元 | 状态 | 当前文件、关键入口与处理 | 覆盖边界／待验 | P3代码参考 |
| --- | --- | --- | --- | --- |
| C01 发现页选中语言 | 已实施 | `game/css/discovery-selection.css`：`button[data-discovery-option]`、`.discovery-selection-frame/.discovery-selection-mark`。合并多层框与外光为单个2px金框，保留“✓ 已选中”，焦点另用浅蓝描边；标记移到卡内右上。`game/src/ui/discovery-selection.js:bindDiscoverySelection`继续承载原业务。 | `cards.md`及下方最终实页：真实寻宝3选1、焦点与选择分离、详情返回、双击确认只获1张均已检查；触屏／全部边缘不随该样本自动覆盖。 | [R06](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r06) |
| C02 阅读焦点与业务选择分开 | 沿用现有 | `game/src/ui/discovery-selection.js:bindDiscoverySelection`、`game/src/ui/card-state-motion.js:installCardStateMotion`、`game/src/ui/reward-scene-view.js`。保留发现的两步选择、奖励查看／领取、背包阅读各自语义，未新增全局状态管理器。 | 现行背包没有 `.bag-tile.sel` 的业务消费者，因此没有伪造“选中栈”功能；相关样式分层归C07。 | [R01](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r01) |
| C03 重整战斗拾牌姿态算法 | 条件未触发 | `game/src/battle/view/battle.aim.js`：`startAim/applyPose/stepMotionFrame/cancelAim`及 returning 分支；保留唯一拾牌姿态所有者。 | 本任务未重写该算法，未证明需要统一progress模型或速度连续；普通截图不能证明快速拾取／反向归位通过。 | [R06](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r06) |
| C04 固定命中与文字阅读 | 沿用现有 | `game/src/battle/view/battle.hand-hit.js:createHandHitController`；`game/src/ui/term-tip-policy.js:allowsTermTip`；`game/src/battle/view/battle.aim.js`。保留固定逻辑命中区、文字阅读排除与单次提交。 | 未复制P3的26%放大，也未修改输入阈值；重叠边界、触屏、文字选择和重复提交属于集成待验范围。 | [R07](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r07)、[R09](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r09) |
| C05 奖励可领／已领／查看 | 已实施 | `game/css/card-state-motion.css`：奖励实际按钮`:focus-visible`；`game/css/card-layout-selected.css`：真实卡面宿主焦点出口；`game/src/ui/card-state-motion.js:update`继续排除已领／丢弃。其余待领卡正常对比，不加卡名托条。 | `cards.md`及主代理实页反馈：单张领取后卡面保留，全部领取后回总览已处理3张，背包2/16→5/16。该反馈证明状态与交易结果；容量不足、全部边缘和回程细节未在此对照追加通过结论。 | [R06](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r06) |
| C06 领取飞行与到达反馈 | 条件未触发 | `game/src/ui/reward-acquisition-motion.js:showRewardAcquisition/clearRewardAcquisition/refreshGeometry`；`game/src/ui/reward-card-feedback.js:showRewardCardFeedback/showRewardCompletionReceipt`。沿用340ms飞行与160ms到达。 | 主代理确认本轮未新增收纳动画或时长整改；focus／claim截图不证明轨迹、滚动重定位、掉帧或FPS。 | [R09](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r09)；仅生命周期原则，P3无本项目背包轨迹实现 |
| C07 背包卡与筛选 | 已实施 | `game/css/bag-design-system.css`：真实卡面焦点，移除重复brightness与清焦点；`game/css/expedition-inventory.css`：旧hover位移只留给非真实卡面；真实卡及数量角标由 `game/src/ui/card-state-motion.js` 同宿主接管transform。分类底板见A02。 | `cards.md`；未新增不存在的栈业务选择。全部→装备→空资源→全部、拖动取消、详情返回、数量角标和滚动保持仍须实页分别核对。 | [R06](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r06)、[R10](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r10) |
| C08 牌库网格焦点与标题 | 已实施 | `game/css/card-layout-selected.css`：`.battle-pile-card:focus-visible`；`game/src/battle/view/battle.overlays.js:renderDeckPileView`使用`draw-pile`。`game/src/battle/view/battle.pile-view.js:buildPileStacks/battlePileBodyHTML`及 `game/css/battle-pile-view.css` 原滚动／网格留白保留。 | `cards.md`、`icons-consumers.md`、`screens/pile-new-icon.jpg`。没有扩网格padding、复制排序、增加重复名牌；1项／首屏整行／99项／底部焦点与详情返回不由单张截图全部证明。 | [R06](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r06)、[R07](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r07) |
| C09 大图展开与回程重整 | 条件未触发 | `game/src/ui/card-zoom-controller.js:createCardZoomController`、`sourceCurrent`、原来源FLIP和关闭链；`game/src/ui/screen-owner.js:registerScreenOwner`。沿用现有来源有效性、inert及焦点恢复。 | 未新增并行预览层，未重写回程或照片专用路径；快速关闭、来源删除／滚动后的回退仍不能写成新效果验收。 | [R06](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r06)、[R07](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r07) |
| C10 新增卡错峰进入 | 条件未触发 | `game/src/ui/motion-presets.js:motionTiming`已有`stagger=35/staggerMax=105`；列表仍由各调用方更新。 | 未新增99张错峰、分批构造或筛选入场重播；没有同输入首开成本样本支持扩展。 | [R07](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r07)、[R06](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r06) |

## 常驻状态栏与说明

| 单元 | 状态 | 当前文件、关键入口与处理 | 覆盖边界／待验 | P3代码参考 |
| --- | --- | --- | --- | --- |
| B01 固定密度与空间边界 | 已实施 | `game/src/battle/view/battle.status-chips.js:statusChipsHTML/reconcileStatusChips`；`game/src/battle/view/battle.layers.js:curseChips/setStatusSection`；`game/css/battle-status-chips.css`的`.sts-chips/.status-chip-list/.status-chip-summary`。玩家full保留名称单位，敌人／随从compact固定图标＋纯数字，不再按4/5切换。当前为同排有界原生滚动区＋精确数量。 | 第三轮当前自然1280×720实页已确认随从2项／各敌人3项、5组数量、固定高度与末项Tab，见最终实页节及`status-layout.md`。完整ARIA与原单位保留；构造状态不证明玩法触发。 | [R01](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r01)、[R03](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r03) |
| B02 数值／层数／回合／开关 | 已实施 | `battle.status-chips.js:currentAmount/statusChipsHTML`读 `game/src/battle/core/combat.factory.js:BUFF_META/CURSE_META`。value取实际量、timed取回合、stack取层数、dodge取次数、flag只表达生效；`.status-value/.status-unit`分开保存，compact视觉只显数值，完整单位在full／ARIA／tooltip中保留。 | 8项状态表现测试含99层、回合、次数、flag与归零，以及compact/full视觉区别。附加限时增益的每一类真实来源／期限没有在本记录逐一实页触发；不扩大为全部机制已验。 | [R01](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r01)、[R04](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r04) |
| B03 正负表面与说明层级 | 已实施 | `battle.status-chips.js:statusChipsHTML`保留BUFF在前／CURSE在后，输出`bt-buff/bt-curse`、标题／当前量／原机制正文；`battle-status-chips.css`用青侧边与酒红侧边／背景区分。`game/src/ui/term-tips.runtime.js:renderContent`沿原说明表面。 | 没有新增分组标题或额外空白行；密集预算内以顺序、侧边和文案区分。若仍要求独立段间留白，此点尚未另加，不能写成全部分组外观均照原稿落实。 | [R04](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r04) |
| B04 状态节点局部复用 | 已实施 | `battle.status-chips.js:reconcileStatusChips`按`buff:/curse:/effect:/affix:/mark:` key复用；`battle.layers.js:setStatusSection`只在HTML签名变化时调用。保留滚动宿主、焦点、`aria-describedby`及额外敌方标记。 | 原P09的整组`innerHTML`重写有明确源码依据；本任务限定状态容器实施，未造通用reconciler。测试证明A节点／焦点／描述关联和滚动位置不因B更新丢失；死亡／换token与真实持续阅读仍待集成验收。 | [R05](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r05) |
| B05 新增／变层短反馈 | 条件未触发 | 状态节点已稳定，但 `battle.status-chips.js` 未新增脉冲动画；`game/src/ui/target-motion.js`和`motion-presets.js`仅保留为现有能力。 | 先解决重叠与缩放后可读性；没有证据证明160–220ms数量强调有净收益。不得把节点复用描述成已添加变层动效。 | [R01](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r01)、[R03](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r03) |
| B06 独立状态汇总入口 | 延后 | 现有单条说明已由`statusChipsHTML`补当前量、标题与原机制；数量“N项↕”只说明当前常驻滚动区，不创建独立汇总弹窗或新screen owner。 | 原暂缓决定保留；密集状态通过有界常驻栏先处理。未实现“点击状态N打开完整独立列表”，不以同排数量冒充该功能。 | [R01](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r01)、[R02](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r02) |
| B07 汇总浮层定位／滚动 | 延后 | `game/src/ui/term-tips.runtime.js:positionTip/followAnchor`与原单条避边继续沿用。B01新增的是名牌内部原生滚动，不是本项暂缓的独立汇总浮层。 | 没有新增62%屏高面板、选侧、受控惯性或wheel拦截；当前常驻区坐标预算见状态迭代，不能混记为B07独立层已完成。 | [R03](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r03) |
| B08 阅读与出牌互不误触 | 已实施 | `battle.status-chips.js:reconcileStatusChips`为状态容器增加局部click停止冒泡，不`preventDefault`；区域`data-ui-tip`提供数量／滚动／Tab说明。现有 `game/src/ui/term-tips.js` 捕获与 `term-tip-policy.js`继续工作。 | 测试证明列表空白／summary不冒泡确认，也不取消默认；真实拿牌点敌方状态后能量2/2、选中牌保持且完整tooltip显示。键盘原生滚动已验；额外滚动条点击／Esc／触屏不被这一样本全部证明。未新增document永久捕获器或汇总层owner。 | [R02](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r02)、[R05](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r05) |

## 动画责任、成本与图标

| 单元 | 状态 | 当前文件、关键入口与处理 | 覆盖边界／待验 | P3代码参考 |
| --- | --- | --- | --- | --- |
| F01 同元素动画责任 | 已实施 | 设置旧位移在`settings-navigation.css`收口；背包旧hover在`expedition-inventory.css`限制消费者；公共清框与焦点在`card-layout-selected.css`分开；状态姓名入流冲突回 `battle-stage.css:.sts-headrow`原规则修正。姿态仍由各原控制器负责。 | 处理已定位冲突，未换全局动画底座。`target-motion.js`保留位置续接，不声称速度连续。实页快速往返／中断覆盖由主代理最终列明。 | [R06](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r06)、[R09](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r09)；P3 `Fx.Animate`无统一冲突所有权保证 |
| F02 不叠业务锁 | 沿用现有 | `game/src/ui/reward-interaction.js:initRewardInteraction`、`game/src/battle/view/battle.discover-input.js`、`game/src/ui/discovery-selection.js:bindDiscoverySelection`。保留350ms跨页输入保护、页面token和busy/submitted。 | 未延长等待或因动画改锁；没有把音乐盒2帧或450ms／6px阈值搬成全局规则。Enter长按／双击／迟到回调的完整集成结果待主代理。 | [R10](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r10)、[R11](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r11) |
| F03 长列表首开成本 | 条件未触发 | `game/src/battle/view/battle.pile-view.js:battlePileBodyHTML`、`game/css/battle-pile-view.css`沿原实现；没有新虚拟列表、后台预热、持续rAF或第二份资源缓存。 | 未取得匹配输入、冷／热缓存条件下的首开瓶颈采样；99项测试出现不等同性能瓶颈证据。 | [R06](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r06)、[R13](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r13)、[R14](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r14) |
| F04 四槽飘字调整 | 条件未触发 | `game/src/battle/view/battle.vfx.js:spawnFloats`已有四个活跃错位槽及同单位多段计数，沿用现有。 | 未获得超过4个同时活跃文字仍不可读的真实样本，未加第5／6槽，也未引入格挡合并；不能把既有功能算作本轮新增。 | [R12](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r12) |
| F05 减少动态与静态结果 | 已实施 | `selection-state-motion.css`在系统／游戏偏好下使用静态选中填充；`battle-discover.css`两条减少动态路径取消hover位移；`card-layout-selected.css`和发现选中标记保留静态焦点／选择。原 `motion-presets.js:motionReduced`与控制器清理链沿用。 | 子任务测试覆盖相应开关／清理，但系统偏好、游戏开关中途改变、所有页面返回焦点不能因其中一项测试通过而统称全验收。 | P3未提供本项目双偏好的实现依据；参考[R06](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r06)时序，静态出口以项目P01／P21为准 |
| I01 重复占位图标及用途拆分 | 已实施 | `game/src/core/semantic-icons.js:SEMANTIC_ICON_KEYS/semanticIconPath`、`icons-bitmap.js`原API、`game/src/ui/status-icons.js:STATUS_ICONS`；68张 `game/assets/ui/semantic-icons/*.svg`。旧11组30键及chart/info退出同图别名，16状态同义贯通；21份消费者107处及主代理手牌／卡面近邻接线见`icons-consumers.md`。 | 原卡背WebP、金币／祭坛原画保留。域外m2／事件碎片、组合符印、次级机制等剩余候选仍在消费者记录中，未宣称全仓旧键清零。资源审查记录的失败与后续修复须按最新证据读取，不汇总成未经运行的全绿。 | 无直接P3图形实现依据：本项目原创SVG。仅[R01](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r01)／[R04](../2026-10-23-WF-p3-ui-adaptation-audit-1023/reference-code.md#r04)支持图标、当前量和正文分层 |

## 状态密度迭代及原方案变化

1. **原自由换行方案暴露碰撞。** `screens/status-8.jpg`中，1280×720当前窗口，三敌人8状态的敌方状态区y478、高79、宽166，进入y519的消耗堆；随从y480、高141、宽127，与x540、y510起的手牌相交。只移除4/5阈值不能解决空间边界。
2. **第一次密度整改：有界原生滚动＋下方数量说明。** 敌人／随从列表28 CSS px，间隔2、说明12，总42；玩家列表59、总73。姓名hover／focus改为原名牌上方绝对提示，避免入流再推低列表。主代理实页反馈 `screens/status-8-99-fixed.jpg` 已消除重叠，但窗口自然变为1074×956、游戏约0.559缩放，12 CSS px说明仅约6.7屏幕px，不可读。
3. **第二次密度整改：数量移到同排。** `.sts-chips` 改为 `minmax(0,1fr) max-content`，右侧“N项↕”18 CSS px／28行高，短名与数值18、图标18；横向间距与内边距压至2 px。紧凑列表28、玩家59，总高不再叠说明行。主代理实页矩阵确认计数和不遮挡，但紧凑随从106屏幕px宽度中，短名、99回合与数量竞争，仅能同时显示1项，仍不符合密集状态阅读需要。
4. **第三次密度整改：明确compact与full职责。** 在16个独立机制图标已接入后，主代理授权compact固定为18 CSS px图标＋纯数字，flag仅图标，名称／单位只在compact视觉隐藏，保留于DOM、完整ARIA和原tooltip；玩家full继续全名／单位两行。chip目标约49 CSS px，列表仍28、玩家59。该版本8项定向测试通过；主代理随后在当前自然1280×720确认随从同时2项／敌人各3项、末项Tab滚动及拿牌后阅读不出牌，具体范围见下方最终实页节。

原方案B01的“直接换行”据实页失败改为有界常驻列表；“图标未区分时保留短名”的前提已由I01解决，第三轮据当前窄栏证据固定compact视觉。B04由条件优化转为限定状态容器的keyed更新；B06／B07独立汇总浮层继续延后。没有增加第二份战斗状态、移除多余状态、移动战场单位／手牌或复制P3惯性滚动。测试用fixture的无随从补样只存在于展示snapshot，不进入玩法或存档。

## 本代理写入路径与验证归属

以下是本代理在本任务实际写入的全部产品源码、样式和测试路径；其他代理的图标／卡片实现以对应证据记录为准。

| 类型 | 路径 | 关键责任 |
| --- | --- | --- |
| 设置样式 | [game/css/settings-navigation.css](../../../game/css/settings-navigation.css) | A01／A04、静态分类外观、百分号 |
| 分类样式 | [game/css/selection-state-motion.css](../../../game/css/selection-state-motion.css) | A02的ready接管与减少动态静态出口；主代理随后补最终宿主级联 |
| 分类控制器 | [game/src/ui/selection-state-motion.js](../../../game/src/ui/selection-state-motion.js) | 首测／隐藏／销毁接管标记 |
| 分类测试 | [tests/selection-state-motion.test.js](../../../tests/selection-state-motion.test.js) | 单底板、焦点、零尺寸／重开、背包局部更新 |
| 状态样式 | [game/css/battle-status-chips.css](../../../game/css/battle-status-chips.css) | 有界列表、同排数量、第三轮compact图标＋纯数字 |
| 状态模块 | [game/src/battle/view/battle.status-chips.js](../../../game/src/battle/view/battle.status-chips.js) | keyed节点、数量、完整单位／ARIA／tooltip、局部阅读输入隔离 |
| 战斗局部样式 | [game/css/battle-stage.css](../../../game/css/battle-stage.css) | 仅原有姓名提示职责的两处规则；本代理未改单位／手牌位置 |
| 状态测试 | [tests/battle-status-presentation.test.js](../../../tests/battle-status-presentation.test.js) | 0/1/4/5/8/16、compact/full、keyed／焦点／scrollTop、局部点击不取消默认 |

本代理证据文件：`settings.md`、`status-layout.md`、`status-review.fixture.js`及本对照。fixture仅供冻结副本DEV导入；`installStatusReviewFixture/displaySnapshot`通过真实按钮调用原 `getSnapshot/mountUnitLayer/updateUnits`，只写展示副本。入口归当前战斗modal，退出脱离、重建重挂；没有写产品入口或解除产品inert。

本代理实际完成的定向结果：设置3文件20测试通过；第三轮状态文件8测试通过；对应JS／测试ESLint、修改CSS解析、定向diff检查通过。fixture语法与JSDOM机制／modal归属探针通过，但不冒充真实输入证据。卡片／图标分片的测试和失败边界仅引用各自记录，未由本代理重复运行或改写。

## 主代理最终CSS接管补充

原分类通用规则仍会被 `expedition-inventory.css` 的完整背包宿主压过；旧hover按钮上移和transform过渡也会穿透减少动态。该真实级联缺口由主代理最后修正，本代理本轮只读核对、更新文档，没有重复改源码。

| 归属 | 当前文件与接管范围 | 验证边界 |
| --- | --- | --- |
| 主代理追加，归A02／F01／F05 | [selection-state-motion.css](../../../game/css/selection-state-motion.css)：完整 `.card.bag-page .bag-v2` 加分区／类型宿主，普通模式按钮`transform:none`且不含transform过渡；系统与游戏reduce分支均`transition:none;transform:none`。 | 与ready／静态选择协同；最终hover、减少动态和按钮几何仍待主代理实页结论。 |
| 主代理追加，归C07／F01 | [card-state-motion.css](../../../game/css/card-state-motion.css)：真实背包卡面采用同等宿主范围，避免旧CSS重新把transform纳入过渡。 | 保留原卡片控制器唯一姿态责任；未新增卡片算法。 |
| 主代理新增测试 | [tests/ui-motion-cascade.test.js](../../../tests/ui-motion-cascade.test.js)：最初4个真实宿主级联契约，后补临时／变形／两者叠加aura的3个减少动态契约，共7项。 | 按CSS优先级做定向解析，不冒充浏览器输入。主代理报告aura新增契约先红，修复后7项通过；不得把本代理20／8项或主代理87项批次相加作全量数字。 |

相关细节同步见 [settings.md](settings.md#主代理追加的最终级联接管)。第三轮状态CSS／helper保持冻结，主代理最后CSS修复不构成新的状态密度版本。

## 主代理最终实页与定向验证补记

2026-10-24，主代理使用Codex内置IAB tab6、当前自然1280×720窗口完成以下真实输入；中途未主动切换多尺寸。本代理仅追加证据对照，不自行操作浏览器。

| 对应单元 | 已取得的结果 | 证据与范围 |
| --- | --- | --- |
| B01／B02 | 16／99时随从同屏2项，三敌人各3项，玩家full两行；玩家39.325、compact18.6625屏幕px，对应59／28 CSS px，当前场地不挡手牌／消耗堆／结束回合。0／1／4／5／8／16的5组数量全部正确，0高0，4→5→8→16高度不变；1／9／10／99纯数字盒约14.4125／14.425屏幕px，flag无假1。 | [第三轮最终截图](status-16-99-compact-final.jpg)、[数量矩阵](status-count-matrix-final.json)、[数值矩阵](status-amount-matrix-final.json)。旧`status-16-99-final.jpg`是第二轮，不能混作最终。 |
| B04／B08阅读出口 | 实际Tab到末项“攻击降低99回合”，原生scrollTop217.2、client28、scroll245，焦点线清楚；先实际选择攻击卡再点敌方首个构造状态，能量2/2且牌仍选中，完整tooltip显示，没有提交攻击。 | [末项键盘滚动](status-keyboard-scroll-final.jpg)、[输入前后JSON](status-input-isolation.json)、[完整词条与选中卡](status-tooltip-and-input.jpg)。此项不扩展为所有持续更新／死亡token已验。 |
| C01／C02／F02发现链 | 临时发寻宝，经数字2／Enter实际施放触发3选1；先点击第一项，ArrowRight按既有语义改选第二；Tab焦点第三而第二仍`aria-pressed=true`；查看第二详情后关闭，选择保留；双击确认只获狙杀1张，能量1/2、寻宝消耗1张。 | [discovery-selected-and-tab-focus.jpg](discovery-selected-and-tab-focus.jpg)及主代理输入记录。证明该真实发现／选择／详情／提交链，不等同触屏或全部长按跨页分支。 |

状态矩阵是构造展示snapshot，证明布局、读数、滚动、键盘与局部输入隔离，不证明玩法实际施加／到期；构造本身不写引擎或存档。先拿牌阅读状态的实验未触发出牌／扣能量。发现链使用实际输入与原玩法消费者，不能与构造展示证据混为同一种验证。

主代理报告87项定向批次通过；卡片aura新增契约在先失败、修复后独立复跑7项通过。两个批次有不同执行时点与范围，不相加为94，也不称本地全量测试。原分片20项设置与8项状态的执行记录分别保留，不重复加总。

## 实页反馈补充：共享生命与顶栏

老板实页指出生命外观跨页不一致、背包顶端生命／金币／攻击压住容量。这项补充用于收掉既有实装冲突，不新增原计划编号。它关联A02／C07／F01／F05的公共边界，但不改变28单元及状态统计。

共享顶栏仍是同一组DOM节点的受控重挂，并非为每页复制HUD。公共skin由 [game/src/ui/run-top-bar.css](../../../game/src/ui/run-top-bar.css) 的`body #runTopBar #hpHud`、`#hpText`、`.hp-rest`、`#hpBarWrap`收口：当前／上限使用同一字形，`.hp-rest`继承，地图／战斗／奖励不再依赖旧`page-opaque`／`scene-battle-3d`门控切换生命外观。

数字DOM已按 [hud-format.md](hud-format.md) 统一到 [map-health-hud.js](../../../game/src/ui/map-health-hud.js) 的现有`updateMapHealthHud`入口；`renderHealthNumbers`在快照缓存早退前维护`.hp-current/.hp-rest`，保留`#hpText`根节点。[hud.js](../../../game/src/ui/hud.js) 与 [run-top-bar.js](../../../game/src/ui/run-top-bar.js) 不再分别重写数字HTML或纯文本。现有条色、低血、伤疗、tooltip和战斗快照优先保留；inactive仍准确，active源码未扩。

老板允许部分页面隐藏顶栏。当前真实selector位于同一公共skin中：

| 页面边界 | 当前源码条件 | 显示策略 |
| --- | --- | --- |
| 远征背包／安全格／消耗区 | `body #overlay.bag-full > #runTopBar.run-topbar` | 隐藏共享顶栏，页面保留自己的返回、分类与容量，不再与容量争顶端空间 |
| 完整设置页 | `body #overlay:has(.pg.settings-page.settings-tabbed .settings-layout > .settings-nav) > #runTopBar.run-topbar` | 隐藏；不把任意带settings字样的局部战斗选项层一起隐藏 |
| 战斗发现选择层 | `body #overlay:has(.battle-decision[data-decision-kind="discover"] [data-battle-discover] + .discovery-selection-actions [data-act="btDiscoverCancel"]) > #runTopBar.run-topbar` | 满足实际发现动作结构时隐藏；以该selector范围为准，不声称所有无取消动作的发现变体均已覆盖 |
| 地图／战斗／奖励／战斗牌库／简易设置 | 沿现有`syncLocation`及modal归属保留，未增加上述页面隐藏条件 | 正常保留同一公共生命／资源栏；既有lobby、大图和动作确认隐藏条件继续生效 |

数字渲染近邻的3文件25项定向测试通过，详见[数字格式记录](hud-format.md)；没有与其他批次相加。公共skin／可见性接入后，主代理在Codex内置IAB tab6自然1074×956窗口完成以下实页。窗口由用户自然变化，未脚本调整尺寸；与前一状态密度批次的1280×720分别记录。

| 本轮局部验收 | 取得的结果 | 最终证据 |
| --- | --- | --- |
| 跨页显示与单节点 | 15个读数中，地图／奖励／战斗／牌库／战斗简易设置显示；背包／安全格／消耗区／完整设置／真实发现隐藏。全程`runTopBar/hpHud/hpText/resHud`各1，背包三区关闭回奖励、完整设置返回、发现确认回战斗均恢复。 | [15个跨页读数](hud-cross-page-matrix.json)、[背包最终洁净页](bag-header-clean-final.jpg)、[设置最终洁净页](settings-header-clean-final.jpg) |
| 生命外观与数字格式 | 可见HP均164×64 CSS px，数字字号30／行高34、normal非italic，轨道4 px；格式始终`.hp-current + .hp-rest`。地图生命说明经Enter和点击均展开。 | [地图最终页](hud-map-final.jpg)、[跨页矩阵](hud-cross-page-matrix.json) |
| 真实护甲及受伤 | 包扎实际花1费获得3护甲；真实`b.sts-hp-armor`宽26.3375屏幕px、生命区域宽138.25，没有覆盖血条。之后实际结束回合，HP30→23，顶栏与脚下同步23/30。 | [护甲几何](armor-geometry-final.json)、[受伤数值](hud-damage-final.json)、[受伤最终页](hud-injured-final.jpg) |
| 真实发现往返 | 实际施放寻宝触发发现，顶栏`display:none`；选择确认回战斗后恢复`grid`。 | [发现最终洁净页](discovery-header-clean-final.jpg)、[跨页矩阵](hud-cross-page-matrix.json) |

以上证明当前样本的共享生命、顶栏可见性、真实护甲／受伤和往返输入；未扩展为首脑、全场景、满容量、完整拖拽、所有上限／低血变化或全部发现变体通过。旧背包截图中仍有顶栏碰撞的画面只作修前证据，不能代替本表最终洁净截图。

## 最终覆盖仍有的边界

- 第三轮当前场地的数量／数值／密度、末项Tab滚动和拿牌后点状态已取得以上证据。触屏、全部姓名／意图／邻居边界、真实状态施加／到期、死亡／换token与全部滚动条／Esc分支未在本对照宣称全覆盖。
- `screens/settings.jpg`、`screens/reward-focus.jpg`、`screens/pile-new-icon.jpg`可证明各自截图时刻；不能单独覆盖快速切换、所有边缘、触屏、容量不足、动态轨迹或返回链。主代理奖励交易反馈也不证明FPS。
- I01保留消费者记录中的合理复用与域外语义候选；剩余候选不等同旧30键仍共用同图，也不能被写成已完成迁移。
- 未实施的8项条件优化没有成本／故障证据支持扩展，2项独立汇总功能保持延后。本对照完成后冻结；主代理补最终验收结论，不把待验句自动改成通过。
