# 高频流程补齐：规则说明入口统一

持续目标第十一批，沿卡牌展示、搜索、交易和详情，把当前卡快照与现有正式说明入口接齐，按实际执行声明维护简单句式。

状态：本批修改完成，编辑释放，待老板统一验收，全部保留未提交。主会话负责公共显示接线；`description_templates_r11`、`description_consumers_r11`、`battle_description_surfaces_r11`使用6.1-sol/high，分别负责简单句式、基地入口与战斗提示。

本批集中修改，由老板统一验收，不运行测试、lint、构建或实页，不新增测试，不提交或推送。

## 实施

- `structured-card-description.js`与`card-description-text.js`：精神药水`tt3-mind-potion`复用抽牌模板，读取`bag.use.draw.amountField`；满月形态`tt3-nature-form`使用`onPlay.energyCap.n`，同时说明能量上限与即时能量增加。执行依据分别为`cards.sync.m6.js`与`battle.bag.domain.js`、`cards.sync.m2.js`与`battle.effect-assembly.domain.js`/`battle.resolution.domain.js`。复杂或地图/战斗语义不同的混合药水保持原说明。
- `card-description-links.js`：`render`解析原始说明，`renderResolved`排版已生成说明，共用现有链接、搜索高亮、缓存和富文本。`game.cardslib.page.js`选片台接后一入口，退出先生成再解析的重复步骤；搜索/选片台传齐当前卡快照，搜索采用当前说明。
- `hub.trade-shop-v5.js`与`hub.personnel.js`：交易卡牌说明使用正式富文本，材料`good.tip`保留基地语义；人物招式搜索使用当前显示说明，沿用既有交易浏览和人物培养增量。
- `equipment-info.js`、`card-tip-groups.js`、`battle.overlays.js`：装备提示、词条收集和战斗背包按钮说明共用正式说明入口；装备保留uid/snapshot相位状态，规则识别继续使用原始数据。
- `battle.view.js`：药水栏从`findEffectiveCard(uid)`返回条目取`.card`，把完整当前卡传入说明生成。`battle.potion-use.js`读取该已生成说明的路径本已正确，保留；`battle.hover.js`使用执行上下文和预览结果，未改。
- `card-zoom-content.js`：本次生成一次完整说明，照片与大卡按实际解析内容显示，保留动态规则产生的正文。

未改卡牌定义、平衡数值、玩法或使用资格，未新建说明系统；旧原文显示/搜索及重复解析接线按上述入口退出。现行合同归`docs/cards/card-display.md`。

## 老板统一验收入口

- 图鉴/人物卡池按现行效果与数值搜索，交易卡牌详情与大卡说明一致，木材/口粮仍显示基地用途。
- 战斗药水栏与预览显示同一当前卡说明；精神药水抽牌数与声明一致，地图入口保持原可用性。
- 满月形态说明与实际能量上限、即时能量变化一致。
- 装备相位、已触发状态与下一回合提示保持；术语说明沿当前正文收集。
- 照片/选片台搜索高亮、伤害摘要裁剪与卡牌引用正常，说明数值不重复叠加。

本批依据源码与子代理交接实施，上述行为尚待老板集中验收；未复用早期测试结果证明本批增量。
