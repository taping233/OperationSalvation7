# 人物浏览与出征准备实施

2026-10-11。批次 WF-selection-map-implementation-1011，完成未提交。当前窗口实页由根会话补验；本记录不宣称视觉已通过。

## 改动与来源

- F01/F03：定位、已核实代表机制与代表卡查看入口在首层；熟练成长折叠，完整卡池保留类型筛选/分页/详情。五人候选采用已有独立 avatar，未改原画。来源 R01/R02/R10、G1/G2、L1/L2；代表卡描述来自当前卡池对象。
- F02：按五人配置水平重心和共同底部锚点，保留全图 contain 与白塔坐姿；不扩大原画或切掉武器。来源 R01/R02、L1/L2。当前参数需根窗口确认。
- F04：纯展示 preview 从实际 starterSha、宠物 effect、仓库拥有数与 stackCapOf生成固定卡、额外携带、数量、已知格数；珍珠盒额外格仅资源。职业卡最多两张不同卡，仍在确认时随机抽取，未知格数以入城实际计入。来源 R07/G1/E1-A02/A03。
- F06：保留实际发牌/扣仓时点；转场完成执行原继续按钮的 idle/save/refresh，地图旁路事件揭晓实际卡面；关闭反馈只关闭展示。保存失败仍由 saveGame记录，反馈附未保存原因。来源 R08/G1/G3/E1-A14；消费者模块归地图代理。
- F14：首次整备自动展开损耗说明，独立选人入口同样提供；成功出发复用 Base.markAmmoTaught，保存整备失败不标记，熟悉玩家可随时重看。真实规则来自 game.bag.settle.js：普通卡入口袋，初始攻击/职业/衍生打出消散；道具装备不可在火堆复原；撤离口袋每张1/3保留。来源 G1/G2/E1-A04。
- F16：换人同步更新选中信息、立绘和头像条，保留外层页面；仅立绘局部反馈，无整层退场、无粒子。快速连续切换不排队旧对象。减少动态沿现有 preview 机制。
- 节点代理协调增量：火堆日志与事件使用实际hpGain/复原张数、满血0；层间闸门说明按reverse方向。仅由本代理写altar，规则回归归节点代理。

## 路径

- game/src/run/game.run.altar.js（保留既有基地取消/作用域diff）
- game/src/hub/game.hub.depart.js（保留既有整备草稿、取消、失败和档位边界）
- game/src/hub/departure.view-updates.js
- game/src/hub/departure.summary.js（新增纯预览）
- game/css/character-view-motion.css
- game/css/departure-cover.css
- tests/departure-summary.test.js
- tests/departure-browse-state.test.js
- tests/departure-class-confirmation.test.js

## 已验证

- 定向 Vitest：上述三测试 + base-departure/contracts/architecture-boundaries，6文件53测试通过。
- 定向 ESLint：本域四JS和三测试通过。
- npm run check:syntax：360文件通过（最终接线后已核）。
- 测试覆盖：机器人7张分成5+2；火焰精灵转换与同名额外卡合并；珍珠盒资源格；仓库裁量/职业排除；失败不标教学、成功标教学；真实火球详情；重复确认不重复抽牌；取消转场不反馈/保存；入城实际卡与保存失败提示；快速连续换人保留页面根节点。

## 根窗口实页剧本

1. 基地出征选无：首层读定位和代表卡，点击代表卡只开详情；展开成长。连续切无→白塔→黑像→无，截图当前无和白塔：无原画/脸/武器完整，白塔坐姿不被拉高，选中头像与名字一致，无整页空白。
2. 进入整备：首次规则展开，固定卡、额外、模式、宠物与未知职业卡摘要可读，主出发按钮可见。分别机器人/火焰精灵核对7张初始攻击/5张火球及格数；同名额外火球在详情仍能移除。截图整备与展开规则。
3. 返回人物、返回模式、重新进入整备；草稿与仓库未消耗；取消不变原存档。真实确认仅一次扣仓。
4. 入城转场完成直接看地图位置和实际职业卡反馈，关闭继续探索不再次发牌；截图卡牌反馈及地图位置。刷新读档不重复发牌。
5. 火堆：受伤与满血分别显示实际增量/0，复原数量一致；截图资源附近反馈。火堆若另有职业奖励层，核对反馈不会被遮挡/误结算。
6. 当前窗口快速换人/返回/皮肤、减少动态模式；页面不空白、不串对象。未覆盖多尺寸、最终对比度与命中区域测量。

## 未覆盖

根窗口真实链、视觉截图、五人精确构图/头像辨识、最终对比度与字号命中区域由根会话补验。未build、未全量测试、未提交推送发布；不覆盖在途原画/人物播放器，未改机制数值或概率。旁路DOM和地图美术归地图代理。

## 根当前窗口定向反馈

根实际窗口654x956的01-roster-first显示步骤竖排及头像仅见发顶。选择页steps改右对齐max-content，各项不收缩、不换行，未改字号和缩放。关闭旧full-art黑色渐变，将avatar放在名字条上方，object-position为center 65%，原图保留。首屏定位沿已核实CLASS_STORY，无为物理进攻/潜行/流血/连击，代表卡仅作示例。ESLint和diff检查通过；根窗口复验尚待完成。

### 实际加载来源修正

根CSSOM确认前述character-view-motion.css补丁未加载。源码定位：game/src/hub/game.hub.js静态import game/css/base-camp-rework.css，Vite注入到inline style；expedition-roster.css的character-view-motion.css @import已注释。本次只改base-camp-rework.css中选择页steps和avatar规则，原left440/rightauto改右16/max-content并逐项不收缩不换行；原center18通用img规则改精确art-avatar定位、名字条上方高度、65%裁切和z-index1，盖过旧after渐变，名字仍为z-index2。保留其他基地diff、没有important/字号/缩放改动。此CSS路径归本轮人物切片增量；当前窗口隔离复验交根会话。

## 实际加载样式的静态细化

根02-roster-stable确认steps与avatar生效，但新增信息使用默认按钮外观。现以实际加载base-camp-rework.css统一定位28px、机制24px、代表卡名24px/查看说明20px、成长入口22px；代表卡入口分行，不在首层堆完整规则，完整详情仍可查看。黑像/星月沿同一单列结构与各自已核实CLASS_STORY，长卡名允许换行，不设固定窗口断点。立绘及整页缩放保留。根当前窗口需继续核对最终字形与角色适配。

根04-preparation-stable验证真实携带穿刺后摘要为6张/2格并且返回保留，发现摘要白字白底。精准depSummary及b改不透明#e4eaed底/#263946字，保留内容逻辑。

老板授权删除卡面外重复名字：只移除左仓库dep-card-caption标题及其本来源样式，卡面名字、aria-label、剩余/已带、堆叠与查看移出保留；右侧原本没有独立重复名字。没有删除文件。

本次涉及game/css/base-camp-rework.css、game/src/run/game.run.altar.js、game/src/hub/game.hub.depart.js。直接3测试12项通过、两JS ESLint与diff-check通过。源码已稳定通知根同步隔离实页，未宣称新样式视觉通过。

### 五人首屏简介去重

根14-roster-refined确认新增层级实页生效。逐条核对五人CLASS_STORY均为机制复述，没有人格或叙事；对已有mechanism人物不再渲染旧cls2-story重复段，保留数据及缺机制时的fallback。星月圣光信息合入新关键词。只改game.run.altar.js文字展示，ESLint与diff-check通过。卡池、成长和皮肤保留。
