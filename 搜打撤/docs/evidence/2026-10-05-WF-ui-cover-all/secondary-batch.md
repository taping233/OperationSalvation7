# 第二批剩余界面：实现交接

状态：已写独立样式，尚未挂载，待主代理挂载、待老板验收。2026-10-05，沿上一工作时段认可的浅紙面 / 蓝金 / 切角控件；只写本目录说明与 game/css/cover-secondary.css。统一加载页经 10-04-WF-feedback-1004 来源补冻，本轮所有 page-loading 规则已剔除，旧 page-loading.css/js 未改。没有浏览器、实机、测试、lint、build、安装、提交或文件删除。

## 已实现边界

| 本轮根 | 运行来源 | 处理 |
|---|---|---|
| #legendGet / #cardGet | game/src/ui/cinematics.js 的 showLegendGet / showCardReward | 深青玻璃外景与浅纸展示承托；传说标签暖金，普通获得标签冷蓝；保留 .lg-card、.lg-beam 的几何和全部原动画/退出时长/发牌队列，原卡面与稀有度不动 |
| #overlay .card.discover:has(.ammo-teach) | game/src/hub/game.bag.settle.js 的卡牌消耗品提示 | 三组宽松纸面图解，自动换行；口袋用冷青，直接消散用浅红；卡面例图、图标和 ammoTeachOk 接线未改 |
| #overlay .card.discover:has(.devc-topbar) | game/src/run/game.run.dev.js；game/src/agent/agent.console.js 与 agent.data.js | 四页签开发壳、资源/卡牌分组、Agent表单、快捷键、同源数据表与危险区；只在真实开发者modal根生效，独立跑局数据 .data-tuned 不受影响 |
| #overlay .card:has([data-act="copyCards"]) | game/src/hub/game.cardslib.designer.js 的 showCardsExportOverlay | 可达“开发模式 → 导出工具 → 卡牌导出”的独立浅纸壳；宽JSON纸面与大留白，不碰照相馆父页 |
| #overlay .card:has([data-act="retryTerminalDeath"],[data-act="retryAbandon"]) | game/src/ui/terminal-settlement.js 的可变 retryAct；供给方为 game.session.death.js / game.menu.js | 终局保存失败的独立纸面与明确错误标题，解释区分段、重试按钮冷蓝，保留安全重试机制；覆盖普通及残留 room 状态 |
| #overlay .card.page:has([data-act="extractRetry"]) | game/src/run/game.run.altar.js 的 showExtractionRetry | 只给无专属名称的撤离恢复页做全屏浅纸、宽说明、蓝色状态条、宽重试按钮；恢复原 h2 可见，绝不泛盖 .pg.hub / .card.page |

## 冻结与协作

- 此前 34 项 frozen_recent 页面和 5 项隐藏/排除内容不进入样式根；角色卡池与统一加载页均已补冻，不恢复卡牌制作坊、卡牌导入、旧房间或目标预设。
- 本文件不含 #hubMain、.cls2-page、.cls-pool-page、.settings-page、.sugin-page、.slot-page、.studio-unified、.cz-photo、.achievement-gallery 或地图/HUD根的覆盖。
- 获得演出仅改展示承托和文字。卡面 .hs-card / .hsc-* / 稀有度图像与卡牌尺寸完全沿原有规则。
- 节点 sc-*、chest、sac-hand、exMain、doom-panel、研究所/nest、labEnding、非 base-arrival 过场归 run 代理；战斗主/附属层与 battleSettleRetry 归 battle-shell；背包、普通cardZoom、物品详情/help 归 details；普通确认/备注小窗、term-tip、exitScr 归 system。
- 开发者数据页规则全部以 .card:has(.devc-topbar) 包住，不能影响已冻结的跑局数据父页。危险按钮继续红系、运行状态继续绿系、LLM身份保留紫色。
- discover 原壳在 winter.css 使用背景/描边/投影 !important。本文件仅为 .ammo-teach 与 .devc-topbar 两个精确锚点的同三项做定向覆盖，未给其他样式扩大重要性。

## 残余与不确定项

- “投影选项小窗”：现行源码检索未发现玩家运行UI独有窗口或 data-act。投影字样来自隐藏 home.visuals 参数、extraction-preview 期望值及 ephemeral 结算文案。没有猜造selector，没有恢复隐藏房间；若主代理持有具体锚点，可另分片。
- 研究所“正在整理撤离”只有一段 .ov-note、无唯一根或动作，它属于 run/nest 状态链。本文件没有通过模糊正文或通用 .wide/.ov-note 去覆盖。
- 无额外发现尚未分配的可达主/二/三级页面。行内空态、数据身份/过滤等都沿所属页面根，并非每种状态新建一个页面。
- 仅源码基线可达，不代表实机触发。实际视觉、当前窗口裁切、动态时序、按钮/滚动/保存以及 CSS 挂载均未核。没有性能或功能通过结论。

## 接入

主代理按项目既有入口把 cover-secondary.css 放在旧主题层之后。此文件自身不导入、不修改现有入口，也不建服务。先保存该批源码，再由老板目视验收。
