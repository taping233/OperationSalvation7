# R5-a 地图快照交付

## 玩家结果

普通远征现在把四层节点、类型、网格坐标、连边、入口、出口与 forward door 保存为严格 canonical `mapSnapshot`。刷新恢复使用快照重建运行时派生字段，不再按当前生成器洗图。无快照旧局只接受有真实 `mapSeed|seed` 且明确为生成器 3 / 布局 9 的存档；无 seed、无版本、未知版本、坏快照、外层元数据冲突或坏位置均保留原 run 串并停在选档页。选档页有 `role=alert` 的可见错误，不进入整备。

龙巢 `nestActive===true` 继续走独立恢复，不要求普通图快照；从龙巢再读取普通图会显式清除 `nestActive`。保存前同时校验当前 `layerIdx/trackPos`，快照或位置非法时不调用 RunStorage.write，因此不会覆盖旧原串。Web Storage 写入仍走现有 RunStorage/R2 pending 守卫。

## 文件与接口

- 新增 `game/src/map-snapshot.js`：`createMapSnapshot`、`validateMapSnapshot`、`hydrateMapSnapshot`、`planMapRestore`。
- 最小修改 `game/src/game.session.js`：保存快照、纯预检、Result 读档、校验后一次性安装派生地图。
- 最小修改 `game/src/game.menu.js`：`launch` 前预检、单层 Result 判断、选档页可访问错误；失败不调用 Base.use/save 或 deploy。
- 更新 `docs/save-format.md`，区分 RunStorage 顶层可扩展与 `mapSnapshot` 严格 schema。
- 新增 `tests/r5a-map-snapshot.test.js`、`tests/r5a-session-menu.test.js`。
- `game.storage.js` 的无 Web Crypto runId 后备去掉了 `Math.random`，改为时间加进程内单调 nonce，使既有随机服务守卫恢复通过；R2 行为与测试保持不变。

快照严格拒绝未知键、非 JSON 值、重复坐标、单向/越界/重复边、没有唯一 forward door 描述的额外跨层边、未知版本和无效当前位置。顶层 snapshot 与外层 seed/generator/layout 任一显式冲突均拒绝；snapshot 不存在时才进入受限的 3/9 旧图迁移。

## 验证与边界

聚焦回归：

```text
npx vitest run tests/r5a-map-snapshot.test.js tests/r5a-session-menu.test.js tests/layered-map-generator.test.js tests/save-compat.test.js tests/node-retrigger.test.js tests/random.test.js --no-file-parallelism
# 6 files / 29 tests passed

npx vitest run tests/r2a-commands.test.js tests/r2a-recovery.test.js --no-file-parallelism
# 2 files / 22 tests passed
```

另跑 `nest-regression.test.js` 时，当前共享树有两项未归因失败（战斗未结束、心模式未扣血）；没有修改前基线，不能证明它们是既存问题，也未证明由本包引入。本包没有改战斗或龙巢规则，未将该文件冒充绿灯。

Friday 根验收已通过：根脚本对 100 个种子的 snapshot 往返零失败，根定向 5 文件 34/34。IAB 使用 QA05 正常整备，角色“无”从入口前往零基节点 3 的火堆并完成事件；整页刷新后继续同档，仍为 35/35 生命、行动 1、背包 3 格，位置仍是火堆。入口 1、物资 3、遭遇 5 三个相邻按钮及 5 个已知节点的形状与连边均一致，没有重发启程或火堆事件。证据只覆盖该实际路线与根 100 种子往返，不代表双路线已经实现。本包没有新增双路线模板、修改 3/9 生成器、经济或职业收藏规则。
