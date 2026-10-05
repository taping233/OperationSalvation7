# 探索与终局界面批次（2026-10-05）

状态：`cover-run.css` 已实现并由主代理挂载，待老板目视；续令已剔除全部研究所专属样式和结局样式。仅静态读取真实渲染源与现行 CSS；不浏览器、不实机、不测试、不 lint、不解析验证、不 build、不安装、不提交。未创建服务、未操作存档、未删除文件。

## 本批属地与设计

- 仅新增 `game/css/cover-run.css`、本报告。玩法源、全局 CSS、公共台账、已有素材只读。
- 沿首页/制作名单/设置的纸面 `#edf0e8`、纸层 `#f7f7ef`、深蓝 `#1b3442/#233743`、暖金 `#c0aa78`、冷青 `#80a9aa`，使用有留白的档案/价签/报告结构。
- 节点背景、商店室内图、宝箱道具、战斗结果横幅全部保留；本文件没有 `.hs-card` 及卡面内部选择器。既有稀有度与职业色、`.off/.got/.picked/.sel`、禁用和计数数据保留。
- 不改 DOM、文字、data-act、监听、事务、存档与收益。仅对普通探索具体根添加视觉规则；研究所完全排除于本批独立设计之外。

## 根选择器 → 来源 → 覆盖

| 独立根 | 真实渲染源 | 本批视觉覆盖及二三级路径 |
| --- | --- | --- |
| `.node-pg:has(> .node-panel)` / `.node-pg > .node-panel` | `game/src/run/game.run.scenes.js:83` 的 `nodeShell` | 保留整屏房间插画，右侧宽纸档案页、蓝金边条；分开标题/说明/选项/页脚；选项低饱和纸条与清晰禁用态、16–20px 留白；不作用没有 node-panel 的商店 |
| 上述根 `.sc-pickup/.sc-safe/.sc-fire` | `game.run.scenes.js:185/238/324` | 拾获搜索/收益与领取、安全地带、营火消耗卡复原；原复原卡面/数量/不可复原状态不变 |
| 上述根 `.sc-event` | `game/src/run/game.run.flow.js:196/316/378/463/540/581/645/845`；`game.run.altar.js:441` | 启程补给、投放点、最后引路灯故事/恢复错误分支、一般事件选择、药水/军需/修鞋铺子选择、重编选择/确认、黑市赌局；卡牌仅承托与间距，未改牌身 |
| 上述根 `.sc-door/.sc-altar/.sc-exit` | `game.run.altar.js:466/502/535/554/588/602/628/654/732/742/770/779/1041` | 环间门、污染祭坛主选项/碎片不足/兑换不可用/奖励二选一/复原、首脑封印与迎战、停用撤离点/紧急撤离/终局撤离、撤离成功最终总结；危险色收敛为砖红，状态信息保留 |
| `.shop-pg.sc-shop` | `game/src/run/game.run.shop.js:248/294` | 补给站与二级收购台：原室内照片、浅纸页头与资源条、货位纸套与价签、收购账簿、空货位/已售/不足/物品卡外框、离开；保留原货位列数、卡面尺寸与所有价格/不足语义 |
| `.card.chest` | `game/src/run/chests.js:256/360`；`ui/overlay.js` chest mode | 搜索与揭晓、普通/职业宝箱、三选一/全部领取、战后战利品、满包警告与放不下计数；纸报告/容量栏/领取页脚，保留道具、横幅、tier 外框色及收取/已收状态 |
| `.card.discover:has(.sac-hand)` | `game.run.altar.js:676/686` | 祭坛献祭选卡器：纸面外壳与外部卡牌网格、选中描边与确认/取消；不作用其他 discover 或战斗选卡 |
| `#exMain.result-pg` / `.card.page:has(#exMain.result-pg)` | `game.run.altar.js:928` | 撤离入库整理：容量页头、回收摘要、背包卡牌外套、资源账簿、全入库/智能整理/完成；入库/off/no-room 逻辑、原卡面与角标保留 |
| `.doom-panel` / `.card:has(.doom-panel)` / `.fx-doom .card.room:has(.doom-panel)` | `game/src/run/game.session.death.js:162` | 撤离失败：三项损失/抢运/安全格数据、熟练度条、抢运卡牌、返回/再出发；保留失败横幅与抢运卡面；不覆盖战斗舞台 |
| `.flow-transition:not([data-presentation="base-arrival"])` | `game.run.scenes.js:134` | 非基地抵达/迎战/胜利短演出：原场景图/扫描/时序，蓝金说明承托；排除已改基地过场 |

