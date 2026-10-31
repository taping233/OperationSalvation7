# 第二轮：成就渲染状态收拢

已接回中断现场，由主会话完成本批整理。`hub.archive.js` 提供单次渲染的成就状态快照，每条成就读取一次解锁/领取状态并累计分类数量。`hub.archive-v3.js` 共用快照进行排序、列表呈现、筛选数量与待领取数量展示；选中项的详情复用列表模板中同一份 HTML。

下一次渲染重新读取服务，不跨次缓存状态，不执行领奖命令，不改变原成就数组顺序。原进度读取器继续按本次渲染复用。

修改 `game/src/hub/hub.archive.js`、`game/src/hub/hub.archive-v3.js`，更新 `tests/archive-progress-rendering.test.js` 的状态变化、排序、筛选数量、详情和无业务写入覆盖。按老板要求未执行测试或其他验收。
