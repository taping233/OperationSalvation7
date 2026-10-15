# 奖励／地图接班限定复核

当前源码的奖励持久化、配送互斥选择、地点按钮接线及新旧局第三层分流均已存在；本次未发现必须补接的源码缺口，未修改源码或测试。现行 `docs/rules.md` 有四处口径待主会话统一同步，已逐项通知。

## 现行文档冲突

| 位置 | 当前源码与建议口径 |
| --- | --- |
| `docs/rules.md:13` | 仍写一次性内容变空白、首脑击败变空白。当前 `game/src/core/renderer.js:325`、`game/src/core/node-info.js:29` 与预览均保留原类型，追加“已完成”和画布勾号；消耗及可通行判定未变。 |
| `docs/rules.md:9` | 仍断言层间单向且不能返回。`game/src/run/map-travel-path.js:42` 保留直接跨层邻接，`game/src/run/game.run.altar.js:185`、187 有 reverse 返回入口。应按实际有向边和闸门出口说明，不能写绝对不可返回；本次没有改地图布局。 |
| `docs/rules.md:15` | “背包已满时不复原”不够准确。`game/src/run/game.run.altar.js:106` 按 `canReceiveCard` 过滤，可接受同名未满叠；应写实际容量允许时复原，不能接收的保留口袋。 |
| `docs/rules.md:16`–20 | 仍只有单种普通敌人数量规则。应补新局第三层在既有普通档按人数许可混编，旧档缺标记继续原遭遇；实现为 `game/src/run/game.run.scenes.js:363` 和 `game/src/run/game.session.js:150`、356、476。人数、精英概率、奖励及缩放未改。 |

## 限定接线检查

- `game.boot.js` 的 sidebar 委托已消费 `button[data-route-select]`，核对当前层、迷雾、idle 与真实可达性，再调用 `showTarget`；按钮只预览，现有确认入口负责移动。`summary` 的 Enter/空格已有原生键保护。本次未构造真实输入。
- 固定奖励经 `openFixedRewardsOnCell → resumeChestsOnCell → Chests.restore`，保存既有 current.cards/taken/lost；事件选项先消耗节点，再打开固定领奖。与 `peer-review.md` 已有持久化静态复核一致。
- 配送木材分支在任何结算前执行 `canReceiveCard`，失败保持 `evtSettled=false` 并原位提示；成功分支受同一选项幂等守卫，货币与木材互斥。
- 祭坛随机卡先确定并转入固定领奖，三选一未选项及确认放弃写 lost 后持久化，批量容量失败保留待领索引。
- 第三层分支需要 `encounterRotationVersion===1`、第三层、普通 entry 与实际战斗节点序号；原 enemy 随机调用仍执行。新局置 1，保存显式写 1/0，旧档缺字段恢复 0，未新增旧地图重建路径。
- 首脑入口数值读取 MAP.rules，自动编组实现保留原有效编组并按背包补齐；基础上限与混沌之眼加成的详细口径已由 `docs/rules.md:47` 说明。

## 实际执行与证据复用

- 已读 PLAN、rewards、map、peer-review 与适用流程／质量门，完成目标 diff、关键消费点和现行规则对照；读取及搜索命令成功。
- 已运行限定路径 `npm run handoff -- --paths ...`，命令成功输出 HEAD `a330d25f47` 与相关占用／变更简报。该调用所在读取编排最终退出码 1 来自额外尝试读取不存在的 `current-window/README.md`，不是 handoff 失败；未把该文件当作证据。
- 未重跑测试：本次未改源码，`rewards.md` 的 110＋8 例及 `map.md` 的 118 例是既有通过记录，相关实现与本次静态检查一致，可继续作为原范围的定向证据；本报告不将其改写为本次新测通过，也不保证没有输入指纹的完整冻结可复用性。
- 老板最新明确“不用实页验证”，主会话已停止浏览器。本轮按实现交付、待老板验收收官；奖励满包整理／刷新续领、配送两分支、地图列表真实选择到确认、完成标记辨识、祭坛与首脑入口均不新增实页验证。源码接线静态成立不替代真实输入证据。
- 未打开浏览器、启动服务、build、提交、删除或修改共享台账／PLAN；没有新增老板决策项。
