# 死 DOM 样式保守清退

完成 18 个现行发布样式表的白名单修订：源文本减少 **55,487 字节**，移除 **468 个旧选择器分支、425 条只匹配旧界面的规则**。12 个定向/哨兵测试文件、135 个用例通过；新专测 ESLint 与定向 diff 空白检查通过。未删除文件，未改变原预算、门禁或资产指纹。

这是已授权的内容修订。未运行全量测试、构建、浏览器或服务操作，也没有提交/推送。保留原有其他任务的未提交修改。实页和最终正常构建交父任务统一覆盖，不能称新版本 CSS 预算通过。

## 为什么这批可以清退

这次只匹配明确白名单的正向必需旧 DOM 标识，不做全局自动未使用 CSS 清洗。对 game/src、game/data、game/index.html 的检索没有发现下述旧类名的生成入口；routePanel 的旧查询仍保留在 HUD/反馈代码中，但当前渲染器不创建它，既有 DOM 专测明确验证不生成旧路线面板。

| 类别 | 旧作用域 | 当前生成入口及替代结构 |
| --- | --- | --- |
| 路线目录 | #routePanel、.route-option/heading/help 等明确白名单子类 | game/src/run/expedition.view.js:92–190，创建 expedition-toolbar 与 expedition-map-preview；tests/expedition-view.test.js:90–91、107、138 明确验证旧面板/按钮不存在 |
| 旧远征手册 | .expedition-manual | game/src/ui/game.menu.js:460–479 调用 beginnerGuideHTML；game/src/ui/beginner-guide.js:24、40 生成 beginner-guide |
| 人物旧卡墙 | .class-dossier 及其旧子类 | game/src/hub/hub.personnel.js:70 起使用 person-stage/人物档案，保留当前类名及其规则 |
| 收藏/里程碑/卡背旧结构 | coll-room、coll-ms、coll-slot、coll-group、collection-command/panel、back-card/grid/thumb/sm | game/src/hub/hub.collection-v4.js:26 使用 collection-v12；hub.archive-v3.js:60–90 使用 av12-milestone、av3-back、archive-v12；cards.view.js:45–56 仍生成 hs-back/hb-* 卡背正本，不在清退范围 |
| 基地主页旧整备 | deploy-brief/mission/mode-dock/readiness-panel/primary、camp-depart-mission/art/figure/filehead/dossier | game/src/hub/game.hub.depart.js:26 委托 baseHomeV3HTML；hub.home-v3.js:27–33 使用 base-home-v7；出征详情 camp-depart-person/art、depMain 等现行结构保留 |
| 宝箱旧操作/揭示 | chest-ops、chest-reveal、loot-manifest/capacity | game/src/run/chests.js:334–336、414–465 使用 reward-v14/reward-unit/reward-claim/reward-capacity；不动 chest-opening、loot-actions、loot-outcome 等现行结构 |
| 基地旧货架 | shelf-item/visual/info/ico、shop-price/tag | game/src/hub/hub.trade-shop-v5.js:42–43、85–88 使用 trade-v5-item/trade-v12；不动局内商店 |
| 仓库旧用途页签 | warehouse-use-tabs | game/src/hub/hub.warehouse.js:65–68 使用 warehouse-controls-v12、warehouse-workspace-v12 与 warehouse-categories-v7 |

新专测 css-dead-dom-budget.test.js 固定以上旧界面白名单及当前生成器证据，并保护混合选择器。源码依据哈希见 checks.json。

## 选择器边界与幸存声明

- 按 PostCSS 解析后的顶层逗号分支处理，不能按普通逗号拆 :is()/其他函数
- 对 :not()、:is()、:where() 的内容一律跳过，包括嵌套函数与字符串，避免把“排除旧类”或“旧类与活类任选”的规则当死规则
- :has(.expedition-manual) 是明确要求旧结构存在的条件，可以清退对应分支
- 混合分支仅移除旧目标。ak-skin 中给 hub-card/dep-card 等共用的 :is(...) 规则、page-ach 中 hub-card:not(.collection-panel):not(.coll-room)、base-rooms-v7 中共享 :is(...) 均原样保留
- 每个文件先记录当前字节与 SHA，再施加局部 AST 编辑；写入前再次检查无并发变化。重新解析结果与预期幸存规则逐条核对，**幸存规则的声明及其顺序字节不变**
- prune-receipt.json 列每次修改的原始文件/起止行、原选择器、移除/保留分支、全部原声明、原规则文本及前后 SHA，可精确审查和恢复本任务改动

## 文件归属与改动量

| 现行文件 | 减少原文字节 | 删除分支 | 删除整条旧规则 |
| --- | ---: | ---: | ---: |
| game/css/ak-skin.css | 58 | 2 | 0 |
| game/css/base.css | 298 | 3 | 3 |
| game/css/base-camp.css | 7011 | 54 | 51 |
| game/css/base-camp-rework.css | 466 | 3 | 3 |
| game/css/base-cohesion-v5.css | 334 | 2 | 2 |
| game/css/base-controls-v4.css | 203 | 2 | 2 |
| game/css/base-rooms-v7.css | 476 | 3 | 3 |
| game/css/camp-entry.css | 656 | 5 | 5 |
| game/css/expedition-hub.css | 13208 | 116 | 95 |
| game/css/expedition-inventory.css | 1705 | 20 | 15 |
| game/css/expedition-rewards.css | 1037 | 12 | 12 |
| game/css/expedition.css | 2503 | 26 | 25 |
| game/css/hub.css | 1681 | 17 | 17 |
| game/css/page-ach.css | 9138 | 67 | 66 |
| game/css/page-expedition-hud.css | 5512 | 52 | 50 |
| game/css/page-rewards-bag-help.css | 7666 | 56 | 49 |
| game/css/scenes.css | 2417 | 18 | 18 |
| game/css/winter.css | 1118 | 10 | 9 |

只有以上 18 个 CSS、新专测与本证据目录归本次清退；其余在途改动不认领。没有顺手修改不进入当前发布的 page-classes、page-shop、cover-* 等旧纸面文件。

## 体积结论

原独立构建的 CSS gzip 总量是 205,912 字节，原门限 139,264 字节，缺口 66,648 字节。scripts/perf-budget.cjs:116–119 统计发布目录全部 CSS，单纯懒加载页面样式不能缩小这个总量。

对上轮 index-BM20MoP9.css（输入 SHA 见收据）在内存中应用同一白名单：原文 997,134 → 947,293 字节，gzip 176,039 → 167,911 字节，**模拟减少 8,128 字节（7.94 KiB）**。这是旧产物静态模拟，未重新运行 Vite，也不等同下一次构建的收益；不能据此表示当前预算已过。总量仍需父任务正常集成构建确定。

完全相同声明的机械去重只体现约 0.3 KiB 的压缩空间，本次没有实施。即使跨同选择器合并覆盖声明，静态粗估也只有约 2.6 KiB，且要处理兼容回退。后续更大收益需要按现行页面收敛 winter/基地旧框架，不宜在无实页对照时整文件清退。

## 验证

- 10 个针对性文件 / 94 用例：新死 DOM 样式守卫、地图、指南、基地出征、人物相关共用流程、收藏、成就档案、交易、宝箱、背包和入城补给
- 2 个哨兵文件 / 41 用例：contracts、architecture-boundaries
- ESLint：仅新专测，退出 0
- 定向 git diff --check：退出 0
- 所有 18 个文件写后 SHA 与收据一致；所有文件仍存在

测试通过只覆盖上述范围。浏览器视觉/交互、普通全量测试、正常生产构建和原预算最终判定均未执行。
