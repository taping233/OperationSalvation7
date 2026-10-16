# 已完成祭坛的地图状态与本地入口

完成未提交，编辑已释放。祭坛仪式一次性规则与奖励回调不变；仅将真实激活/待领奖状态接入地图展示。未使用浏览器、访问玩家存档、启动服务、构建或提交；此前复原选择 UI 未改。实际画面待父任务当前窗口核验。

## 问题与修复边界

实机已完成仪式后仍显示“祭坛 / 选择能力·准备决战”，脚下“查看本地内容”可点，但只播放短转场后回地图。根因是 `isConsumedMapNode` 没有祭坛完成态，节点信息是固定文案；原 `openAltarRitual` 实际已禁止重复领奖，仅写内部日志后收尾。此次不改 flow 转场或重新打开日志面板。

生产改动仅四文件：

- `game/src/core/map-node-state.js`：祭坛按 `altarActivated && !altarRewardPending` 投影完成。visited 不是仪式完成的证据；仅道具献祭也不代表激活完成
- `game/src/core/node-info.js`：未激活说明改为“献祭激活·选择回赠”；已激活待选择回赠时显示“已激活·回赠待领取”；完成态沿现有“祭坛·已完成 / 内容已消耗”展示
- `game/src/run/expedition.view.js`：只有脚下且已完成的祭坛禁用查看，显示“本地内容已完成”；远处完成祭坛仍可进入通行，未激活/待选择回赠入口保留，其他完成节点行为不变
- `game/src/core/renderer.js`：仅道路裁剪缓存 contentKey 追加两项祭坛布尔标记，状态变化但 visited 数量不变时也会重裁道路端点；其余缓存、渲染代码不变

地图节点勾标每次绘制直接读取共用完成判断；详情缓存显式纳入脚下祭坛完成状态，并已有名称/说明依赖。保留祭坛本身类型图标，完成状态用既有勾标、名称和说明呈现，不改图源或颜色体系。

奖励②在选择时清除 altarRewardPending，并由独立的 Chests 待领快照接管，因此完成说明只表示祭坛仪式不再有可选内容，不宣称所有奖励卡均已领取。未改存档结构、领取顺序、发卡、费用或奖励数量。

## 验证

最终定向 12 文件 147 项全部通过，覆盖：

- 原地图状态“祭坛永不完成”断言改为 7 态矩阵，保留未激活可用、仅道具献祭不完成、待领奖可用、旧档无待领标记等情况
- 新增 `altar-node-completion-view.test.js`：未激活/待领/完成、离开返回、原地状态切换缓存、完成后直接进入和离开、现有多跳不穿祭坛规则、其他完成节点与层门兼容
- 新增 `altar-completion-road-cache.test.js`：运行真实 Renderer.draw，分别改变激活/待领标记且保持 visited 数量不变，确认裁剪结果更新、同状态仍复用缓存
- 旧 expedition-view、地图路径、node-flow、SYS03、祭坛保护、renderer 生命周期、辉光、契约与架构边界全部通过
- 限定 ESLint、427 文件语法、8 套类型配置、改动 whitespace 检查通过

证据：`regression-final.log`、`lint.log`、`syntax.log`、`typecheck.log`。`production.delta.diff` 是完整四文件独立增量；各文件 delta 与 SHA 见 `manifest.json`。父任务管理的 opaque 指纹未更新，待完整增量审查后统一处理。
