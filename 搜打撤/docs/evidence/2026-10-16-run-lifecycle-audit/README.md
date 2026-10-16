# 远征生命周期独立审查与事件选择恢复

## 结果

药摊、装备征用的满包失败与退出丢奖励、黑市命中后的满包吞奖，以及普通事件退出/刷新重抽已分三批修复。等待父任务在下一安全节点统一切换实机，三选一/黑市仍待自然遇到。源码不再改动；未改 CSS、玩家存档、服务或 Git 状态。输入 SHA256 与定向检查记录见 `verification.json`。

- 原一级选择先写 visited，二级 openEventCardChoice 不显示背包入口/局部失败状态。失败仅落不可见的地图日志；通用退出随后保存已完成节点，候选未持久化。父任务实机已在药摊确认未收卡但节点完成
- 两条入口现在先固定候选到 nodeRewards，实际收卡成功才消费节点；征用的 3 币与候选在同一份 run 快照保存
- 二级页有容量、当前放不下提示和真实整理入口；背包往返不重掷，退出回地图保留原节点候选，正常读档在当前位置直接恢复候选
- 领取索引与 visited 一起保存；旧回调、重复点击、重新进入或读档不能重领。用户在地图正常移动/拖动不会强弹其他节点的奖励
- 既有卡池、三选一规则、药水/装备抽取概率与卡牌容量规则未变。旧存档无需新增字段；新增记录校验候选 ID、领取索引、事件类型与 0/3 币付款标记

## 实现归属

- `game/src/run/event-card-choice.js`：独立的固定候选/渲染/领取控制器，94 行
- `game/src/run/game.run.flow.js`：两事件延后消费，原节点优先恢复候选；lazy 装配保持初始化边界，移除旧选择器
- `game/src/run/node-reward-state.js`：受校验的 event-choice 节点记录
- `game/src/run/game.session.js`、`game.session.kernel.js`、`game.run.js`、`game/src/game.boot.js`：最小同步读档恢复钩子
- `tests/event-choice-recovery-cloud.test.js`、`tests/event-choice-session-resume-cloud.test.js`：真实事件流、背包按钮和真实 RunStorage/loadGame 回归；既有测试未覆盖二级页真实按钮/满包局部提示/退出重载路径

## 已验证

最终13文件103测试通过；11个相关源码/测试 ESLint 通过；422 项目文件语法检查通过；8 份渐进类型配置通过；docs门461相对链接零发现；自有diff空白检查通过。首批11文件83项与黑市追加批12文件97项保留在 verification.json。回归包含满包失败、整理往返、退出重进、正常 JSON 持久化、真实 loadGame 恢复、领取终结、同槽新局旧回调失效、征用余额 2/3、扣款一次、不同节点不强弹、恢复端口失效不伪称成功，以及既有补给/撤离/地图/架构兼容。

不是全量门通过；未运行 build。实机结果由父任务补入其统一证据。

## 黑市追加批与其他发现

`game.run.flow.js` 的 openEventGamble 命中分支，逐张 prizes.forEach(grantEventCard) 不检查失败，仍 settled=true、关闭页面并宣称获得三张。满容量时可能收费后奖品部分或全部丢失，无待领记录。静态路径确定，最小事件流探针已确认：18→15 币，零卡入包、visited=1、nodeRewards 空、Chests.serialize=null、idle 且页面关闭。父任务随后授权以现有 openFixedRewardsOnCell 承接命中后的三张固定奖品；该分支已修复，并通过满包、部分领取、重载、重复扣款/领奖回归。首次概率、投币费用、第五次保底逻辑不变。追加批12文件97测试通过，相关ESLint通过。

旧型 wood/rations/key 拾取路径也忽略 grantEventCard 的失败并 done，可能消费旧存档中的该类节点。现行新局主要使用 resource/chest，旧型三类节点的满包失败在定向探针中均已重现；现行新局可达范围仍待确认，不计入已实机验证缺陷。

## 存档现行说明

父任务授权后已同步 docs/save-format.md，并通过 docs 门（461 个相对链接、零发现）：nodeRewards 可包含 version=1、type=event-choice 的节点记录，eventId 为 ev19-potions/ev19-quartermaster，cardIds 是固定的 1–3 个候选 ID，paidCoins 为 0/3，taken 为 null 或已领索引。付款、候选、余额在普通 run 快照同时保存；未领不消费节点，读档恢复当前位置未领选择，完成索引禁止重领。无需更改地图快照版本。

`known-loss-probe.test.js` 与其独立 Vitest 配置保留修复前的4个损失行为探针；黑市部分是历史诊断证据，修复后不应再通过该错误行为断言。当前黑市验收在 tests/event-choice-recovery-cloud.test.js。

## 第三批：普通事件节点绑定

父任务实机发现征用未支付时退出/刷新后同节点变成隧道血契；源码确认 runEventDeck 每次 pick(deck)，没有节点ID记录。父任务明确授权本轮一致性改进。

- nodeRewards 新增 version=1/type=event/eventId 的轻量记录；第一次仍使用原 pick(deck)，叙事加载前保存，再进同节点只查该 ID
- 旧档没有记录时首次进入补建，不把 eventLog 当节点记录，不更改 mapSeed 或 mapSnapshot
- 已绑定节点不会被之后的故事首遇分流改成另一事件；药摊/征用升级为 event-choice 后优先恢复原候选与已付余额
- 已移除/未知事件ID保留记录，提示暂不可用并允许显式返回地图，不静默重抽或消费节点
- 新增 tests/event-node-binding-cloud.test.js 验证首次卡池、退出重进、JSON重建、旧档补建、坐标隔离、未知ID返回、付款候选升级、完成禁重复与非法结构拒绝。此前余额不足无记录断言同步更新为“仅绑定初始事件，未扣款、未消费”

该批只冻结事件卡ID；不额外重构每一种旧事件在一级页展示的随机预览。父任务持有浏览器、统一登记与实机证据；本子任务没有使用浏览器、构建、修改玩家存档或管理服务。
