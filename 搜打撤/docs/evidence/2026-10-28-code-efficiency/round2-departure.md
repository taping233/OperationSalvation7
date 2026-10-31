# 第二轮：整备容量判断收拢

已接回中断现场，由主会话完成本批整理。`departure.summary.js` 抽出同一份选择投影：保留初始发牌、宠物转换、同名合堆、版本身份、普通格及资源格计算；完整摘要再生成卡格和来源切片，可带判断只读取容量结果。

整备渲染通过 `departurePickAvailabilities` 批量计算候选。一次同步调用内复用原 `findDepartureStack` 的解析结果，继续处理重复身份拒绝和旧名称回退；下次调用重新读取库存和选择。恢复流程仍走原锁定状态，实际点击仍重新检查当前状态。

修改 `game/src/hub/departure.summary.js`、`game/src/hub/game.hub.depart.js`，在现有 `tests/departure-summary.test.js` 增加普通/资源容量、选择变化、重复身份和库存变化的回归内容。按老板要求未执行测试或其他验收，不能把候选测试视为通过。
