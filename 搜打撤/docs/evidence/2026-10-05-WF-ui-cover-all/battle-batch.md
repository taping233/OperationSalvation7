# 战斗 HUD 与独立附属层

日期：2026-10-05。归属：Codex 子代理 hub_surface 第二批。状态：静态实现待老板验收；主会话统一挂载 `game/css/cover-battle-shell.css`。

## 范围与冻结

- 已读 `inventory.json` 的 battle/boss 条目及 `inventory.md` 今日冻结边界：以下 11 个条目均 `target_this_task=true`、`frozen_recent=false`。
- 已认可主页、设置、制作名单、选档、选人、指南、照相馆/信箱/跑局数据、基地所有新体系页、地图、主页成就详情、在途主页/地图/基地全部避让。
- 仅新建 `cover-battle-shell.css` 与本记录；未修改 battle.view、战后结算、mainmotion/公共动效、任何既有源码；未改之前排除的 `cover-hub.css`。
- 普通小窗沿用 `cover-system` 的纸面规范；战斗附属层需要独立补齐 `.room` 与普通 `.wide` 外壳（见后续静态整合修正）；开箱与祭坛 `.sac-hand` 归 `cover-run`；主背包 `.bag-view`、普通 CardZoom/help 归 `cover-details`，本批不重做。

## 入口 → 根选择器 → 实现

| inventory id | 真实入口 | 精确根/组件 | 实现范围 |
| --- | --- | --- | --- |
| battle | `battle.view.js` → `render()` / `showBattleStage()` | `#overlay .card.battle .battle-stage.sts` 后的 `.sts-topbar/.sts-encounter/.sts-hud/.bt-pile/.sts-tactics` | 深蓝上下 HUD 承托、纸面牌堆徽、金色主动作、深蓝次动作、红棕撤离语义；仅皮肤不重排战场 |
| boss-deck | `battle.overlays.js` → `renderDeckSelection()` | `.card:has([data-act='bossGo'])` | 复用普通纸面小窗外壳，编组标题/计数可换行、外部卡格间距、已选描边与开战被动标签 |
| battle-choice | `battle.view.js` → `choosing` | `.card.discover:has([data-act='btChoicePick'])` | 浅纸独立壳、蓝色题头、宽松纵向选项、长文字换行、焦点/按键色彩反馈 |
| battle-hand-payment | `battle.view.js` → `handSelecting` | `.card.discover:has([data-act='btPickHand'],[data-act='btPickHandSkip'])` | 普通选手牌、燃料注能、支付/牺牲候选共用该真实入口；纸面壳与提示、外部卡格留白，保留必选/跳过动作 |
| battle-discover | `battle.view.js` → `discovering` | `.card.discover:has([data-act='btDiscover'])` | 纸面壳/题头/说明；仅改卡格容器，不改发现卡面与获得动画坐标 |
| battle-settings | `battle.view.js` → `UI.act('btSettings')` | `.card:has(.bt-settings) .bt-settings` | 复用小窗，四项设置的纸面行、青左缘、可读字号与复选框；原 ID 与状态保留 |
| battle-grave | `battle.overlays.js` → `renderGrave()` | `.card:has([data-act='btGraveBack']) .bt-gy-list/.bt-gy-row` | 浅纸清单、名称/类型/费/稀有度文本分栏可换行、完整说明与返回按钮复用 |
| battle-deck | `battle.overlays.js` → `renderDeckPileView()` | `.card:has([data-act='btDeckBack']) .bt-gy-list/.bt-gy-row` | 与墓地同体系，仍显示真实数量/分类与洗牌说明 |
| battle-bag | `battle.overlays.js` → `renderBattleBag()` | `.card.battle-bag .battle-bag-grid/.battle-bag-slot` | 复用小窗壳，浅纸托卡/整组数量与“存入”标签、格间留白；安全格不足 `.off` 原语义保留 |
| battle-settle-retry | `game.bag.settle.js` → `retry()` | `.card.discover:has([data-act='battleSettleRetry'])` | 独立纸面小窗、金色重试按钮；未改结算、存档或重复奖励逻辑 |
| boss-intro | `battle.view.js` → 首脑登场与开战装备演出 | `.boss-intro .boss-intro-tag/.boss-intro-title`、`.bt-start-equip-flash .bt-start-equip-label` | 字体与装备标签承托；保留红色首脑提醒、插画、全部动画与时间 |

战斗原位 `.bt-infuse` 的注能/选目标提示使用浅纸短横条；其 `btInfuseDirect/btInfuseGo/btInfuseCancel/btPickCancel` 控件与真实文案保留。

## 无动作空态的静态限定依据

初读发现“必选手牌为空”没有 `btPickHand` 或 `btPickHandSkip`，不能只按动作定域。主会话要求再枚举全部 discover 来源，静态核对如下：

