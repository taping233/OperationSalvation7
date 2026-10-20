# 战斗 UI 信息减负与普通牌库说明

状态：UI 实现和定向回归完成；真实抽牌规则与普通牌库打开权限由领域分片/主会话接入，当前窗口实页由主会话集中验收。

## 改动

- 普通战牌库徽章读取 `snapshot.drawPile` 的真实剩余数量，点击沿原 `btDeck` 查看入口；保留现有普通消耗牌堆，不新增弃牌堆或洗回制度。库内按卡牌身份合并99份初始攻击，空库明确不会自动补牌。
- 战斗选项在普通战也提供“战斗规则”，分别简述普通效果抽牌与首脑循环。普通随身可用牌开局入手，另有99张初始攻击库；开局和常规回合不自动抽库，仅效果抽取。
- 玩家攻/法伤常驻保留含强化的总值，强化来源改为共享 `data-ui-tip` 可聚焦详情。护甲仍在生命栏旁的徽章显示，移除统计文字区的重复护甲。护盾、格挡、状态、装备入口保留。
- 承伤估算、余血与可能致死继续常驻；边界说明进入同一条估算的可聚焦共享详情，移除重复的小字边界。
- 生存指南数据和图示、规则页、源头活水直接规则说明与可见抽牌预览文案同步；指南中“战斗中按B整理背包”更正为地图/战前操作，与本批规则页一致。

未生图、未换人物/敌人/背景、未改领域或战斗胜利模块；本片没有调整场景材质/明度。未启动服务或浏览器、未 build、未提交。

## 文件

新增：`game/src/ui/battle-hud-info.js`、`game/css/battle-hud-clarity.css`、`tests/battle-hud-info.test.js`。

修改：`game/src/battle/view/battle.layers.js`、`battle.view.js`、`battle.piles.view.js`、`battle.decision-content.js`、`battle.preview.js`；`game/src/ui/beginner-guide-diagrams.js`、`game/data/beginner-guide.json`；`docs/rules.md`、`docs/requested-card-batch.md`；`tests/battle-infusion-action-layout.test.js`、`tests/battle-preview-trust-boundary.test.js`、`tests/battle-status-preview.test.js`。

编辑前原字节基线保存于 `../.tmp/battle-flow-1020/ui-before/`，任务前已完成改动保持原样。未编辑 `cards-sync.json`、`cards/card-description*` 或公共台账。

## 验证

`npm run test:target -- tests/battle-hud-info.test.js tests/battle-preview-trust-boundary.test.js tests/battle-status-preview.test.js tests/battle-preview-amount.test.js tests/battle-infusion-action-layout.test.js tests/beginner-guide-entry-copy.test.js tests/beginner-guide-readability.test.js tests/battle-pile-readability.test.js tests/battle-decision-redesign.test.js tests/battle-architecture.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`

12文件、210项全部通过。覆盖普通牌库99/98/0计数及99份身份分组、空库说明、无新弃牌循环、攻/法伤真实合计与来源详情、承伤/余血/致死保留、估算边界可聚焦读取、实际战场渲染及快照不变、预览信任边界、指南与既有牌堆详情。相关目标 ESLint 全部通过。

首轮原有“估算边界永远常驻”断言不再符合老板批准的信息减负要求，已改验实际承伤和余血仍常驻、边界可聚焦读取及快照不变；没有改动预测计算。

## 协调与待验

领域代理确认：普通库保留现有 drawPile 接口，空库不造牌、定向只取匹配实体，墓地/消耗制度保留。普通 `openDeckView` 的 mode门禁放开由主会话处理；本片测试不替代领域实际抽取/回合验收。

现行卡牌渲染 `game/src/cards/cards.view.js:139`、制作坊 `game/src/hub/game.cardslib.designer.js:145` 尚有旧抽牌提示。已向主会话给出精确替换建议“从本场牌库抽N张牌”；前者属其他活跃会话，本片未编辑。历史 archive/evidence/交付记录不改写成新规则。

