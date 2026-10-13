# 队员五子页重排（待老板验收）

2026-10-11。实施范围为 `game/src/hub/hub.personnel.js` 与 `game/css/base-personnel-v12.css`。没有修改共用框架、常驻房间导航、业务数据或原画。未运行浏览器、测试、build，未执行出征、购买、出售、培养、孵化或领奖，未提交或推送。

## 已实际查看的真实屏幕

参考图通过 Invoke-WebRequest 下载原图，使用 view_image 实际查看。网页读取图链超时时，下载原图成功后直接查看，未使用游戏浏览器。

| 页面 | 真实参考与图片 | 实际采用的分区与流程 |
| --- | --- | --- |
| 培养 | [Gamebanana 角色基础资料实屏](https://images.gamebanana.com/img/ss/questions/6877e85db53f4.jpg)；[Icy Veins 角色培养攻略](https://www.icy-veins.com/zenless-zone-zero/agent-leveling) 中的 [晋升实屏](https://static.icy-veins.com/images/zenless-zone-zero/beginner-guides/agents/promotion.webp) | 完整人物原画在左；右上横向角色头像条；右侧身份与等级、加成和熟练度；右侧下方一体式培养/招式/外观/伙伴导航。选择人物后保留当前专属页；培养入口仍去仓库选卡，未发明新培养消耗。 |
| 招式 | [同攻略技能实屏](https://static.icy-veins.com/images/zenless-zone-zero/beginner-guides/agents/skill-interface.webp) | 原图的招式选择→详情流程映射到现有招式卡：右侧先读已选招式原画、类型、归档状态、描述，下方按类型切换和分页选择，详情按钮再打开完整卡牌。保留人物大立绘与一体式导航；没有冒用绝区零不存在于本作的技能等级。 |
| 外观 | [同攻略装备选择实屏](https://static.icy-veins.com/images/zenless-zone-zero/beginner-guides/agents/equipment-selection.webp) | 选择网格→查看当前预览→应用的浏览流程映射至已有外观；选择后左侧原画替换，右侧标记装备/预览状态，应用仍调用既有行为。此项采用装备选择实屏映射，未取得独立外观页截图，不宣称一比一复刻外观页。 |
| 伙伴 | [Gamewith 邦布升级实屏](https://img.gamewith.jp/img/original_1724f7fc263418425ede80f1d4262923.png) | 中央偏左大伙伴原画，右侧终端集中等级、安全格、能力、携带和培养；伙伴缩略原画横条放在两栏下方。选择伙伴保持档案，已相遇、随行与未相遇状态沿现有数据。 |
| 孵化 | [同邦布升级实屏](https://img.gamewith.jp/img/original_1724f7fc263418425ede80f1d4262923.png) 与 [晋升确认实屏](https://static.icy-veins.com/images/zenless-zone-zero/beginner-guides/agents/promotion.webp) | 使用中央素材原画＋右侧条件终端；显示伙伴蛋、储备币、缺口和孵化按钮；新增返回伙伴入口。孵化随机逻辑不变。未取得绝区零中与本作“伙伴蛋孵化”同功能实屏，此页明确是原有业务的参考布局映射。 |

所有人物使用横向全白画布，竖向原画 `object-fit:contain` 完整显示，保留人物与伙伴资产 URL，未生成环境图或口号。标题采用共用 `--base-font-title` 的粗黑体。

## 根接线

在 `base-rooms-v7.css` 之后导入 `base-personnel-v12.css`。保留 `.personnel-v2` 与原导出接口，新增 `.personnel-v12`、`.pv12-agent-workspace` 局部结构；无需修改 game.hub.js 或底部导航。样式限定在现有 `base-frame-v7.base-subpage` 内。

既有 `personnelHTML`、`bindPersonnel`、group/section/back key 接口沿用；人物导航继续使用 `personSection`、`personGroup`、`hubPersonView`。招式 `bindCardBrowser` 改为先填入页内详情，`personCardZoom` 保留单独完整卡牌入口；伙伴选择会退出孵化状态，回到新选伙伴档案。

## 未完成项

老板尚未进行当前窗口验收。CSS 需根统一导入后生效。依老板“先实施”要求，没有浏览器或测试通过结论。外观与孵化的精确同功能实屏证据缺口如上；目前实施的是已查看真实屏幕的布局/浏览流程与现有功能映射。

原图本地位于本目录 `personnel-v12-references/`，获取 URL 与 SHA256 见该目录 `receipt.md`；图片只用于参考，不作为游戏背景。

## 当前窗口反馈后调整

根会话在当前 viewport 654×956、游戏 zoom .340625 的培养页看到人物裁到膝盖、人物导航被共用底部导航覆盖。局部 CSS 原来采用物理视口 `vh`，本轮改为 `var(--game-layout-height,1080px) - 260px` 的内容高度：共用头部 84px、共用底部 128px、内容上下留白 48px，人物工作区占剩余 820 逻辑 px。

人物工作区使用固定顶部人物条、可收缩资料区、固定底部专属导航，立绘放在可收缩网格内完整 contain；资料在内部滚动。伙伴与孵化均改为此内容区内的固定网格，伙伴资料终端与孵化条件终端内部滚动。没有改根画布、全局缩放或共用导航。本助手未运行浏览器或测试，修后结果待根会话当前窗口复看。