- `ui/overlay.js` 74 行只在 `mode === 'discover'` 加 `.discover`。
- `battle.view.js` 236/269/282：战斗抉择、选手牌、发现；选手牌空池生成直属 `.bt-hand > p.ov-empty`，发现空数组生成直属 `.bt-hand:empty`。
- `game.run.altar.js` 701：祭坛同模式但明确 `.bt-hand.sac-hand`，本批显式排除。
- `game.run.dev.js` 178：开发台同模式，其内容无 `.bt-hand`。
- `game.bag.settle.js` 67/169：结算重试与弹药说明同模式，分别为 `.ov-btns` 与 `.ammo-teach`，均无直属 `.bt-hand`。
- 全 `game/src` 的 `.bt-hand` 标记搜索另含 `.event-choice-hand/.fire-restore-hand/.cls-grant-hand`、chests、boss 编组、主背包；前三种仍在空态选择器显式排除，箱子/编组/主背包分别由其他模式隔离。研究所入口 `game.nest.js` 未使用 discover 模式或 `.bt-hand`。

因此新增限定根为 `.card.discover:has(#ovBody > .bt-hand:not(.sac-hand):not(.event-choice-hand):not(.fire-restore-hand):not(.cls-grant-hand):is(:empty,:has(> .ov-empty:only-child)))`，只补该源代码结构的外壳/文字/空说明。没有新增玩法空态文案，发现空数组本来就没有内容也未虚构提示。该结论仅为当前源码结构依据，不是实机触发/交互验证。

## 保护项

- 不覆盖 `.sts-arena/.sts-unit/.sts-me/.sts-foes/.sts-allies` 几何、HP、意图、红绿紫/状态语义、单位名牌、目标热区、人物立绘、场景底图、能量球素材。
- 不写 `.sts-hand/.bt-slot/.hs-card/.hs-back` 本体规则，保留原手牌尺寸/扇形数学/拖拽/瞄准/卡面内部/牌堆卡背。
- `.bt-hand` 仅出现在动作锚定的独立 discover 或 boss 编组根内，不存在全局 `.bt-hand` 覆盖。
- 交互新过渡均 ≤.18s，仅背景/边框/颜色；不新增循环动画或滤镜，不改 VFX/登场/装备/获得/退场的计时。
- 撤离 `.arm` 原红色确认态/内联色/缩放保留；危险键 hover 显式排除 `.arm`。`.dis` 仍保留提示点击能力，不设置 disabled 或 pointer-events。
- 少量 `!important` 仅针对旧 winter 的顶栏和特定 discover 壳已有强制背景/边框/投影；没有全局 discover 规则。
- `.battle-bag` 卡面容器比例与 `.off` 容量不足语义保留；卡格留白为容器调整，不改单卡内部。

## 静态阅读与未核项

### 静态整合修正：普通及 room 战斗附属窗

主会话指出 `overlay.js` 在探索房间启动战斗时，把 `showOverlay(..., true)` 的设置/墓地/牌库/背包/首脑编组附属窗同时标为 `.wide.room`，而 `cover-system` 明确排除 `.room`。原候选仅改内部后会残留深灰外壳与浅纸内部混搭，本轮已修。

- 精确共同外壳选择器：`#overlay .card:is(.room,.wide):not(.battle):not(.page):not(.bag-page):not(.chest):not(.discover):not(.scene):not(:has(.doom-panel)):is(.battle-bag,:has(.bt-settings),:has([data-act='bossGo']),:has([data-act='btGraveBack']),:has([data-act='btDeckBack']))`。
- 完整补齐普通及 room 变体：浅纸底/深蓝边框/硬投影、`height:auto` 与 `max-height:90%` 外层滚动、最高 1140px 的卡格与清单宽度；设置单独限为最高 740px。取消 room 的整屏高度及纵向居中，让长内容从标题开始滚动。
- 同根内覆盖 `#ovTitle`、`#ovBody`、直属 `.ov-stats/.ov-note/.ov-empty` 与其中强调字、`.set-h`、`.ov-btns`、按钮/禁用/焦点/关闭状态。`#ovTitle` 改左对齐并可自然折行，说明统一可读深灰；操作与返回为同体系蓝金切角。
- 强制背景/投影仅用于该限定壳，防既有 3D 战斗场景主题的 `.card { background:transparent!important;box-shadow:none!important }` 泄漏至附属层。没有修改战场根 `.card.battle` 或 `.battle-stage`。
- 静态补读 `overlays.css` 342-350 的全屏 room 基底、`winter.css` 的 3D 场景强制规则；只改本批 CSS/本记录，保持零测试/浏览器。

按 `rg` 入口读 `battle.view.js` render/设置/注能/发现/支付段、`battle.overlays.js`、`battle.piles.view.js`、`game.bag.settle.js` 重试段、`ui/overlay.js` 模式切换；读相关 battle/expedition-battle/page-battle-ui/overlays/winter 样式片段与 `cover-system.css`。为无动作空态定域，追加只读全源码 discover/hand 标记及对应祭坛/dev/弹药来源。

未浏览器/实机/截图，未测试/lint/build/解析验证，未写存档、安装、删除、提交。真实尺寸、长名字、首脑牌库、必选空池是否实际可达、双倍节奏、拖拽/瞄准/撤离确认、保存重试与性能均待老板验收；未据静态源码宣称视觉或功能通过。
