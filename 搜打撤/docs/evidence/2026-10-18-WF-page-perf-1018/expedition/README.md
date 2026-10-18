# 远征与节点页面性能证据

本轮减少了重复状态投影、重复图搜索、重编事件的图鉴遍历、未使用的节点 HTML 解析，以及选角页的默认大立绘投机预热。玩法与可见图片地址保持原口径。修复前输入是本会话实际编辑前保存的原字节，包含工作树当时已有改动；没有用 HEAD 代替现场。

## 可复现收益

在 `搜打撤` 执行：

```sh
node docs/evidence/2026-10-18-WF-page-perf-1018/expedition/benchmark.mjs
```

结果见 [operation-counts.json](operation-counts.json)，脚本从 `baseline/*.txt` 和当前源码各取实际函数运行，输出不同就失败。这里测的是确定性同步操作次数，不能直接推算实机 FPS、网络传输量或 RSS。

| 场景 | 修复前 | 修复后 | 等价性 |
| --- | ---: | ---: | --- |
| 30 条已清空分支汇入同一未完成战斗，查询其后方目标 | 30 次阻塞节点状态检查 | 1 次 | 均不可达；下一查询重新读取领取、门、可见性变化 |
| 6 个相邻节点的路线投影 | 60 次奖励记录读取 | 36 次 | 路线输出含顺序逐项相等 |
| 600 张图鉴、80 张背包的重编资格判断 | 30,600 次图鉴条目读取、2,499 次可随机规则检查 | 600 次、450 次 | 46 个合格卡对象同序相等 |
| 入城、营火、拾取、闸门、祭坛、撤离节点壳 | 每页 1 次模板解析 | 0 次 | 六类 HTML 逐字相等 |
| 多选事件节点壳 | 2 次模板解析 | 1 次 | HTML 逐字相等 |
| 单项事件与叙述合并 | 3 次模板解析 | 2 次 | HTML 逐字相等，动作键保留 |
| 选角页默认完整立绘预热 | 每次开页向 Art.warm 提交 5 个默认 full URL | 0 个 | 可见 full 与头像调用点相同；动态切人/换皮肤仍走原渲染入口 |

选角项的 5 个 URL 是投机预热入口数量。完成缓存、画质预算与原本可见的大图会影响实际传输/解码，不能称为固定减少 5 次请求或固定释放若干内存。可见图仍由既有页面就绪与立绘切换流程加载。`Art.warmClassRoster` 公共接口未改。

## 页面覆盖清单

此表记录源码入口核查和本轮处理依据。真实浏览器操作、首图冷缓存延迟、GPU/合成负载统一由父会话在当前窗口验收；子代理没有启动服务或操作浏览器。