## 收窄后的冻结与剔除

老板续令“今天改过的不要再改”后，按实时 `PARALLEL-REGISTRY.md` 与近期证据、现有 cover 文件重新核定：

- 本拟补 `.cls-pool-page`，但 10-04 feedback-r5 已改、10-05 `WF-character-pool-cover` 正编辑；已从本文件完全移除卡池规则和通用按钮组中的卡池锚点。复用 `character-pool-cover.css`，不叠加。
- 主页/制作名单/设置/选档/选人/基地各页/出发整备/照相馆/成就/留言/数据/指南/地图均不在本批；基地过场显式排除 `base-arrival`。
- 10-05 `WF-big-chest-search` 是卡牌 `cmtn28jv33wx` 的独立插画重绘，不是 `.card.chest` 界面重塑；本文件仅宝箱外框和排布，未引用/染色/改卡牌素材。
- 10-04 通用开合与转场动效已完成；本文件不改其 keyframes、动画/时序/reduced-motion/导演接线，也不碰在途地图路由。
- 老板再续令“研究所的也不用改”：已完整剔除本批研究所八组动作壳 `labBack/nestGo/nestCell*/rcBack/naBack/nsBack/nestExtractRetry/labScoreBack`、其按钮/状态/格子模板/焦点/响应式规则以及 `#labEnding` 全部规则；旧研究所代码与 CSS 未改，文件未删。主代理公共壳继续负向排除八组动作根。

## 集成边界与待核

- 主代理负责挂载在现行 `winter/expedition-shop/expedition-rewards` 之后。本批不修改 CSS import 或入口代码。
- 原 CSS 有明确 `!important` 的商店和 chest/discover 背景/边框/投影，按相同具体根局部接管；tier 稀有度外框 `!important` 保留更具体权重，未抹掉等级色。
- 研究所不再由本批接管；公共 CSS 的保守排除方式与无锚点限制见下节，只回报主代理，不越域改公共壳。
- 终局保存异常 `terminal-settlement.js` 与普通撤离 `extractRetry` 页、帮助 `.help-body` 归公共壳/帮助批次。
- 原卡牌尺寸（包括矮窗已有 `!important` 尺寸）、动画、职业/稀有度色沿用。只增外部留白/滚动兜底；未声称卡面排布在任何窗口已验收。
- 按老板要求未做实机、视觉渲染、输入、尺寸、功能、性能或自动化验证。当前结论是源代码层已实现，不等于实页验收完成。

## 研究所共享界面只读边界核查

- `game.nest.js:568` 保存中只发 `showOverlay(title, '<p class="ov-note">…</p>', true)`。DOM 是 `.card.wide` 与单个 `.ov-note`；没有 class/data-act/data-asset-key/body 模式标记。CSS 无法按“研究所”文字判定。主代理可保守排除无动作的 `.card.wide:has(#ovBody > .ov-note:only-child)` 忙碌窗，会同时保持其它同形忙碌窗旧样式，不能宣称精准模式识别。
- `game.nest.js:301` 传入 `opts.nest` 仅在内存；`battle.view.js:358–377` 没将它变成 DOM 模式标记。研究所舞台仍 `.battle-stage.sts`、`data-boss="1"`，背景键因 nest 敌人不在三首脑映射里回落 `battle-boss-general`，与一图首脑共用；不可拿 boss/background 当研究所的唯一模式锚点。
- 研究所战斗设置/墓地/牌库/道具包使用与普通战斗相同 `bt-settings/btGraveBack/btDeckBack/btBagBack` 标记；普通探索通过 `game.run.flow.js:137` 调 `beginRoom`，研究所源不调用，因此按已有 `.card.room` 上下文限制普通节点战斗子窗是保守区分方法。需要明确这只是现有调用链边界，不是独立 nest DOM 标记。
- 全屏背包 `.bag-view`、普通 `#cardZoom`、丢弃 `.glass-panel` 与部分共用提示没有可靠模式差异。若老板要求研究所的共享部件也完全冻结，在不改逻辑/不加标记的限制下，应整类不覆盖；不能只靠当前文案、`data-boss` 或敌人插画猜模式。
- 本次仅删自有新 CSS 中的研究所规则并更新本报告；未改共享战斗、背包、确认、公共壳或研究所旧文件。
