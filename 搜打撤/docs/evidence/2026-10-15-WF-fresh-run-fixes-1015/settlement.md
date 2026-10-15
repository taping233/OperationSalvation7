# 失败结算闭环（2026-10-15）

F12、F44、F45 的失败结算实现与定向验证已完成。当前窗口内置浏览器实页由主会话统一执行；本记录不声称视觉验收通过。

## 当前行为

- **F12 伙伴名**：失败 token 在结算前从当前绑定档位的 `Base.carriedPet()` 读取真实伙伴名，抢运标题与日志使用同一快照；无伙伴数据时用“随行伙伴”。异步提交期间改选伙伴不会改写本次归属；活动档位或绑定 Base 档位改变时，旧提交不绘制结果页。
- **F44 损失口径**：原“损失物资”改为“散装物资估值损失”，另列散装物资的名称/数量。卡牌损失继续读取死亡回执，追加资源卡散失名称/数量；安全抢运资源卡单列说明。明确估值不含卡牌，木材/口粮/钥匙资源卡入仓后需在仓库“使用”才折入基地材料；散装木材/口粮仅成功撤离时直接折入。
- **F44 计数修复**：同一牌的安全与不安全副本可能共享 card 对象；旧回执用 Set 排除对象会把所有同对象副本都排除。改为按抢运数量扣除对象副本，确保一张抢运、一张散失时损失仍为一张。死亡回执结构/版本未变。
- **F45 战斗复盘**：`game.bag.settle` 将真实 `opts.battleSummary` 与首脑标记传入失败结算。token 复制摘要，页面显示最后回合、首脑或敌人剩余生命、按来源归并的已归因生命承伤。紧邻承伤行明确记录覆盖敌人直接攻击与回合末毒/灼，卡牌自伤/反噬尚未归因。
- **F45 无摘要的结束**：主动撤离显示主动选择及失败口径；非战斗 `game.damage` 将实际受伤原因传入，来源未提供时如实提示。无摘要不推算敌人生命或承伤数据。
- **F45 熟练度**：提交前后快照只用于“本次失败结算 +N XP”，另列“当前累计进度 Lv.N：XP/升级所需”。单次跨级按升级前所需减去原XP再加升级后XP求实际本次奖励，不把当前等级内进度误称整局经验；没有整局XP来源数据时不虚构明细。
- **布局**：复盘与材料说明增加内容，失败页为结果面板设置高度上限与内部滚动，底部操作可通过滚动抵达。需主会话当前窗口核验。

## 变更路径

- `game/src/run/game.session.death.js`：伙伴/经济/摘要快照、回执副本计数、失败页与XP文案。
- `game/src/hub/game.bag.settle.js`：仅失败分支转发摘要与首脑标记。
- `game/css/expedition-rewards.css`：仅失败页滚动与复盘局部样式。
- `tests/fresh-run-settlement.test.js`、`tests/fresh-run-settlement-battle-summary.test.js`、`tests/battle-settlement-retry.test.js`：新增展示、真实战斗采集与转发断言。

第一批战斗主交互未再修改；未修改 `terminal-settlement.js`、存档版本、事务提交算法或全局遥测。

## 实际验证

1. `npx vitest run tests/fresh-run-settlement.test.js tests/terminal-death.test.js tests/terminal-settlement.test.js tests/terminal-retry-copy.test.js tests/agent-provenance-stopreason.test.js --reporter=dot`：5文件31测试通过，exit 0。
2. `npx vitest run tests/battle-settlement-retry.test.js tests/battle-settlement-recovery.test.js tests/terminal-persistence.test.js tests/terminal-recovery-matrix.test.js tests/extraction-receipt.test.js tests/xart-z1-batch2.test.js --reporter=dot`：6文件62测试通过，exit 0。故障注入测试按预期输出重试日志。
3. 新增转发断言后，`npx vitest run tests/fresh-run-settlement.test.js tests/battle-settlement-retry.test.js --reporter=dot`：2文件29测试通过，exit 0。
4. `npx vitest run tests/fresh-run-settlement-battle-summary.test.js --reporter=dot`：真实首脑战中毒2、灼烧1、敌人攻击3使6生命归零，结束回调逐项记录一致；1测试通过，exit 0。
5. 本轮两份源码和三份变更测试定向 `npx eslint`：exit 0。自有路径 `git diff --check`：exit 0。

新测试确认：共享card对象的副本损失数量、真实伙伴名、异步伙伴快照、异步切档拒绝旧页、资源卡/散装物资/估值去向、最后失败XP与累计进度、单次跨级、实际战斗摘要转发、摘要副本、无摘要时原因与数据边界。

## 当前窗口待验

- 携汪汪狗、带一张安全资源卡与一张未保护资源卡失败：伙伴标题/两张去向/散装估值分别可读。
- 首脑战败：最后回合、首脑剩余血量、承伤来源和覆盖说明清楚；面板能滚到底部，回基地/再出发可真实点击。
- 失败+5XP未跨级及跨级：本次奖励与当前累计进度各自准确。
- 主动撤离和非战斗死亡：结束原因准确，无摘要时不出现虚构首脑数据。

未运行 build、全量测试、浏览器或服务；未提交、推送。反噬/卡牌自伤的完整归因未扩入本轮，页面明确说明。