主会话需在当前内置浏览器窗口检查普通99库点击与返回、99→98实际抽取、HUD明暗与遮挡、键盘说明落点。自动测试不能证明实际窗口的文字大小、对比度和交互手感。

## 追加：统一消耗牌堆

老板随后明确：弃牌堆、墓地和消耗牌堆统一为一个“消耗牌堆”，不自动洗回，仅由卡牌效果取回。本节替代上文旧的首脑循环/独立牌堆描述。

UI普通/首脑均只留一个消耗牌堆徽章、统一标题与计数入口；沿现有 `btGrave` 动作兼容，不另建同义入口。`consumedPileUids` 由其他获授权语义分片负责，本片没有修改该函数；`battle.overlays.js` 已经复用该函数与唯一标题常量，保持原样。

战斗规则详情、发现牌去向、注能材料、空牌堆与空手说明、生存指南、规则页和源头活水/星辰直接说明已统一：不自动洗回，仅由卡牌效果取回。首脑战固定抽牌与普通99库不固定抽牌继续分别保留；空手提示只看当前抽牌库，不再从旧弃牌字段承诺下回合有牌。地图/基地跨战斗“消耗区”保留。能源结晶、复原药水、后备能源的现行规则按主会话确认写为统一消耗牌堆全来源，不读地图消耗区；领域接实装由语义分片负责。

追加编辑前基线保存于 `../.tmp/battle-flow-1020/unified-pile-ui-before/`。未改卡牌canonical、描述解析、纯逻辑/runtime/core、战斗时序或资产。

追加定向回归：`npm run test:target -- tests/battle-infusion-action-layout.test.js tests/battle-hud-info.test.js tests/battle-decision-redesign.test.js tests/battle-pile-readability.test.js tests/battle-architecture.test.js tests/beginner-guide-entry-copy.test.js tests/beginner-guide-readability.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`；9文件142项通过。新增普通/首脑唯一入口与唯一名称断言，旧“消耗永不取回/首脑自动洗回”文案断言按老板新规则更新。相关目标ESLint、`git diff --check` 通过。

`npm run --silent docs:check -- --json` 返回 `ok:true`、653条相对链接、0项发现。仍需主会话验实际统一集合及跨来源取回、计数与当前窗口显示；本片不将只读展示测试视为领域规则验收。

## 追加：游戏全书使用共享卡文

`scripts/generate-compendium.mjs` 的卡牌表改用现有 `displayCardDescription(c.desc, c.id, c)`，再沿原转义和Markdown表格输出，未更改卡牌原始数据、描述解析或共享显示函数。战斗摘要明确普通99库不固定抽牌、首脑手牌上限8与原固定抽牌数，统一消耗牌堆不自动洗回。

原字节基线保存在 `../.tmp/battle-flow-1020/compendium-before/`。通过 `npm run docs:compendium` 生成 `docs/game-compendium.md`，未手改生成文件。更新范围核对：215行卡牌描述与共享展示同步；既有卡牌名称/费用/稀有度/职业0项改变；保留现有运行时新卡“穷鬼套餐”，卡牌总数281→282、装备38→39，无卡牌移除。非表格变化仅生成日期、对应计数与本批战斗摘要。

生成器定向13项测试全部通过，包括每张卡文与实际显示函数一致、原卡库不变、雷殛只显示“消耗牌堆”、普通/首脑摘要和现有样例。生成器/测试ESLint与diff check通过。

联合 `tests/compendium.test.js tests/contracts.test.js tests/architecture-boundaries.test.js` 在本轮并行现场结果66/68：全书13项通过，另外两项分别报告 `battle/core/battle.default-context.js` 访问运行时未登记、`settings-battle-restart.js → battle-loader.js` 与战斗视图形成循环依赖。已将准确错误交主会话协调；本片未修改相关源文件，不改守卫或扩大修复范围。该结果不宣称全项目guard通过。