| 页面或场景 | 入口 | 发现 / 本轮处理 |
| --- | --- | --- |
| 主地图、节点标签 | `core/renderer.js`，`run/expedition.view.js` | 已有视口道路裁剪、单帧几何投影和绘制预算不重做；路线/选中预览改为复用已算状态 |
| 迷雾与底部小地图 | `run/game.session.board.js` | 当前在揭开节点、换层或 resize 时绘制，不是独立逐帧循环；未新改 |
| 长路线预览与移动 | `run/map-travel-path.js`，`game.run.flow.js` | BFS 对同一阻塞点多入边重复查询，改为单次查询内保存失败节点；直连、最短路、原边次序保持 |
| 新局路线生成与路线选择提示 | `ui/route-overlay.js`，`run/route-choice-preview.js` | 路线覆盖发生在生成/恢复，提示只读现行计划；现有五项守卫路线预览回归通过 |
| 角色选择、皮肤 | `game.run.class-choice.page.js` | 去掉全体默认 full 预热；仅选中大图可见，头像仍是头像图；已有局部替换不改 |
| 职业卡池二级页 | 同上 `renderPool` / `renderPoolGrid` | 当前按页切片造卡，只预取下一页，过滤与描述适配由页面操作触发；未新建长期缓存 |
| 入城补给、已领结果 | `game.run.altar.js:openEntrySupply` | 领取与存档所有权不改；共用节点壳少一次无用解析 |
| 商店货架、商品详情、买入 | `game.run.shop.js:renderShop` / `refreshShopSlot` | 固定九个槽位，详情/购买已有局部刷新与页面身份守卫；未新改 |
| 商店收购台、背包往返 | 同上 `renderSellPage` | 只列可出售牌；出售和返回由操作重绘，无新增轮询；未新改 |
| 通用事件单选、多选、放弃/返回 | `game.run.flow.js:triggerEventCard`，`ui/node-scene-view.js` | 合并同次 body 模板解析，保留先阅读后确认、单项叙述去重与所有动作键 |
| 故障重编 | `game.run.flow.js:openEventRecode` | 按本次开页需要的类型/稀有度分组后短路检查，代替逐背包牌扫描全图鉴；真正转换仍调用当前完整候选规则 |
| 药摊、黑市与固定事件奖励 | `game.run.flow.js`，`event-card-choice.js` | 已有奖励保存、过期页守卫；本轮不改随机和奖池，36 项事件/节点生命周期回归覆盖其中关键返回、重编与领取路径 |
| 营火休整、消耗卡复原、完成页 | `game.run.altar.js:openFireRest`，`game.run.scenes.js:openPocketRestore` | 当前行为由一次性事务/操作驱动；共用节点壳减少解析，容量、概率与复原次序不改 |
| 宝箱总览、逐箱开启、卡片/金币领取、容量整理 | `run/chests.js`，`ui/chest-reward-overview.js` | 已有挂起时取消演出、恢复身份与版本守卫；该源码另有活跃会话，按父协调未编辑保底块及宠物蛋测试 |
| 普通拾取、物资格、空白安全页 | `game.run.scenes.js`，`game.run.flow.js` | 共用非事件壳不再建立未使用模板；本轮不改发卡、容量和消耗节点语义 |
| 闸门、祭坛仪式/回赠、献祭确认、首脑入口 | `game.run.altar.js`，`ui/node-decision-view.js` | 都由当前页动作驱动；仅共用壳解析优化。核对首脑现行最低编组数后修正旧“最多 15 张”文案断言为“选择 15 张，不足全部编入” |
| 研究所备战、地图、符文箱/法阵、研究所祭坛/商店 | `run/game.nest.js` | 直线地图与候选在开页/操作重绘，无常驻绘制循环；固定 5 块符文/有限槽位；未新改 |
| 研究所通关三页演出、行动结算 | `run/lab.ending.js`，`game.nest.js:showLabSettlement` | 打字计时器在补全/翻页/完成时停止；结束解绑键盘并移除宿主；本轮未改演出资源或时长 |
| 紧急撤离、整理入库、完成回执 | `game.run.altar.js:openEmergencyModal` / `renderExtractStash` / `showExtractDone`，`ui/extraction-rewards-view.js` | 按保存事务与页面操作造页，存档期间禁重入，卡片排序保留原动作索引；本轮不改安全提交或卡堆状态 |
| 死亡/放弃结算、保存失败重试 | `game.session.death.js`，`ui/terminal-settlement.js` | 已有 busy / promise 与 attempt 复用，避免重复结算；本轮不改事务边界 |
| 地图生命提示 | `ui/map-health-hud.js` | 相同快照直接返回；变化反馈的计时器与监听由 dispose 清理；未新改 |
| 入城/离城与归档切幕 | `ui/camp-entry.js` | 现有图像就绪、AbortController、离页观察和一次性时长；本轮不改 |

## 修改与验证

生产代码只有六个路径：`game/src/run/expedition.view.js`、`map-travel-path.js`、新 `event-recode-candidates.js`、`game.run.flow.js`、`game.run.class-choice.page.js`、`game/src/ui/node-scene-view.js`。测试为新 `tests/page-perf-expedition.test.js` 与既有事件生命周期文件的一条过期文案断言。现行源码与原字节快照 SHA256 见 [source-manifest.json](source-manifest.json)。

最终有效定向反馈合计 10 文件、142 项通过，包含依赖/循环架构哨兵；八个既有文件的 125 项已在同轮批次通过，之后只修新测试的 motion 替身并单独验证其 12 项，另补守卫路线 5 项，没有重复全量。精确命令和分批范围见 [verification.json](verification.json)。八个修改/新增源码与测试路径的定向 ESLint 退出 0；A/B 脚本退出 0。

新测试覆盖状态投影次数、单次查询阻塞去重，以及原地修改奖励/门/可见性后立即失效；重编还核对职业例外、同名/同 ID、保护牌与顺序，并验证重新开页读取当前数据。选角测试覆盖初始大图、换人、换皮肤、返回和无全体预热；真实入城确认仍由现有三项出征确认测试覆盖。

本子任务未 build、未运行全量测试、未提交；当前窗口浏览器实测由父会话统一执行。未获得真实操作下的 GPU 帧率、冷缓存首次展示时延或进程内存证据，因此本报告只承诺上述查询/解析/投机资源入口减少。
