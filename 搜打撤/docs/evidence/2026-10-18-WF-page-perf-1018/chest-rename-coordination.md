# 性能优化属地与地图语义边界

本轮三个性能子代理源码已冻结。没有修改 `game/src/core/node-info.js`、`game/src/run/map-generator-v4.js`、`map-generation-rules.js`、`map-snapshot.js`、旧地图版本判断、`tests/node-flow-confirmation.test.js`、`docs/rules.md` 或 `docs/save-format.md`。

`game.run.flow.js` 仅本轮重编候选 helper 的 import 和 eligibility 分组实现属于本轮；`runInstant` 的 chest 分支、`openResourcePick` 不属于本轮性能修改。`event-callback-lifecycle-audit.test.js` 本轮只把 B01 的旧“最多 15 张”断言同步为当前“选择 15 张”，原基线保存在 expedition/baseline。

所列宝箱名称、资源入口和地图配额语义行没有本轮在途性能修改冲突。其他会话的活跃路径继续按 PARALLEL-REGISTRY 的实际登记保护。本聊天已获老板在完成后打包提交的授权；提交前核对同文件的在途改动和 mtime，未验收的其他任务不混入提交。当前实页在5318冻结纯副本运行，不占用其他聊天的浏览器标签或5200源码验收窗口。
