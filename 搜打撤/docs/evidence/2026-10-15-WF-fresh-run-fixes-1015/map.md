# 地图说明、键盘入口与新局第三层编组

第二批源码与定向验证已完成，等待主会话使用当前窗口内置浏览器复核。未启动服务、操作浏览器、构建或提交；没有改地图设施布局、邻接约束或首脑数值。

## 实际行为

| 编号 | 修改 |
| --- | --- |
| F26 | 地图新增“本地与可达地点”原生按钮列表，含节点编号、当前位置/可前往、当前选择状态；使用与画布相同的 seen 迷雾范围，只列当前层本地及实际路径允许的地点。按钮只选择预览，仍由既有进入动作确认移动。祭坛献祭候选改为原生 button、可读名称和 aria-pressed，选后恢复到同一候选的键盘焦点。 |
| F34 | 首次显示可关闭的“地图操作与图例”，说明拖动、滚轮缩放、选点后确认、Tab/Enter/空格及默认 F/G/B；说明既有类型色、完成勾号与迷雾。关闭状态随当前 DOM 保留，后续刷新不会反复打开。原生 summary 的 Enter/空格不会被地图全局快捷键抢走。 |
| F36 | 画布节点保留原类型图标，追加完成勾号与“已完成”名称；相邻路线、预览和 hover 使用同口径。仅展示改变，内容消耗和可通行判断仍使用既有 isConsumedMapNode。 |
| F17 | 底栏消耗口袋的可访问名称改为“已消耗卡牌”，不再把不可在火堆复原的装备也称为“待复原”。 |
| F38 | 仅本次代码之后创建的新局启用第三层普通编组轮换。原精英骰、原人数掷数、原怪物表、scaledEnemy 调用和奖励档不变；从第三层既有普通池按独立种子 hash＋该层战斗节点序号轮换混编。人数 1 只有雪狼区间允许，找不到多种候选时保留原组。 |
| F39 协作 | 首脑确认入口补一段简短提示：先看意图、高伤回合用防护、对方有防护或元素庇幕时如有破甲牌可先破甲。没有假设新号必定持有破甲牌。机制文案已与战斗代理核对。 |

“同强度”依老板本轮选择解释为同一第三层普通档：允许同层既有怪物攻血分布差异，不要求每场总攻击和总生命都低于原随机组。没有新增怪物、抬高人数、改变精英概率、跨层取敌人或修改缩放。

## F38 恢复兼容

实际组怪位置是 `game.run.scenes.js/buildEncounter`，不在地图几何生成器。真实恢复链为 `loadGame → preflightRunMap/planMapRestore → hydrateMapSnapshot → installDerived`；旧 3/9 无快照档先重建，再进入同一规范化/恢复链。

`map-snapshot.js` 明确只保留 def 的 type/name/extraction，不能依赖新增 def 字段保存新局开关。因此按 R-MAP-02 批准，在 `game.session.js` 只增加三点可选 `encounterRotationVersion`：新局为 1、保存为 1/0、旧档缺字段恢复为 0。没有升级 schema、改变地图快照或重建旧档地图。

轮换 hash 使用 `mapSeed` 的独立盐，不调用 Random。运行中仍执行原遭遇随机调用，保证同输入下敌人数、精英结果以及随机流推进步数与旧分支一致。新标记读档后保留；旧快照和旧种子档即使由新代码加载，也仍走原遭遇分支。

## 路径

- `game/src/run/expedition.view.js`
- `game/src/core/node-info.js`
- `game/src/core/renderer.js`
- `game/src/core/map-node-art.js`
- `game/css/expedition-map.css`
- `game/src/game.boot.js`：R-MAP-01 批准的地点动作委托、原生键盘保护与 hover。
- `game/src/run/game.session.js`：R-MAP-02 批准的三点可选开关。
- `game/src/run/game.run.scenes.js`：第三层普通组怪分支。
- `game/src/run/game.run.altar.js`：献祭按钮语义与 F39 一段说明。
- `tests/expedition-view.test.js`
- `tests/map-node-state.test.js`
- `tests/node-retrigger.test.js`
- `tests/sys03-altar-restore-txn.test.js`
- `tests/fresh-run-map-encounters.test.js`

没有修改 `map-generator.js`、`layeredMap.js`、`mapData.js`、地图数据或全局 UI/CSS。

## 验证

最终定向命令退出码 0，10 文件、118 例通过：

```text
npm run test:target -- tests/fresh-run-map-encounters.test.js tests/expedition-view.test.js tests/node-retrigger.test.js tests/renderer-resource-lifecycle.test.js tests/render-scheduler.test.js tests/map-node-state.test.js tests/map-node-glow.test.js tests/sys03-altar-restore-txn.test.js tests/contracts.test.js tests/architecture-boundaries.test.js
```

覆盖：地点列表迷雾过滤、位置/选择语义、同状态 DOM 复用及焦点保持；帮助可关闭且不被刷新重新打开；已消耗标签；祭坛原生按钮与选择焦点；原类型完成状态；渲染缓存、空闲零绘制调度；240 个种子的编组范围、确定性、精英/人数/奖励/随机调用步数不变；连续节点编组变化；单体无替代回退；其他层不受影响。

`node-retrigger` 从真实 main、新局保存、真实 loadGame 验证：新档标记恢复为 1，旧快照缺字段及旧 3/9 种子档缺字段均恢复为 0；快照分支地图节点/定义/边/坐标保持一致。没有只用手工无字段 def 代替旧档恢复链。

相关 13 个 JS 源码/测试文件 ESLint 与本轮 diff-check 均退出码 0。运行有既有 Vitest 配置废弃提示及 jsdom 音频警告；真实 main 回归中的手动测试职业“武”有缺资产映射警告，不影响断言或退出码。

测试文件 `node-retrigger.test.js` 在真实恢复用例写入且通过后，后续补加独立 DOM 接线用例时出现工具写文件失败；已告知主会话并停止反复写入，现有用例与证据保留。地图地点点击接线的真实输入由主会话实页补验。

## 未核

当前窗口实页尚未由本代理执行：图例展开对地图/日志的遮挡、键盘列表选点到确认移动、祭坛键盘选择、完成勾号与原类型辨识、首脑简短教学及第三层混编实际战斗。主会话统一验收；本报告不宣称实页、全量或构建通过。无新增老板决策项。
